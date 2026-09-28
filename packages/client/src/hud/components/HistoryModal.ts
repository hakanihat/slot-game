import type { HistoryEntry } from '@gem-rush/shared';
import { el } from '../../core/dom';
import { Modal } from './Modal';

/** Recent rounds — transparency players (and regulators) expect. */
export class HistoryModal {
  private readonly modal = new Modal('Game History');

  constructor(
    private readonly load: () => Promise<readonly HistoryEntry[]>,
    private readonly format: (cents: number) => string,
  ) {}

  async open(): Promise<void> {
    this.modal.body.replaceChildren(el('p', { class: 'muted', text: 'Loading…' }));
    this.modal.open();
    try {
      this.render(await this.load());
    } catch {
      this.modal.body.replaceChildren(
        el('p', { class: 'muted', text: 'History is unavailable right now.' }),
      );
    }
  }

  private render(rounds: readonly HistoryEntry[]): void {
    if (rounds.length === 0) {
      this.modal.body.replaceChildren(el('p', { class: 'muted', text: 'No rounds played yet.' }));
      return;
    }
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
    this.modal.body.replaceChildren(
      el('table', { class: 'history' }, [
        el('thead', {}, [
          el(
            'tr',
            {},
            ['Time', 'Type', 'Bet', 'Win', 'Balance'].map((h) =>
              el('th', { scope: 'col', text: h }),
            ),
          ),
        ]),
        el(
          'tbody',
          {},
          rounds.map((round) =>
            el('tr', { class: round.win > 0 ? 'history__win' : '' }, [
              el('td', { text: time.format(new Date(round.timestamp)) }),
              el('td', { text: round.mode === 'freeSpins' ? 'Free Spin' : 'Spin' }),
              el('td', { text: this.format(round.bet) }),
              el('td', { text: this.format(round.win) }),
              el('td', { text: this.format(round.balanceAfter) }),
            ]),
          ),
        ),
      ]),
    );
  }
}
