import { lineBetFor, type GameInfo, type SymbolId } from '@gem-rush/shared';
import { PAYLINE_COLORS } from '../../config/presentation';
import { el } from '../../core/dom';
import { Modal } from './Modal';

const PAY_ORDER: readonly SymbolId[] = [
  'RUBY',
  'SAPPHIRE',
  'EMERALD',
  'AMETHYST',
  'A',
  'K',
  'Q',
  'J',
];

/**
 * Game rules and paytable. Pays are shown in currency for the *current* bet —
 * players think in money, not multipliers — and re-render when the bet changes.
 */
export class PaytableModal {
  private readonly modal = new Modal('Paytable & Rules', 'modal--wide');

  constructor(
    private readonly info: GameInfo,
    private readonly symbolImage: (id: SymbolId) => string,
    private readonly format: (cents: number) => string,
  ) {}

  open(bet: number): void {
    this.render(bet);
    this.modal.open();
  }

  private render(bet: number): void {
    const { info, format } = this;
    const lineBet = lineBetFor(bet);
    const fs = info.freeSpins;
    const scatterRows = ([3, 4, 5] as const).map((n) =>
      el('li', {}, [
        el('b', { text: `${n}×` }),
        ` ${format(info.scatterPays[n] * bet)} + ${fs.award[n]} Free Spins`,
      ]),
    );

    this.modal.body.replaceChildren(
      el('p', { class: 'paytable__bet', text: `Values shown for a total bet of ${format(bet)}.` }),
      el('section', { class: 'paytable__features' }, [
        this.featureCard('WILD', 'Wild', [
          `Substitutes for every symbol except SCATTER and BONUS.`,
          `Lands on reels ${info.wildReels.map((r) => r + 1).join(', ')}.`,
        ]),
        this.featureCard('SCATTER', 'Star Scatter', ['Pays anywhere on the reels:'], scatterRows),
        this.featureCard('BONUS', 'Gem Vault Bonus', [
          `A BONUS on reels ${info.bonusGame.triggerReels.map((r) => r + 1).join(', ')} starts the Gem Vault.`,
          `Open vaults to win ${Math.min(...info.bonusGame.prizes)}× to ${Math.max(...info.bonusGame.prizes)}× your bet (${format(Math.min(...info.bonusGame.prizes) * bet)} – ${format(Math.max(...info.bonusGame.prizes) * bet)}) until you find one of ${info.bonusGame.collects} COLLECT vaults. The first vault always pays.`,
          'Prizes are decided when the bonus starts; which vault you open does not change the outcome.',
        ]),
        el('article', { class: 'feature-card feature-card--accent' }, [
          el('h3', { text: 'Free Spins' }),
          el('p', {
            text: `All wins are multiplied ×${fs.multiplier}. Free Spins are played at the triggering bet and can be retriggered.`,
          }),
        ]),
      ]),
      el(
        'section',
        { class: 'paytable__grid' },
        PAY_ORDER.map((id) => {
          const pays = info.linePays[id];
          return el('article', { class: 'pay-card' }, [
            el('img', {
              src: this.symbolImage(id),
              alt: info.symbols[id].name,
              width: 72,
              height: 72,
            }),
            el(
              'ul',
              {},
              ([5, 4, 3] as const).map((n) =>
                el('li', {}, [
                  el('b', { text: `${n}×` }),
                  ` ${format((pays?.[n] ?? 0) * lineBet)}`,
                ]),
              ),
            ),
          ]);
        }),
      ),
      el('h3', { text: `${info.paylines.length} Paylines` }),
      el(
        'section',
        { class: 'paylines' },
        info.paylines.map((rows, index) => this.paylineDiagram(rows, index)),
      ),
      el('h3', { text: 'Rules' }),
      el('ul', { class: 'rules' }, [
        el('li', {
          text: 'Line wins pay left to right on adjacent reels, starting from the leftmost reel.',
        }),
        el('li', {
          text: `Line pays are multiplied by the line bet (total bet ÷ ${info.paylines.length}).`,
        }),
        el('li', {
          text: 'Only the highest win per line is paid. Wins on different lines are added.',
        }),
        el('li', { text: 'Scatter wins are multiplied by the total bet and added to line wins.' }),
        el('li', {
          text: 'All outcomes are determined by the server using a certified-style random number generator.',
        }),
        el('li', { text: 'Malfunction voids all pays and plays.' }),
        el('li', { text: `Theoretical return to player (RTP): ${(info.rtp * 100).toFixed(2)}%.` }),
      ]),
    );
  }

  private featureCard(
    id: SymbolId,
    title: string,
    lines: string[],
    extra: HTMLElement[] = [],
  ): HTMLElement {
    return el('article', { class: 'feature-card' }, [
      el('img', { src: this.symbolImage(id), alt: title, width: 64, height: 64 }),
      el('div', {}, [
        el('h3', { text: title }),
        ...lines.map((line) => el('p', { text: line })),
        extra.length ? el('ul', {}, extra) : null,
      ]),
    ]);
  }

  private paylineDiagram(rows: readonly number[], index: number): HTMLElement {
    const color = `#${(PAYLINE_COLORS[index % PAYLINE_COLORS.length] ?? 0xffffff).toString(16).padStart(6, '0')}`;
    const cells: HTMLElement[] = [];
    for (let row = 0; row < this.info.rows; row += 1) {
      for (let reel = 0; reel < this.info.reels; reel += 1) {
        cells.push(el('span', { class: rows[reel] === row ? 'on' : '' }));
      }
    }
    const figure = el('figure', { class: 'payline', 'aria-label': `Line ${index + 1}` }, [
      el('div', { class: 'payline__cells' }, cells),
      el('figcaption', { text: String(index + 1) }),
    ]);
    figure.style.setProperty('--line-color', color);
    return figure;
  }
}
