import { FillGradient, type TextStyleOptions } from 'pixi.js';
import { DISPLAY_FONT } from '../art/fonts';

const goldFill = () =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.4, color: '#ffe27a' },
      { offset: 1, color: '#e08a00' },
    ],
  });

export const headlineStyle = (fontSize: number): TextStyleOptions => ({
  fontFamily: [DISPLAY_FONT, 'Georgia', 'serif'],
  fontWeight: '900',
  fontSize,
  letterSpacing: 4,
  align: 'center',
  fill: goldFill(),
  stroke: { color: '#3a1600', width: Math.max(4, fontSize / 10), join: 'round' },
});

export const HEADLINE_GLOW = '#ff9d00';

export const bodyStyle = (fontSize: number): TextStyleOptions => ({
  fontFamily: ['Inter', 'system-ui', 'sans-serif'],
  fontWeight: '700',
  fontSize,
  align: 'center',
  fill: '#ffffff',
  stroke: { color: '#1a0833', width: 4, join: 'round' },
  wordWrap: true,
  wordWrapWidth: 900,
});
