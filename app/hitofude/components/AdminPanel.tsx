'use client';

import React from 'react';
import { RoomState } from '../types';

interface AdminPanelProps {
  roomState: RoomState;
  onKickPlayer: (playerId: string) => void;
  onStartGame: () => void;
  onResetRoom: () => void;
  onExitAdmin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  roomState,
  onKickPlayer,
  onStartGame,
  onResetRoom,
  onExitAdmin,
}) => {
  const activePlayers = roomState.players.filter((p) => p.status !== 'kicked');
  const kickedPlayers = roomState.players.filter((p) => p.status === 'kicked');

  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--.--';
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${min}:${sec < 10 ? '0' : ''}${sec}.${hundredths < 10 ? '0' : ''}${hundredths}`;
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8">
      {/* Admin Title Card */}
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold mb-2">
              👑 管理者ダッシュボード
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100">対戦ルーム リアルタイム管理画面</h1>
            <p className="text-slate-400 text-sm mt-1">
              参加者のリアルタイム追放(キック)、対戦スタート、ルーム状態のリセットを行えます。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExitAdmin}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition-all border border-slate-700"
            >
              管理者画面を閉じる
            </button>

            <button
              onClick={onResetRoom}
              className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl font-semibold text-sm transition-all"
            >
              🔄 ルームリセット
            </button>
          </div>
        </div>

        {/* Room Status Summary & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">現在のルームステータス</div>
            <div className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
              {roomState.status === 'lobby' && <span className="text-amber-400">⏳ 待機中 (Lobby)</span>}
              {roomState.status === 'countdown' && <span className="text-blue-400">3...2...1 カウントダウン</span>}
              {roomState.status === 'in_game' && <span className="text-emerald-400 animate-pulse">🔥 ゲーム進行中</span>}
              {roomState.status === 'finished' && <span className="text-purple-400">🏆 全員終了</span>}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">接続中のプレイヤー</div>
            <div className="text-2xl font-extrabold text-indigo-400">
              {activePlayers.length} 名
              <span className="text-xs text-slate-400 font-normal ml-2">
                (観戦者: {roomState.spectators.length} 名)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-indigo-500/30 rounded-2xl p-5 flex items-center justify-center">
            {roomState.status === 'lobby' ? (
              <button
                onClick={onStartGame}
                disabled={activePlayers.length === 0}
                className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                  activePlayers.length > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-600/30 hover:scale-105 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>🚀</span> スタートを押す
              </button>
            ) : (
              <div className="text-center text-sm font-semibold text-slate-300">
                {roomState.status === 'in_game' ? '対戦が進行しています' : '対戦が完了しました'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Players Management Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center justify-between">
          <span>参加者リスト & リアルタイム操作</span>
          <span className="text-xs text-emerald-400 font-normal">ライブ同期中 🟢</span>
        </h2>

        {activePlayers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            現在エントリー中のプレイヤーはいません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4 rounded-l-xl">プレイヤー</th>
                  <th className="p-4">ステータス</th>
                  <th className="p-4">現在進行</th>
                  <th className="p-4">タイム</th>
                  <th className="p-4 rounded-r-xl text-right">キック操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activePlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-inner"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.avatar}
                        </div>
                        <span className="font-bold text-slate-100">{p.name}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      {p.status === 'waiting' && (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          待機中
                        </span>
                      )}
                      {p.status === 'playing' && (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
                          挑戦中
                        </span>
                      )}
                      {p.status === 'finished' && (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          完走 🎉
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-slate-200">
                        {p.status === 'finished' ? '5 / 5 クリア' : `問 ${p.currentQuestion} / 5`}
                      </span>
                    </td>

                    <td className="p-4 font-mono text-indigo-300 font-bold">
                      {formatDuration(p.totalTimeMs)}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => onKickPlayer(p.id)}
                        className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-600/20 hover:scale-105 active:scale-95 flex items-center gap-1 ml-auto"
                      >
                        <span>🚫</span> 蹴る (キック)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kicked log */}
        {kickedPlayers.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3">
              キック(追放)済みアカウント ({kickedPlayers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {kickedPlayers.map((kp) => (
                <span
                  key={kp.id}
                  className="px-3 py-1 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-lg flex items-center gap-1.5"
                >
                  <span>🚫</span> {kp.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
