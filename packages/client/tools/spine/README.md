# Symbol rig (Spine)

Reel symbols are Spine 4.3 skeletons. This folder **generates** the rig:
art is drawn procedurally (`art.ts`), baked into an atlas and wired into a
skeleton with skins and animations (`rig.ts`).

```bash
npm run spine:build   # writes packages/client/public/spine/symbols.{json,atlas,png}
```

The output is exactly what the Spine Editor exports, so an animator can
replace these files with hand-made ones. The game only relies on the contract
below (also enforced by `src/game/spine/symbolRig.test.ts`).

## Contract with the game

| Item       | Requirement                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| Files      | `public/spine/symbols.json` (or `.skel`) + `symbols.atlas` + page image(s)     |
| Skins      | One per symbol id: `J Q K A AMETHYST EMERALD SAPPHIRE RUBY WILD SCATTER BONUS` |
| Animations | `idle` (setup pose, baked to static sprites), `land` (one-shot), `win` (loop)  |
| Space      | Symbol centred on the origin inside a 256 × 256 unit square                    |

## How the generated rig is built

```
root
└─ symbol            ← scale pulse / land squash
   ├─ rays           ← Wild / Scatter / Bonus starburst (12-fold, loops by rotating 30°)
   ├─ glow           ← additive halo, tinted per skin
   ├─ body           ← the symbol art  +  clip (gem outline clipping mask)
   ├─ shine          ← additive light band, swept across the gem, clipped
   ├─ label          ← WILD / SCATTER / BONUS banner, bounces on win
   ├─ sparkle1       ← always-on twinkle (gems), spins on win
   └─ sparkle2       ← extra twinkle, win only
```

- **Skins** share bones, slots and animations; each skin only supplies its
  attachments (body, tint colours, clipping polygon, label). Royals have no
  clip/shine/sparkle1, so those slots stay empty for them.
- **Curves**: `rig.ts` converts CSS-style cubic-bezier easings into Spine's
  absolute Bézier handles, so animations are authored with familiar presets.
- **Fonts**: `fonts/Cinzel-Black.ttf` (SIL OFL 1.1, see `fonts/OFL.txt`) is
  registered with `@napi-rs/canvas` so royals and labels render identically on
  any machine.

## Licensing note

The Spine runtimes (`@esotericsoftware/spine-*`) are free to download, but the
[Spine Runtimes License](http://esotericsoftware.com/spine-runtimes-license)
requires anyone integrating them into a product to hold a Spine Editor license.
