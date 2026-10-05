'use client';

import '../hitofude/hitofude.css';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RoomState } from '../hitofude/types';
import { hitofudeStore, resolveState } from '../hitofude/store';
import { formatDuration } from '../hitofude/format';

/** 任意: .env に NEXT_PUBLIC_KANRI_PASS を入れると合言葉が必要になる(簡易ロックなので本格的な防御ではありません) */
const PASS = process.env.NEXT_PUBLIC_KANRI_PASS;

const STATUS_LABEL: Record<RoomState['status'], string> = {
  lobby: '⏳ 待機中',
  countdown: '3…2…1 カウントダウン',
  in_game: '🔥 ゲーム進行中',
  finished: '🏆 終了',
};

export default function KanriPage() {
  const [roomState, setRoomState] = useState<RoomState>(hitofudeStore.getState());
  const [, setTick] = useState(0);
  const [authed, setAuthed] = useState(!PASS);
  const [input, setInput] = useState('');

  useEffect(() => hitofudeStore.subscribe((s) => setRoomState(s)), []);
  // カウントダウン→対戦中の切り替わりを表示に反映
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const state = resolveState(roomState, hitofudeStore.serverNow());
  const players = state.players.filter((p) => p.status !== 'kicked');
  const kicked = state.players.filter((p) => p.status === 'kicked');

  if (!authed) {
    return (
      <div className="hf-root min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-extrabold mb-4">👑 管理画面</h1>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="合言葉"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl mb-4 text-slate-100"
          />
          <button
            onClick={() => input === PASS && setAuthed(true)}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold"
          >
            入る
          </button>
        </div>
      </div>
    );
  }

  const kick = (id: string, name: string) => {
    if (window.confirm(`「${name}」を強制退出させますか？`)) void hitofudeStore.kickPlayer(id);
  };

  return (
    <div className="hf-root min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <span className="font-extrabold text-amber-300">👑 一筆書き競争 管理画面</span>
          <Link
            href="/hitofude"
            className="text-xs font-bold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            ゲーム画面へ →
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 mb-1">ルームの状態</div>
            <div className="text-xl font-extrabold">{STATUS_LABEL[state.status]}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 mb-1">プレイヤー / 観戦者</div>
            <div className="text-xl font-extrabold text-indigo-400">
              {players.length} 名 <span className="text-sm text-slate-400 font-normal">/ {state.spectators.length} 名</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-center">
            {state.status === 'in_game' && (
              <button
                onClick={() => {
                  if (window.confirm('走っている人がいても対戦を終了して順位表を出します。よろしいですか？'))
                    void hitofudeStore.forceEnd();
                }}
                className="py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-bold"
              >
                🏁 強制終了して結果を出す
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('ルームを初期化します(参加者は全員ロビーに戻されます)。よろしいですか？'))
                  void hitofudeStore.resetRoom();
              }}
              className="py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-sm font-bold"
            >
              🔄 ルームをリセット
            </button>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
            <span>参加者</span>
            <span className="text-xs text-emerald-400 font-normal">ライブ同期中 🟢</span>
          </h2>

          {players.length === 0 ? (
            <div className="text-center py-10 text-slate-500">参加中のプレイヤーはいません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="p-3">プレイヤー</th>
                    <th className="p-3">状態</th>
                    <th className="p-3">進行</th>
                    <th className="p-3">タイム</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {players.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.avatar}
                          </div>
                          <span className="font-bold">{p.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">
                        {p.status === 'waiting' && '準備中'}
                        {p.status === 'ready' && <span className="text-emerald-400">準備OK</span>}
                        {p.status === 'playing' && <span className="text-blue-300">挑戦中</span>}
                        {p.status === 'finished' && <span className="text-emerald-300 font-bold">完走 🎉</span>}
                        {p.left && <span className="text-slate-500">（退出済み）</span>}
                      </td>
                      <td className="p-3 text-slate-300">
                        {p.status === 'finished' ? '5 / 5' : `問 ${p.currentQuestion} / 5`}
                      </td>
                      <td className="p-3 font-mono text-indigo-300 font-bold">{formatDuration(p.totalTimeMs)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => kick(p.id, p.name)}
                          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                        >
                          🚫 強制退出
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {kicked.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="text-xs font-bold text-rose-400 mb-2">強制退出済み ({kicked.length})</div>
              <div className="flex flex-wrap gap-2">
                {kicked.map((k) => (
                  <span key={k.id} className="px-3 py-1 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-lg">
                    🚫 {k.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
