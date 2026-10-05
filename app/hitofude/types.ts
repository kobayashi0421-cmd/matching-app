export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'kicked';
export type RoomStatus = 'lobby' | 'countdown' | 'in_game' | 'finished';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  status: PlayerStatus;
  currentQuestion: number; // 1 to 5
  finishTime?: number; // サーバー時刻(ms)
  questionTimes: number[]; // 各問の所要時間(ms)
  totalTimeMs?: number;
  joinedAt: number;
  /** 対戦中に画面を離れた(順位表には残す) */
  left?: boolean;
}

export interface Spectator {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoomState {
  status: RoomStatus;
  /** レース開始時刻(サーバー時刻ms)。countdown 中は「この時刻になったら開始」 */
  startAt?: number;
  players: Player[];
  spectators: Spectator[];
  kickedPlayerIds: string[];
  lastUpdated: number;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface Puzzle {
  id: number; // 1 to 5
  title: string;
  subtitle: string;
  difficulty: '★☆☆☆☆' | '★★☆☆☆' | '★★★☆☆' | '★★★★☆' | '★★★★★';
  viewBox: string;
  nodes: Node[];
  edges: Edge[];
  hint?: string;
}

export type UserRole = 'player' | 'spectator' | null;
