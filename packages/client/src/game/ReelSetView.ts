import type { GameConfig, LineWin, Position, ScatterWin, SymbolId } from '@gem-rush/shared';
import { Container } from 'pixi.js';
import type { SpeedProfile } from '../config/presentation';
import { SkipSignal } from '../core/SkipSignal';
import type { SymbolTextures } from './art/SymbolTextures';
import { ReelView } from './ReelView';
import { WinLinesView } from './WinLinesView';

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
];

/**
 * The 5x3 reel area: owns the reels, the payline overlay and win highlighting.
 * It only *presents* results — every symbol it lands on comes from the server.
 */
export class ReelSetView extends Container {
  readonly reels: ReelView[];
  private readonly winLines: WinLinesView;
  private skipRequested = false;
  private readonly skip = new SkipSignal();

  constructor(
    textures: SymbolTextures,
    private readonly config: GameConfig,
    readonly cellSize: number,
  ) {
    super();
    // Visual-only filler while spinning. The real strips are server-side and
    // are never needed (or exposed) on the client.
    const randomSymbol = () =>
      FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)] as SymbolId;

    this.reels = Array.from({ length: config.reels }, (_, reel) => {
      const view = new ReelView(textures, cellSize, config.rows, randomSymbol);
      view.x = reel * cellSize;
      return view;
    });
    this.winLines = new WinLinesView(config.paylines, cellSize);
    this.addChild(...this.reels, this.winLines);
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
  showWins(lineWins: readonly LineWin[], scatterWin: ScatterWin | null): void {
    const positions = [...lineWins.flatMap((w) => w.positions), ...(scatterWin?.positions ?? [])];
    this.highlight(positions);
    this.winLines.show(lineWins.map((w) => w.lineIndex));
  }

  showSingleWin(win: LineWin | ScatterWin): void {
    this.highlight(win.positions);
    this.winLines.show('lineIndex' in win ? [win.lineIndex] : []);
  }

  clearWins(): void {
    this.winLines.clear();
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
