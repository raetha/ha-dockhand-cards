// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { DockhandContainersCard } from '../dockhand-containers-card/card';
import { DockhandStacksCard } from '../dockhand-stacks-card/card';
import { DockhandContainerCard } from '../dockhand-container-card/card';
import { DockhandStackCard } from '../dockhand-stack-card/card';
import { entityTags, renderTagPill } from './tag-pills';
import { makeDevice, makeEntity, makeHass, makeState } from './test-fixtures';
import type { HomeAssistant } from './ha-types';

type CardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

const CARDS = {
  containers: ['tag-pills-containers-card', DockhandContainersCard],
  stacks: ['tag-pills-stacks-card', DockhandStacksCard],
  container: ['tag-pills-container-card', DockhandContainerCard],
  stack: ['tag-pills-stack-card', DockhandStackCard]
} as const;
for (const [tag, cls] of Object.values(CARDS)) {
  if (!customElements.get(tag)) customElements.define(tag, cls as unknown as CustomElementConstructor);
}

const TAGGED = { tags: ['media', 'critical', 'plain'], tag_colors: { media: '#3b82f6', critical: '#ef4444', plain: 'red;}' } };

describe('entityTags', () => {
  it('reads names in order, keeping only a well-formed colour', () => {
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: TAGGED }))).toEqual([
      { name: 'media', color: '#3b82f6' },
      { name: 'critical', color: '#ef4444' },
      { name: 'plain' }
    ]);
  });

  it('is empty without tags (an older ha-dockhand) or with malformed ones', () => {
    expect(entityTags(undefined)).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: {} }))).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: { tags: 'media' } }))).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: { tags: ['', 3, 'ok'] } }))).toEqual([{ name: 'ok' }]);
  });
});

describe('renderTagPill', () => {
  it('colours a pill from its tag and leaves an uncoloured one plain', () => {
    const host = document.createElement('div');
    render([renderTagPill({ name: 'media', color: '#3b82f6' }), renderTagPill({ name: 'plain' })], host);
    const [coloured, plain] = host.querySelectorAll('.tag-pill');
    expect(coloured.textContent).toBe('media');
    expect(coloured.getAttribute('style')).toContain('#3b82f6');
    expect(plain.hasAttribute('style')).toBe(false);
  });
});

const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });

function hassWith(kind: 'container' | 'stack', attributes: Record<string, unknown>): HomeAssistant {
  const device = makeDevice({ id: 'dev-web', identifiers: [['dockhand', `entry_${kind}_1_web`]], config_entry_id: 'entry', name: 'web', via_device_id: 'env-device' });
  const key = kind === 'container' ? 'state' : 'status';
  return makeHass({
    devices: [env, device],
    entities: [makeEntity({ entity_id: `sensor.web_${key}`, device_id: 'dev-web', translation_key: key })],
    states: [makeState({ entity_id: `sensor.web_${key}`, state: 'running', attributes: { name: 'web', ...attributes } })]
  });
}

async function mount(card: keyof typeof CARDS, hass: HomeAssistant, config: Record<string, unknown> = {}): Promise<CardElement> {
  const [tag] = CARDS[card];
  const el = document.createElement(tag) as CardElement;
  el.setConfig({ type: `custom:dockhand-${card}-card`, ...config });
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function pills(el: CardElement): string[] {
  return [...el.shadowRoot!.querySelectorAll('.tag-pill')].map((p) => p.textContent ?? '');
}

describe.each([
  { list: 'containers' as const, single: 'container' as const, kind: 'container' as const },
  { list: 'stacks' as const, single: 'stack' as const, kind: 'stack' as const }
])('$kind tags', ({ list, single, kind }) => {
  it('show on list rows by default, and can be turned off', async () => {
    const hass = hassWith(kind, TAGGED);
    let el = await mount(list, hass, { device_id: 'env-device' });
    expect(pills(el)).toEqual(['media', 'critical', 'plain']);
    el.remove();
    el = await mount(list, hass, { device_id: 'env-device', visible_badges: ['updates'] });
    expect(pills(el)).toEqual([]);
    el.remove();
  });

  it('show under the single card header, and nothing without tags', async () => {
    let el = await mount(single, hassWith(kind, TAGGED), { device_id: 'dev-web' });
    expect(el.shadowRoot!.querySelector('.tag-row')).not.toBeNull();
    expect(pills(el)).toEqual(['media', 'critical', 'plain']);
    el.remove();
    el = await mount(single, hassWith(kind, {}), { device_id: 'dev-web' });
    expect(el.shadowRoot!.querySelector('.tag-row')).toBeNull();
    el.remove();
  });
});
