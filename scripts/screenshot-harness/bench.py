"""How long the cards take to render, and to take a new `hass`, at a large install's size.

Copies every container and stack in the mock data out (`--copies`, default 10),
adds unrelated entities like a real Home Assistant's (`--others`, default 5000),
mounts each card in `CARDS`, then times a first render and `--updates` new
`hass` objects in which one entity elsewhere changed, as Home Assistant sends
one whenever any state changes. Needs the harness served on port 8931 (README).

    python3 bench.py [--copies N] [--others N] [--updates N]
"""

import argparse
import asyncio
import json

from playwright.async_api import async_playwright

from screenshot import CARDS

SCALE_JS = """
({ copies, others }) => {
  const hass = window.__hass;
  const devices = { ...hass.devices };
  const entities = { ...hass.entities };
  const states = { ...hass.states };
  const itemOf = (d) => (d.identifiers || []).map(([, id]) => id).find((id) => /(^|_)(container|stack)_\\d+_/.test(id));
  for (const device of Object.values(hass.devices)) {
    const ident = itemOf(device);
    if (!ident) continue;
    const owned = Object.values(hass.entities).filter((e) => e.device_id === device.id);
    for (let n = 1; n <= copies; n++) {
      const id = `${device.id}__${n}`;
      devices[id] = { ...device, id, name: `${device.name}${n}`, identifiers: device.identifiers.map(([dom, i]) => [dom, i === ident ? `${i}${n}` : i]) };
      for (const e of owned) {
        const entityId = `${e.entity_id}_${n}`;
        entities[entityId] = { ...e, entity_id: entityId, device_id: id };
        if (hass.states[e.entity_id]) states[entityId] = { ...hass.states[e.entity_id], entity_id: entityId };
      }
    }
  }
  for (let n = 0; n < others; n++) {
    const entityId = `sensor.elsewhere_${n}`;
    entities[entityId] = { entity_id: entityId, device_id: `elsewhere_${n % 500}`, platform: 'other', translation_key: null };
    states[entityId] = { entity_id: entityId, state: String(n), attributes: {}, last_changed: '', last_updated: '', context: { id: '' } };
  }
  Object.assign(hass, { devices, entities, states });
  return { devices: Object.keys(devices).length, entities: Object.keys(entities).length };
}
"""

MEASURE_JS = """
async ({ tag, config, updates }) => {
  const hass = window.__hass;
  const started = performance.now();
  const el = window.__mount(tag, { __id: 'bench', ...config }, 420);
  await el.updateComplete;
  const first = performance.now() - started;
  let current = hass;
  const times = [];
  for (let n = 0; n < updates; n++) {
    const id = `sensor.elsewhere_${n % 100}`;
    current = { ...current, states: { ...current.states, [id]: { ...current.states[id], state: String(Math.random()) } } };
    const t = performance.now();
    el.hass = current;
    await el.updateComplete;
    times.push(performance.now() - t);
  }
  el.parentElement.remove();
  times.sort((a, b) => a - b);
  return { first, median: times[Math.floor(times.length / 2)], max: times[times.length - 1] };
}
"""


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--copies", type=int, default=10)
    parser.add_argument("--others", type=int, default=5000)
    parser.add_argument("--updates", type=int, default=30)
    args = parser.parse_args()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 1000})
        page.on("pageerror", lambda exc: print("[pageerror]", exc))
        await page.goto("http://localhost:8931/index.html")
        await page.wait_for_function("window.__renderDone === true")
        size = await page.evaluate(SCALE_JS, {"copies": args.copies, "others": args.others})
        print(f"{size['devices']} devices, {size['entities']} entities; ms per card:")
        print(f"{'card':58} {'first':>7} {'update':>7} {'max':>7}")
        for tag, config, *_ in CARDS:
            r = await page.evaluate(MEASURE_JS, {"tag": tag, "config": config, "updates": args.updates})
            label = f"{tag} {json.dumps(config)}"[:58]
            print(f"{label:58} {r['first']:7.1f} {r['median']:7.1f} {r['max']:7.1f}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
