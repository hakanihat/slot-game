import { CHEAT_SCENARIOS, type CheatScenario } from '@gem-rush/shared';
import { el } from '../../core/dom';

const LABELS: Readonly<Record<CheatScenario, string>> = {
  freeSpins: 'Free Spins',
  bonus: 'Gem Vault Bonus',
  bigWin: 'Big Win',
  anticipation: 'Anticipation',
};

/**
 * QA panel for forcing outcomes. Only shown when the server runs in QA mode
 * (`npm run dev:qa`), and only honoured there, so it can never affect real play.
 */
export function createDebugPanel(onCheat: (scenario: CheatScenario) => void): HTMLElement {
  return el('aside', { class: 'debug-panel', 'aria-label': 'QA tools' }, [
    el('span', { class: 'debug-panel__title', text: 'QA' }),
    ...CHEAT_SCENARIOS.map((scenario) => {
      const button = el('button', {
        type: 'button',
        text: LABELS[scenario],
        'data-cheat': scenario,
      });
      button.addEventListener('click', () => onCheat(scenario));
      return button;
    }),
  ]);
}
