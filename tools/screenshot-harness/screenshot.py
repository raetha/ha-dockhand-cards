import asyncio
import os
import sys
from playwright.async_api import async_playwright

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
LIGHT = "--light" in sys.argv

CARDS = [
    ("dockhand-environment-card", {"device_id": "env_2", "mode": "compact"}, "env-compact.png", 500, 140),
    ("dockhand-environment-card", {"device_id": "env_2", "mode": "standard"}, "env-standard.png", 500, 340),
    ("dockhand-environment-card", {"device_id": "env_1", "mode": "detailed"}, "env-detailed.png", 500, 700),
    ("dockhand-environment-card", {"device_id": "env_4", "mode": "full"}, "env-full.png", 900, 640),
    ("dockhand-vulnerability-card", {"device_id": "env_1"}, "vulnerability.png", 420, 260),
    ("dockhand-stack-card", {"device_id": "stack_1_core"}, "stack.png", 420, 420),
    ("dockhand-container-card", {"device_id": "container_1_web"}, "container.png", 420, 320),
    ("dockhand-stacks-card", {"device_id": "env_1"}, "stacks-list.png", 420, 220),
    ("dockhand-containers-card", {"device_id": "env_1"}, "containers-list.png", 420, 320),
    ("dockhand-updates-card", {"scope": "all"}, "updates.png", 420, 320),
    ("dockhand-schedules-card", {"group_by": "environment"}, "schedules.png", 420, 460),
    (
        "dockhand-overview-card",
        {
            "show_environments": True,
            "environment_mode": "compact",
            "show_stacks": True,
            "show_containers": True,
            "exclude_device_ids": ["env_3", "env_4"],
        },
        "overview.png",
        920,
        900,
        # Overview is the one card with text outside a card body (its column
        # titles), which is unreadable on a transparent PNG once the README's
        # page background doesn't match the theme. Render it on HA's own
        # dashboard background instead, in the light theme.
        {"theme": "light", "backdrop": True},
    ),
]


async def _open_page(browser, light):
    page = await browser.new_page(device_scale_factor=2)
    page.on("pageerror", lambda exc: print("[pageerror]", exc))
    url = "http://localhost:8931/index.html" + ("?theme=light" if light else "")
    await page.goto(url)
    await page.wait_for_function("window.__renderDone === true")
    return page


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        pages = {}

        for tag, config, filename, width, height, *extra in CARDS:
            opts = extra[0] if extra else {}
            if "theme" in opts:
                # Fixed theme: produced once, only by the default (dark) run.
                if LIGHT:
                    continue
                light = opts["theme"] == "light"
            else:
                light = LIGHT
                if LIGHT:
                    filename = filename.replace(".png", "-light.png")
            if light not in pages:
                pages[light] = await _open_page(browser, light)
            page = pages[light]
            slot_id = filename.replace(".", "_")
            config = dict(config)
            config["__id"] = slot_id
            await page.evaluate(
                "([tag, config]) => window.__mount(tag, config, %d)" % width,
                [tag, config],
            )
            el = page.locator(f"#{slot_id}")
            if opts.get("backdrop"):
                await el.evaluate(
                    """(e) => Object.assign(e.style, {
                        background: 'var(--primary-background-color)',
                        padding: '16px',
                        borderRadius: '12px',
                        boxSizing: 'content-box'
                    })"""
                )
            await page.wait_for_timeout(500)
            await el.screenshot(path=os.path.join(OUT_DIR, filename), omit_background=True)
            print("saved", filename)

        await browser.close()


asyncio.run(main())
