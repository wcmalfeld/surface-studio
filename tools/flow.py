import asyncio
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/dd5a51f8-4ea3-5e79-93ac-da02749d4ac4/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        pg = await ctx.new_page()
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto('file:///home/claude/surface-studio/apps/prototype/dist/local.html')
        await pg.wait_for_selector('.ss-tile')
        await pg.wait_for_timeout(2500)
        await pg.fill('#ss-text', "Start before you're ready.\nNobody is.")
        await pg.click('.ss-tab:has-text("Boards")')
        await pg.click('.ss-tile:has-text("Chalkboard")')
        await pg.wait_for_timeout(2500)
        info = await pg.evaluate("document.querySelector('.ss-counts').textContent")
        print('counts:', info)
        # scene prompt
        await pg.fill('#ss-prompt', 'spray paint on a red brick wall in an alley at night')
        await pg.click('button:has-text("Build scene")')
        await pg.wait_for_timeout(3000)
        print('scene:', await pg.evaluate("document.querySelector('.ss-scene-result').textContent"))
        print('treat:', await pg.evaluate("document.querySelector('.ss-treat[aria-pressed=true] b').textContent"))
        await pg.click('.ss-var:nth-child(3)')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=SP+'flow1.png')
        # adjust placement drag
        await pg.click('button:has-text("Adjust placement")')
        await pg.wait_for_timeout(300)
        cr = await (await pg.query_selector('.ss-frame canvas')).bounding_box()
        bb = None
        for c in await pg.query_selector_all('.ss-handles circle'):
            b2 = await c.bounding_box()
            if cr['x']+30 < b2['x'] < cr['x']+cr['width']-30 and cr['y']+30 < b2['y'] < cr['y']+cr['height']-30: bb = b2; break
        print('handle inside canvas:', bb is not None)
        await pg.mouse.move(bb['x']+9, bb['y']+9); await pg.mouse.down(); await pg.mouse.move(bb['x']-60, bb['y']+40, steps=5); await pg.mouse.up()
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=SP+'flow-drag.png')
        await pg.wait_for_timeout(2000)
        # undo
        print('before undo', await pg.evaluate('JSON.stringify({s:surfaceStudio.project.selected,m:surfaceStudio.project.mood,q:Object.keys(surfaceStudio.project.quads)})'))
        await pg.click('button[aria-label=Undo]')
        await pg.wait_for_timeout(300)
        print('after undo', await pg.evaluate('JSON.stringify({s:surfaceStudio.project.selected,m:surfaceStudio.project.mood,q:Object.keys(surfaceStudio.project.quads)})'))
        await pg.wait_for_timeout(1500)
        # export
        async with pg.expect_download() as dl:
            await pg.click('.ss-top .ss-btn.primary')
        d = await dl.value
        path = SP + d.suggested_filename
        await d.save_as(path)
        print('download:', d.suggested_filename)
        await pg.wait_for_timeout(1600)
        await pg.click('button:has-text("Projects")')
        await pg.wait_for_timeout(800)
        print('projects:', await pg.evaluate("document.querySelectorAll('.ss-pitem').length"))
        await pg.screenshot(path=SP+'flow2.png')
        print('logs', logs[:8])
        await b.close()
asyncio.run(main())
