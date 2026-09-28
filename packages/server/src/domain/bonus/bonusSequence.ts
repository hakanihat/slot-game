import type { Rng } from '../rng/Rng.js';

/** A hidden vault tile: a prize multiplier (× total bet) or the COLLECT that ends the bonus. */
export type BonusItem = number | 'collect';

export interface BonusGameDefinition {
  readonly prizes: readonly number[];
  readonly collects: number;
}

/**
 * Draws the complete, hidden reveal order for one Gem Vault bonus.
 *
 * The outcome is fixed at trigger time — which tile the player clicks only
 * decides *where* each item is shown, never *what* is won. This is how
 * regulated pick games stay server-authoritative and auditable. The first item
 * is always a prize so the feature can never pay nothing.
 */
export function drawBonusSequence(game: BonusGameDefinition, rng: Rng): BonusItem[] {
  const prizes = [...game.prizes];
  const firstIndex = rng.nextInt(prizes.length);
  const [first] = prizes.splice(firstIndex, 1);
  const rest: BonusItem[] = [...prizes, ...Array<BonusItem>(game.collects).fill('collect')];
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [rest[i], rest[j]] = [rest[j] as BonusItem, rest[i] as BonusItem];
  }
  return [first as number, ...rest];
}

/** Sum of prize multipliers revealed before the first COLLECT. */
export function bonusMultiplierOf(sequence: readonly BonusItem[]): number {
  let total = 0;
  for (const item of sequence) {
    if (item === 'collect') break;
    total += item;
  }
  return total;
}
