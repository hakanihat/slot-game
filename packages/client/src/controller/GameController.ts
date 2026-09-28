import type {
  CheatScenario,
  GameInfo,
  LineWin,
  ScatterWin,
  SpinResponse,
  SymbolId,
} from '@gem-rush/shared';
import type { SoundManager } from '../audio/SoundManager';
import { SPEED, rollupDurationMs, winTierFor, type SpeedProfile } from '../config/presentation';
import { SkipSignal } from '../core/SkipSignal';
import type { Store } from '../core/Store';
import { wait } from '../core/tween';
import type { GameScene } from '../game/GameScene';
import type { Hud } from '../hud/Hud';
import { ApiError, type ApiClient } from '../net/ApiClient';
import type { AutoplaySettings, GameState, HudActions } from './state';

type Grid = readonly (readonly SymbolId[])[];

const MESSAGES = {
  idle: 'Place your bet and press SPIN',
  spinning: 'Good luck!',
  feature: 'Free Spins in play — all wins ×3',
} as const;

export interface ControllerDependencies {
  readonly api: ApiClient;
  readonly store: Store<GameState>;
  readonly scene: GameScene;
  readonly sound: SoundManager;
  readonly info: GameInfo;
  readonly format: (cents: number) => string;
}

/**
 * Orchestrates the round lifecycle:
 *
 *   idle → spinning (request + reels) → presenting (wins, big win, feature
 *   banners) → idle → [auto-continue for Free Spins / Autoplay]
 *
 * All money comes from the server response; the controller only decides
 * *how* and *when* results are shown.
 */
export class GameController implements HudActions {
  private hud!: Hud;
  private currentGrid: Grid;
  private quickStop = false;
  private readonly skip = new SkipSignal();
  private lineCycleToken = 0;
  private pendingCheat: CheatScenario | undefined;

  constructor(private readonly deps: ControllerDependencies) {
    this.currentGrid = [];
  }

  attachHud(hud: Hud): void {
    this.hud = hud;
  }

  /** Restores a session: last grid, balance and any Free Spins in progress. */
  async resume(grid: Grid): Promise<void> {
    const { store, scene } = this.deps;
    this.currentGrid = grid;
    scene.reels.setGrid(grid);
    const { freeSpins } = store.get();

    if (freeSpins) {
      scene.setTheme('feature');
      store.set({ phase: 'presenting', message: MESSAGES.feature });
      await scene.banner.show({
        title: 'WELCOME BACK',
        body: `${freeSpins.remaining} Free Spins remaining`,
        hint: 'Tap to continue',
      });
      store.set({ phase: 'idle' });
      void this.spin();
      return;
    }
    store.set({ phase: 'idle', message: MESSAGES.idle });
  }

  // ── HudActions ──────────────────────────────────────────────

  primaryAction(): void {
    const { scene, store, sound } = this.deps;
    sound.unlock();

    // Overlays swallow the tap first (skip / continue).
    if (scene.bigWin.visible) return scene.bigWin.notifyTap();
    if (scene.banner.visible) return scene.banner.notifyTap();

    const state = store.get();
    if (state.autoplay) return this.stopAutoplay();

    switch (state.phase) {
      case 'idle':
        void this.spin();
        break;
      case 'spinning':
        // Slam stop: land reels as soon as the result is known.
        this.quickStop = true;
        scene.reels.requestQuickStop();
        this.skip.trigger();
        break;
      case 'presenting':
        this.hud.skipRollup();
        this.skip.trigger();
        break;
      case 'loading':
        break;
    }
  }

  changeBet(direction: 1 | -1): void {
    const { store, info, sound } = this.deps;
    const state = store.get();
    if (state.phase !== 'idle' || state.autoplay || state.freeSpins) return;
    const betIndex = Math.max(0, Math.min(info.betLevels.length - 1, state.betIndex + direction));
    if (betIndex === state.betIndex) return;
    sound.unlock();
    sound.play('click');
    store.set({ betIndex });
    try {
      localStorage.setItem('gem-rush.bet-index', String(betIndex));
    } catch {
      // ignore
    }
  }

  setTurbo(turbo: boolean): void {
    this.deps.sound.play('click');
    this.deps.store.set({ turbo });
  }

  setMuted(muted: boolean): void {
    const { sound, store } = this.deps;
    sound.unlock();
    sound.setMuted(muted);
    store.set({ muted });
  }

  startAutoplay(settings: AutoplaySettings): void {
    const { store, sound } = this.deps;
    sound.unlock();
    const state = store.get();
    store.set({
      autoplay: { ...settings, remaining: settings.spins, startBalance: state.balance },
    });
    if (state.phase === 'idle') void this.spin();
  }

  stopAutoplay(reason = 'Autoplay stopped'): void {
    const { store } = this.deps;
    if (!store.get().autoplay) return;
    store.set({ autoplay: null, message: reason });
  }

  async refill(): Promise<void> {
    const { api, store } = this.deps;
    try {
      const state = await api.refill();
      store.set({ balance: state.balance, message: 'Credits refilled — good luck!' });
    } catch (error) {
      this.handleError(error);
    }
  }

  spinWithCheat(scenario: CheatScenario): void {
    if (this.deps.store.get().phase !== 'idle') return;
    this.pendingCheat = scenario;
    this.primaryAction();
  }

  // ── Round flow ──────────────────────────────────────────────

  private get speed(): SpeedProfile {
    return this.deps.store.get().turbo ? SPEED.turbo : SPEED.normal;
  }

  private async spin(): Promise<void> {
    const { store, scene, sound, api, info } = this.deps;
    const state = store.get();
    if (state.phase !== 'idle') return;

    const inFeature = state.freeSpins !== null;
    const bet = state.freeSpins?.bet ?? info.betLevels[state.betIndex] ?? 0;
    if (!inFeature && state.balance < bet) {
      this.handleInsufficientFunds(bet);
      return;
    }

    this.stopLineCycle();
    this.quickStop = false;
    const speed = this.speed;
    store.set({
      phase: 'spinning',
      win: 0,
      // The stake leaves the balance the moment the player commits to it.
      balance: inFeature ? state.balance : state.balance - bet,
      message: inFeature ? MESSAGES.feature : MESSAGES.spinning,
      autoplay:
        !inFeature && state.autoplay
          ? { ...state.autoplay, remaining: state.autoplay.remaining - 1 }
          : state.autoplay,
    });
    sound.play('spinStart');
    const startedAt = performance.now();
    scene.reels.startSpin(speed);

    let response: SpinResponse;
    try {
      const cheat = this.pendingCheat;
      this.pendingCheat = undefined;
      response = await api.spin(bet, cheat);
    } catch (error) {
      // No outcome exists: land back on the previous symbols and restore the display.
      await scene.reels.stopOn(this.currentGrid, { speed, quick: true });
      store.set({ phase: 'idle', balance: state.balance, autoplay: null, message: MESSAGES.idle });
      this.handleError(error);
      return;
    }

    const remainingSpinTime = speed.minSpinMs - (performance.now() - startedAt);
    if (!this.quickStop && remainingSpinTime > 0) await this.skip.wait(remainingSpinTime);

    await this.stopReels(response.outcome.grid, speed);
    this.currentGrid = response.outcome.grid;

    store.set({ phase: 'presenting' });
    await this.presentOutcome(response, speed);
    store.set({ balance: response.balance, freeSpins: response.freeSpins });
    await this.presentFeatureTransitions(response);

    const next = store.get();
    store.set({ phase: 'idle', message: next.freeSpins ? MESSAGES.feature : next.message });
    await this.continueAutomatically(response);
  }

  private async stopReels(grid: Grid, speed: SpeedProfile): Promise<void> {
    const { scene, sound } = this.deps;
    let scatters = 0;
    await scene.reels.stopOn(grid, {
      speed,
      quick: this.quickStop,
      onAnticipation: () => sound.play('anticipation'),
      onReelLanded: (reel, symbols) => {
        sound.play('reelStop');
        symbols.forEach((symbol, row) => {
          if (symbol !== 'SCATTER' && symbol !== 'WILD') return;
          if (symbol === 'SCATTER') sound.play('scatterLand', scatters++);
          void scene.reels.reels[reel]?.viewAt(row).land();
        });
      },
    });
    sound.stopAnticipation();
  }

  private async presentOutcome({ outcome }: SpinResponse, speed: SpeedProfile): Promise<void> {
    const { scene, sound, store, format } = this.deps;
    const win = outcome.totalWin;
    if (win === 0) {
      if (!outcome.freeSpinsAwarded && !store.get().freeSpins)
        store.set({ message: MESSAGES.idle });
      return;
    }

    scene.reels.showWins(outcome.lineWins, outcome.scatterWin);
    const tier = winTierFor(win, outcome.bet);
    const duration = rollupDurationMs(win, outcome.bet) * (store.get().turbo ? 0.5 : 1);

    if (tier) {
      await scene.bigWin.play({
        amount: win,
        bet: outcome.bet,
        durationMs: duration,
        format,
        onTier: () => sound.play('winBig'),
      });
      this.hud.skipRollup();
    } else {
      sound.play('winSmall');
      store.set({ message: `You won ${format(win)}!` });
      await this.skip.race(this.hud.rollupWin(0, win, duration));
      this.hud.skipRollup();
    }
    store.set({ win, message: `You won ${format(win)}!` });

    const automatic =
      store.get().autoplay !== null ||
      store.get().freeSpins !== null ||
      outcome.freeSpinsAwarded > 0;
    if (automatic) await this.skip.wait(speed.winShowMs);
    else this.startLineCycle(outcome.lineWins, outcome.scatterWin);
  }

  private async presentFeatureTransitions({ outcome, featureEnded }: SpinResponse): Promise<void> {
    const { scene, sound, store, format, info } = this.deps;
    const auto = store.get().autoplay !== null;

    if (outcome.freeSpinsAwarded > 0) {
      sound.play('featureStart');
      if (outcome.mode === 'base') {
        if (store.get().autoplay?.stopOnFeature)
          this.stopAutoplay('Autoplay stopped — Free Spins won!');
        scene.setTheme('feature');
        await scene.banner.show({
          title: 'FREE SPINS',
          body: `${outcome.freeSpinsAwarded} free spins · all wins ×${info.freeSpins.multiplier}`,
          hint: auto ? '' : 'Tap to start',
          autoCloseMs: auto ? 2500 : undefined,
        });
      } else {
        await scene.banner.show({
          title: `+${outcome.freeSpinsAwarded} FREE SPINS`,
          body: 'Retriggered!',
          hint: '',
          autoCloseMs: 1800,
        });
      }
      scene.reels.clearWins();
    }

    if (featureEnded) {
      sound.play('featureEnd');
      store.set({
        win: featureEnded.totalWin,
        message: `Feature win ${format(featureEnded.totalWin)}`,
      });
      await scene.banner.show({
        title: 'FEATURE WIN',
        body: `${format(featureEnded.totalWin)} from ${featureEnded.spinsPlayed} free spins`,
        hint: auto ? '' : 'Tap to continue',
        autoCloseMs: auto ? 3000 : undefined,
      });
      scene.setTheme('base');
      scene.reels.clearWins();
    }
  }

  /** Keeps Free Spins flowing, and runs Autoplay with its stop conditions. */
  private async continueAutomatically({ outcome, featureEnded }: SpinResponse): Promise<void> {
    const { store, info } = this.deps;
    const state = store.get();

    if (state.freeSpins) {
      await this.skip.wait(this.speed.autoSpinDelayMs);
      void this.spin();
      return;
    }

    const autoplay = state.autoplay;
    if (!autoplay) return;

    const bet = info.betLevels[state.betIndex] ?? 0;
    const roundWin = featureEnded?.totalWin ?? outcome.totalWin;
    const reason =
      autoplay.remaining <= 0
        ? 'Autoplay finished'
        : autoplay.startBalance - state.balance >= autoplay.lossLimit
          ? 'Autoplay stopped — loss limit reached'
          : autoplay.singleWinLimit !== null && roundWin >= autoplay.singleWinLimit
            ? 'Autoplay stopped — win limit reached'
            : state.balance < bet
              ? 'Autoplay stopped — insufficient balance'
              : null;

    if (reason) {
      this.stopAutoplay(reason);
      return;
    }
    await wait(this.speed.autoSpinDelayMs);
    if (store.get().autoplay) void this.spin();
  }

  // ── Idle win cycling ────────────────────────────────────────

  /** Cycles individual wins while idle so players can see exactly what paid. */
  private startLineCycle(lineWins: readonly LineWin[], scatterWin: ScatterWin | null): void {
    const wins: (LineWin | ScatterWin)[] = [...lineWins, ...(scatterWin ? [scatterWin] : [])];
    if (wins.length < 1) return;
    const token = ++this.lineCycleToken;
    const { scene, store, format, info } = this.deps;

    const describe = (win: LineWin | ScatterWin) =>
      'lineIndex' in win
        ? `Line ${win.lineIndex + 1} · ${win.count}× ${info.symbols[win.symbol].name} · ${format(win.amount)}`
        : `${win.count}× Bonus Scatter · ${format(win.amount)}`;

    void (async () => {
      await wait(1200);
      for (let i = 0; this.lineCycleToken === token; i = (i + 1) % wins.length) {
        const win = wins[i] as LineWin | ScatterWin;
        scene.reels.showSingleWin(win);
        store.set({ message: describe(win) });
        await wait(1400);
      }
    })();
  }

  private stopLineCycle(): void {
    this.lineCycleToken += 1;
    this.deps.scene.reels.clearWins();
  }

  // ── Errors ──────────────────────────────────────────────────

  private handleInsufficientFunds(bet: number): void {
    const { store, info } = this.deps;
    const minBet = Math.min(...info.betLevels);
    this.stopAutoplay('Autoplay stopped — insufficient balance');
    if (store.get().balance < minBet) {
      this.hud.toast('You are out of demo credits.', {
        tone: 'error',
        action: { label: 'Refill credits', onClick: () => void this.refill() },
        durationMs: 10_000,
      });
    } else {
      this.hud.toast(
        `Your balance is too low for a ${this.deps.format(bet)} bet — lower your stake.`,
        { tone: 'error' },
      );
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
      this.hud.toast('Your session has expired.', {
        tone: 'error',
        action: { label: 'Start new session', onClick: () => window.location.reload() },
        durationMs: 15_000,
      });
      return;
    }
    if (error instanceof ApiError && error.code === 'INSUFFICIENT_FUNDS') {
      this.handleInsufficientFunds(this.deps.info.betLevels[this.deps.store.get().betIndex] ?? 0);
      return;
    }
    const message = error instanceof Error ? error.message : 'Something went wrong';
    this.hud.toast(message, { tone: 'error' });
  }
}
