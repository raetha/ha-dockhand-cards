// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DockhandContainersCard } from './card';
import { makeDevice, makeEntity, makeHass, makeState } from '../common/test-fixtures';
import type { HomeAssistant } from '../common/ha-types';
import { mount as mountTag, type Lit } from '../common/mount.test-helpers';

type ContainersCardElement = Lit;

const TAG = 'dockhand-containers-card-under-test';
if (!customElements.get(TAG)) customElements.define(TAG, DockhandContainersCard);

function hassWithContainer(update: { state: string; latest?: string; newer?: string; extra?: Record<string, unknown> } | null) {
  const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });
  const container = makeDevice({ id: 'dev-postgres', identifiers: [['dockhand', 'entry_container_1_postgres']], config_entry_id: 'entry', name: 'postgres' });
  const entities = [makeEntity({ entity_id: 'sensor.postgres_state', device_id: 'dev-postgres', translation_key: 'state' })];
  const states = [makeState({ entity_id: 'sensor.postgres_state', state: 'running', attributes: {} })];
  if (update) {
    entities.push(makeEntity({ entity_id: 'update.postgres', device_id: 'dev-postgres' }));
    states.push(
      makeState({
        entity_id: 'update.postgres',
        state: update.state,
        attributes: { installed_version: '16.3', latest_version: update.latest ?? '16.3', ...(update.newer ? { newer_version: update.newer } : {}), ...update.extra }
      })
    );
  }
  return makeHass({ devices: [env, container], entities, states });
}

const mount = (hass: HomeAssistant, config: Record<string, unknown> = {}) => mountTag<ContainersCardElement>(TAG, { type: 'custom:dockhand-containers-card', ...config }, hass);

/** What the first row shows on its right, in order: the contents of its
 * column cells. */
function rightItems(card: ContainersCardElement): Element[] {
  return [...card.shadowRoot!.querySelectorAll('.row .cell')].flatMap((cell) => [...cell.children]);
}

function updateIcon(card: ContainersCardElement): Element | undefined {
  return rightItems(card).find((e) => e.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:arrow-up-circle');
}

function tagIcon(card: ContainersCardElement): Element | undefined {
  return rightItems(card).find((e) => e.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:tag-arrow-up-outline');
}

describe('Containers card newer version tag', () => {
  it('shows a tag icon before the update icon when both are pending, as Dockhand does, its tag in the tooltip', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', newer: '17.6' }));
    const items = rightItems(card);
    expect(items[0]).toBe(tagIcon(card));
    expect(items[1]).toBe(updateIcon(card));
    expect(tagIcon(card)!.getAttribute('title')).toContain('17.6');
    expect(card.shadowRoot!.querySelector<HTMLElement>('.icon-slots')!.style.getPropertyValue('--icon-slots')).toBe('2');
  });


  it('shows only the tag icon when the newer tag is the only update', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: '17.6', newer: '17.6' }));
    expect(tagIcon(card)).toBeDefined();
    expect(updateIcon(card)).toBeUndefined();
  });

  it('keeps just the update icon with older ha-dockhand (no newer_version)', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending' }));
    expect(tagIcon(card)).toBeUndefined();
    expect(updateIcon(card)).toBeDefined();
  });

  it('hides the tag icon along with the update icon when the updates badge is turned off', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', newer: '17.6' }), { visible_badges: ['health'] });
    expect(tagIcon(card)).toBeUndefined();
    expect(updateIcon(card)).toBeUndefined();
  });

  it('opens the update entity, not the row’s state entity, when the tag icon is clicked', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: '17.6', newer: '17.6' }));
    const events: string[] = [];
    card.addEventListener('hass-more-info', (e) => events.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
    (tagIcon(card) as HTMLElement).click();
    expect(events).toEqual(['update.postgres']);
  });
});

describe('Containers card pinned digest and held update', () => {
  function iconNamed(card: ContainersCardElement, name: string): Element | undefined {
    return rightItems(card).find((e) => (e.matches('ha-icon') ? e : e.querySelector('ha-icon'))?.getAttribute('icon') === name);
  }

  it('shows the pin in the update icon\'s place for a moved digest on a pinned image', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', extra: { pinned_digest_moved: true } }));
    const pin = iconNamed(card, 'mdi:pin-outline')!;
    expect(pin).toBeDefined();
    expect(pin.className).toContain('warn');
    expect(pin.getAttribute('title')).toContain('Pinned to a digest');
    expect(updateIcon(card)).toBeUndefined();
  });

  it('shows a grey clock for an update held by the minimum image age', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', extra: { update_held_hours: 3 } }));
    const clock = iconNamed(card, 'mdi:clock-outline')!;
    expect(clock).toBeDefined();
    expect(clock.className).toContain('neutral');
    expect(clock.getAttribute('title')).toBe('Update held: 3 h left of the minimum image age');
  });

  it('shows nothing for an up-to-date container', async () => {
    const card = await mount(hassWithContainer({ state: 'off' }));
    expect(iconNamed(card, 'mdi:clock-outline')).toBeUndefined();
    expect(updateIcon(card)).toBeUndefined();
  });
});

describe('Containers card on a narrow row', () => {
  const width = (el: Element, scroll: () => number, client: () => number): void => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: scroll });
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: client });
  };
  // The card re-measures when it's resized (jsdom has no ResizeObserver).
  const resized: Array<() => void> = [];
  const resize = (): void => resized.forEach((callback) => callback());
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe(): void {}
        disconnect(): void {}
      }
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resized.length = 0;
  });

  it('folds the tags, then leaves them out, only while the name would be cut', async () => {
    const hass = hassWithContainer({ state: 'on', latest: '17.6', newer: '15-vectorchord1.1.1' });
    hass.states['sensor.postgres_state'].attributes = { tags: ['db', 'prod'] };
    const card = await mount(hass, { visible_badges: ['updates', 'tags'] });
    const root = card.shadowRoot!;
    const row = root.querySelector<HTMLElement>('.row')!;
    expect(root.querySelector('.tag-summary')!.getAttribute('title')).toBe('db, prod');
    expect(root.querySelector('.tag-summary')!.textContent!.trim()).toBe('2');
    let narrow = true;
    width(row.querySelector('.tag-pills')!, () => 80, () => (narrow ? 0 : 80));
    resize();
    expect(row.classList.contains('compact-tags')).toBe(true);

    // Even the count pill doesn't fit: the tags are left out.
    width(row.querySelector('.row-left')!, () => (row.classList.contains('compact-tags') ? 100 : 50), () => 50);
    resize();
    expect(row.classList.contains('no-tags')).toBe(true);
    expect(row.classList.contains('compact-tags')).toBe(false);

    narrow = false;
    resize();
    for (const cls of ['compact-tags', 'no-tags']) expect(row.classList.contains(cls)).toBe(false);
  });

  it('leaves the environment pill out when the name would be cut short, not when it is merely cut', async () => {
    const card = await mount(hassWithContainer({ state: 'on' }), { visible_badges: ['environment'] });
    const row = card.shadowRoot!.querySelector<HTMLElement>('.row')!;
    expect(row.querySelector('.row-left > .name-label')).not.toBeNull();
    const name = row.querySelector('.item-name')!;
    // 6em of a 14px font is 84px: cut, but still showing more than that.
    let shown = 120;
    width(name, () => 200, () => shown);
    resize();
    expect(row.classList.contains('no-labels')).toBe(false);
    shown = 40;
    resize();
    expect(row.classList.contains('no-labels')).toBe(true);
  });
});

describe('Containers card aligned columns', () => {
  it('has a column for each detail shown, in order, and a cell for it on every row', async () => {
    const hass = hassWithContainer({ state: 'on', latest: 'update-pending', newer: '17.6' });
    const list = async (config: Record<string, unknown>) => (await mount(hass, config)).shadowRoot!.querySelector<HTMLElement>('.list.aligned')!;
    const all = await list({ visible_badges: ['health', 'updates', 'cpu', 'memory', 'tags', 'controls'] });
    // Its container has a newer version and an update, but no health check or
    // stats: those columns aren't there.
    expect(all.style.gridTemplateColumns).toBe('minmax(0px, 1fr) auto auto');
    const row = all.querySelector('.row')!;
    expect([...row.children].map((c) => c.className)).toEqual(['row-left row-target', 'cell icon-slots', 'row-actions']);
    // A hidden detail has no column at all, nor one no row has.
    const some = await list({ visible_badges: ['updates', 'memory'] });
    expect(some.style.gridTemplateColumns).toBe('minmax(0px, 1fr) auto');
    const none = await list({ visible_badges: ['memory'] });
    expect(none.style.gridTemplateColumns).toBe('minmax(0px, 1fr)');
  });
});
