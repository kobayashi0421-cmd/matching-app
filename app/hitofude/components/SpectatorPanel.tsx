'use client';

import React from 'react';
import { RoomState } from '../types';

interface SpectatorPanelProps {
  roomState: RoomState;
  onExitSpectator: () => void;
}

export const SpectatorPanel: React.FC<SpectatorPanelProps> = ({ roomState, onExitSpectator }) => {
  const activePlayers = roomState.players.filter((p) => p.status !== 'kicked');

  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--.--';
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${min}:${sec < 10 ? '0' : ''}${sec}.${hundredths < 10 ? '0' : ''}${hundredths}`;
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold mb-2">
              👁️ 観戦・視聴モード
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100">一筆書き競争 ライブ中継</h1>
            <p className="text-slate-400 text-sm mt-1">
              チャレンジャーたちの進行状況とクリアタイムをリアルタイムで観戦できます！
            </p>
          </div>

          <button
            onClick={onExitSpectator}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition-all border border-slate-700"
          >
            観戦を終了する
          </button>
        </div>

        {/* Live Status indicator */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold text-slate-200">
              {roomState.status === 'lobby' && '待機室（管理者のスタート待ち）'}
              {roomState.status === 'countdown' && '3秒カウントダウン進行中...'}
              {roomState.status === 'in_game' && '対戦中（リアルタイム進行中）'}
              {roomState.status === 'finished' && 'レース終了！最終結果発表'}
            </span>
          </div>

          <div className="text-xs text-slate-400">
            参加者: <strong className="text-indigo-400 text-sm">{activePlayers.length}</strong> 名
          </div>
        </div>
      </div>

      {/* Live Players Progress Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-200 flex items-center justify-between px-2">
          <span>チャレンジャーの進行状況</span>
          <span className="text-xs text-emerald-400 font-normal">LIVE 🟢</span>
        </h2>

        {activePlayers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900/60 rounded-3xl border border-slate-800">
            現在プレイ中のプレイヤーはいません。
          </div>
        ) : (
          activePlayers.map((p) => {
            const progressPercent = ((p.status === 'finished' ? 5 : p.currentQuestion - 1) / 5) * 100;

            return (
              <div
                key={p.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/10"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.avatar}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-base">{p.name}</h3>
                    <div className="text-xs text-slate-400">
                      {p.status === 'finished' ? (
                        <span className="text-emerald-400 font-bold">🎉 全5問クリア！</span>
                      ) : p.status === 'playing' ? (
                        <span className="text-indigo-400">第 {p.currentQuestion} / 5 問に挑戦中</span>
                      ) : (
                        <span className="text-amber-400">待機中</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-bold">
                    <span>達成度</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="text-right min-w-[120px]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TIME</div>
                  <div className="font-mono text-lg font-extrabold text-indigo-300">
                    {formatDuration(p.totalTimeMs)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
