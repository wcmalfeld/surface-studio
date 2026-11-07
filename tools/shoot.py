import sys, json, asyncio
from playwright.async_api import async_playwright
async def main():
    ids = sys.argv[1].split(',')
    out = sys.argv[2]
    opts = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': int(opts.get('vw',1130)), 'height': 400}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto('file:///home/claude/surface-studio/tools/harness.html')
        errs = await pg.evaluate('(a)=>runGrid(a[0],a[1])', [ids, opts])
        await pg.screenshot(path=out, full_page=True)
        print('errors', errs, logs[:5])
        await b.close()
asyncio.run(main())
