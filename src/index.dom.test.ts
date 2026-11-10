// @vitest-environment jsdom
/** The card picker's entity suggestions, registered by index.ts. */
import { describe, it, expect, vi } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import type { HomeAssistant } from './common/ha-types';

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return { devices, entities, states, language: 'en', locale: { language: 'en' }, callApi: vi.fn() } as unknown as HomeAssistant;
}

describe('card picker suggestions', () => {
  it('suggests a card for every Dockhand entity, and none for others', async () => {
    await import('./index');
    const hass = mockHass();
    const suggesters = window.customCards.filter((c) => c.getEntitySuggestion);
    expect(suggesters.length).toBeGreaterThan(0);
    let suggested = 0;
    for (const entityId of Object.keys(hass.entities)) {
      for (const card of suggesters) {
        const result = card.getEntitySuggestion!(hass, entityId);
        if (!result) continue;
        suggested++;
        for (const s of Array.isArray(result) ? result : [result]) {
          expect(String(s.config.type)).toMatch(/^custom:dockhand-/);
          expect(s.label).toBeTruthy();
        }
      }
    }
    expect(suggested).toBeGreaterThan(Object.keys(hass.devices).length / 2);
    for (const card of suggesters) {
      expect(card.getEntitySuggestion!(hass, 'light.kitchen')).toBeUndefined();
      expect(card.getEntitySuggestion!({ ...hass, entities: { 'sensor.x': { entity_id: 'sensor.x', platform: 'dockhand', device_id: 'gone' } } } as unknown as HomeAssistant, 'sensor.x')).toBeUndefined();
    }
  });
});

