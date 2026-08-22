'use client';

import { RoomState, Player, Spectator, SyncMessage } from './types';

const STORAGE_KEY = 'hitofude_room_state_v2';
const CHANNEL_NAME = 'hitofude_room_channel_v2';

const INITIAL_ROOM_STATE: RoomState = {
  status: 'lobby',
  countdown: 3,
  players: [],
  spectators: [],
  kickedPlayerIds: [],
  lastUpdated: Date.now(),
};

type Listener = (state: RoomState) => void;

class HitofudeStore {
  private state: RoomState;
  private listeners: Set<Listener> = new Set();
  private channel: BroadcastChannel | null = null;
  private isBrowser: boolean = typeof window !== 'undefined';

  constructor() {
    this.state = this.loadInitialState();
    if (this.isBrowser) {
      this.initChannel();
      this.initStorageListener();
    }
  }

  private loadInitialState(): RoomState {
    if (!this.isBrowser) return INITIAL_ROOM_STATE;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_ROOM_STATE,
          ...parsed,
        };
      }
    } catch (e) {
      console.error('Failed to load room state from localStorage:', e);
    }
    return INITIAL_ROOM_STATE;
  }

  private initChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingSyncMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported or failed to initialize:', e);
    }
  }

  private initStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          this.state = newState;
          this.notifyListeners();
        } catch (e) {
          console.error('Error parsing storage sync:', e);
        }
      }
    });
  }

  private handleIncomingSyncMessage(msg: SyncMessage) {
    if (!msg || !msg.type) return;
    // Reload state from storage or update in place
    const updated = this.loadInitialState();
    this.state = updated;
    this.notifyListeners();
  }

  private saveAndBroadcast(newState: RoomState, type: SyncMessage['type'] = 'SYNC_STATE', payload?: any) {
    this.state = {
      ...newState,
      lastUpdated: Date.now(),
    };

    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error('Error saving state to localStorage:', e);
      }

      if (this.channel) {
        try {
          this.channel.postMessage({
            type,
            payload,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.error('Error broadcasting message:', e);
        }
      }
    }

    this.notifyListeners();
  }

  public getState(): RoomState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Send immediate state
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // --- ACTIONS ---

  public joinPlayer(name: string, avatar: string, color: string): Player {
    const existingPlayers = this.state.players.filter((p) => p.status !== 'kicked');
    const newPlayer: Player = {
      id: 'player_' + Math.random().toString(36).substr(2, 9),
      name: name.trim() || '名無しのチャレンジャー',
      avatar: avatar || '⚡',
      color: color || '#3b82f6',
      status: this.state.status === 'in_game' ? 'playing' : 'waiting',
      currentQuestion: 1,
      questionTimes: [],
      joinedAt: Date.now(),
      startTime: this.state.startTime,
    };

    const nextState: RoomState = {
      ...this.state,
      players: [...existingPlayers, newPlayer],
    };

    this.saveAndBroadcast(nextState, 'PLAYER_JOIN', newPlayer);
    return newPlayer;
  }

  public joinSpectator(name: string): Spectator {
    const newSpectator: Spectator = {
      id: 'spec_' + Math.random().toString(36).substr(2, 9),
      name: name.trim() || '匿名観戦者',
      joinedAt: Date.now(),
    };

    const nextState: RoomState = {
      ...this.state,
      spectators: [...this.state.spectators, newSpectator],
    };

    this.saveAndBroadcast(nextState, 'SPECTATOR_JOIN', newSpectator);
    return newSpectator;
  }

  public kickPlayer(playerId: string) {
    const updatedPlayers = this.state.players.map((p) =>
      p.id === playerId ? { ...p, status: 'kicked' as const } : p
    );

    const nextState: RoomState = {
      ...this.state,
      players: updatedPlayers,
      kickedPlayerIds: [...new Set([...this.state.kickedPlayerIds, playerId])],
    };

    this.saveAndBroadcast(nextState, 'KICK_PLAYER', { playerId });
  }

  public startGame() {
    const updatedPlayers = this.state.players.map((p) => ({
      ...p,
      status: 'playing' as const,
      currentQuestion: 1,
      questionTimes: [],
      totalTimeMs: 0,
      startTime: Date.now() + 3000, // countdown offset
    }));

    // Start 3 second countdown
    let count = 3;
    const startNextState: RoomState = {
      ...this.state,
      status: 'countdown',
      countdown: count,
      players: updatedPlayers,
    };
    this.saveAndBroadcast(startNextState, 'START_GAME');

    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        this.saveAndBroadcast(
          {
            ...this.state,
            status: 'countdown',
            countdown: count,
          },
          'START_GAME'
        );
      } else {
        clearInterval(timer);
        const gameActiveState: RoomState = {
          ...this.state,
          status: 'in_game',
          countdown: 0,
          startTime: Date.now(),
          players: this.state.players.map((p) => ({
            ...p,
            status: 'playing' as const,
            startTime: Date.now(),
          })),
        };
        this.saveAndBroadcast(gameActiveState, 'START_GAME');
      }
    }, 1000);
  }

  public recordQuestionCompletion(playerId: string, questionIndex: number, durationMs: number) {
    const gameStartTime = this.state.startTime || Date.now();
    const updatedPlayers = this.state.players.map((p) => {
      if (p.id !== playerId) return p;

      const newQuestionTimes = [...p.questionTimes];
      newQuestionTimes[questionIndex - 1] = durationMs;

      const nextQuestion = questionIndex + 1;
      const isFinished = nextQuestion > 5;

      const finishTime = isFinished ? Date.now() : p.finishTime;
      const totalTimeMs = isFinished ? Date.now() - gameStartTime : p.totalTimeMs;

      return {
        ...p,
        currentQuestion: isFinished ? 5 : nextQuestion,
        questionTimes: newQuestionTimes,
        status: isFinished ? ('finished' as const) : p.status,
        finishTime,
        totalTimeMs,
      };
    });

    // Check if all playing participants have finished
    const playingCount = updatedPlayers.filter((p) => p.status === 'playing').length;
    const allFinished = playingCount === 0 && updatedPlayers.some((p) => p.status === 'finished');

    const nextState: RoomState = {
      ...this.state,
      status: allFinished ? 'finished' : this.state.status,
      players: updatedPlayers,
    };

    this.saveAndBroadcast(nextState, 'UPDATE_PROGRESS', { playerId, questionIndex });
  }

  public resetRoom() {
    const nextState: RoomState = {
      status: 'lobby',
      countdown: 3,
      startTime: undefined,
      players: [],
      spectators: [],
      kickedPlayerIds: [],
      lastUpdated: Date.now(),
    };
    this.saveAndBroadcast(nextState, 'RESET_ROOM');
  }

  public leavePlayer(id: string) {
    const updatedPlayers = this.state.players.filter((p) => p.id !== id);
    const updatedSpectators = this.state.spectators.filter((s) => s.id !== id);

    const nextState: RoomState = {
      ...this.state,
      players: updatedPlayers,
      spectators: updatedSpectators,
    };

    this.saveAndBroadcast(nextState, 'PLAYER_LEAVE', { id });
  }
}

export const hitofudeStore = new HitofudeStore();
