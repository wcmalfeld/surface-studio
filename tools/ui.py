import sys, asyncio
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/dd5a51f8-4ea3-5e79-93ac-da02749d4ac4/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        for name, vp, dark in [('desk', {'width':1440,'height':900}, False), ('mob', {'width':400,'height':860}, False), ('dark', {'width':1280,'height':820}, True)]:
            ctx = await b.new_context(viewport=vp, color_scheme='dark' if dark else 'light', device_scale_factor=1)
            pg = await ctx.new_page()
            logs=[]
            pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
            pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
            await pg.goto('file:///home/claude/surface-studio/apps/prototype/dist/local.html')
            await pg.wait_for_timeout(int(sys.argv[1]) if len(sys.argv)>1 else 5000)
            await pg.screenshot(path=SP+f'ui-{name}.png', full_page=(name=='mob'))
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            print(name, 'scrollWidth', sw, logs[:6])
            await ctx.close()
        await b.close()
asyncio.run(main())
