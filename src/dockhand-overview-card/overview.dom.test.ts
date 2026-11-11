// @vitest-environment jsdom
/**
 * The Overview card's column alignment and its editor's detail views: the
 * global section settings and the per-environment overrides, each written
 * back into the Overview's own config.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import '../render.dom.test-elements';
import type { HomeAssistant } from '../common/ha-types';

type Lit = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return {
    devices,
    entities,
    states,
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: 'language' },
    themes: { darkMode: false },
    callApi: vi.fn().mockResolvedValue([]),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({})
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
  vi.unstubAllGlobals();
});

async function mount(tag: string, config: Record<string, unknown>): Promise<Lit> {
  const el = document.createElement(tag) as Lit;
  el.setConfig({ type: 'custom:dockhand-overview-card', ...config });
  el.hass = mockHass();
  document.body.appendChild(el);
  mounted.push(el);
  await settle(el);
  return el;
}

async function settle(el: Element): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    const all = [el, ...(el.shadowRoot?.querySelectorAll('*') ?? [])] as Partial<Lit>[];
    await Promise.all(all.map((e) => e.updateComplete));
  }
}

const ALL_SECTIONS = { show_environments: true, show_vulnerabilities: true, show_stacks: true, show_containers: true, show_updates: true, show_schedules: true };

describe('Overview card column alignment', () => {
  function stubLayout(): { frames: FrameRequestCallback[]; resized: () => void } {
    const frames: FrameRequestCallback[] = [];
    let onResize: () => void = () => undefined;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          onResize = cb;
        }
        observe(): void {}
        disconnect(): void {}
      }
    );
    return { frames, resized: () => onResize() };
  }

  it('gives a section the tallest height of its row, and leaves a lone column alone', async () => {
    const { frames, resized } = stubLayout();
    const el = await mount('dockhand-overview-card', ALL_SECTIONS);
    const columns = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.env-column')];
    expect(columns.length).toBeGreaterThan(2);
    // The first two columns share a row; the rest sit alone below.
    columns.forEach((col, i) => {
      col.getBoundingClientRect = () => ({ top: i < 2 ? 0 : 500 * i }) as DOMRect;
      col.querySelectorAll<HTMLElement>('.section-wrapper').forEach((w, j) => {
        w.getBoundingClientRect = () => ({ height: (i + 1) * 10 + j }) as DOMRect;
      });
    });
    frames.splice(0).forEach((f) => f(0));
    const first = columns[0].querySelector<HTMLElement>('.section-wrapper')!;
    expect(first.style.minHeight).toBe('20px');
    expect(columns[2].querySelector<HTMLElement>('.section-wrapper')!.style.minHeight).toBe('');

    // A resize measures again, from natural heights.
    first.style.minHeight = '999px';
    resized();
    expect(first.style.minHeight).toBe('20px');
  });

  it('stops aligning when turned off', async () => {
    const { frames } = stubLayout();
    const el = await mount('dockhand-overview-card', ALL_SECTIONS);
    frames.splice(0).forEach((f) => f(0));
    el.setConfig({ type: 'custom:dockhand-overview-card', ...ALL_SECTIONS, align_columns: false });
    await settle(el);
    expect(el.shadowRoot!.querySelector('.overview.no-align')).not.toBeNull();
    expect(el.shadowRoot!.querySelector<HTMLElement>('.section-wrapper')?.style.minHeight ?? '').toBe('');
  });

  it('asks for every section to be turned on when all are off', async () => {
    const el = await mount('dockhand-overview-card', { show_environments: false });
    expect(el.shadowRoot!.querySelector('.card-message')).not.toBeNull();
  });
});

describe('Overview editor detail views', () => {
  function changes(el: Element): Record<string, unknown>[] {
    const seen: Record<string, unknown>[] = [];
    el.addEventListener('config-changed', (ev) => seen.push((ev as CustomEvent<{ config: Record<string, unknown> }>).detail.config));
    return seen;
  }

  const EMBEDDED = 'dockhand-environment-card-editor, dockhand-vulnerability-card-editor, dockhand-stacks-card-editor, dockhand-containers-card-editor, dockhand-updates-card-editor, dockhand-schedules-card-editor';

  function emit(inner: Element, config: Record<string, unknown>): void {
    inner.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  it('writes a section default under the section prefix and removes a cleared one', async () => {
    const el = await mount('dockhand-overview-card-editor', { ...ALL_SECTIONS, stacks_group_by: 'status' });
    const seen = changes(el);
    for (let i = 0; i < 6; i++) {
      const rows = [...el.shadowRoot!.querySelectorAll('.section-order-row')];
      (rows[i].querySelector('.row-action-btn') as HTMLElement).click();
      await settle(el);
      const inner = el.shadowRoot!.querySelector(EMBEDDED)!;
      expect(inner).not.toBeNull();
      emit(inner, { type: 'custom:x', device_id: '', group_by: 'none', sort_by: undefined, stacks_group_by: undefined });
      (el.shadowRoot!.querySelector('.detail-header .row-action-btn') as HTMLElement).click();
      await settle(el);
    }
    expect(seen.length).toBe(6);
    expect(seen[seen.length - 1]).not.toHaveProperty('type', 'custom:x');
    // Every embedded editor follows later hass updates.
    el.hass = mockHass();
  });

  it('keeps per-environment overrides and prunes empty ones', async () => {
    const el = await mount('dockhand-overview-card-editor', {
      ...ALL_SECTIONS,
      environments_overrides: { env_1: { stacks: { group_by: 'status' } } }
    });
    const seen = changes(el);
    const edit = el.shadowRoot!.querySelector<HTMLElement>('.order-row:not(.section-order-row) .row-action-btn')!;
    edit.click();
    await settle(el);
    const inners = [...el.shadowRoot!.querySelectorAll(EMBEDDED)];
    expect(inners.length).toBe(6);
    el.hass = mockHass();
    for (const inner of inners) emit(inner, { type: 'custom:x', device_id: 'env_1', show_settings_link: false });
    for (const inner of inners) emit(inner, { type: 'custom:x', device_id: 'env_1', name: '', visible_badges: [] });
    // The first environment listed is another one: its overrides come and
    // go while env_1's stay untouched.
    const [edited] = Object.keys(seen[0].environments_overrides as object).filter((id) => id !== 'env_1');
    expect(seen[0].environments_overrides).toMatchObject({ [edited]: { environment: { show_settings_link: false } }, env_1: { stacks: { group_by: 'status' } } });
    expect(seen[seen.length - 1]!.environments_overrides).toEqual({ env_1: { stacks: { group_by: 'status' } } });

    (el.shadowRoot!.querySelector('.detail-header .row-action-btn') as HTMLElement).click();
    await settle(el);
    expect(el.shadowRoot!.querySelector('.detail-header')).toBeNull();
  });

  it('drops the overrides key once the last override is cleared', async () => {
    const el = await mount('dockhand-overview-card-editor', ALL_SECTIONS);
    const seen = changes(el);
    el.shadowRoot!.querySelector<HTMLElement>('.order-row:not(.section-order-row) .row-action-btn')!.click();
    await settle(el);
    const inner = el.shadowRoot!.querySelector(EMBEDDED)!;
    emit(inner, { type: 'custom:x', show_settings_link: false });
    emit(inner, { type: 'custom:x' });
    expect(seen[seen.length - 1]).not.toHaveProperty('environments_overrides');
  });

  it('falls back to the list when the environment being edited disappears', async () => {
    const el = await mount('dockhand-overview-card-editor', ALL_SECTIONS);
    el.shadowRoot!.querySelector<HTMLElement>('.order-row:not(.section-order-row) .row-action-btn')!.click();
    await settle(el);
    expect(el.shadowRoot!.querySelector('.detail-header')).not.toBeNull();
    el.hass = { ...mockHass(), devices: {} };
    await settle(el);
    expect(el.shadowRoot!.querySelector('.detail-header')).toBeNull();
  });
});

describe('Overview card generated cards', () => {
  // The config each generated card was given (cards keep it privately).
  type Child = HTMLElement & { _config: Record<string, unknown> };
  /** The env_1 column's card: the one not excluding env_1. */
  const child = (el: Lit, tag: string): Record<string, unknown> =>
    [...el.shadowRoot!.querySelectorAll(tag)]
      .map((c) => (c as unknown as Child)._config)
      .find((cfg) => cfg.device_id === 'env_1' || (Array.isArray(cfg.exclude_device_ids) && !cfg.exclude_device_ids.includes('env_1')))!;

  it('pass every section default and override on, whatever the field', async () => {
    const el = await mount('dockhand-overview-card', {
      ...ALL_SECTIONS,
      stacks_show_controls: true,
      containers_filters: { state: ['exited_error'] },
      schedules_group_by: 'type',
      environment_mode: 'compact',
      updates_hide_when_no_updates: false,
      environments_overrides: { env_1: { containers: { show_controls: true, filters: { tags: { not: ['infra'] } } } } }
    });
    expect(child(el, 'dockhand-stacks-card')).toMatchObject({ show_controls: true, type: 'custom:dockhand-stacks-card' });
    expect(child(el, 'dockhand-containers-card')).toMatchObject({ filters: { tags: { not: ['infra'] } }, show_controls: true });
    expect(child(el, 'dockhand-schedules-card')).toMatchObject({ group_by: 'type', include_global: false, visible_badges: ['next_run'] });
    expect(child(el, 'dockhand-environment-card')).toMatchObject({ mode: 'compact', device_id: 'env_1' });
    // The Vulnerability card picks its environment the way the list cards do.
    expect(child(el, 'dockhand-vulnerability-card')).not.toHaveProperty('device_id');
    expect(child(el, 'dockhand-updates-card')).not.toHaveProperty('hide_when_no_updates');
    // Unset fields stay absent, so each card's own defaults hold.
    expect(child(el, 'dockhand-stacks-card')).not.toHaveProperty('visible_badges');
  });
});
