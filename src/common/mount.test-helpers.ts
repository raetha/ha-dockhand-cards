/**
 * What the DOM tests share: a Home Assistant built from the screenshot
 * harness's mock data, mounting a card or editor, and waiting for it and
 * everything inside it to render. Mounted elements are removed after each
 * test of a file that imports this.
 */
import { afterEach, vi } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import type { HomeAssistant } from './ha-types';

/** A card or editor as the tests drive it. */
export type Lit = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

/** The screenshot harness's four environments, with the calls a card makes
 * mocked: `callApi` (history) answers `history`, the rest succeed empty. */
export function harnessHass(opts: { language?: string; darkMode?: boolean; history?: unknown[] } = {}): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  const language = opts.language ?? 'en';
  return {
    devices,
    entities,
    states,
    language,
    locale: { language, number_format: 'language', time_format: 'language' },
    themes: { darkMode: opts.darkMode ?? false },
    callApi: vi.fn().mockResolvedValue(opts.history ?? []),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({})
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

/** Creates `tag` with this configuration (its `type` is the card's own
 * unless the configuration gives one), sets `hass`, attaches it and waits
 * for it to render. */
export async function mount<T extends Lit = Lit>(tag: string, config: Record<string, unknown> = {}, hass: HomeAssistant = harnessHass()): Promise<T> {
  const el = document.createElement(tag) as T;
  el.setConfig({ type: `custom:${tag.replace(/-editor$/, '')}`, ...config });
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await rendered(el);
  return el;
}

/** Waits for `root` and every Lit element below it, through shadow roots,
 * to finish rendering (sub-cards render in their own updates). */
export async function rendered(root: Element): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    const all = [root, ...deep(root, '*')] as Partial<Lit>[];
    await Promise.all(all.map((e) => e.updateComplete));
  }
}

/** querySelectorAll through every shadow root below `root`. */
export function deep(root: Element | ShadowRoot, selector: string): Element[] {
  const out: Element[] = [];
  const visit = (node: Element | ShadowRoot): void => {
    out.push(...node.querySelectorAll(selector));
    for (const el of node.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
  if (root instanceof Element && root.shadowRoot) visit(root.shadowRoot);
  else visit(root);
  return out;
}
