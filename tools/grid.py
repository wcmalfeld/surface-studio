import sys, json, asyncio
from playwright.async_api import async_playwright
# renders surfaces in a wrapped grid: each surface shows chosen recipes side by side
async def main():
    ids = sys.argv[1].split(','); out = sys.argv[2]; opts = json.loads(sys.argv[3])
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': opts.get('vw', 1500), 'height': 400})
        logs=[]; pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('file:///home/claude/surface-studio/tools/harness.html')
        await pg.add_style_tag(content='#out{display:flex;flex-wrap:wrap}.row{padding:3px;gap:3px}figcaption{font-size:10px}')
        errs = await pg.evaluate('(a)=>runGrid(a[0],a[1])', [ids, opts])
        await pg.screenshot(path=out, full_page=True)
        print('errors', errs, logs[:5]); print(await pg.evaluate('[...document.querySelectorAll("figcaption")].map(f=>f.textContent).join(" | ")'))
        await b.close()
asyncio.run(main())
