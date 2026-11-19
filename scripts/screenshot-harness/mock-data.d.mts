/** Types for the screenshot harness's mock Home Assistant data, which the
 * render tests (src/render.dom.test.ts) also use. */
export function buildMockHass(): {
  devices: Record<string, unknown>;
  entities: Record<string, unknown>;
  states: Record<string, unknown>;
};
