import type { SymbolId } from '@gem-rush/shared';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { SYMBOL_SPINE, skinFor } from './symbolAssets';

/**
 * Recycles Spine instances for animated symbols.
 *
 * Reels show static sprites most of the time; a Spine instance is only
 * borrowed while a symbol lands or wins. That caps live skeletons at the
 * number of cells animating at once instead of every recycled reel cell, and
 * avoids re-allocating skeletons on every win.
 */
export class SpineSymbolPool {
  private readonly free: Spine[] = [];
  private created = 0;

  acquire(id: SymbolId): Spine {
    const spine = this.free.pop() ?? this.create();
    spine.skeleton.setSkin(skinFor(id));
    spine.skeleton.setupPose();
    spine.state.clearTracks();
    spine.alpha = 1;
    spine.autoUpdate = true;
    return spine;
  }

  release(spine: Spine): void {
    spine.state.clearTracks();
    spine.autoUpdate = false;
    spine.removeFromParent();
    this.free.push(spine);
  }

  /** Total instances ever created — useful for profiling. */
  get size(): number {
    return this.created;
  }

  private create(): Spine {
    this.created += 1;
    const spine = Spine.from({
      skeleton: SYMBOL_SPINE.skeleton.alias,
      atlas: SYMBOL_SPINE.atlas.alias,
      autoUpdate: false,
    });
    spine.state.data.defaultMix = 0.08;
    return spine;
  }
}
