import { Text } from 'pixi.js';
import { wait } from '../../core/tween';
import { Overlay } from './Overlay';
import { GlowText } from '../GlowText';
import { bodyStyle, HEADLINE_GLOW, headlineStyle } from './textStyles';

export interface BannerOptions {
  readonly title: string;
  readonly body?: string;
  readonly hint?: string;
  /** Auto-dismiss after this delay (autoplay / free spins keep flowing). */
  readonly autoCloseMs?: number;
}

/** Feature intro/outro and retrigger announcements. */
export class BannerOverlay extends Overlay {
  private readonly title = new GlowText('', headlineStyle(96), HEADLINE_GLOW);
  private readonly body = new Text({ text: '', style: bodyStyle(40), anchor: 0.5 });
  private readonly hint = new Text({ text: '', style: bodyStyle(24), anchor: 0.5 });

  constructor() {
    super();
    this.body.y = 100;
    this.hint.y = 190;
    this.hint.alpha = 0.7;
    this.content.addChild(this.title, this.body, this.hint);
  }

  async show({
    title,
    body = '',
    hint = 'Tap to continue',
    autoCloseMs,
  }: BannerOptions): Promise<void> {
    this.title.text = title;
    this.body.text = body;
    this.hint.text = hint;
    await this.fadeIn();
    await (autoCloseMs === undefined
      ? this.nextTap()
      : Promise.race([this.nextTap(), wait(autoCloseMs)]));
    await this.fadeOut();
  }
}
