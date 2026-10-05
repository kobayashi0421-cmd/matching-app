'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Puzzle } from '../types';
import { getEdgeKey } from '../puzzles';
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

/** 親側で key={questionIndex} を付けているので、問題が変わるたびに状態は新品になる */
export const PuzzleCanvas: React.FC<PuzzleCanvasProps> = ({
  puzzle,
  questionIndex,
  gameStartTime,
  getNow,
  onCompleteQuestion,
}) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [tracedEdgeKeys, setTracedEdgeKeys] = useState<Set<string>>(new Set());
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  // 第1問はレース開始時刻から、以降は表示された時刻から測る
  const [questionStartTime] = useState<number>(() => (questionIndex === 1 ? gameStartTime : getNow()));
  const [elapsedMs, setElapsedMs] = useState<number>(() => Math.max(0, getNow() - gameStartTime));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const durationRef = useRef(0);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(Math.max(0, getNow() - gameStartTime)), 40);
    return () => clearInterval(interval);
  }, [gameStartTime, getNow]);

  // 正解したのに3秒たっても次へ進まないときは「次へ進む」ボタンを出す
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => setStuck(true), 3000);
    return () => clearTimeout(t);
  }, [isSuccess]);

  // エラー表示は1.8秒で自動的に消す
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 1800);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // Node Selection & Edge Tracing Handler
  const handleNodeClick = useCallback(
    (targetNodeId: string) => {
      if (isSuccess) return;
      setErrorMessage(null);

      // 1. Initial selection
      if (!currentNodeId) {
        setCurrentNodeId(targetNodeId);
        setNodeHistory([targetNodeId]);
        playPopSound();
        return;
      }

      // 2. Clicking same node -> ignore or hint
      if (targetNodeId === currentNodeId) return;

      // 3. Find edge connecting currentNodeId and targetNodeId
      const targetEdge = puzzle.edges.find(
        (e) =>
          (e.source === currentNodeId && e.target === targetNodeId) ||
          (e.source === targetNodeId && e.target === currentNodeId)
      );

      if (!targetEdge) {
        setErrorMessage('直線でつながっていない頂点です！');
        playErrorSound();
        return;
      }

      const key = getEdgeKey(targetEdge.source, targetEdge.target);

      if (tracedEdgeKeys.has(key)) {
        setErrorMessage('その線はすでになぞられています！');
        playErrorSound();
        return;
      }

      // Valid stroke!
      playPopSound();
      const nextTraced = new Set(tracedEdgeKeys);
      nextTraced.add(key);
      setTracedEdgeKeys(nextTraced);
      setCurrentNodeId(targetNodeId);
      setNodeHistory((prev) => [...prev, targetNodeId]);

      // Check puzzle completion
      if (nextTraced.size === puzzle.edges.length) {
        setIsSuccess(true);
        playSuccessSound();
        const duration = getNow() - questionStartTime;
        durationRef.current = duration;
        onCompleteQuestion(questionIndex, duration);
      }
    },
    [currentNodeId, isSuccess, puzzle, tracedEdgeKeys, questionIndex, questionStartTime, getNow, onCompleteQuestion]
  );

  const handleUndo = () => {
    if (isSuccess) return;
    if (nodeHistory.length <= 1) {
      handleReset();
      return;
    }
    const newHistory = [...nodeHistory];
    const removedNode = newHistory.pop()!;
    const prevNode = newHistory[newHistory.length - 1];

    const targetEdge = puzzle.edges.find(
      (e) =>
        (e.source === removedNode && e.target === prevNode) ||
        (e.source === prevNode && e.target === removedNode)
    );

    if (targetEdge) {
      const key = getEdgeKey(targetEdge.source, targetEdge.target);
      const nextTraced = new Set(tracedEdgeKeys);
      nextTraced.delete(key);
      setTracedEdgeKeys(nextTraced);
    }

    setNodeHistory(newHistory);
    setCurrentNodeId(prevNode);
    setIsSuccess(false);
  };

  const handleReset = () => {
    if (isSuccess) return;
    setCurrentNodeId(null);
    setTracedEdgeKeys(new Set());
    setNodeHistory([]);
    setIsSuccess(false);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-6">
      {/* Header bar: Progress & Stopwatch */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-xl mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Question progress pill */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-sm shadow-md">
              問題 {questionIndex} / 5
            </div>
            <div className="text-xs text-slate-400 font-semibold">{puzzle.difficulty}</div>
          </div>

          {/* Stopwatch Timer */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-5 py-2 rounded-2xl border border-indigo-500/30">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">TIME</span>
            <span className="font-mono text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              {formatTimer(elapsedMs)}
            </span>
          </div>

          {/* Remaining edges indicator */}
          <div className="text-xs font-bold text-slate-300">
            残りの線: <span className="text-indigo-400 text-base font-extrabold">{puzzle.edges.length - tracedEdgeKeys.size}</span> / {puzzle.edges.length} 本
          </div>
        </div>

        {/* Puzzle Titles */}
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
            💡 <strong>ヒント:</strong> {puzzle.hint}
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-8 shadow-2xl backdrop-blur-xl relative flex flex-col items-center">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 px-4 py-2 bg-rose-600/90 text-white font-bold text-xs rounded-full shadow-lg border border-rose-400 animate-bounce">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Success overlay banner */}
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

        {/* Interactive SVG Board */}
        <div className="w-full max-w-lg aspect-square bg-slate-950/90 rounded-2xl border border-slate-800 p-4 relative shadow-inner overflow-hidden flex items-center justify-center">
          {/* Subtle Grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 pointer-events-none" />

          <svg viewBox={puzzle.viewBox} className="w-full h-full touch-none select-none z-10">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Render Edges */}
            {puzzle.edges.map((edge) => {
              const sourceNode = puzzle.nodes.find((n) => n.id === edge.source);
              const targetNode = puzzle.nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const edgeKey = getEdgeKey(edge.source, edge.target);
              const isTraced = tracedEdgeKeys.has(edgeKey);

              return (
                <g key={edge.id}>
                  {/* Outer glow line for traced edges */}
                  {isTraced && (
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke="#38bdf8"
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.4"
                      filter="url(#glow)"
                    />
                  )}

                  {/* Main Line */}
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isTraced ? '#38bdf8' : '#334155'}
                    strokeWidth={isTraced ? '5' : '3'}
                    strokeDasharray={isTraced ? undefined : '6 4'}
                    strokeLinecap="round"
                    className={isTraced ? 'hf-line-traced' : undefined}
                  />
                </g>
              );
            })}

            {/* Render Nodes */}
            {puzzle.nodes.map((node) => {
              const isCurrent = currentNodeId === node.id;
              const isVisited = nodeHistory.includes(node.id);

              return (
                <g
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                  className="hf-node"
                >
                  {/* Pulse ring for active current node */}
                  {isCurrent && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="22"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      className="hf-ring"
                    />
                  )}

                  {/* Node outer circle */}
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

                  {/* Node Label */}
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

        {/* Action Controls */}
        <div className="flex items-center gap-4 mt-6 w-full max-w-lg">
          <button
            onClick={handleUndo}
            disabled={nodeHistory.length === 0}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${nodeHistory.length > 0
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-md active:scale-95'
                : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
              }`}
          >
            <span>↩️</span> 1手戻す
          </button>

          <button
            onClick={handleReset}
            disabled={nodeHistory.length === 0}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${nodeHistory.length > 0
                ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 shadow-md active:scale-95'
                : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
              }`}
          >
            <span>🔄</span> やり直す
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-400 text-center">
          頂点(円)を順番にクリック/タップして、すべての線を1度だけ通ってください！
        </div>
      </div>
    </div>
  );
};
