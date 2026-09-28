import type { SessionState, SymbolId } from '@gem-rush/shared';
import { Application, Assets } from 'pixi.js';
import { SoundManager } from './audio/SoundManager';
import { GameController } from './controller/GameController';
import type { GameState } from './controller/state';
import { formatMoney } from './core/format';
import { Store } from './core/Store';
import { loadArtFonts } from './game/art/fonts';
import { SymbolTextures } from './game/art/SymbolTextures';
import { GameScene } from './game/GameScene';
import { SpineSymbolPool } from './game/spine/SpineSymbolPool';
import { SYMBOL_SPINE } from './game/spine/symbolAssets';
import { Hud } from './hud/Hud';
import { ApiClient, ApiError } from './net/ApiClient';
import { withRetry } from './net/retry';
import { tokenStorage } from './net/tokenStorage';
import './styles/main.css';

/** Shown on first visit, before any round exists. */
const ATTRACT_GRID: SymbolId[][] = [
  ['A', 'RUBY', 'K'],
  ['WILD', 'Q', 'SAPPHIRE'],
  ['J', 'EMERALD', 'SCATTER'],
  ['AMETHYST', 'K', 'WILD'],
  ['Q', 'A', 'RUBY'],
];

/** Resumes the stored guest session, or starts a fresh one if it's missing/expired. */
async function openSession(api: ApiClient): Promise<SessionState> {
  const token = tokenStorage.load();
  if (token) {
    api.setToken(token);
    try {
      return await api.getSession();
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'UNAUTHORIZED')) throw error;
    }
  }
  const created = await api.createSession();
  tokenStorage.save(created.token);
  api.setToken(created.token);
  return created.state;
}

function readBetIndex(levels: number, fallback: number): number {
  try {
    const raw = localStorage.getItem('gem-rush.bet-index');
    const stored = raw === null ? Number.NaN : Number(raw);
    return Number.isInteger(stored) && stored >= 0 && stored < levels ? stored : fallback;
  } catch {
    return fallback;
  }
}

async function boot(): Promise<void> {
  const root = document.getElementById('app') as HTMLElement;
  const stage = document.getElementById('stage') as HTMLElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const api = new ApiClient();
  const loaderText = document.querySelector('.loader__text');
  const fonts = loadArtFonts();
  const [info, session] = await withRetry(
    () => Promise.all([api.getGameInfo(), openSession(api)]),
    {
      onRetry: () => {
        if (loaderText) loaderText.textContent = 'Connecting to the game server…';
      },
    },
  );
  await fonts;
  const format = (cents: number) => formatMoney(cents, info.currency);

  const app = new Application();
  await app.init({
    resizeTo: stage,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    sharedTicker: true,
  });
  stage.append(app.canvas);

  // Symbol rig: static sprites are baked from the Spine setup pose; the pool animates wins.
  await Assets.load([SYMBOL_SPINE.skeleton, SYMBOL_SPINE.atlas]);
  const pool = new SpineSymbolPool();
  const textures = await SymbolTextures.bake(app.renderer, pool);
  const scene = new GameScene(app, { textures, pool }, info, reducedMotion);
  app.stage.addChild(scene);

  const sound = new SoundManager();
  const store = new Store<GameState>({
    phase: 'loading',
    balance: session.balance,
    currency: session.currency,
    betIndex: session.freeSpins
      ? Math.max(
          0,
          info.betLevels.indexOf(session.freeSpins.bet as (typeof info.betLevels)[number]),
        )
      : readBetIndex(info.betLevels.length, info.defaultBetIndex),
    win: session.lastRound?.totalWin ?? 0,
    freeSpins: session.freeSpins,
    bonus: session.bonus,
    autoplay: null,
    turbo: false,
    muted: sound.muted,
    message: '',
    sessionStartedAt: Date.now(),
  });

  const controller = new GameController({ api, store, scene, sound, info, format });
  const hud = new Hud({
    root,
    store,
    actions: controller,
    info,
    format,
    symbolImage: (id) => textures.dataUrl(id),
    loadHistory: async () => (await api.history()).rounds,
    onLayoutChange: () => scene.layout(hud.insets),
    debug: info.cheatsEnabled,
  });
  controller.attachHud(hud);

  // Tapping the reels can stop/skip, but never starts a paid spin by accident.
  scene.reels.eventMode = 'static';
  scene.reels.on('pointertap', () => {
    const { phase } = store.get();
    if (phase === 'spinning' || phase === 'presenting') controller.primaryAction();
  });

  app.renderer.on('resize', () => scene.layout(hud.insets));
  scene.layout(hud.insets);
  root.querySelector('.loader')?.remove();

  await controller.resume(session.lastRound?.grid ?? ATTRACT_GRID);
}

boot().catch((error: unknown) => {
  console.error(error);
  const text = document.querySelector('.loader__text');
  if (text)
    text.textContent = 'The game could not be loaded. Please check your connection and try again.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn--primary';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => window.location.reload());
  document.querySelector('.loader')?.append(retry);
});
