'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Puzzle } from '../types';
import { formatTimer } from '../format';

interface PuzzleCanvasProps {
  puzzle: Puzzle;
  questionIndex: number; // 1 to 5
  gameStartTime: number; // レース開始時刻(サーバー時刻ms)
  getNow: () => number; // サーバー時刻を返す関数
  onCompleteQuestion: (questionIndex: number, durationMs: number) => void;
}

// AudioContext は Chrome で同時数に上限があるので、1つだけ作って使い回す
let sharedCtx: AudioContext | null = null;
const getAudioCtx = (): AudioContext | null => {
  try {
    if (!sharedCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      sharedCtx = new Ctor();
    }
    if (sharedCtx!.state === 'suspended') void sharedCtx!.resume();
    return sharedCtx;
  } catch {
    return null;
  }
};

const playPopSound = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

const playErrorSound = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
};

const playSuccessSound = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.08);
    osc.stop(ctx.currentTime + i * 0.08 + 0.15);
  });
};

/** 数字つなぎ: 1番から順番にタップして、最後の番号まで押せたら正解 */
export const PuzzleCanvas: React.FC<PuzzleCanvasProps> = ({
  puzzle,
  questionIndex,
  gameStartTime,
  getNow,
  onCompleteQuestion,
}) => {
  const total = puzzle.nodes.length;
  const [nextIndex, setNextIndex] = useState(0); // 次に押す番号の位置(= もう押した数)
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [stuck, setStuck] = useState(false);
  // 第1問はレース開始時刻から、以降は表示された時刻から測る
  const [questionStartTime] = useState<number>(() => (questionIndex === 1 ? gameStartTime : getNow()));
  const [elapsedMs, setElapsedMs] = useState<number>(() => Math.max(0, getNow() - gameStartTime));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(Math.max(0, getNow() - gameStartTime)), 40);
    return () => clearInterval(interval);
  }, [gameStartTime, getNow]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 1500);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // 正解したのに3秒たっても次へ進まないときは「次へ進む」ボタンを出す
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => setStuck(true), 3000);
    return () => clearTimeout(t);
  }, [isSuccess]);

  const handleNodeClick = useCallback(
    (index: number) => {
      if (isSuccess) return;
      setErrorMessage(null);

      if (index === nextIndex) {
        playPopSound();
        const n = nextIndex + 1;
        setNextIndex(n);
        if (n === total) {
          setIsSuccess(true);
          playSuccessSound();
          const duration = getNow() - questionStartTime;
          durationRef.current = duration;
          onCompleteQuestion(questionIndex, duration);
        }
        return;
      }
      if (index < nextIndex) return; // すでに押した番号は無視
      setErrorMessage(`次は「${puzzle.nodes[nextIndex].label}」番です！`);
      playErrorSound();
    },
    [isSuccess, nextIndex, total, puzzle, questionIndex, questionStartTime, getNow, onCompleteQuestion]
  );

  const first = puzzle.nodes[0];
  const last = puzzle.nodes[total - 1];
  const nextLabel = puzzle.nodes[Math.min(nextIndex, total - 1)].label;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-6">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-xl mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-sm shadow-md">
              問題 {questionIndex} / 5
            </div>
            <div className="text-xs text-slate-400 font-semibold">{puzzle.difficulty}</div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-5 py-2 rounded-2xl border border-indigo-500/30">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">TIME</span>
            <span className="font-mono text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              {formatTimer(elapsedMs)}
            </span>
          </div>

          <div className="text-xs font-bold text-slate-300">
            次の番号: <span className="text-amber-400 text-base font-extrabold">{isSuccess ? '✔' : nextLabel}</span>
            <span className="ml-2 text-slate-400">
              ({nextIndex} / {total})
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-100">{puzzle.title}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{puzzle.subtitle}</p>
          </div>
          {puzzle.hint && (
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
            >
              💡 {showHint ? 'ヒントを隠す' : 'ヒントを見る'}
            </button>
          )}
        </div>

        {showHint && puzzle.hint && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
            💡 {puzzle.hint}
          </div>
        )}
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-8 shadow-2xl backdrop-blur-xl relative flex flex-col items-center">
        {errorMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 px-4 py-2 bg-rose-600/90 text-white font-bold text-xs rounded-full shadow-lg border border-rose-400 animate-bounce">
            ⚠️ {errorMessage}
          </div>
        )}

        {isSuccess && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
              第{questionIndex}問 CLEAR!!
            </h3>
            <p className="text-slate-300 text-sm mt-2">次の問題へ自動で移動します...</p>
            {stuck && (
              <button
                onClick={() => onCompleteQuestion(questionIndex, durationRef.current)}
                className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold"
              >
                次へ進む
              </button>
            )}
          </div>
        )}

        <div className="w-full max-w-lg aspect-square bg-slate-950/90 rounded-2xl border border-slate-800 p-4 relative shadow-inner overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 pointer-events-none" />

          <svg viewBox={puzzle.viewBox} className="w-full h-full touch-none select-none z-10">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* 完成したら絵の中を薄く塗る */}
            {isSuccess && puzzle.closed && (
              <polygon
                points={puzzle.nodes.map((n) => `${n.x},${n.y}`).join(' ')}
                fill="#38bdf8"
                opacity="0.18"
              />
            )}

            {/* なぞった線(1→2→3…) */}
            {puzzle.nodes.slice(0, Math.max(0, nextIndex - 1)).map((n, i) => {
              const m = puzzle.nodes[i + 1];
              return (
                <g key={`l${i}`}>
                  <line x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" opacity="0.4" filter="url(#glow)" />
                  <line x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" className="hf-line-traced" />
                </g>
              );
            })}
            {/* 最後の番号から1番へ戻る線 */}
            {isSuccess && puzzle.closed && (
              <line x1={last.x} y1={last.y} x2={first.x} y2={first.y} stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" className="hf-line-traced" />
            )}

            {/* 頂点(番号) */}
            {puzzle.nodes.map((node, i) => {
              const isCurrent = nextIndex > 0 && i === nextIndex - 1;
              const isVisited = i < nextIndex;
              return (
                <g key={node.id} onClick={() => handleNodeClick(i)} className="hf-node">
                  {isCurrent && !isSuccess && (
                    <circle cx={node.x} cy={node.y} r="22" fill="none" stroke="#f59e0b" strokeWidth="3" className="hf-ring" />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isCurrent ? '16' : '14'}
                    fill={isCurrent ? '#f59e0b' : isVisited ? '#3b82f6' : '#1e293b'}
                    stroke={isCurrent ? '#fef08a' : isVisited ? '#60a5fa' : '#64748b'}
                    strokeWidth="3"
                    className="hf-node-body"
                    filter={isCurrent ? 'url(#glow)' : undefined}
                  />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill={isCurrent || isVisited ? '#ffffff' : '#94a3b8'}
                    fontSize="11"
                    fontWeight="bold"
                    className="pointer-events-none select-none font-mono"
                  >
                    {node.label || node.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 text-xs text-slate-400 text-center">
          番号を <strong className="text-slate-200">1 から順番に</strong> タップしてつなごう！ 最後の番号まで押せたらクリアです。
        </div>
      </div>
    </div>
  );
};
