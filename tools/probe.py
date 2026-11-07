import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page()
        pg.on('pageerror', lambda e: print('ERR', e))
        await pg.goto('file:///home/claude/surface-studio/tools/harness.html')
        print(await pg.evaluate(sys.argv[1]))
        await b.close()
asyncio.run(main())
