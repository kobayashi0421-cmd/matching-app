'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RoomState, Player, Spectator } from './types';

export const COUNTDOWN_MS = 3000;
/** 全員が準備OKでスタートするのに必要な最低人数(1人でも試せる) */
export const MIN_PLAYERS = 1;

const ROOM_ID = 'main';
const TABLE = 'hitofude_room';
const LOCAL_KEY = 'hitofude_room_state_v3';
const LOCAL_CHANNEL = 'hitofude_room_channel_v3';

// ------------------------------------------------------------
// 状態ヘルパー
// ------------------------------------------------------------

export function createInitialState(): RoomState {
  return {
    status: 'lobby',
    players: [],
    spectators: [],
    kickedPlayerIds: [],
    lastUpdated: 0,
  };
}

function normalize(raw: unknown): RoomState {
  const base = createInitialState();
  if (raw && typeof raw === 'object') return { ...base, ...(raw as Partial<RoomState>) };
  return base;
}

/**
 * countdown の startAt を過ぎていたら in_game として扱う。
 * タイマーで状態を書き換えず、各クライアントが時刻から計算するので、
 * 管理者がタブを閉じてもゲームは止まらない。
 */
export function resolveState(s: RoomState, now: number): RoomState {
  if (s.status === 'countdown' && s.startAt !== undefined && now >= s.startAt) {
    return { ...s, status: 'in_game' };
  }
  return s;
}

/** 走っている人が誰もいなくなったら finished にする */
function settle(s: RoomState): RoomState {
  if (s.status !== 'in_game') return s;
  const stillPlaying = s.players.some((p) => p.status === 'playing' && !p.left);
  return stillPlaying ? s : { ...s, status: 'finished' };
}

/** ロビーで全員が「準備OK」になったらカウントダウンを始める */
function maybeStart(s: RoomState, now: number): RoomState {
  if (s.status !== 'lobby') return s;
  if (s.players.length < MIN_PLAYERS || !s.players.every((p) => p.status === 'ready')) return s;
  return {
    ...s,
    status: 'countdown',
    startAt: now + COUNTDOWN_MS,
    players: s.players.map((p) => ({
      ...p,
      status: 'playing' as const,
      currentQuestion: 1,
      questionTimes: [],
      totalTimeMs: undefined,
      finishTime: undefined,
      left: false,
    })),
  };
}

/** 管理者がいないので、放置された部屋は次に来た人のときに自動で初期化する */
export function isRoomStale(s: RoomState, now: number): boolean {
  if (s.status === 'in_game') return now - s.lastUpdated > 15 * 60 * 1000;
  if (s.status === 'finished') return now - s.lastUpdated > 5 * 60 * 1000;
  return false;
}

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

// ------------------------------------------------------------
// バックエンド(Supabase / localStorage)
// ------------------------------------------------------------

interface Snapshot {
  state: RoomState;
  version: number;
}

type SaveResult = { ok: true } | { ok: false; current: Snapshot };

interface Backend {
  now(): number;
  init(): Promise<void>;
  load(): Promise<Snapshot>;
  /** expected と version が一致するときだけ書き込む(楽観ロック) */
  save(state: RoomState, expected: number): Promise<SaveResult>;
  subscribe(cb: (snap: Snapshot) => void): () => void;
}

/** 同じブラウザ内のタブ間だけで動く開発用バックエンド */
class LocalBackend implements Backend {
  private channel: BroadcastChannel | null = null;

  now() {
    return Date.now();
  }

  async init() {}

  private read(): Snapshot {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { state: normalize(p.state), version: Number(p.version) || 0 };
      }
    } catch (e) {
      console.error('Failed to read local room state:', e);
    }
    return { state: createInitialState(), version: 0 };
  }

  async load() {
    return this.read();
  }

  async save(state: RoomState, expected: number): Promise<SaveResult> {
    const cur = this.read();
    if (cur.version !== expected) return { ok: false, current: cur };
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ state, version: expected + 1 }));
    try {
      this.channel?.postMessage('changed');
    } catch {}
    return { ok: true };
  }

  subscribe(cb: (snap: Snapshot) => void) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(LOCAL_CHANNEL);
      this.channel.onmessage = () => cb(this.read());
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY) cb(this.read());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      this.channel?.close();
      this.channel = null;
    };
  }
}

/** 端末をまたいで動く本番用バックエンド(Supabase Realtime + 楽観ロック) */
class SupabaseBackend implements Backend {
  private client: SupabaseClient;
  private offset = 0; // サーバー時刻 - 端末時刻

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  now() {
    return Date.now() + this.offset;
  }

  async init() {
    try {
      const t0 = Date.now();
      const { data, error } = await this.client.rpc('hitofude_now');
      const t1 = Date.now();
      if (!error && data != null) this.offset = Number(data) - (t0 + t1) / 2;
    } catch (e) {
      console.warn('Server clock sync failed, using device clock:', e);
    }
  }

  async load(): Promise<Snapshot> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('state, version')
      .eq('id', ROOM_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      // 行がまだ無ければ作る(既にあれば何もしない)
      await this.client
        .from(TABLE)
        .upsert({ id: ROOM_ID, state: createInitialState(), version: 0 }, { onConflict: 'id', ignoreDuplicates: true });
      const retry = await this.client.from(TABLE).select('state, version').eq('id', ROOM_ID).maybeSingle();
      if (retry.error || !retry.data) throw retry.error ?? new Error('room row not found');
      return { state: normalize(retry.data.state), version: Number(retry.data.version) };
    }
    return { state: normalize(data.state), version: Number(data.version) };
  }

  async save(state: RoomState, expected: number): Promise<SaveResult> {
    const { data, error } = await this.client
      .from(TABLE)
      .update({ state, version: expected + 1, updated_at: new Date().toISOString() })
      .eq('id', ROOM_ID)
      .eq('version', expected)
      .select('version');
    if (error) throw error;
    if (data && data.length > 0) return { ok: true };
    return { ok: false, current: await this.load() };
  }

  subscribe(cb: (snap: Snapshot) => void) {
    const refetch = () => {
      this.load().then(cb).catch(() => {});
    };

    const channel = this.client
      .channel('hitofude-room')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${ROOM_ID}` },
        (payload) => {
          const row = payload.new as { state?: unknown; version?: number | string };
          if (row?.state) cb({ state: normalize(row.state), version: Number(row.version) });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch();
      });

    // 取りこぼし対策: 定期ポーリングと、タブが戻ったときの再取得
    const poll = setInterval(refetch, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      this.client.removeChannel(channel);
    };
  }
}

// ------------------------------------------------------------
// ストア本体
// ------------------------------------------------------------

type Listener = (state: RoomState, ready: boolean) => void;

class HitofudeStore {
  private state: RoomState = createInitialState();
  private version = -1;
  private ready = false;
  private listeners = new Set<Listener>();
  private backend: Backend | null = null;
  private bootPromise: Promise<void> | null = null;

  /** サーバー時刻(取れなければ端末時刻)。アロー関数なので props にそのまま渡せる */
  serverNow = (): number => (this.backend ? this.backend.now() : Date.now());

  getState(): RoomState {
    return this.state;
  }

  isReady(): boolean {
    return this.ready;
  }

  subscribe(listener: Listener): () => void {
    this.start();
    this.listeners.add(listener);
    listener(this.state, this.ready);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private start() {
    if (this.bootPromise || typeof window === 'undefined') return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const backend: Backend = url && key ? new SupabaseBackend(url, key) : new LocalBackend();
    this.backend = backend;

    this.bootPromise = (async () => {
      try {
        await backend.init();
        this.apply(await backend.load());
      } catch (e) {
        console.error('Failed to load room state:', e);
      }
      this.ready = true;
      this.notify();
      backend.subscribe((snap) => this.apply(snap));
    })();
  }

  private apply(snap: Snapshot) {
    if (snap.version < this.version) return; // 古い通知は無視
    this.state = snap.state;
    this.version = snap.version;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state, this.ready));
  }

  /**
   * 状態を読み → 変更 → 楽観ロックつきで保存。
   * 他の端末と同時に書き込んで衝突したら、最新を読み直してやり直す。
   * fn が null を返したら「何もしない」(条件を満たさなかった)。
   */
  private async mutate(fn: (s: RoomState, now: number) => RoomState | null): Promise<boolean> {
    this.start();
    await this.bootPromise;
    const backend = this.backend;
    if (!backend) return false;

    try {
      for (let i = 0; i < 8; i++) {
        const now = backend.now();
        const next = fn(resolveState(this.state, now), now);
        if (!next) return false;

        const stamped: RoomState = { ...next, lastUpdated: now };
        const res = await backend.save(stamped, this.version);
        if (res.ok) {
          this.apply({ state: stamped, version: this.version + 1 });
          return true;
        }
        this.apply(res.current);
      }
    } catch (e) {
      console.error('Failed to save room state:', e);
    }
    return false;
  }

  // --- ACTIONS ---

  /** ロビー以外では参加できない。失敗時は null */
  public async joinPlayer(name: string, avatar: string, color: string): Promise<Player | null> {
    const player: Player = {
      id: newId('player'),
      name: name.trim() || '名無しのチャレンジャー',
      avatar: avatar || '⚡',
      color: color || '#3b82f6',
      status: 'waiting',
      currentQuestion: 1,
      questionTimes: [],
      joinedAt: Date.now(),
    };
    const ok = await this.mutate((s, now) => {
      const base = isRoomStale(s, now) ? { ...createInitialState(), spectators: s.spectators } : s;
      if (base.status !== 'lobby') return null;
      return { ...base, players: [...base.players, player] };
    });
    return ok ? player : null;
  }

  public async joinSpectator(name: string): Promise<Spectator | null> {
    const spectator: Spectator = {
      id: newId('spec'),
      name: name.trim() || '匿名観戦者',
      joinedAt: Date.now(),
    };
    const ok = await this.mutate((s) => ({ ...s, spectators: [...s.spectators, spectator] }));
    return ok ? spectator : null;
  }

  public async leaveSpectator(id: string) {
    await this.mutate((s) => ({ ...s, spectators: s.spectators.filter((x) => x.id !== id) }));
  }

  /** ロビーで「準備OK」を押す/取り消す。全員OKになった瞬間にカウントダウン開始 */
  public async setReady(playerId: string, ready: boolean) {
    await this.mutate((s, now) => {
      if (s.status !== 'lobby') return null;
      if (!s.players.some((p) => p.id === playerId)) return null;
      const players = s.players.map((p) =>
        p.id === playerId ? { ...p, status: ready ? ('ready' as const) : ('waiting' as const) } : p
      );
      return maybeStart({ ...s, players }, now);
    });
  }

  public async recordQuestionCompletion(playerId: string, questionIndex: number, durationMs: number) {
    await this.mutate((s, now) => {
      if (s.status !== 'in_game') return null;
      const me = s.players.find((p) => p.id === playerId);
      if (!me || me.status !== 'playing' || me.currentQuestion !== questionIndex) return null;

      const players = s.players.map((p) => {
        if (p.id !== playerId) return p;
        const questionTimes = [...p.questionTimes];
        questionTimes[questionIndex - 1] = durationMs;
        const isFinished = questionIndex >= 5;
        return {
          ...p,
          currentQuestion: isFinished ? 5 : questionIndex + 1,
          questionTimes,
          status: isFinished ? ('finished' as const) : p.status,
          finishTime: isFinished ? now : p.finishTime,
          totalTimeMs: isFinished ? now - (s.startAt ?? now) : p.totalTimeMs,
        };
      });
      return settle({ ...s, players });
    });
  }

  /**
   * ロビーなら名簿から外す(残りが全員準備OKならそのままスタート)。
   * 対戦後は記録を残して left にするだけ。全員が抜けたら部屋を初期化する。
   */
  public async leavePlayer(id: string) {
    await this.mutate((s, now) => {
      if (!s.players.some((p) => p.id === id)) return null;
      if (s.status === 'lobby') {
        return maybeStart({ ...s, players: s.players.filter((p) => p.id !== id) }, now);
      }
      const players = s.players.map((p) => (p.id === id ? { ...p, left: true } : p));
      if (players.every((p) => p.left)) return { ...createInitialState(), spectators: s.spectators };
      return settle({ ...s, players });
    });
  }
}

export const hitofudeStore = new HitofudeStore();
