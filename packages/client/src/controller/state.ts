import type { BonusState, CheatScenario, FreeSpinsState } from '@gem-rush/shared';

/**
 * - `loading`: booting / restoring the session.
 * - `idle`: waiting for the player.
 * - `spinning`: request in flight and/or reels moving.
 * - `presenting`: showing wins, big-win or feature banners.
 * - `bonus`: the Gem Vault pick game is on screen.
 */
export type Phase = 'loading' | 'idle' | 'spinning' | 'presenting' | 'bonus';

export interface AutoplaySettings {
  readonly spins: number;
  /** Stop once net losses since starting reach this amount (cents). Always required. */
  readonly lossLimit: number;
  /** Stop when a single round wins at least this much (cents); `null` = off. */
  readonly singleWinLimit: number | null;
  readonly stopOnFeature: boolean;
}

export interface AutoplayState extends AutoplaySettings {
  readonly remaining: number;
  readonly startBalance: number;
}

export interface GameState {
  readonly phase: Phase;
  readonly balance: number;
  readonly currency: string;
  readonly betIndex: number;
  /** Last round's win as shown in the WIN meter. */
  readonly win: number;
  readonly freeSpins: FreeSpinsState | null;
  /** Gem Vault bonus in progress. */
  readonly bonus: BonusState | null;
  readonly autoplay: AutoplayState | null;
  readonly turbo: boolean;
  readonly muted: boolean;
  readonly message: string;
  readonly sessionStartedAt: number;
}

/** Everything the HUD can ask the game to do. Implemented by GameController. */
export interface HudActions {
  primaryAction(): void;
  changeBet(direction: 1 | -1): void;
  setTurbo(enabled: boolean): void;
  setMuted(muted: boolean): void;
  startAutoplay(settings: AutoplaySettings): void;
  stopAutoplay(): void;
  refill(): Promise<void>;
  /** QA only: the next spin requests a forced outcome. */
  spinWithCheat(scenario: CheatScenario): void;
}
