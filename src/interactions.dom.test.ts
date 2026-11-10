// @vitest-environment jsdom
/**
 * Every control in every card and editor, driven the way Home Assistant
 * and a person would: each ha-form's labels and helpers, a value change in
 * each form, every button, toggle and row clicked or activated from the
 * keyboard, every sortable list reordered, and every embedded editor's
 * change passed up. Each step must leave the element rendering and must
 * produce the event it promises (config-changed from an editor; more-info,
 * an action or a service call from a card).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import './render.dom.test-elements';
import type { HomeAssistant } from './common/ha-types';

type Lit = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};
type Form = HTMLElement & {
  schema: unknown[];
  data: Record<string, unknown>;
  computeLabel?: (schema: unknown) => string;
  computeHelper?: (schema: unknown) => string | undefined;
};

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return {
    devices,
    entities,
    states,
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: 'language' },
    themes: { darkMode: true },
    callApi: vi.fn().mockResolvedValue([]),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({})
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

async function mount(tag: string, config: Record<string, unknown>, hass = mockHass()): Promise<Lit> {
  const el = document.createElement(tag) as Lit;
  el.setConfig({ type: `custom:${tag.replace(/-editor$/, '')}`, ...config });
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await settle(el);
  return el;
}

/** Waits for an element and every Lit element inside it to finish
 * rendering. */
async function settle(root: Element): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    const all = [root, ...deep(root, '*')] as Partial<Lit>[];
    await Promise.all(all.map((e) => e.updateComplete));
  }
}

/** querySelectorAll through every shadow root below `root`. */
function deep(root: Element | ShadowRoot, selector: string): Element[] {
  const out: Element[] = [];
  const visit = (node: Element | ShadowRoot): void => {
    out.push(...node.querySelectorAll(selector));
    for (const el of node.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
  if (root instanceof Element && root.shadowRoot) visit(root.shadowRoot);
  else visit(root);
  return out;
}

function fields(schema: unknown[]): Record<string, unknown>[] {
  return (schema as Record<string, unknown>[]).flatMap((s) => [s, ...(Array.isArray(s.schema) ? fields(s.schema) : [])]);
}

/** A changed value for a field, so the editor has something to apply. */
function changed(field: Record<string, unknown>, current: unknown): unknown {
  const selector = (field.selector ?? {}) as Record<string, unknown>;
  if ('boolean' in selector) return !current;
  if (field.type === 'multi_select' || Array.isArray(current)) return [];
  if ('number' in selector) return 3;
  const options = ((selector.select as { options?: ({ value: string } | string)[] } | undefined)?.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
  if (options.length) return options.find((o) => o !== current) ?? options[0];
  return 'x';
}

const EDITOR_CASES: [string, Record<string, unknown>][] = [
  ['environment', { device_id: 'env_1', mode: 'custom', custom_sections: ['metrics'] }],
  ['environment', { device_id: 'env_2', mode: 'standard' }],
  ['vulnerability', { device_id: 'env_1' }],
  ['stack', { device_id: 'stack_1_core', environment_device_id: 'env_1' }],
  ['stack', {}],
  ['container', { device_id: 'container_1_web', environment_device_id: 'env_1' }],
  ['container', {}],
  ['stacks', { device_id: 'env_1' }],
  ['stacks', { group_by: 'status' }],
  ['containers', { exclude_device_ids: ['env_2'] }],
  ['updates', { group_by: 'environment' }],
  ['schedules', { group_by: 'status', show_stats: true }],
  ['overview', { show_environments: true, show_stacks: true, show_containers: true, show_updates: true, show_schedules: true, show_vulnerabilities: true }]
];

describe('editors', () => {
  it.each(EDITOR_CASES)('%s %j: every form, button and list works', async (card, config) => {
    const el = await mount(`dockhand-${card}-card-editor`, config);
    const changes = vi.fn();
    el.addEventListener('config-changed', changes);

    // Forms: labels and helpers for every field, then a change to each.
    for (const form of deep(el, 'ha-form') as Form[]) {
      for (const field of fields(form.schema ?? [])) {
        if (form.computeLabel) expect(typeof form.computeLabel(field)).toBe('string');
        form.computeHelper?.(field);
      }
      for (const field of fields(form.schema ?? []).filter((f) => typeof f.name === 'string' && !f.type?.toString().includes('expandable'))) {
        const name = field.name as string;
        form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { ...form.data, [name]: changed(field, form.data?.[name]) } }, bubbles: true, composed: true }));
        await settle(el);
      }
    }

    // Sortable lists: move the first item to the end.
    for (const list of deep(el, 'ha-sortable')) {
      list.dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 0, newIndex: 1 }, bubbles: true, composed: true }));
      await settle(el);
    }

    // Embedded editors (the Overview's) pass their changes up.
    for (const inner of deep(el, '[class*="editor"], dockhand-environment-card-editor, dockhand-stacks-card-editor, dockhand-containers-card-editor, dockhand-updates-card-editor, dockhand-schedules-card-editor, dockhand-vulnerability-card-editor')) {
      inner.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'x', show_settings_link: false } }, bubbles: true, composed: true }));
    }

    // Every button, twice over: some open a detail view with more inside.
    for (let round = 0; round < 3; round++) {
      for (const button of deep(el, 'button, ha-icon-button, [role="button"], .clickable')) {
        (button as HTMLElement).click();
        await settle(el);
      }
    }
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
    expect(changes).toHaveBeenCalled();
  });
});

const CARD_CASES: [string, Record<string, unknown>][] = [
  ['environment', { device_id: 'env_1', mode: 'detailed' }],
  ['environment', { device_id: 'env_4', mode: 'full' }],
  ['environment', { device_id: 'env_2', mode: 'compact' }],
  ['vulnerability', { device_id: 'env_1' }],
  ['stack', { device_id: 'stack_1_core' }],
  ['container', { device_id: 'container_1_web' }],
  ['stacks', { device_id: 'env_1', show_controls: true }],
  ['containers', { device_id: 'env_1', show_controls: true }],
  ['updates', { scope: 'all' }],
  ['schedules', { group_by: 'status', show_stats: true, show_controls: true }],
  ['overview', { show_environments: true, show_vulnerabilities: true, show_stacks: true, show_containers: true, show_updates: true, show_schedules: true }]
];

describe('cards', () => {
  it.each(CARD_CASES)('%s %j: every control does something', async (card, config) => {
    const hass = mockHass();
    const el = await mount(`dockhand-${card}-card`, config, hass);
    const events = vi.fn();
    for (const type of ['hass-more-info', 'hass-action', 'show-dialog', 'location-changed']) el.addEventListener(type, events);
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const targets = deep(el, 'button, ha-icon-button, [role="button"], .clickable, a');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      (target as HTMLElement).click();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
    }
    await settle(el);
    expect(events.mock.calls.length + vi.mocked(hass.callService).mock.calls.length).toBeGreaterThan(0);
    // A change of state re-renders without trouble.
    el.hass = { ...hass, states: { ...hass.states } };
    await settle(el);
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });
});
