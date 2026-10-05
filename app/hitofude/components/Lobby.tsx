'use client';

import React, { useState } from 'react';
import { Player, RoomState, UserRole } from '../types';

interface LobbyProps {
  roomState: RoomState;
  onJoinAsPlayer: (name: string, avatar: string, color: string) => void;
  onJoinAsSpectator: (name: string) => void;
  onToggleReady: () => void;
  currentPlayer: Player | null;
  userRole: UserRole;
  onLeave: () => void;
  notice?: string | null;
  canJoin?: boolean;
}

const AVATARS = ['🔥', '⚡', '🎯', '🚀', '👑', '🐱', '🦊', '🐉', '💎', '🌸'];
const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

export const Lobby: React.FC<LobbyProps> = ({
  roomState,
  onJoinAsPlayer,
  onJoinAsSpectator,
  onToggleReady,
  currentPlayer,
  userRole,
  onLeave,
  notice = null,
  canJoin = true,
}) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚡');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const activePlayers = roomState.players.filter((p) => p.status !== 'kicked');
  const isKicked = currentPlayer && currentPlayer.status === 'kicked';
  const iAmReady = currentPlayer?.status === 'ready';
  const readyCount = activePlayers.filter((p) => p.status === 'ready').length;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold mb-4 backdrop-blur-md">
          <span className="animate-pulse">✨</span> リアルタイム対戦 一筆書きスピードレース
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight">
          一筆書き競争ゲーム
        </h1>
        <p className="mt-3 text-slate-400 text-base max-w-xl mx-auto">
          5問の図形パズルを最も速くなぞりきるのは誰だ！？<br />
          プレイヤーとして参加するか、視聴・観戦者として楽しもう！
        </p>
      </div>

      {/* Main Container */}
      {!userRole || (userRole === 'spectator' && !currentPlayer) ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-6 flex items-center justify-center gap-2">
            <span>🚀</span> エントリー設定
          </h2>

          {/* Name input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              プレイヤー名 / ニックネーム
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: スピードスターたろう"
              maxLength={14}
              className="w-full px-5 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
            />
          </div>

          {/* Avatar selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              アバター絵文字
            </label>
            <div className="flex flex-wrap gap-2.5 justify-center bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                    selectedAvatar === av
                      ? 'bg-indigo-600/90 text-white scale-110 shadow-lg shadow-indigo-500/50 ring-2 ring-indigo-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Color selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              イメージカラー
            </label>
            <div className="flex flex-wrap gap-3 justify-center">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    selectedColor === c ? 'scale-125 ring-4 ring-slate-100 shadow-md' : 'hover:scale-110 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {(notice || !canJoin) && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
              {notice || '対戦が進行中のため、プレイヤーとしては参加できません。観戦モードでご覧ください。'}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => onJoinAsPlayer(name, selectedAvatar, selectedColor)}
              disabled={!canJoin}
              className="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
            >
              <span>🎮</span> 参加する (対戦プレー)
            </button>

            <button
              onClick={() => onJoinAsSpectator(name)}
              className="w-full py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-lg shadow-lg hover:shadow-slate-700/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
            >
              <span>👁️</span> 視聴する (観戦モード)
            </button>
          </div>

        </div>
      ) : (
        /* Real-Time Waiting Lobby for Player */
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Kicked Alert */}
          {isKicked ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-4 animate-bounce">⚠️</div>
              <h3 className="text-2xl font-bold text-rose-400 mb-2">管理者によりキックされました</h3>
              <p className="text-slate-400 mb-6">この対戦ルームから追放されました。</p>
              <button
                onClick={onLeave}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all"
              >
                トップへ戻る
              </button>
            </div>
          ) : (
            <div>
              {/* Waiting status header */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md border border-white/20"
                    style={{ backgroundColor: currentPlayer?.color || '#3b82f6' }}
                  >
                    {currentPlayer?.avatar}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      {currentPlayer?.name}
                      <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        エントリー完了
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">全員が準備OKを押すとゲームが始まります</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={onLeave}
                    className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all border border-slate-700"
                  >
                    退出する
                  </button>
                </div>
              </div>

              {/* Waiting Spinner Card */}
              <div className="bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950/60 rounded-2xl p-8 text-center border border-indigo-500/20 mb-8 relative">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 text-3xl mb-4 animate-pulse">
                  ⏳
                </div>
                <h4 className="text-2xl font-extrabold text-slate-100 mb-2">待機中 (リアルタイム)</h4>
                <p className="text-indigo-300 text-sm max-w-md mx-auto mb-5">
                  準備ができたら「準備OK」を押してください。<br />
                  全員が押すと3秒カウントダウンが始まります！
                </p>
                <div className="text-sm font-bold text-slate-300 mb-4">
                  準備OK <span className="text-emerald-400 text-lg">{readyCount}</span> / {activePlayers.length} 人
                </div>
                <button
                  onClick={onToggleReady}
                  className={`w-full max-w-xs py-3.5 px-6 rounded-2xl font-extrabold text-lg shadow-xl transition-all ${
                    iAmReady
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  {iAmReady ? '↩️ 準備を取り消す' : '✅ 準備OK！'}
                </button>
              </div>

              {/* Connected Players list */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>参加中のプレイヤー一覧 ({activePlayers.length}名)</span>
                  <span className="text-xs text-indigo-400 font-normal">リアルタイム更新中 🟢</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activePlayers.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                        p.id === currentPlayer?.id
                          ? 'bg-indigo-900/40 border-indigo-500/60 ring-1 ring-indigo-500/50'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-200 text-sm truncate flex items-center gap-1.5">
                          {p.name}
                          {p.id === currentPlayer?.id && (
                            <span className="text-[10px] bg-indigo-500 text-white font-extrabold px-1.5 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ready' ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                          <span className={p.status === 'ready' ? 'text-emerald-400' : ''}>
                            {p.status === 'ready' ? '準備OK' : '準備中…'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
