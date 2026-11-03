"""Automated accessibility check: runs axe-core (WCAG 2.1 A/AA rules) over
every card and every editor, in both themes, against the same mock data and
real built bundle the screenshots use.

Run from this folder with the harness server up (see README.md):

    python3 a11y.py              # report violations, exit 1 if any
    python3 a11y.py --verbose    # also list every affected element

Catches what can be checked mechanically — missing accessible names, roles,
contrast, invalid ARIA — not whether the cards make sense to a screen-reader
user. That still needs a manual pass (see docs/backlog.md).

Elements rendered by this harness's own stand-ins for Home Assistant
components (ha-shims.mjs) rather than the cards are skipped: they say nothing
about the cards in a real dashboard. So is text in Home Assistant's own theme
colors (see HA_THEME_COLORS).
"""

import asyncio
import json
import re
import sys

from playwright.async_api import async_playwright

from screenshot import CARDS

VERBOSE = '--verbose' in sys.argv

# Extra states the screenshots don't show but a user can hit.
EXTRA_CARDS = [
    ('dockhand-container-card', {'device_id': 'container_1_backup'}),
    ('dockhand-stack-card', {'device_id': 'stack_1_monitoring'}),
    ('dockhand-stacks-card', {'device_id': 'env_1', 'group_by': 'status'}),
    ('dockhand-containers-card', {'device_id': 'env_1', 'group_by': 'status'}),
    ('dockhand-schedules-card', {'group_by': 'status', 'show_stats': True}),
    ('dockhand-environment-card', {'device_id': 'env_3', 'mode': 'standard'}),
    ('dockhand-environment-card', {'device_id': 'env_1', 'mode': 'detailed'}),
]

EDITORS = sorted({tag for tag, *_ in CARDS} | {tag for tag, _ in EXTRA_CARDS})

def from_shim(node):
    # ha-shims.mjs's stand-in for <ha-form> renders plain disabled inputs and
    # selects with no labels; Home Assistant's real ha-form labels its own.
    return 'class="shim-' in node['html']

# Text in Home Assistant's own theme colors is accepted as it is: the cards
# use HA's colors unchanged so they match the rest of the dashboard, and
# someone who needs more contrast picks a theme that provides it (HA's default
# warning orange, for one, is under 2:1 on white). The same applies to white
# text on HA's primary color, as on HA's own buttons. These are the values
# index.html sets — HA's defaults — so only those exact colors are excused,
# not this repo's own. #ed751b is the Vulnerability card's "high" severity:
# HA's error and warning colors mixed evenly, since HA has nothing between.
HA_THEME_COLORS = {'#009ac7', '#43a047', '#ffa600', '#db4437', '#039be5', '#ed751b'}
CONTRAST = re.compile(r'foreground color: (#[0-9a-f]{6}), background color: (#[0-9a-f]{6})')

def uses_ha_theme_color(rule, node):
    if rule != 'color-contrast':
        return False
    m = CONTRAST.search(node['summary'] or '')
    if not m:
        return False
    fg, bg = m.groups()
    return fg in HA_THEME_COLORS or (fg == '#ffffff' and bg in HA_THEME_COLORS)

AXE_OPTIONS = {'runOnly': {'type': 'tag', 'values': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}}


async def run(page, slot_id):
    return await page.evaluate(
        """async ([id, options]) => {
            const result = await axe.run(document.getElementById(id), options);
            return result.violations.map((v) => ({
                id: v.id, impact: v.impact, help: v.help,
                nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 160), summary: n.failureSummary }))
            }));
        }""",
        [slot_id, AXE_OPTIONS],
    )


async def check_theme(browser, light):
    page = await browser.new_page()
    page.on('pageerror', lambda exc: print('[pageerror]', exc))
    await page.goto('http://localhost:8931/index.html' + ('?theme=light' if light else ''))
    await page.wait_for_function('window.__renderDone === true')
    # Cards sit on HA's dashboard background, not the transparent page the
    # screenshots use; without it, text outside any card (Overview's column
    # titles) is measured against white in the dark theme.
    await page.evaluate("document.body.style.background = 'var(--primary-background-color)'")
    await page.add_script_tag(url='/node_modules/axe-core/axe.min.js')

    slots = []
    for n, (tag, config, *_rest) in enumerate([(c[0], c[1]) for c in CARDS] + EXTRA_CARDS):
        config = dict(config, __id=f'card_{n}')
        await page.evaluate('([t, c]) => window.__mount(t, c, 460)', [tag, config])
        slots.append((f'card_{n}', f'{tag} {json.dumps({k: v for k, v in config.items() if k != "__id"})}'))
    for n, tag in enumerate(EDITORS):
        device = 'env_1' if ('environment' in tag or 'vulnerability' in tag) else ''
        await page.evaluate('([t, c]) => window.__mountEditor(t, c, 480)', [tag, {'__id': f'editor_{n}', 'device_id': device}])
        slots.append((f'editor_{n}', f'{tag} (editor)'))
    await page.wait_for_timeout(1500)

    found = {}
    for slot_id, label in slots:
        for v in await run(page, slot_id):
            nodes = [n for n in v['nodes'] if not from_shim(n) and not uses_ha_theme_color(v['id'], n)]
            if not nodes:
                continue
            entry = found.setdefault(v['id'], {'impact': v['impact'], 'help': v['help'], 'where': []})
            entry['where'].append((label, nodes))
    await page.close()
    return found


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        total = 0
        for light in (False, True):
            theme = 'light' if light else 'dark'
            found = await check_theme(browser, light)
            print(f'== {theme} theme: {len(found)} rule(s) violated')
            for rule, entry in sorted(found.items()):
                count = sum(len(nodes) for _, nodes in entry['where'])
                total += count
                print(f"  [{entry['impact']}] {rule}: {entry['help']} — {count} element(s)")
                for label, nodes in entry['where']:
                    print(f'      in {label}')
                    if VERBOSE:
                        for n in nodes:
                            print(f"        {n['target']}  {n['html']}")
                            print(f"          {n['summary'].splitlines()[-1].strip() if n['summary'] else ''}")
        await browser.close()
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    asyncio.run(main())
