'use client';

import React from 'react';
import { Player, RoomState } from '../types';

interface LeaderboardProps {
  roomState: RoomState;
  onBackToLobby: () => void;
  onResetRoom?: () => void;
  isAdmin?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  roomState,
  onBackToLobby,
  onResetRoom,
  isAdmin = false,
}) => {
  // Sort players: finished first by totalTimeMs ascending, then unfinished
  const sortedPlayers = [...roomState.players]
    .filter((p) => p.status !== 'kicked')
    .sort((a, b) => {
      if (a.status === 'finished' && b.status !== 'finished') return -1;
      if (a.status !== 'finished' && b.status === 'finished') return 1;
      if (a.status === 'finished' && b.status === 'finished') {
        return (a.totalTimeMs || Infinity) - (b.totalTimeMs || Infinity);
      }
      return b.currentQuestion - a.currentQuestion;
    });

  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--.--';
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${min}:${sec < 10 ? '0' : ''}${sec}.${hundredths < 10 ? '0' : ''}${hundredths}`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-3xl">🥇</span>;
    if (rank === 2) return <span className="text-3xl">🥈</span>;
    if (rank === 3) return <span className="text-3xl">🥉</span>;
    return <span className="text-lg font-bold text-slate-400">#{rank}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Winner Hero Header */}
      <div className="bg-gradient-to-br from-indigo-900/90 via-purple-950/80 to-slate-900/95 border border-indigo-500/40 rounded-3xl p-8 md:p-10 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-sm font-extrabold mb-4">
          🏆 GAME SET! 最終結果発表
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 tracking-tight">
          一筆書き競争 ランキング
        </h1>
        <p className="mt-2 text-slate-300 text-sm max-w-lg mx-auto">
          全5問の一筆書きパズルを制制した最速プレイヤーたちが勢揃い！
        </p>

        {/* 1st Place Highlight */}
        {sortedPlayers.length > 0 && sortedPlayers[0].status === 'finished' && (
          <div className="mt-8 bg-slate-950/80 border border-amber-500/50 rounded-2xl p-6 max-w-md mx-auto shadow-2xl relative">
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-xs px-4 py-1 rounded-full shadow-lg border border-amber-300 uppercase tracking-widest">
              CHAMPION 👑
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 border-amber-400"
                style={{ backgroundColor: sortedPlayers[0].color }}
              >
                {sortedPlayers[0].avatar}
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-slate-100">{sortedPlayers[0].name}</h3>
                <div className="font-mono text-xl font-extrabold text-amber-400 mt-1">
                  ⏱️ {formatDuration(sortedPlayers[0].totalTimeMs)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center justify-between">
          <span>順位一覧 (タイムが早い順)</span>
          <span className="text-xs text-indigo-400 font-normal">全 {sortedPlayers.length} 名</span>
        </h2>

        <div className="space-y-3">
          {sortedPlayers.map((p, index) => {
            const rank = index + 1;
            const isFinished = p.status === 'finished';

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                  rank === 1
                    ? 'bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : rank === 2
                    ? 'bg-slate-800/60 border-slate-600'
                    : rank === 3
                    ? 'bg-amber-900/15 border-amber-700/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4 min-w-[220px]">
                  <div className="w-10 text-center flex justify-center">{getRankBadge(rank)}</div>
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/10"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.avatar}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                      {p.name}
                      {isFinished && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold">
                          完走
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {isFinished ? '全5問クリア' : `問 ${p.currentQuestion} で終了`}
                    </div>
                  </div>
                </div>

                {/* Per question time breakdown pills */}
                {isFinished && p.questionTimes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {p.questionTimes.map((t, qIdx) => (
                      <span
                        key={qIdx}
                        className="px-2 py-1 bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 rounded-lg"
                      >
                        Q{qIdx + 1}: {formatDuration(t)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Total time */}
                <div className="text-right min-w-[130px] ml-auto">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TOTAL TIME</div>
                  <div className="font-mono text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                    {formatDuration(p.totalTimeMs)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onBackToLobby}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95"
          >
            🏠 ロビーへ戻る
          </button>

          {isAdmin && onResetRoom && (
            <button
              onClick={onResetRoom}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-bold transition-all"
            >
              🔄 ルームをリセットして再戦
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
