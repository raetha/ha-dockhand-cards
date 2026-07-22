import asyncio
import os
from playwright.async_api import async_playwright

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

CARDS = [
    ("dockhand-environment-card", {"device_id": "env_3", "mode": "compact"}, "env-compact.png", 500, 140),
    ("dockhand-environment-card", {"device_id": "env_2", "mode": "standard"}, "env-standard.png", 500, 340),
    ("dockhand-environment-card", {"device_id": "env_1", "mode": "detailed"}, "env-detailed.png", 500, 640),
    ("dockhand-environment-card", {"device_id": "env_4", "mode": "full"}, "env-full.png", 900, 640),
    ("dockhand-vulnerability-card", {"device_id": "env_1"}, "vulnerability.png", 420, 260),
    ("dockhand-stack-card", {"device_id": "stack_1_core"}, "stack.png", 420, 180),
    ("dockhand-container-card", {"device_id": "container_1_web"}, "container.png", 420, 320),
    ("dockhand-stacks-card", {"device_id": "env_1"}, "stacks-list.png", 420, 220),
    ("dockhand-containers-card", {"device_id": "env_1"}, "containers-list.png", 420, 320),
    ("dockhand-updates-card", {"scope": "all"}, "updates.png", 420, 320),
    (
        "dockhand-overview-card",
        {
            "show_environments": True,
            "show_stacks": True,
            "show_containers": True,
            "environment_mode": "standard",
            "exclude_device_ids": ["env_3", "env_4"],
        },
        "overview.png",
        460,
        900,
    ),
]


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(device_scale_factor=2)
        page.on("pageerror", lambda exc: print("[pageerror]", exc))
        await page.goto("http://localhost:8931/index.html")
        await page.wait_for_function("window.__renderDone === true")

        for tag, config, filename, width, height in CARDS:
            slot_id = filename.replace(".", "_")
            config = dict(config)
            config["__id"] = slot_id
            await page.evaluate(
                "([tag, config]) => window.__mount(tag, config, %d)" % width,
                [tag, config],
            )
            await page.wait_for_timeout(500)
            el = page.locator(f"#{slot_id}")
            await el.screenshot(path=os.path.join(OUT_DIR, filename))
            print("saved", filename)

        await browser.close()


asyncio.run(main())
