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
  /** 丸の大きさ(省略時 14)。大小まぜて見分けにくくするため */
  r?: number;
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
  /** 番号順に並べた頂点。1番目が「1」、2番目が「2」… */
  nodes: Node[];
  /** true なら、最後まで押したあと1番に戻る線を引く */
  closed?: boolean;
  /** 背景の目の錯覚: radial=放射線 / rings=同心円 / cafe=カフェウォール */
  illusion?: 'radial' | 'rings' | 'cafe';
  /** 盤面を少しゆらす */
  wobble?: boolean;
  /** 数字のないニセの丸(タップしても反応しない) */
  decoys?: { x: number; y: number; r: number }[];
  hint?: string;
}

export type UserRole = 'player' | 'spectator' | null;
