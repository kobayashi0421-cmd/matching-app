'use client';

import './hitofude.css';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Player, RoomState, UserRole } from './types';
import { PUZZLES } from './puzzles';
import { hitofudeStore } from './store';
import { Lobby } from './components/Lobby';
import { AdminPanel } from './components/AdminPanel';
import { SpectatorPanel } from './components/SpectatorPanel';
import { PuzzleCanvas } from './components/PuzzleCanvas';
import { Leaderboard } from './components/Leaderboard';

export default function HitofudeGamePage() {
  const [roomState, setRoomState] = useState<RoomState>(hitofudeStore.getState());
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  // Subscribe to real-time store updates
  useEffect(() => {
    const unsubscribe = hitofudeStore.subscribe((newState) => {
      setRoomState(newState);

      // Keep currentPlayer synced
      if (currentPlayer) {
        const updated = newState.players.find((p) => p.id === currentPlayer.id);
        if (updated) {
          setCurrentPlayer(updated);
        }
      }
    });

    return () => unsubscribe();
  }, [currentPlayer]);

  // Handle player entry
  const handleJoinAsPlayer = (name: string, avatar: string, color: string) => {
    const player = hitofudeStore.joinPlayer(name, avatar, color);
    setCurrentPlayer(player);
    setUserRole('player');
  };

  // Handle spectator entry
  const handleJoinAsSpectator = (name: string) => {
    hitofudeStore.joinSpectator(name);
    setUserRole('spectator');
  };

  // Select Admin role
  const handleSelectAdmin = () => {
    setUserRole('admin');
  };

  // Player leaves
  const handleLeave = () => {
    if (currentPlayer) {
      hitofudeStore.leavePlayer(currentPlayer.id);
    }
    setCurrentPlayer(null);
    setUserRole(null);
  };

  // Question completion callback
  const handleCompleteQuestion = (questionIndex: number, durationMs: number) => {
    if (currentPlayer) {
      hitofudeStore.recordQuestionCompletion(currentPlayer.id, questionIndex, durationMs);
    }
  };

  return (
    <div className="hf-root min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Dynamic Background Glow Effect */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
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

          {/* Role Pill & Quick Toggles */}
          <div className="flex items-center gap-3">
            {userRole && (
              <div className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border bg-slate-900 border-slate-800">
                {userRole === 'admin' && <span className="text-amber-400">👑 管理者モード</span>}
                {userRole === 'spectator' && <span className="text-indigo-400">👁️ 観戦モード</span>}
                {userRole === 'player' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span>🎮</span> {currentPlayer?.name || 'プレイヤー'}
                  </span>
                )}
              </div>
            )}

            {userRole !== 'admin' && (
              <button
                onClick={() => setUserRole('admin')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
              >
                👑 管理者画面
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Router */}
      <main className="flex-1 flex flex-col justify-center">
        {/* 1. ADMIN PANEL VIEW */}
        {userRole === 'admin' && (
          <AdminPanel
            roomState={roomState}
            onKickPlayer={(id) => hitofudeStore.kickPlayer(id)}
            onStartGame={() => hitofudeStore.startGame()}
            onResetRoom={() => hitofudeStore.resetRoom()}
            onExitAdmin={() => setUserRole(null)}
          />
        )}

        {/* 2. SPECTATOR VIEW */}
        {userRole === 'spectator' && (
          <SpectatorPanel roomState={roomState} onExitSpectator={() => setUserRole(null)} />
        )}

        {/* 3. LOBBY ENTRY VIEW */}
        {!userRole && (
          <Lobby
            roomState={roomState}
            onJoinAsPlayer={handleJoinAsPlayer}
            onJoinAsSpectator={handleJoinAsSpectator}
            onSelectAdmin={handleSelectAdmin}
            currentPlayer={currentPlayer}
            userRole={userRole}
            onLeave={handleLeave}
          />
        )}

        {/* 4. PLAYER VIEW */}
        {userRole === 'player' && currentPlayer && (
          <>
            {/* 4A. WAITING IN LOBBY */}
            {roomState.status === 'lobby' && (
              <Lobby
                roomState={roomState}
                onJoinAsPlayer={handleJoinAsPlayer}
                onJoinAsSpectator={handleJoinAsSpectator}
                onSelectAdmin={handleSelectAdmin}
                currentPlayer={currentPlayer}
                userRole={userRole}
                onLeave={handleLeave}
              />
            )}

            {/* 4B. COUNTDOWN SCREEN */}
            {roomState.status === 'countdown' && (
              <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center text-center p-6">
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 animate-bounce mb-6 font-mono">
                  {roomState.countdown > 0 ? roomState.countdown : 'START!'}
                </div>
                <h2 className="text-3xl font-extrabold text-slate-100">準備してください！</h2>
                <p className="text-indigo-300 text-sm mt-2">全5問の一筆書きパズルが始まります！</p>
              </div>
            )}

            {/* 4C. GAME IN PROGRESS */}
            {roomState.status === 'in_game' && (
              <>
                {currentPlayer.status === 'finished' ? (
                  <Leaderboard
                    roomState={roomState}
                    onBackToLobby={handleLeave}
                    onResetRoom={() => hitofudeStore.resetRoom()}
                  />
                ) : (
                  <PuzzleCanvas
                    player={currentPlayer}
                    puzzle={PUZZLES[Math.min(currentPlayer.currentQuestion - 1, 4)]}
                    questionIndex={currentPlayer.currentQuestion}
                    gameStartTime={roomState.startTime || Date.now()}
                    onCompleteQuestion={handleCompleteQuestion}
                  />
                )}
              </>
            )}

            {/* 4D. GAME FINISHED (Leaderboard) */}
            {roomState.status === 'finished' && (
              <Leaderboard
                roomState={roomState}
                onBackToLobby={handleLeave}
                onResetRoom={() => hitofudeStore.resetRoom()}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 text-slate-500 text-xs py-4 text-center">
        一筆書き競争ゲーム • Real-time Multiplayer One-Stroke Puzzle Race
      </footer>
    </div>
  );
}
