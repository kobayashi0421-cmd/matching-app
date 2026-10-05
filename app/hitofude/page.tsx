'use client';

import './hitofude.css';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { RoomState } from './types';
import { PUZZLES } from './puzzles';
import { hitofudeStore, resolveState, isRoomStale } from './store';
import { Lobby } from './components/Lobby';
import { SpectatorPanel } from './components/SpectatorPanel';
import { PuzzleCanvas } from './components/PuzzleCanvas';
import { Leaderboard } from './components/Leaderboard';

const SESSION_KEY = 'hitofude_session_v1';

interface Session {
  role: 'player' | 'spectator' | null;
  playerId?: string;
  spectatorId?: string;
}

export default function HitofudeGamePage() {
  const [roomState, setRoomState] = useState<RoomState>(hitofudeStore.getState());
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session>({ role: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const restored = useRef(false);
  const [local, setLocal] = useState<{ start?: number; q: number }>({ q: 1 });
  const syncChain = useRef<Promise<void>>(Promise.resolve());

  // ストアの購読(1回だけ)
  useEffect(() => {
    return hitofudeStore.subscribe((s, r) => {
      setRoomState(s);
      setReady(r);
    });
  }, []);

  const updateSession = (next: Session) => {
    setSession(next);
    try {
      if (next.role) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  // リロード後の復帰(初回の状態取得が終わってから1回だけ)
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Session;
      if (s.role === 'player' && s.playerId && roomState.players.some((p) => p.id === s.playerId)) {
        setSession(s);
      } else if (s.role === 'spectator' && s.spectatorId) {
        setSession(s);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }, [ready, roomState]);

  // ルームがリセットされて自分の記録が消えたらロビーに戻す
  const currentPlayer =
    session.role === 'player' ? roomState.players.find((p) => p.id === session.playerId) ?? null : null;
  useEffect(() => {
    if (ready && restored.current && session.role === 'player' && !currentPlayer) {
      updateSession({ role: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session.role, currentPlayer]);

  // countdown 中だけ再描画して残り秒数を出す(状態は書き換えない)
  const state = resolveState(roomState, hitofudeStore.serverNow());
  const counting = state.status === 'countdown';
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [counting]);

  // --- handlers ---
  const handleJoinAsPlayer = async (name: string, avatar: string, color: string) => {
    setNotice(null);
    const player = await hitofudeStore.joinPlayer(name, avatar, color);
    if (!player) {
      setNotice('対戦がすでに始まっているため、プレイヤーとしては参加できません。観戦モードでご覧ください。');
      return;
    }
    updateSession({ role: 'player', playerId: player.id });
  };

  const handleJoinAsSpectator = async (name: string) => {
    setNotice(null);
    const spectator = await hitofudeStore.joinSpectator(name);
    if (spectator) updateSession({ role: 'spectator', spectatorId: spectator.id });
  };

  const handleExitSpectator = () => {
    const id = session.spectatorId;
    updateSession({ role: null });
    if (id) void hitofudeStore.leaveSpectator(id);
  };

  const handleLeave = () => {
    const id = session.playerId;
    updateSession({ role: null });
    if (id) void hitofudeStore.leavePlayer(id);
  };

  const handleToggleReady = () => {
    if (!currentPlayer) return;
    void hitofudeStore.setReady(currentPlayer.id, currentPlayer.status !== 'ready');
  };

  // この端末で解けた問題の番号。サーバー保存を待たず、正解したらすぐ次の問題へ進むために使う
  const localQ = local.start === state.startAt ? local.q : 1;
  const displayQ = currentPlayer ? Math.max(currentPlayer.currentQuestion, localQ) : 1;
  const doneLocally = displayQ > 5;

  const handleCompleteQuestion = (questionIndex: number, durationMs: number) => {
    if (!currentPlayer) return;
    const id = currentPlayer.id;
    const start = state.startAt;
    // 1. 画面はすぐ次の問題へ(第5問なら結果画面へ)
    setLocal((prev) => {
      const base = prev.start === start ? prev.q : 1;
      return { start, q: Math.max(base, questionIndex + 1) };
    });
    // 2. 保存は裏で、問題の順番どおりに。失敗したら最大4回やり直す
    syncChain.current = syncChain.current.then(async () => {
      for (let i = 0; i < 4; i++) {
        await hitofudeStore.recordQuestionCompletion(id, questionIndex, durationMs);
        const me = hitofudeStore.getState().players.find((p) => p.id === id);
        if (!me || me.status !== 'playing' || me.currentQuestion !== questionIndex) return;
        await new Promise((r) => setTimeout(r, 600));
      }
    });
  };

  const remainingSec = Math.max(1, Math.ceil(((state.startAt ?? 0) - hitofudeStore.serverNow()) / 1000));
  const canJoin = state.status === 'lobby' || isRoomStale(state, hitofudeStore.serverNow());

  return (
    <div className="hf-root min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5"
            >
              <span>←</span> アプリホームへ
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span className="font-extrabold text-slate-100 text-base tracking-tight hidden sm:inline">
                一筆書き競争
              </span>
            </div>
          </div>

          {session.role && (
            <div className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border bg-slate-900 border-slate-800">
              {session.role === 'spectator' && <span className="text-indigo-400">👁️ 観戦モード</span>}
              {session.role === 'player' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span>🎮</span> {currentPlayer?.name || 'プレイヤー'}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center">
        {session.role === 'spectator' ? (
          <SpectatorPanel roomState={state} onExitSpectator={handleExitSpectator} />
        ) : session.role === 'player' && currentPlayer ? (
          <>
            {(currentPlayer.status === 'kicked' || state.status === 'lobby') && (
              <Lobby
                roomState={state}
                onJoinAsPlayer={handleJoinAsPlayer}
                onJoinAsSpectator={handleJoinAsSpectator}
                onToggleReady={handleToggleReady}
                currentPlayer={currentPlayer}
                userRole="player"
                onLeave={handleLeave}
              />
            )}

            {currentPlayer.status !== 'kicked' && state.status === 'countdown' && (
              <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center text-center p-6">
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 animate-bounce mb-6 font-mono">
                  {remainingSec}
                </div>
                <h2 className="text-3xl font-extrabold text-slate-100">準備してください！</h2>
                <p className="text-indigo-300 text-sm mt-2">全5問の数字つなぎが始まります！</p>
              </div>
            )}

            {currentPlayer.status !== 'kicked' && state.status === 'in_game' &&
              (currentPlayer.status === 'finished' || doneLocally ? (
                <Leaderboard roomState={state} onBackToLobby={handleLeave} />
              ) : (
                <PuzzleCanvas
                  key={displayQ}
                  puzzle={PUZZLES[Math.min(displayQ - 1, PUZZLES.length - 1)]}
                  questionIndex={displayQ}
                  gameStartTime={state.startAt ?? hitofudeStore.serverNow()}
                  getNow={hitofudeStore.serverNow}
                  onCompleteQuestion={handleCompleteQuestion}
                />
              ))}

            {currentPlayer.status !== 'kicked' && state.status === 'finished' && <Leaderboard roomState={state} onBackToLobby={handleLeave} />}
          </>
        ) : (
          <Lobby
            roomState={state}
            onJoinAsPlayer={handleJoinAsPlayer}
            onJoinAsSpectator={handleJoinAsSpectator}
            onToggleReady={handleToggleReady}
            currentPlayer={null}
            userRole={null}
            onLeave={handleLeave}
            notice={notice}
            canJoin={canJoin}
          />
        )}
      </main>

      <footer className="w-full border-t border-slate-900 bg-slate-950 text-slate-500 text-xs py-4 text-center">
        一筆書き競争ゲーム • Real-time Multiplayer One-Stroke Puzzle Race
      </footer>
    </div>
  );
}
