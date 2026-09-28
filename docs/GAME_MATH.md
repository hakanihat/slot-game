# Gem Rush — Math Sheet

## Configuration

| Property       | Value                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| Layout         | 5 reels × 3 rows, 20 fixed paylines, pays left → right                          |
| Bet levels     | €0.20 · €0.40 · €1.00 · €2.00 · €4.00 · €10.00 · €20.00 (default €1.00)         |
| Wild           | Reels 2–5, substitutes for all symbols except SCATTER and BONUS; no own pay     |
| Scatter (star) | All reels (max one per reel in view); pays anywhere; 3+ start Free Spins        |
| Bonus (vault)  | Reels 1, 3, 5 only (max one per reel in view); one on each starts the Gem Vault |
| Free Spins     | 3 / 4 / 5 scatters → 10 / 15 / 20 spins, all wins ×3, retriggerable             |
| Gem Vault      | Pick bonus: 12 vaults = 10 prizes + 2 COLLECT; first pick always a prize        |

## Paytable

Line pays are multiples of the **line bet** (total bet ÷ 20). Scatter pays and vault prizes are multiples of the
**total bet**.

| Symbol   | 3×  | 4×  | 5×              |
| -------- | --- | --- | --------------- |
| Ruby     | 50  | 200 | 1000            |
| Sapphire | 25  | 100 | 400             |
| Emerald  | 20  | 75  | 300             |
| Amethyst | 15  | 50  | 200             |
| A        | 10  | 30  | 125             |
| K        | 10  | 25  | 100             |
| Q        | 5   | 20  | 75              |
| J        | 5   | 15  | 50              |
| Scatter  | 2×  | 10× | 50× (total bet) |

**Gem Vault prizes** (× total bet): 1, 2, 2, 3, 3, 5, 5, 10, 15, 50, plus 2 × COLLECT.

## Reel strips

Strips are authored as **symbol counts** (`packages/server/src/domain/math/reelSets.ts`). Only the counts affect the
odds, because every stop is equally likely. A seeded shuffle then lays them out reproducibly while making sure no reel
ever shows two scatters or two bonus vaults.

| Reel set   | Royals J/Q/K/A | Gems Am/Em/Sa/Ru | Wild (reels 2–5) | Scatter per reel  | Bonus (reels 1/3/5) | Length |
| ---------- | -------------- | ---------------- | ---------------- | ----------------- | ------------------- | ------ |
| Base       | 9 / 9 / 8 / 8  | 5 / 5 / 4 / 3    | 4                | 2 · 1 · 2 · 1 · 2 | 3                   | 56–60  |
| Free Spins | 7 / 6 / 6 / 4  | 4 / 4 / 3 / 2    | 5                | 1 each            | —                   | 37–42  |

Free Spins use their own, richer strips (fewer royals, more wilds) and no BONUS symbols. The Gem Vault is a base-game
feature.

## RTP breakdown

| Component              | Exact (closed form) | Simulated (5M rounds, seed 2026) |
| ---------------------- | ------------------- | -------------------------------- |
| Base game (lines)      | 63.354%             | 63.580%                          |
| Free Spins             | 19.027%             | 19.043%                          |
| Gem Vault bonus        | 13.886%             | 13.862%                          |
| **Total RTP**          | **96.268%**         | **96.486% (±0.443% @ 95%)**      |
| Free Spins frequency   | 1 in 211.7          | 1 in 211.5                       |
| Avg. spins per feature | 10.59               | 10.59                            |
| Gem Vault frequency    | 1 in 276.5          | 1 in 276.6                       |
| Avg. Gem Vault win     | 38.4× bet           |                                  |
| Hit frequency          | –                   | 39.8%                            |
| Volatility (σ / round) | –                   | 5.06 (medium)                    |

### How the exact figure is computed (`theoreticalRtp.ts`)

1. **Lines.** Reels are independent and every stop is uniform, so each cell on a payline follows its reel's symbol
   distribution. For symbol _s_ and length _k_:
   `P = p₁(s) · Π₂..ₖ (pᵣ(s) + pᵣ(W)) · (1 − pₖ₊₁(s) − pₖ₊₁(W))`. With `lineBet = bet / 20`, the per-line EV in
   line-bet units equals the line RTP of the whole spin.
2. **Scatters.** With at most one scatter per window, reel _r_ shows one with probability `3·countᵣ/lengthᵣ`. The
   scatter count follows a Poisson-binomial distribution.
3. **Free Spins.** Each feature spin awards _a_ more spins on average, so expected spins per feature = `N / (1 − a)`.
   Feature RTP = `E[N] · multiplier · (FS line RTP + FS scatter RTP) / (1 − a)`.
4. **Gem Vault.** P(trigger) = `Π over reels 1, 3, 5 of 3·countᵣ/lengthᵣ`. With the first pick forced to be a prize
   (mean _m_ of the _n_ prizes, sum _S_) and _c_ COLLECTs shuffled among the rest, every other prize is revealed
   before the first COLLECT with probability `1/(c+1)`, so **E[bonus] = m + (S − m)/(c + 1) = 9.6 + 86.4/3 = 38.4×**.
   Bonus RTP = P(trigger) × 38.4.

The test suite asserts the RTP stays within 95.5–96.5%, Free Spins trigger within 1-in-150 to 1-in-250, the Gem Vault
within 1-in-200 to 1-in-400, and that Monte Carlo runs agree with the closed forms (including 200k simulated bonuses
against the 38.4× formula). A strip change that breaks the math therefore fails CI.

### Server-authoritative pick bonus

The complete vault order is drawn with the CSPRNG **when the bonus triggers** and stored server-side only. Each pick
reveals the next item of that order in whichever tile was clicked, so the player's choice is cosmetic. That's the
standard way regulated pick games stay auditable. Prizes are credited on every pick, so nothing is lost if the player
disconnects, and the bonus resumes exactly where it stopped. The order never appears in any API response (a test
checks this).

### Win distribution (simulated)

| Round win (× bet) | Frequency    |
| ----------------- | ------------ |
| 0 – 1×            | 1 in 5.2     |
| 1 – 2×            | 1 in 9.3     |
| 2 – 5×            | 1 in 15.5    |
| 5 – 10×           | 1 in 54.9    |
| 10 – 25×          | 1 in 115     |
| 25 – 50×          | 1 in 355     |
| 50 – 100×         | 1 in 363     |
| 100 – 250×        | 1 in 3,427   |
| 250 – 500×        | 1 in 238,095 |

Reproduce with `npm run simulate -- 5000000 2026`.
