import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AtlasAttachmentLoader, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-core';
import { SYMBOL_IDS } from '@gem-rush/shared';
import { describe, expect, it } from 'vitest';
import { SYMBOL_ANIMATIONS } from './symbolAssets';

const read = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../../../public/spine/${file}`, import.meta.url)), 'utf8');

/**
 * Loads the shipped Spine files with the official runtime parser, exactly as
 * the game does. Guards against a broken export (from the generator or from an
 * artist) reaching players.
 */
describe('Spine symbol rig', () => {
  const atlas = new TextureAtlas(read('symbols.atlas'));
  const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
    read('symbols.json'),
  );

  it('targets the runtime major.minor version', () => {
    expect(data.version?.startsWith('4.3')).toBe(true);
  });

  it('has a skin for every game symbol', () => {
    for (const id of SYMBOL_IDS) expect(data.findSkin(id), id).not.toBeNull();
  });

  it('provides every animation the game plays', () => {
    for (const name of Object.values(SYMBOL_ANIMATIONS))
      expect(data.findAnimation(name), name).not.toBeNull();
  });

  it('has a win animation long enough to read as a loop', () => {
    const win = data.findAnimation(SYMBOL_ANIMATIONS.win);
    expect(win?.duration).toBeGreaterThan(0.5);
  });

  it('references only regions that exist in the atlas', () => {
    // SkeletonJson throws on a missing region, so reaching here means all resolved.
    expect(atlas.regions.length).toBeGreaterThanOrEqual(SYMBOL_IDS.length);
  });
});
