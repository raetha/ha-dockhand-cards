"""Automated accessibility check: runs axe-core (WCAG 2.1 A/AA rules) over
every card and every editor, in both themes, against the same mock data and
real built bundle the screenshots use. It also finds text cut off by a
rounded corner (see clipped_by_corners) and names cut short beside pills
that should have given way (CROWDED_NAMES), which axe doesn't look for.

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
import io
import json
import re
import sys

from PIL import Image, ImageChops

from playwright.async_api import async_playwright

from screenshot import CARDS

VERBOSE = '--verbose' in sys.argv

# Extra states the screenshots don't show but a user can hit.
EXTRA_CARDS = [
    ('dockhand-container-card', {'device_id': 'container_1_backup'}),
    ('dockhand-stack-card', {'device_id': 'stack_1_monitoring'}),
    ('dockhand-stacks-card', {'exclude_device_ids': ['env_2', 'env_3', 'env_4'], 'group_by': 'status', 'show_controls': True}),
    ('dockhand-containers-card', {'exclude_device_ids': ['env_2', 'env_3', 'env_4'], 'group_by': 'status', 'show_controls': True}),
    ('dockhand-schedules-card', {'group_by': 'status', 'show_stats': True, 'show_controls': True}),
    ('dockhand-environment-card', {'device_id': 'env_3', 'mode': 'standard'}),
    ('dockhand-environment-card', {'device_id': 'env_1', 'mode': 'detailed'}),
    ('dockhand-vulnerability-card', {}),
    ('dockhand-containers-card', {'exclude_device_ids': ['env_2', 'env_3', 'env_4'], 'visible_badges': ['vulnerabilities', 'health'], 'sort_by': 'vulnerabilities'}),
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


# Every element that clips its content (overflow other than visible) and has
# rounded corners, through every shadow root under a slot.
CLIPPING_ELEMENTS = """(id) => {
    const out = [];
    const walk = (root) => {
        for (const e of root.querySelectorAll('*')) {
            if (e.shadowRoot) walk(e.shadowRoot);
            const cs = getComputedStyle(e);
            if (cs.overflow === 'visible' || !e.textContent.trim()) continue;
            const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius];
            if (radii.some((r) => parseFloat(r) > 0)) out.push(e);
        }
    };
    walk(document.getElementById(id));
    return out;
}"""

# The element's own paint is hidden for both shots, so only what it contains
# can differ: a rounded pill's background isn't a finding.
BARE = "e => { e.dataset.a11yStyle = e.getAttribute('style') ?? ''; Object.assign(e.style, {background: 'none', borderColor: 'transparent', boxShadow: 'none'}); }"
SQUARE = "e => { e.style.borderRadius = '0'; }"
RESTORE = "e => { e.setAttribute('style', e.dataset.a11yStyle); delete e.dataset.a11yStyle; if (!e.getAttribute('style')) e.removeAttribute('style'); }"


async def _shot(page, clip):
    return Image.open(io.BytesIO(await page.screenshot(clip=clip))).convert('L')


async def clipped_by_corners(page, slot_id):
    """Elements whose rounded corners cut off part of their content: what
    changes when the corners are made square. A clickable name that
    truncates (overflow: hidden) clipped the tail of a "p" at its start to
    .clickable's 6px corner; nothing else looks for that, and a screenshot
    only shows it to someone zooming in."""
    found = []
    elements = await page.evaluate_handle(CLIPPING_ELEMENTS, slot_id)
    for i in range(await elements.evaluate('(list) => list.length')):
        el = await elements.evaluate_handle('(list, i) => list[i]', i)
        await el.scroll_into_view_if_needed()
        box = await el.bounding_box()
        if not box or box['width'] < 1 or box['height'] < 1:
            continue
        clip = {'x': box['x'] - 2, 'y': box['y'] - 2, 'width': box['width'] + 4, 'height': box['height'] + 4}
        await el.evaluate(BARE)
        rounded = await _shot(page, clip)
        await el.evaluate(SQUARE)
        square = await _shot(page, clip)
        await el.evaluate(RESTORE)
        pixels = ImageChops.difference(rounded, square).point(lambda v: 255 if v > 20 else 0).histogram()[255]
        if pixels:
            target, html = await el.evaluate("e => [e.tagName.toLowerCase() + [...e.classList].map((c) => '.' + c).join(''), e.outerHTML.split('>')[0] + '> ' + e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60)]")
            found.append({'target': target, 'html': html, 'summary': f'{pixels} pixel(s) of content cut off by its rounded corners'})
    return found


# Rows whose name is cut short while pills that should give way first
# still show (row-fit.ts): measured to the fraction of a pixel, since the
# browser draws an ellipsis for any overflow.
CROWDED_NAMES = """(id) => {
    const out = [];
    const walk = (root) => {
        for (const e of root.querySelectorAll('*')) if (e.shadowRoot) walk(e.shadowRoot);
        for (const row of root.querySelectorAll('.row')) {
            const name = row.querySelector('.item-name');
            if (!name || !name.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(name);
            const text = range.getBoundingClientRect().width;
            const shown = name.getBoundingClientRect().width;
            const em = parseFloat(getComputedStyle(name).fontSize) || 14;
            if (text - shown <= 0.01 || shown >= Math.min(text, 6 * em)) continue;
            const shownPills = [...row.querySelectorAll('.name-label, .tag-pills, .tag-summary')].filter((p) => p.getClientRects().length > 0);
            if (shownPills.length) out.push({ target: 'row ' + name.textContent.trim(), html: shownPills.map((p) => p.textContent.trim()).join(', '), summary: `name shows ${shown.toFixed(1)} of ${text.toFixed(1)}px beside pills that should give way` });
        }
    };
    walk(document.getElementById(id));
    return out;
}"""


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
        crowded = await page.evaluate(CROWDED_NAMES, slot_id)
        if crowded:
            entry = found.setdefault('name-crowded-by-pills', {'impact': 'moderate', 'help': "A row's pills must give way before its name is cut short", 'where': []})
            entry['where'].append((label, crowded))
        nodes = [n for n in await clipped_by_corners(page, slot_id) if not from_shim(n)]
        if nodes:
            entry = found.setdefault('clipped-by-corner', {'impact': 'moderate', 'help': 'Content must not be cut off by rounded corners', 'where': []})
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
