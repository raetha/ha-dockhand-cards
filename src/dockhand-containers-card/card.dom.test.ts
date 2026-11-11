// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DockhandContainersCard } from './card';
import { makeDevice, makeEntity, makeHass, makeState } from '../common/test-fixtures';
import type { HomeAssistant } from '../common/ha-types';

type ContainersCardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

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

async function mount(hass: HomeAssistant, config: Record<string, unknown> = {}): Promise<ContainersCardElement> {
  const card = document.createElement(TAG) as ContainersCardElement;
  card.setConfig({ type: 'custom:dockhand-containers-card', ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function rightItems(card: ContainersCardElement): Element[] {
  return [...card.shadowRoot!.querySelector('.row .row-right')!.children];
}

function updateIcon(card: ContainersCardElement): Element | undefined {
  return rightItems(card).find((e) => e.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:arrow-up-circle');
}

describe('Containers card version-tag pill', () => {
  it('shows the pill just left of the update icon when both are pending', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', newer: '17.6' }));
    const items = rightItems(card);
    const pill = card.shadowRoot!.querySelector('.version-tag-pill')!;
    expect(pill.textContent?.trim()).toBe('17.6');
    expect(items.indexOf(pill)).toBe(0);
    expect(items[1]).toBe(updateIcon(card));
    card.remove();
  });

  it('shows the pill instead of the update icon when the newer tag is the only update', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: '17.6', newer: '17.6' }));
    expect(card.shadowRoot!.querySelector('.version-tag-pill')).not.toBeNull();
    expect(updateIcon(card)).toBeUndefined();
    card.remove();
  });

  it('keeps just the update icon with older ha-dockhand (no newer_version)', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending' }));
    expect(card.shadowRoot!.querySelector('.version-tag-pill')).toBeNull();
    expect(updateIcon(card)).toBeDefined();
    card.remove();
  });

  it('hides the pill along with the update icon when the updates badge is turned off', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', newer: '17.6' }), { visible_badges: ['health'] });
    expect(card.shadowRoot!.querySelector('.version-tag-pill')).toBeNull();
    expect(updateIcon(card)).toBeUndefined();
    card.remove();
  });

  it('opens the update entity, not the row’s state entity, when the pill is clicked', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: '17.6', newer: '17.6' }));
    const events: string[] = [];
    card.addEventListener('hass-more-info', (e) => events.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
    (card.shadowRoot!.querySelector('.version-tag-pill') as HTMLElement).click();
    expect(events).toEqual(['update.postgres']);
    card.remove();
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
    card.remove();
  });

  it('shows a grey clock for an update held by the minimum image age', async () => {
    const card = await mount(hassWithContainer({ state: 'on', latest: 'update-pending', extra: { update_held_hours: 3 } }));
    const clock = iconNamed(card, 'mdi:clock-outline')!;
    expect(clock).toBeDefined();
    expect(clock.className).toContain('neutral');
    expect(clock.getAttribute('title')).toBe('Update held: 3 h left of the minimum image age');
    card.remove();
  });

  it('shows nothing for an up-to-date container', async () => {
    const card = await mount(hassWithContainer({ state: 'off' }));
    expect(iconNamed(card, 'mdi:clock-outline')).toBeUndefined();
    expect(updateIcon(card)).toBeUndefined();
    card.remove();
  });
});
