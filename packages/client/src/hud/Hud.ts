import type { GameInfo, HistoryEntry, SymbolId } from '@gem-rush/shared';
import { el } from '../core/dom';
import { formatDuration } from '../core/format';
import type { Store } from '../core/Store';
import type { GameState, HudActions } from '../controller/state';
import { AutoplayModal } from './components/AutoplayModal';
import { createDebugPanel } from './components/DebugPanel';
import { HistoryModal } from './components/HistoryModal';
import { Meter } from './components/Meter';
import { PaytableModal } from './components/PaytableModal';
import { Toast, type ToastOptions } from './components/Toast';
import { Icons, iconButton } from './icons';

export interface HudDependencies {
  readonly root: HTMLElement;
  readonly store: Store<GameState>;
  readonly actions: HudActions;
  readonly info: GameInfo;
  readonly format: (cents: number) => string;
  readonly symbolImage: (id: SymbolId) => string;
  readonly loadHistory: () => Promise<readonly HistoryEntry[]>;
  /** Called whenever the HUD's footprint changes so the canvas can re-fit the reels. */
  readonly onLayoutChange: () => void;
  /** Shows the QA cheat panel. */
  readonly debug?: boolean;
}

/**
 * The DOM HUD. Renders purely from the store and forwards player intent to
 * `HudActions` — it never mutates game state itself (unidirectional flow).
 */
export class Hud {
  private readonly topBar: HTMLElement;
  private readonly bottom: HTMLElement;
  private readonly balance: Meter;
  private readonly win: Meter;
  private readonly betValue: HTMLElement;
  private readonly betDown: HTMLButtonElement;
  private readonly betUp: HTMLButtonElement;
  private readonly spinButton: HTMLButtonElement;
  private readonly spinLabel: HTMLElement;
  private readonly autoButton: HTMLButtonElement;
  private readonly turboButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly message: HTMLElement;
  private readonly featurePanel: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly toasts = new Toast();
  private readonly paytable: PaytableModal;
  private readonly autoplay: AutoplayModal;
  private readonly history: HistoryModal;

  constructor(private readonly deps: HudDependencies) {
    const { store, actions, format, info } = deps;

    // ── Top bar ────────────────────────────────────────────────
    const infoButton = iconButton(Icons.info, 'Paytable and rules');
    const historyButton = iconButton(Icons.history, 'Game history');
    this.soundButton = iconButton(Icons.soundOn, 'Mute sound');
    const fullscreenButton = iconButton(Icons.fullscreen, 'Toggle fullscreen');
    this.clock = el('span', {
      class: 'clock',
      title: 'Session time',
      'aria-label': 'Session time',
    });
    this.topBar = el('header', { class: 'topbar' }, [
      el('div', { class: 'topbar__group' }, [infoButton, historyButton]),
      el('div', { class: 'topbar__group topbar__center' }, [
        el('span', { class: 'demo-badge', text: 'DEMO · play money' }),
        this.clock,
      ]),
      el('div', { class: 'topbar__group' }, [this.soundButton, fullscreenButton]),
    ]);

    // ── Bottom HUD ─────────────────────────────────────────────
    this.balance = new Meter('Balance', format, 'meter--balance');
    this.win = new Meter('Win', format, 'meter--win');

    this.betDown = iconButton(Icons.minus, 'Decrease bet', 'round-btn bet-down');
    this.betUp = iconButton(Icons.plus, 'Increase bet', 'round-btn bet-up');
    this.betValue = el('span', { class: 'meter__value' });
    const betControl = el('div', { class: 'bet-control' }, [
      this.betDown,
      el('div', { class: 'meter meter--bet' }, [
        el('span', { class: 'meter__label', text: 'Bet' }),
        this.betValue,
      ]),
      this.betUp,
    ]);

    this.spinLabel = el('span', { class: 'spin-btn__label' });
    this.spinButton = el('button', { type: 'button', class: 'spin-btn', 'aria-label': 'Spin' }, [
      this.spinLabel,
    ]);
    this.autoButton = iconButton(Icons.autoplay, 'Autoplay', 'round-btn round-btn--small auto-btn');
    this.turboButton = iconButton(
      Icons.turbo,
      'Turbo mode',
      'round-btn round-btn--small turbo-btn',
    );
    this.turboButton.setAttribute('aria-pressed', 'false');

    this.message = el('div', { class: 'message-bar', 'aria-live': 'polite' });
    this.featurePanel = el(
      'div',
      { class: 'feature-panel feature-panel--idle', 'aria-hidden': 'true' },
      [el('span', { class: 'feature-panel__title', text: 'FREE SPINS' })],
    );

    this.bottom = el('footer', { class: 'hud' }, [
      this.featurePanel,
      this.message,
      el('div', { class: 'controls' }, [
        this.balance.element,
        betControl,
        el('div', { class: 'spin-cluster' }, [this.autoButton, this.spinButton, this.turboButton]),
        this.win.element,
      ]),
    ]);

    deps.root.append(this.topBar, this.bottom, this.toasts.element);
    if (deps.debug)
      deps.root.append(createDebugPanel((scenario) => actions.spinWithCheat(scenario)));

    // ── Modals ─────────────────────────────────────────────────
    this.paytable = new PaytableModal(info, deps.symbolImage, format);
    this.autoplay = new AutoplayModal(format, (settings) => actions.startAutoplay(settings));
    this.history = new HistoryModal(deps.loadHistory, format);

    // ── Intent wiring ──────────────────────────────────────────
    this.spinButton.addEventListener('click', () => actions.primaryAction());
    this.betDown.addEventListener('click', () => actions.changeBet(-1));
    this.betUp.addEventListener('click', () => actions.changeBet(1));
    this.turboButton.addEventListener('click', () => actions.setTurbo(!store.get().turbo));
    this.soundButton.addEventListener('click', () => actions.setMuted(!store.get().muted));
    this.autoButton.addEventListener('click', () => {
      const state = store.get();
      if (state.autoplay) actions.stopAutoplay();
      else this.autoplay.open(this.currentBet(), state.balance);
    });
    infoButton.addEventListener('click', () => this.paytable.open(this.currentBet()));
    historyButton.addEventListener('click', () => void this.history.open());
    fullscreenButton.addEventListener('click', () => toggleFullscreen());
    this.bindKeyboard();

    new ResizeObserver(() => deps.onLayoutChange()).observe(this.bottom);
    new ResizeObserver(() => deps.onLayoutChange()).observe(this.topBar);

    this.bindStore();
  }

  get insets(): { top: number; bottom: number } {
    return { top: this.topBar.offsetHeight, bottom: this.bottom.offsetHeight };
  }

  rollupWin(from: number, to: number, durationMs: number): Promise<void> {
    return this.win.rollup(from, to, durationMs);
  }

  skipRollup(): void {
    this.win.skip();
  }

  toast(message: string, options?: ToastOptions): void {
    this.toasts.show(message, options);
  }

  private currentBet(): number {
    return this.deps.info.betLevels[this.deps.store.get().betIndex] ?? 0;
  }

  private bindStore(): void {
    const { store, format, info } = this.deps;

    store.select(
      (s) => s.balance,
      (balance) => this.balance.set(balance),
    );
    store.select(
      (s) => s.win,
      (win) => this.win.set(win),
    );
    store.select(
      (s) => s.message,
      (message) => (this.message.textContent = message),
    );
    store.select(
      (s) => s.freeSpins?.bet ?? info.betLevels[s.betIndex] ?? 0,
      (bet) => (this.betValue.textContent = format(bet)),
    );

    store.select(
      (s) => s.turbo,
      (turbo) => {
        this.turboButton.classList.toggle('is-active', turbo);
        this.turboButton.setAttribute('aria-pressed', String(turbo));
      },
    );
    store.select(
      (s) => s.muted,
      (muted) => {
        this.soundButton.innerHTML = muted ? Icons.soundOff : Icons.soundOn;
        this.soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
      },
    );

    store.select(
      (s) => s.freeSpins,
      (fs) => {
        this.featurePanel.classList.toggle('feature-panel--idle', fs === null);
        this.featurePanel.setAttribute('aria-hidden', String(fs === null));
        document.body.classList.toggle('is-feature', fs !== null);
        if (fs) {
          this.featurePanel.replaceChildren(
            el('span', { class: 'feature-panel__title', text: 'FREE SPINS' }),
            el('span', { text: `${fs.remaining} left of ${fs.total}` }),
            el('span', { class: 'feature-panel__mult', text: `×${fs.multiplier}` }),
            el('span', { text: `Feature win ${format(fs.totalWin)}` }),
          );
        }
      },
    );

    // Button availability is derived from several fields, so recompute on any change.
    store.subscribe((state) => this.renderControls(state));
    this.renderControls(store.get());

    const tickClock = () =>
      (this.clock.textContent = formatDuration(Date.now() - store.get().sessionStartedAt));
    tickClock();
    setInterval(tickClock, 1000);
  }

  private renderControls(state: GameState): void {
    const { info } = this.deps;
    const idle = state.phase === 'idle';
    const locked = !idle || state.autoplay !== null || state.freeSpins !== null;

    this.betDown.disabled = locked || state.betIndex <= 0;
    this.betUp.disabled = locked || state.betIndex >= info.betLevels.length - 1;
    this.autoButton.disabled =
      state.phase === 'loading' || (state.freeSpins !== null && !state.autoplay);
    this.autoButton.classList.toggle('is-active', state.autoplay !== null);
    this.autoButton.setAttribute('aria-label', state.autoplay ? 'Stop autoplay' : 'Autoplay');

    let label: string;
    let mode: string;
    if (state.autoplay) {
      mode = 'auto';
      label = `STOP\n${state.autoplay.remaining}`;
    } else if (state.freeSpins) {
      mode = 'free';
      label = 'FREE';
    } else if (state.phase === 'spinning') {
      mode = 'stop';
      label = 'STOP';
    } else {
      mode = 'spin';
      label = 'SPIN';
    }
    this.spinButton.dataset.mode = mode;
    this.spinButton.disabled = state.phase === 'loading';
    this.spinButton.setAttribute(
      'aria-label',
      mode === 'auto' ? 'Stop autoplay' : mode === 'stop' ? 'Stop reels' : 'Spin',
    );
    this.spinLabel.textContent = label;
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      // Let focused controls and open dialogs handle their own keys.
      if (target?.closest('button, input, select, textarea, a, dialog')) return;
      event.preventDefault();
      this.deps.actions.primaryAction();
    });
  }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement)
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  else void document.exitFullscreen();
}
