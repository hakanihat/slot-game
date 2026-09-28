# Gem Rush — Game Design Notes

These are the player-experience decisions behind the implementation and why each one was made.

## Game feel

| Technique                  | Where                                    | Why                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wind-up before spin        | `ReelView.startSpin`                     | A small upward tug (anticipation principle) makes the reels feel physical rather than scripted.                                                                                                   |
| Motion blur while spinning | `ReelView` `BlurFilter`                  | Sells speed and hides the recycled filler symbols. Removed when idle so there's no cost.                                                                                                          |
| Staggered stops + bounce   | `ReelSetView.stopOn`, `ReelView.land`    | Reveals the result left-to-right in reading order, which builds tension one reel at a time.                                                                                                       |
| Scatter anticipation       | `ReelSetView.stopOn`                     | With 2 scatters landed, the remaining reels glow, spin longer and play a rising tone. This is the genre's peak-tension moment.                                                                    |
| Special symbol landing     | Spine `land` animation                   | Squash, glow flash and ray burst on scatters and wilds, plus a pitch-rising chime per scatter, so the important symbols read instantly.                                                           |
| Animated winning symbols   | Spine `win` animation                    | Pulse, halo, a light sweep clipped to the gem outline, and twinkles. Winners feel alive while losers dim.                                                                                         |
| Static-first symbols       | `SymbolTextures.bake`, `SpineSymbolPool` | Idle and spinning cells are cheap sprites baked from the rig. Spine runs only on the few cells that animate, which keeps mobile frame times low.                                                  |
| Minimum spin time          | `SPEED.minSpinMs`                        | Keeps pacing consistent however fast the server answers.                                                                                                                                          |
| Scaled rollups             | `rollupDurationMs`                       | Celebration length is proportional to the win. Small wins never hold the player up.                                                                                                               |
| Tiered big wins            | `BigWinOverlay`                          | BIG → MEGA → EPIC escalates _during_ the count-up, stretching the payoff moment.                                                                                                                  |
| Idle win cycling           | `GameController.startLineCycle`          | After a win, each line is shown in turn with its payout, so players can see exactly what paid and why.                                                                                            |
| Win amounts on lines       | `WinBadge`, `ReelSetView.showSingleWin`  | The payout sits on the line itself, at the last symbol of the combination, and the round total sits in the centre when every line shows at once. Players read _why_ and _how much_ in one glance. |
| Mode theming               | `Background.setTheme`, HUD panel         | Free Spins switch to a magenta palette with a persistent counter. The player always knows which mode they're in.                                                                                  |

## Gem Vault bonus

| Decision                                                | Why                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Trigger on reels 1, 3 and 5 only                        | Gives a readable "one more to go" moment and keeps the bonus distinct from the Free Spins scatter, which can land anywhere. |
| Separate BONUS vault symbol, scatter relabelled SCATTER | Two features, two clearly different symbols: players never wonder which one they just triggered.                            |
| First pick always a prize                               | A bonus that pays nothing feels like a bug. The guarantee is part of the maths (E = 38.4× bet).                             |
| Outcome fixed at trigger, picks are cosmetic            | Server-authoritative and auditable. The rules screen says so openly.                                                        |
| Reveal what the closed vaults held                      | Shows the result was real and builds anticipation for the next one ("the ×50 was right there!").                            |
| Prizes credited per pick, bonus resumes after reload    | A dropped connection never costs the player money.                                                                          |
| Space / PICK button / autoplay pick for you             | Keyboard-accessible and autoplay-friendly without needing a mouse.                                                          |
| Bonus plays before Free Spins won on the same spin      | Keeps a single, predictable order of events.                                                                                |

## Player control

- **Slam stop:** pressing SPIN (or Space, or tapping the reels) while spinning lands every reel immediately.
- **Skip everything:** every rollup, banner and big-win celebration can be skipped. No animation holds the player
  hostage.
- **Tapping the reels never places a bet.** It can only stop or skip, so an accidental tap can't cost money.
- **Turbo mode** shortens every timing through a separate `SpeedProfile`.
- **Keyboard:** Space/Enter spins or stops, Esc closes dialogs, and focus stays visible throughout.

## Responsible-gaming and transparency practices

- **Autoplay requires a loss limit** and offers an optional single-win limit and stop-on-feature, modelled on UKGC
  RTS 8. Autoplay stops on any error or when the balance is too low, and pauses automatically when the tab is hidden.
- **Session clock** is always visible in the top bar.
- **Paytable in money:** pays are shown in currency for the current bet rather than abstract multipliers.
- **RTP disclosure:** the rules screen shows the theoretical RTP served by the backend.
- **Game history** lists the last 50 rounds with bet, win and resulting balance.
- **Clear DEMO labelling** and a refill that is only available once the player is actually out of credits.
- **The stake leaves the balance immediately** when a spin starts, and wins are added after they are presented, so
  the balance never shows money the player hasn't won yet.

## Robustness

- **Session resume:** reloading mid-feature restores the grid, balance and remaining Free Spins, then continues.
- **Network errors** land the reels back on the previous symbols, restore the displayed balance, stop autoplay and
  explain what happened. No phantom outcome is ever shown.
- **One round at a time** per session on the server (`KeyedMutex`), so double-clicks or retries can't race a debit.
- **Free Spins lock the bet** server-side to the triggering stake, whatever the client sends.

## Accessibility

- The HUD is real DOM: buttons have labels, dialogs use native `<dialog>` (focus trapping, Esc), wins are announced
  through `aria-live`, and errors use `role="alert"`.
- `prefers-reduced-motion` disables ambient particles and the coin shower, and shortens CSS transitions.
- Symbols differ in **shape** as well as colour (octagon, hexagon, emerald cut, trillion, star), so the game stays
  readable for colour-blind players.
