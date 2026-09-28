import { AUTOPLAY_LOSS_LIMIT_MULTIPLES, AUTOPLAY_SPIN_OPTIONS } from '../../config/presentation';
import { el } from '../../core/dom';
import type { AutoplaySettings } from '../../controller/state';
import { Modal } from './Modal';

const SINGLE_WIN_MULTIPLES = [null, 10, 50, 100] as const;

/**
 * Autoplay setup. Following responsible-gaming practice (e.g. UKGC RTS 8),
 * a loss limit is mandatory and autoplay always stops on request.
 */
export class AutoplayModal {
  private readonly modal = new Modal('Autoplay');

  constructor(
    private readonly format: (cents: number) => string,
    private readonly onStart: (settings: AutoplaySettings) => void,
  ) {}

  open(bet: number, balance: number): void {
    const spins = this.radioGroup(
      'spins',
      'Number of spins',
      AUTOPLAY_SPIN_OPTIONS.map((n) => ({ value: String(n), label: String(n) })),
      '10',
    );
    const loss = this.radioGroup(
      'loss',
      'Stop if losses reach',
      AUTOPLAY_LOSS_LIMIT_MULTIPLES.map((m) => ({
        value: String(m * bet),
        label: this.format(m * bet),
        disabled: m * bet > balance && m !== AUTOPLAY_LOSS_LIMIT_MULTIPLES[0],
      })),
      String(AUTOPLAY_LOSS_LIMIT_MULTIPLES[0] * bet),
    );
    const singleWin = this.radioGroup(
      'single-win',
      'Stop if a single win exceeds',
      SINGLE_WIN_MULTIPLES.map((m) => ({
        value: m === null ? '' : String(m * bet),
        label: m === null ? 'Off' : this.format(m * bet),
      })),
      '',
    );
    const stopOnFeature = el('input', {
      type: 'checkbox',
      id: 'autoplay-stop-feature',
      checked: true,
    });

    const form = el('form', { class: 'autoplay-form', method: 'dialog' }, [
      spins,
      loss,
      singleWin,
      el('label', { class: 'checkbox' }, [stopOnFeature, ' Stop when Free Spins are won']),
      el('button', { type: 'submit', class: 'btn btn--primary', text: 'Start autoplay' }),
    ]);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const singleWinValue = String(data.get('single-win') ?? '');
      this.onStart({
        spins: Number(data.get('spins')),
        lossLimit: Number(data.get('loss')),
        singleWinLimit: singleWinValue ? Number(singleWinValue) : null,
        stopOnFeature: stopOnFeature.checked,
      });
      this.modal.close();
    });

    this.modal.body.replaceChildren(form);
    this.modal.open();
  }

  private radioGroup(
    name: string,
    legend: string,
    options: { value: string; label: string; disabled?: boolean }[],
    selected: string,
  ): HTMLElement {
    return el('fieldset', { class: 'segmented' }, [
      el('legend', { text: legend }),
      el(
        'div',
        { class: 'segmented__options' },
        options.map((option) =>
          el('label', {}, [
            el('input', {
              type: 'radio',
              name,
              value: option.value,
              checked: option.value === selected,
              disabled: option.disabled,
            }),
            el('span', { text: option.label }),
          ]),
        ),
      ),
    ]);
  }
}
