/** Display face for titles, labels and royals (loaded from Google Fonts in index.html). */
export const DISPLAY_FONT = 'Cinzel';

/** Waits for the display font so canvas/Pixi text never renders in a fallback face. */
export async function loadArtFonts(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load(`900 64px "${DISPLAY_FONT}"`),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Fall back to the serif stack.
  }
}
