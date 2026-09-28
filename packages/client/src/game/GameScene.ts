import type { GameConfig } from '@gem-rush/shared';
import { Container, type Application } from 'pixi.js';
import { createCoinTexture, createGlowTexture } from './art/effectsArt';
import type { SymbolAssets } from './spine/symbolAssets';
import { Background } from './Background';
import { Logo } from './Logo';
import { BannerOverlay } from './overlays/BannerOverlay';
import { BigWinOverlay } from './overlays/BigWinOverlay';
import { ReelFrame } from './ReelFrame';
import { ReelSetView } from './ReelSetView';

const CELL_SIZE = 160;
const FRAME_PADDING = 22;
const LOGO_SPACE = 104;
/** Design-space box the machine (logo + frame) is authored in. */
const DESIGN_WIDTH = 5 * CELL_SIZE + FRAME_PADDING * 2 + 24;
const DESIGN_HEIGHT = 3 * CELL_SIZE + FRAME_PADDING * 2 + LOGO_SPACE + 12;

export interface SceneInsets {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Root of the Pixi display list. Layers, back to front: background → machine
 * (frame, reels, logo) → overlays. The machine is authored at a fixed design
 * size and uniformly scaled into whatever space the DOM HUD leaves free.
 */
export class GameScene extends Container {
  readonly reels: ReelSetView;
  readonly bigWin: BigWinOverlay;
  readonly banner: BannerOverlay;
  private readonly background: Background;
  private readonly machine = new Container();

  constructor(
    private readonly app: Application,
    symbols: SymbolAssets,
    config: GameConfig,
    reducedMotion: boolean,
  ) {
    super();
    this.background = new Background(createGlowTexture(), reducedMotion ? 0 : 70);

    this.reels = new ReelSetView(symbols, config, CELL_SIZE);
    const frame = new ReelFrame(
      this.reels.gridWidth,
      this.reels.gridHeight,
      config.reels,
      FRAME_PADDING,
    );
    const logo = new Logo(config.title);
    logo.position.set(this.reels.gridWidth / 2, -FRAME_PADDING - LOGO_SPACE / 2);

    this.machine.addChild(frame, this.reels, logo);
    this.machine.pivot.set(this.reels.gridWidth / 2, (this.reels.gridHeight - LOGO_SPACE) / 2);

    this.bigWin = new BigWinOverlay(createCoinTexture(), reducedMotion ? 0 : 45);
    this.banner = new BannerOverlay();

    this.addChild(this.background, this.machine, this.bigWin, this.banner);
  }

  setTheme(mode: 'base' | 'feature'): void {
    this.background.setTheme(mode);
  }

  /** Fits the machine into the viewport area not covered by the HUD. */
  layout(insets: SceneInsets): void {
    const { width, height } = this.app.screen;
    this.background.resize(width, height);

    const availableHeight = Math.max(height - insets.top - insets.bottom, 100);
    const scale = Math.min((width * 0.98) / DESIGN_WIDTH, (availableHeight * 0.98) / DESIGN_HEIGHT);
    this.machine.scale.set(scale);
    this.machine.position.set(width / 2, insets.top + availableHeight / 2);

    const overlayScale = Math.min(width / 1100, height / 720, 1);
    this.bigWin.resize(width, height, overlayScale);
    this.banner.resize(width, height, overlayScale);
  }
}
