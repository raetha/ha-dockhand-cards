import asyncio
import os
from playwright.async_api import async_playwright

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

# Not meant to cover every card/config combination — this exists so Claude
# (or anyone) can visually sanity-check an editor's layout after changing
# it, the same way screenshot.py lets you sanity-check a card. Add/adjust
# entries here as needed while actively working on a given editor; there's
# no expectation these stay in sync with every editor this repo has, the
# way screenshot.py's CARDS list does for the README.
EDITORS = [
    ("dockhand-schedules-card", {"group_by": "environment"}, "editor-schedules.png", 480, 750),
    ("dockhand-updates-card", {"scope": "selected"}, "editor-updates.png", 480, 550),
    ("dockhand-overview-card", {"show_environments": True, "show_stacks": True}, "editor-overview.png", 480, 900),
]


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(device_scale_factor=2)
        page.on("pageerror", lambda exc: print("[pageerror]", exc))
        await page.goto("http://localhost:8931/index.html")
        await page.wait_for_function("window.__renderDone === true")

        for tag, config, filename, width, height in EDITORS:
            slot_id = filename.replace(".", "_")
            config = dict(config)
            config["__id"] = slot_id
            await page.evaluate(
                "([tag, config]) => window.__mountEditor(tag, config, %d)" % width,
                [tag, config],
            )
            await page.wait_for_timeout(500)
            el = page.locator(f"#{slot_id}")
            await el.screenshot(path=os.path.join(OUT_DIR, filename))
            print("saved", filename)

        await browser.close()


asyncio.run(main())
