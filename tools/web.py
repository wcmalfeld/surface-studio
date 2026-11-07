import asyncio
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/dd5a51f8-4ea3-5e79-93ac-da02749d4ac4/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width':1366,'height':860})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        pg = await ctx.new_page()
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto('http://localhost:3123/')
        await pg.wait_for_selector('.ss-tile', timeout=20000)
        await pg.fill('#ss-text', 'Ship the small version first.')
        await pg.click('.ss-tile:has-text("Sticky note")')
        await pg.wait_for_timeout(4000)
        r = await pg.evaluate("fetch('/api/store/projects').then(r=>r.json()).then(j=>j.items.map(i=>[i.text,i.surfaceId,!!i.thumb]))")
        print('saved via API:', r)
        await pg.screenshot(path=SP+'web.png')
        await pg.reload(); await pg.wait_for_selector('.ss-tile'); await pg.wait_for_timeout(1500)
        print('after reload text:', await pg.input_value('#ss-text'))
        print('logs', logs[:6])
        await b.close()
asyncio.run(main())
