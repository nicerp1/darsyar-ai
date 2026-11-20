// Set RAVAND_PLAYWRIGHT to the installed Playwright module path if it is not installed in the project.
const { chromium } = require(process.env.RAVAND_PLAYWRIGHT || 'playwright');
const { call } = require('./study-rooms-test.cjs');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = 'http://localhost:8796';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
const schedule = Array.from({length:7},()=>({tasks:[{id:'math',subject:'مرور ریاضی',durationMinutes:25,status:'pending'}]}));

async function client(browser, username, viewport, testData = {}) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    const page=await context.newPage(), errors=[];
    page.setDefaultTimeout(8000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if (url.origin!==origin) return route.abort();
        if (url.pathname==='/api/bootstrap') return route.fulfill({json:{user:{username,name:username,avatar:'avatar:2',accountType:'student'},data:{settings:{sound:false},schedule:structuredClone(schedule),...testData}}});
        if (url.pathname==='/api/community' && url.searchParams.has('rooms')) {
            const {action,...data}=route.request().postDataJSON();
            const result=await call(username,action,data);
            return route.fulfill({status:result.status,json:result.body});
        }
        if (url.pathname==='/api/data') {
            const {key,value}=route.request().postDataJSON(); testData[key]=value;
            return route.fulfill({json:{ok:true}});
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({json:{ok:true,items:[]}});
        const file=path.resolve(__dirname,'..','.'+(url.pathname==='/'?'/index.html':url.pathname));
        try { return route.fulfill({body:await readFile(file),contentType:mime[path.extname(file)] || 'application/octet-stream'}); }
        catch { return route.fulfill({status:404}); }
    });
    return {context,page,errors};
}
const open = async page => {
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.locator('#view-dashboard.active').waitFor();
    await page.evaluate(()=>App.navigate('study-rooms'));
    await page.locator('#view-study-rooms.active').waitFor();
};
const press = (page,id) => page.locator(`#view-study-rooms button[data-sr="${id}"]:visible`).first().click();

(async()=>{
    const browser=await chromium.launch({channel:process.env.RAVAND_BROWSER_CHANNEL || 'msedge'});
    try {
        const data = {};
        const a=await client(browser,'alice',{width:1440,height:930},data);
        await open(a.page);
        await press(a.page,'create');
        await a.page.locator('[name="name"]').fill('کتابخانه شب');
        await a.page.locator('[data-form="create"] button[type="submit"]').click();
        await a.page.locator('.sr-session').waitFor();
        await press(a.page,'share');
        const url=await a.page.locator('#sr-link').inputValue();
        assert.match(url,/#room=.{36}\.[0-9a-f]{48}$/);
        await press(a.page,'dismiss');
        const b=await client(browser,'bob',{width:390,height:844});
        await b.page.goto(url,{waitUntil:'domcontentloaded'});
        await b.page.locator('.sr-session').waitFor();
        await press(a.page,'start');
        await a.page.getByText('در حال مطالعه',{exact:true}).first().waitFor();
        await b.page.getByText('هم‌زمان با اتاق',{exact:true}).waitFor();
        const seconds=text=>text.replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).split(':').reduce((x,y)=>x*60+Number(y),0);
        assert(Math.abs(seconds(await a.page.locator('.sr-time').innerText())-seconds(await b.page.locator('.sr-time').innerText()))<=1);
        await press(b.page,'solo');
        await b.page.getByRole('button',{name:'شروع تایمر من'}).waitFor();
        await press(b.page,'soloStart');
        await b.page.getByRole('button',{name:'مکث',exact:true}).waitFor();
        await press(b.page,'soloPause');
        await b.page.getByRole('button',{name:'ادامه',exact:true}).waitFor();
        assert((await a.page.locator('.sr-time').innerText()).startsWith('۴۹'));
        await press(a.page,'goal');
        await a.page.locator('[name="subject"]').fill('حل ۱۰ تست زیست');
        await a.page.locator('[data-form="goal"] button[type="submit"]').click();
        await a.page.locator('.sr-goal').filter({hasText:'حل ۱۰ تست زیست'}).locator('input').check();
        await a.page.waitForFunction(()=>Storage.get('schedule').flatMap(d=>d.tasks).some(t=>t.subject==='حل ۱۰ تست زیست'&&t.status==='completed'));
        assert(data.schedule.flatMap(d=>d.tasks).some(t=>t.subject==='حل ۱۰ تست زیست'&&t.status==='completed'));
        await press(a.page,'settings');
        assert.equal(await a.page.locator('.sr-themes img').count(),4);
        await a.page.locator('input[value="rain"]').check();
        await a.page.locator('[name="tick"]').check();
        await a.page.locator('[data-form="prefs"] button[type="submit"]').click();
        await a.page.waitForFunction(()=>document.querySelector('#view-study-rooms').dataset.themeRoom==='rain');
        assert.equal(data.study_room_preferences.tick,true);
        await press(b.page,'directory');
        assert.equal(await b.page.locator('#sr-directory').isVisible(),false);
        await b.page.evaluate(()=>{ document.getElementById('view-study-rooms').requestFullscreen=undefined; });
        await press(b.page,'fullscreen');
        assert.equal(await b.page.locator('[data-sr="fullscreen"]').getAttribute('aria-pressed'),'true');
        await b.page.keyboard.press('Escape');
        assert.equal(await b.page.locator('[data-sr="fullscreen"]').getAttribute('aria-pressed'),'false');
        assert.equal(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        assert.deepEqual([...a.errors,...b.errors],[]);
        if (process.env.RAVAND_ROOM_SCREENSHOT) await a.page.locator('#view-study-rooms').screenshot({path:process.env.RAVAND_ROOM_SCREENSHOT});
        console.log('PASS: two users, invite, shared clock, solo pause, multiple plan goals, settings, collapsible list, mobile fullscreen fallback');
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
