import type { BonusPick, BonusPrize, BonusState } from '@gem-rush/shared';
import { Container, FillGradient, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { Ease, tween, wait } from '../../core/tween';
import { DISPLAY_FONT } from '../art/fonts';
import { GlowText } from '../GlowText';
import { bodyStyle, HEADLINE_GLOW, headlineStyle } from './textStyles';

const COLUMNS = 4;
const TILE = 150;
const GAP = 20;
const PLATE = 136;
/** Content box (title → total) in design units, and its vertical centre offset. */
const DESIGN_WIDTH = 820;
const DESIGN_HEIGHT = 720;
const DESIGN_CENTER_OFFSET = 15;

/** One vault in the grid: closed chest on the front, revealed prize plate on the back. */
class VaultTile extends Container {
  readonly front: Sprite;
  private readonly back = new Container();
  opened = false;

  constructor(texture: Texture, onTap: () => void) {
    super();
    this.front = new Sprite({ texture, anchor: 0.5 });
    this.front.width = this.front.height = TILE;
    this.back.visible = false;
    this.addChild(this.front, this.back);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', onTap);
    this.on(
      'pointerover',
      () => !this.opened && tween(this.scale, { x: 1.08, y: 1.08 }, { duration: 120 }),
    );
    this.on(
      'pointerout',
      () => !this.opened && tween(this.scale, { x: 1, y: 1 }, { duration: 120 }),
    );
  }

  /** Card-flip reveal: squash to zero width, swap faces, spring back. */
  async flip(prize: BonusPrize, amountLabel: string, faded = false): Promise<void> {
    this.opened = true;
    this.cursor = 'default';
    this.drawPlate(prize, amountLabel);
    await tween(this.scale, { x: 0, y: 1.05 }, { duration: faded ? 80 : 130, ease: Ease.quadIn })
      .finished;
    this.front.visible = false;
    this.back.visible = true;
    this.back.alpha = faded ? 0.5 : 1;
    await tween(this.scale, { x: 1, y: 1 }, { duration: faded ? 120 : 260, ease: Ease.backOut })
      .finished;
  }

  private drawPlate(prize: BonusPrize, amountLabel: string): void {
    const collect = prize.kind === 'collect';
    const border = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: collect
        ? [
            { offset: 0, color: '#ffc2cf' },
            { offset: 1, color: '#a3123a' },
          ]
        : [
            { offset: 0, color: '#fff3b0' },
            { offset: 1, color: '#b36b00' },
          ],
    });
    const plate = new Graphics()
      .roundRect(-PLATE / 2, -PLATE / 2, PLATE, PLATE, 22)
      .fill(border)
      .roundRect(-PLATE / 2 + 6, -PLATE / 2 + 6, PLATE - 12, PLATE - 12, 18)
      .fill({ color: collect ? 0x4a0619 : 0x1d0b3d });

    const headline = new Text({
      text: collect ? 'COLLECT' : `×${prize.multiplier}`,
      anchor: 0.5,
      style: {
        fontFamily: [DISPLAY_FONT, 'Georgia', 'serif'],
        fontWeight: '900',
        fontSize: collect ? 24 : 50,
        fill: collect ? '#ffd6e0' : '#ffe27a',
        stroke: { color: '#1a0833', width: 5, join: 'round' },
      },
    });
    headline.y = collect ? 0 : -14;
    this.back.removeChildren();
    this.back.addChild(plate, headline);

    if (!collect) {
      const amount = new Text({ text: amountLabel, anchor: 0.5, style: bodyStyle(22) });
      amount.y = 36;
      this.back.addChild(amount);
    }
  }
}

/**
 * Gem Vault pick bonus. Purely presentational: the controller asks the server
 * for each pick's result and tells this view what to reveal.
 */
export class BonusGameView extends Container {
  private readonly backdrop = new Graphics();
  private readonly content = new Container();
  private readonly title = new GlowText('GEM VAULT', headlineStyle(72), HEADLINE_GLOW);
  private readonly subtitle = new Text({ text: '', anchor: 0.5, style: bodyStyle(26) });
  private readonly total = new GlowText('', headlineStyle(44), HEADLINE_GLOW);
  private readonly grid = new Container();
  private tiles: VaultTile[] = [];
  private pending: ((tile: number) => void) | null = null;
  private format: (cents: number) => string = String;

  constructor(private readonly vaultTexture: Texture) {
    super();
    this.visible = false;
    this.eventMode = 'static';
    this.title.y = -300;
    this.subtitle.y = -236;
    this.grid.y = -115;
    this.total.y = 340;
    this.content.addChild(this.title, this.subtitle, this.grid, this.total);
    this.addChild(this.backdrop, this.content);
  }

  /** Fits the pick game into the area the HUD leaves free, like the reels. */
  resize(width: number, height: number, insets: { top: number; bottom: number }): void {
    this.backdrop.clear().rect(0, 0, width, height).fill({ color: 0x0b0320, alpha: 0.92 });
    const available = Math.max(height - insets.top - insets.bottom, 100);
    const scale = Math.min(width / DESIGN_WIDTH, available / DESIGN_HEIGHT, 1);
    this.content.scale.set(scale);
    this.content.position.set(width / 2, insets.top + available / 2 - DESIGN_CENTER_OFFSET * scale);
  }

  /** Builds the grid; picks already made (resumed session) are shown opened. */
  async open(state: BonusState, format: (cents: number) => string): Promise<void> {
    this.format = format;
    this.grid.removeChildren();
    this.tiles = Array.from({ length: state.tiles }, (_, index) => {
      const tile = new VaultTile(this.vaultTexture, () => this.handleTap(index));
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      tile.x = (column - (COLUMNS - 1) / 2) * (TILE + GAP);
      tile.y = row * (TILE + GAP);
      this.grid.addChild(tile);
      return tile;
    });
    this.setTotal(state.totalWin);
    this.subtitle.text = 'Pick a vault — find COLLECT to end the bonus';

    this.visible = true;
    this.alpha = 0;
    await tween(this as Container, { alpha: 1 }, { duration: 250 }).finished;
    for (const pick of state.picks)
      await this.tiles[pick.tile]?.flip(pick.prize, this.amountOf(pick.prize), false);
  }

  /** Resolves with the next unopened tile the player chooses. */
  nextPick(): Promise<number> {
    return new Promise((resolve) => (this.pending = resolve));
  }

  /** Chooses for the player (Space key, autoplay). */
  pickRandom(): void {
    const closed = this.tiles.map((t, i) => (t.opened ? -1 : i)).filter((i) => i >= 0);
    const choice = closed[Math.floor(Math.random() * closed.length)];
    if (choice !== undefined) this.handleTap(choice);
  }

  get waitingForPick(): boolean {
    return this.pending !== null;
  }

  async reveal(pick: BonusPick, totalWin: number): Promise<void> {
    await this.tiles[pick.tile]?.flip(pick.prize, this.amountOf(pick.prize));
    this.setTotal(totalWin);
    if (pick.prize.kind === 'prize') {
      this.total.scale.set(1.2);
      void tween(this.total.scale, { x: 1, y: 1 }, { duration: 300, ease: Ease.backOut });
    } else {
      this.subtitle.text = 'COLLECT! Here is what the other vaults held…';
    }
  }

  /** Shows what the closed vaults held, faded, so the player sees the outcome was real. */
  async revealRest(unrevealed: readonly BonusPick[]): Promise<void> {
    for (const pick of unrevealed) {
      void this.tiles[pick.tile]?.flip(pick.prize, this.amountOf(pick.prize), true);
      await wait(60);
    }
    await wait(300);
  }

  async close(): Promise<void> {
    this.pending = null;
    await tween(this as Container, { alpha: 0 }, { duration: 250 }).finished;
    this.visible = false;
    this.grid.removeChildren();
    this.tiles = [];
  }

  private handleTap(index: number): void {
    const tile = this.tiles[index];
    if (!tile || tile.opened || !this.pending) return;
    const resolve = this.pending;
    this.pending = null;
    resolve(index);
  }

  private setTotal(totalWin: number): void {
    this.total.text = `BONUS WIN ${this.format(totalWin)}`;
  }

  private amountOf(prize: BonusPrize): string {
    return prize.kind === 'prize' ? this.format(prize.amount) : '';
  }
}
