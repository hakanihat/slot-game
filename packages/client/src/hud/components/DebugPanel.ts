import { CHEAT_SCENARIOS, type CheatScenario } from '@gem-rush/shared';
import { el } from '../../core/dom';

const LABELS: Readonly<Record<CheatScenario, string>> = {
  freeSpins: 'Free Spins',
  bigWin: 'Big Win',
  anticipation: 'Anticipation',
};

/**
 * QA panel for forcing outcomes (open the game with `?debug`). The server
 * must also run with ENABLE_CHEATS=true, so this can never affect real play.
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
