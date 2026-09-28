import type { GameConfig, LineWin, Position, ScatterWin, SymbolId } from '@gem-rush/shared';
import { Container } from 'pixi.js';
import type { SpeedProfile } from '../config/presentation';
import { SkipSignal } from '../core/SkipSignal';
import type { SymbolAssets } from './spine/symbolAssets';
import { ReelView } from './ReelView';
import { WinBadge } from './WinBadge';
import { WinLinesView, lineColor } from './WinLinesView';

export interface StopOptions {
  readonly speed: SpeedProfile;
  /** Skip the stagger and anticipation (turbo slam / player quick-stop). */
  readonly quick: boolean;
  readonly onReelLanded?: (reel: number, symbols: readonly SymbolId[]) => void;
  readonly onAnticipation?: (reel: number) => void;
}

const FILLER_SYMBOLS: readonly SymbolId[] = [
  'J',
  'J',
  'Q',
  'Q',
  'K',
  'K',
  'A',
  'A',
  'AMETHYST',
  'EMERALD',
  'SAPPHIRE',
  'RUBY',
  'WILD',
  'SCATTER',
  'BONUS',
];

/**
 * The 5x3 reel area: owns the reels, the payline overlay and win highlighting.
 * It only *presents* results — every symbol it lands on comes from the server.
 */
export class ReelSetView extends Container {
  readonly reels: ReelView[];
  private readonly winLines: WinLinesView;
  private readonly badge: WinBadge;
  private skipRequested = false;
  private readonly skip = new SkipSignal();

  constructor(
    assets: SymbolAssets,
    private readonly config: GameConfig,
    readonly cellSize: number,
  ) {
    super();
    // Visual-only filler while spinning. The real strips are server-side and
    // are never needed (or exposed) on the client.
    const randomSymbol = () =>
      FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)] as SymbolId;

    this.reels = Array.from({ length: config.reels }, (_, reel) => {
      const view = new ReelView(assets, cellSize, config.rows, randomSymbol);
      view.x = reel * cellSize;
      return view;
    });
    this.winLines = new WinLinesView(config.paylines, cellSize);
    this.badge = new WinBadge(cellSize * 0.2);
    this.addChild(...this.reels, this.winLines, this.badge);
  }

  get gridWidth(): number {
    return this.config.reels * this.cellSize;
  }

  get gridHeight(): number {
    return this.config.rows * this.cellSize;
  }

  setGrid(grid: readonly (readonly SymbolId[])[]): void {
    grid.forEach((symbols, reel) => this.reels[reel]?.setSymbols(symbols));
  }

  startSpin(speed: SpeedProfile): void {
    this.skipRequested = false;
    this.clearWins();
    this.reels.forEach((reel, i) => void reel.startSpin(speed.reelSpeed, i * 45));
  }

  /** Makes any in-flight stop sequence finish immediately. */
  requestQuickStop(): void {
    this.skipRequested = true;
    this.skip.trigger();
  }

  async stopOn(grid: readonly (readonly SymbolId[])[], options: StopOptions): Promise<void> {
    const { speed, onReelLanded, onAnticipation } = options;
    const landings: Promise<void>[] = [];
    let scattersSoFar = 0;
    const scattersNeeded = 3;

    for (let reel = 0; reel < this.reels.length; reel += 1) {
      const view = this.reels[reel] as ReelView;
      const symbols = grid[reel] ?? [];
      const quick = options.quick || this.skipRequested;
      // Anticipation: when the feature is one scatter away, remaining reels spin longer.
      const anticipate = !quick && scattersSoFar >= scattersNeeded - 1;

      if (anticipate) {
        await Promise.all(landings);
        view.setAnticipation(true);
        onAnticipation?.(reel);
        await this.skippableWait(speed.anticipationMs);
      } else if (reel > 0 && !quick) {
        await this.skippableWait(speed.reelStopStaggerMs);
      }

      landings.push(view.stop(symbols).then(() => onReelLanded?.(reel, symbols)));
      scattersSoFar += symbols.filter((s) => s === 'SCATTER').length;
    }
    await Promise.all(landings);
    this.reels.forEach((r) => r.setAnticipation(false));
  }

  /** Highlights every win at once: winning cells pulse, everything else dims. */
  /** Highlights every win at once, with the round's total in the centre. */
  showWins(lineWins: readonly LineWin[], scatterWin: ScatterWin | null, totalLabel: string): void {
    const positions = [...lineWins.flatMap((w) => w.positions), ...(scatterWin?.positions ?? [])];
    this.highlight(positions);
    this.winLines.show(lineWins.map((w) => w.lineIndex));
    this.badge.show(totalLabel, this.gridWidth / 2, this.gridHeight / 2, 0xffd54a);
  }

  /**
   * Shows one win with its payout. Line wins put the badge on the line, at the
   * last symbol of the combination, where players look to see "how far" it went.
   */
  showSingleWin(win: LineWin | ScatterWin, label: string): void {
    this.highlight(win.positions);
    if ('lineIndex' in win) {
      this.winLines.show([win.lineIndex]);
      const last = win.positions[win.positions.length - 1] ?? { reel: 0, row: 0 };
      const x = (last.reel + 0.5) * this.cellSize;
      const y = (last.row + 0.5) * this.cellSize;
      this.badge.show(label, x, y + this.cellSize * 0.32, lineColor(win.lineIndex));
    } else {
      this.winLines.clear();
      this.badge.show(label, this.gridWidth / 2, this.gridHeight / 2, 0xff5ccf);
    }
  }

  /** Highlights feature-trigger symbols (e.g. the three BONUS vaults) without lines or badges. */
  showTrigger(positions: readonly Position[]): void {
    this.winLines.clear();
    this.badge.hide();
    this.highlight(positions);
  }

  clearWins(): void {
    this.winLines.clear();
    this.badge.hide();
    this.forEachVisible((view) => view.stopWinAnimation());
  }

  symbolAt(position: Position) {
    return this.reels[position.reel]?.viewAt(position.row);
  }

  private highlight(positions: readonly Position[]): void {
    const winning = new Set(positions.map((p) => `${p.reel}:${p.row}`));
    this.forEachVisible((view, reel, row) => {
      if (winning.has(`${reel}:${row}`)) {
        view.setDimmed(false);
        view.startWinAnimation();
      } else {
        view.stopWinAnimation();
        view.setDimmed(true);
      }
    });
  }

  private forEachVisible(
    fn: (view: ReturnType<ReelView['viewAt']>, reel: number, row: number) => void,
  ): void {
    this.reels.forEach((reel, r) => {
      for (let row = 0; row < this.config.rows; row += 1) fn(reel.viewAt(row), r, row);
    });
  }

  private skippableWait(ms: number): Promise<void> {
    return this.skipRequested ? Promise.resolve() : this.skip.wait(ms);
  }
}
