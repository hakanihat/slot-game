import { Text, type Texture } from 'pixi.js';
import { WIN_TIERS, winTierFor, type WinTier } from '../../config/presentation';
import { Ease, tween, wait } from '../../core/tween';
import { CoinShower } from './CoinShower';
import { Overlay } from './Overlay';
import { GlowText } from '../GlowText';
import { bodyStyle, HEADLINE_GLOW, headlineStyle } from './textStyles';

export interface BigWinOptions {
  readonly amount: number;
  readonly bet: number;
  readonly durationMs: number;
  readonly format: (amount: number) => string;
  readonly onTier?: (tier: WinTier) => void;
}

/**
 * Celebration for wins ≥ the BIG tier. The counter rolls up and the title
 * escalates BIG → MEGA → EPIC as thresholds are crossed, which stretches the
 * payoff moment. First tap fast-forwards, second tap dismisses — the player
 * is never trapped in a long animation.
 */
export class BigWinOverlay extends Overlay {
  private readonly title = new GlowText('', headlineStyle(120), HEADLINE_GLOW);
  private readonly amountText = new GlowText('', headlineStyle(88), HEADLINE_GLOW);
  private readonly hint = new Text({ text: 'Tap to skip', style: bodyStyle(24), anchor: 0.5 });
  private readonly coins: CoinShower;

  constructor(coinTexture: Texture, coinRate: number) {
    super();
    this.coins = new CoinShower(coinTexture, coinRate);
    this.title.y = -90;
    this.amountText.y = 60;
    this.hint.y = 170;
    this.hint.alpha = 0.6;
    this.content.addChild(this.title, this.amountText, this.hint);
    this.addChildAt(this.coins, 1);
  }

  override resize(width: number, height: number, scale: number): void {
    super.resize(width, height, scale);
    this.coins.resize(width, height);
  }

  async play({ amount, bet, durationMs, format, onTier }: BigWinOptions): Promise<void> {
    const counter = { value: 0 };
    let tier: WinTier = WIN_TIERS[0];
    this.title.text = tier.label;
    this.amountText.text = format(0);
    onTier?.(tier);

    await this.fadeIn();
    this.coins.start();

    const rollup = tween(
      counter,
      { value: amount },
      {
        duration: durationMs,
        ease: Ease.cubicOut,
        onUpdate: () => {
          this.amountText.text = format(Math.round(counter.value));
          const reached = winTierFor(counter.value, bet);
          if (reached && reached !== tier) {
            tier = reached;
            this.title.text = tier.label;
            this.title.scale.set(1.4);
            void tween(this.title.scale, { x: 1, y: 1 }, { duration: 400, ease: Ease.elasticOut });
            onTier?.(tier);
          }
        },
      },
    );

    await Promise.race([rollup.finished, this.nextTap()]);
    rollup.complete();
    this.hint.text = 'Tap to continue';
    await Promise.race([wait(1600), this.nextTap()]);

    this.coins.stop();
    await this.fadeOut();
    this.coins.clear();
    this.hint.text = 'Tap to skip';
  }
}
