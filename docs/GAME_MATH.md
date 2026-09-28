# Gem Rush — Math Sheet

## Configuration

| Property        | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Layout          | 5 reels × 3 rows, 20 fixed paylines, pays left → right                  |
| Bet levels      | €0.20 · €0.40 · €1.00 · €2.00 · €4.00 · €10.00 · €20.00 (default €1.00) |
| Wild            | Reels 2–5, substitutes for all symbols except the scatter; no own pay   |
| Scatter (BONUS) | All reels (max one per reel in view); pays anywhere                     |
| Free Spins      | 3 / 4 / 5 scatters → 10 / 15 / 20 spins, all wins ×3, retriggerable     |

## Paytable

Line pays are multiples of the **line bet** (total bet ÷ 20). Scatter pays are multiples of the **total bet**.

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

## Reel strips

Strips are authored as **symbol counts** (`packages/server/src/domain/math/reelSets.ts`). Only the counts affect the
odds, because every stop is equally likely. A seeded shuffle then lays them out reproducibly while making sure no reel
ever shows two scatters.

| Reel set   | Royals J/Q/K/A | Gems Am/Em/Sa/Ru | Wild (reels 2–5) | Scatter per reel  | Strip length |
| ---------- | -------------- | ---------------- | ---------------- | ----------------- | ------------ |
| Base       | 9 / 9 / 8 / 8  | 5 / 5 / 4 / 3    | 4                | 2 · 1 · 2 · 1 · 2 | 53–57        |
| Free Spins | 7 / 6 / 6 / 5  | 4 / 4 / 3 / 2    | 6                | 1 each            | 38–44        |

Free Spins use their own, richer strips (fewer royals, more wilds). This is the standard lever for making the feature
feel special without changing the paytable.

## RTP breakdown

| Component                | Exact (closed form) | Simulated (5M rounds, seed 2026) |
| ------------------------ | ------------------- | -------------------------------- |
| Base game                | 71.155%             | 71.083%                          |
| Free Spins               | 24.953%             | 24.846%                          |
| **Total RTP**            | **96.108%**         | **95.930% (±0.425% @ 95%)**      |
| Feature frequency        | 1 in 190.8          | 1 in 190.4                       |
| Avg. spins per feature   | 10.55               | 10.56                            |
| Avg. feature value       | ≈ 47.6× bet         |                                  |
| Hit frequency            | –                   | 44.3%                            |
| Volatility (σ per round) | –                   | 4.85 (medium)                    |

### How the exact figure is computed (`theoreticalRtp.ts`)

1. **Lines.** Reels are independent and every stop is uniform, so each cell on a payline follows its reel's symbol
   distribution. For symbol _s_ and length _k_:
   `P = p₁(s) · Π₂..ₖ (pᵣ(s) + pᵣ(W)) · (1 − pₖ₊₁(s) − pₖ₊₁(W))`. With `lineBet = bet / 20`, the per-line EV in
   line-bet units equals the line RTP of the whole spin.
2. **Scatters.** With at most one scatter per window, reel _r_ shows one with probability `3·countᵣ/lengthᵣ`. The
   scatter count follows a Poisson-binomial distribution.
3. **Free Spins.** Each feature spin awards _a_ more spins on average, so expected spins per feature = `N / (1 − a)`.
   Feature RTP = `E[N] · multiplier · (FS line RTP + FS scatter RTP) / (1 − a)`.

The test suite asserts the RTP stays within 95.5–96.5%, the feature frequency within 1-in-150 to 1-in-250, and that
the Monte Carlo result agrees with the closed form. A strip change that breaks the math therefore fails CI.

### Win distribution (simulated)

| Round win (× bet) | Frequency   |
| ----------------- | ----------- |
| 0 – 1×            | 1 in 4.6    |
| 1 – 2×            | 1 in 8.2    |
| 2 – 5×            | 1 in 13.9   |
| 5 – 10×           | 1 in 46.8   |
| 10 – 25×          | 1 in 126    |
| 25 – 50×          | 1 in 441    |
| 50 – 100×         | 1 in 557    |
| 100 – 250×        | 1 in 2,366  |
| 250 – 500×        | 1 in 72,464 |

Reproduce with `npm run simulate -- 5000000 2026`.
