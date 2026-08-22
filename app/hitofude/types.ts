export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'kicked';
export type RoomStatus = 'lobby' | 'countdown' | 'in_game' | 'finished';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  status: PlayerStatus;
  currentQuestion: number; // 1 to 5
  startTime?: number; // timestamp ms
  finishTime?: number; // timestamp ms
  questionTimes: number[]; // Array of duration in ms for each question
  totalTimeMs?: number;
  joinedAt: number;
}

export interface Spectator {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoomState {
  status: RoomStatus;
  countdown: number; // 3, 2, 1, 0
  startTime?: number; // Game start timestamp
  players: Player[];
  spectators: Spectator[];
  kickedPlayerIds: string[];
  lastUpdated: number;
}

export interface Node {
  id: string;
  x: number; // Percentage 0 - 100 or pixels in viewBox
  y: number;
  label?: string;
}

export interface Edge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
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

export type UserRole = 'player' | 'spectator' | 'admin' | null;

export type SyncEventType =
  | 'SYNC_STATE'
  | 'PLAYER_JOIN'
  | 'SPECTATOR_JOIN'
  | 'PLAYER_LEAVE'
  | 'KICK_PLAYER'
  | 'START_GAME'
  | 'UPDATE_PROGRESS'
  | 'FINISH_PLAYER'
  | 'RESET_ROOM';

export interface SyncMessage {
  type: SyncEventType;
  payload?: any;
  senderId?: string;
  timestamp: number;
}
