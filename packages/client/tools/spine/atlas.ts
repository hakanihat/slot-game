export interface PackInput {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export interface PackedRegion extends PackInput {
  readonly x: number;
  readonly y: number;
}

export interface PackResult {
  readonly width: number;
  readonly height: number;
  readonly regions: readonly PackedRegion[];
}

/**
 * Shelf packer: tallest regions first, left-to-right rows. Simple and
 * deterministic, which keeps regenerated atlases diff-stable; a dozen regions
 * don't need a smarter algorithm.
 */
export function packShelves(
  inputs: readonly PackInput[],
  pageWidth: number,
  padding: number,
): PackResult {
  const sorted = [...inputs].sort(
    (a, b) => b.height - a.height || b.width - a.width || a.name.localeCompare(b.name),
  );
  const regions: PackedRegion[] = [];
  let x = padding;
  let y = padding;
  let shelfHeight = 0;

  for (const input of sorted) {
    if (input.width + padding * 2 > pageWidth)
      throw new Error(`Region ${input.name} is wider than the page`);
    if (x + input.width + padding > pageWidth) {
      x = padding;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }
    regions.push({ ...input, x, y });
    x += input.width + padding;
    shelfHeight = Math.max(shelfHeight, input.height);
  }

  const height = y + shelfHeight + padding;
  return { width: pageWidth, height: Math.ceil(height / 4) * 4, regions };
}

/** Serialises a single-page atlas in the Spine/libGDX text format. */
export function atlasText(image: string, pack: PackResult): string {
  const lines = [image, `size:${pack.width},${pack.height}`, 'filter:Linear,Linear', 'pma:false'];
  const byName = [...pack.regions].sort((a, b) => a.name.localeCompare(b.name));
  for (const region of byName) {
    lines.push(region.name, `bounds:${region.x},${region.y},${region.width},${region.height}`);
  }
  return `${lines.join('\n')}\n`;
}
