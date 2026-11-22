// Smoke test: loads the app with fake credentials and mocked Binance, clicks every tab/sub-tab/theme button,
// fails on any page error or on a click that does not change the UI. Run: node tests/smoke.js
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),PORT=8099+Math.floor(Math.random()*500);
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let n=q.url.split('?')[0];if(n==='/')n='/index.html';try{s.setHeader('content-type',MIME[path.extname(n)]||'text/plain');s.end(fs.readFileSync(path.join(ROOT,n)))}catch(e){s.statusCode=404;s.end()}});
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);console.log((c?'PASS ':'FAIL ')+m)};
(async()=>{
await new Promise(r=>srv.listen(PORT,r));
const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:430,height:900}}),p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();
 if(/exchangeInfo/.test(u))return r.fulfill({json:{symbols:[]}});
 if(/\/account/.test(u))return r.fulfill({json:{balances:[{asset:'USDT',free:'100',locked:'0'},{asset:'BTC',free:'0.01',locked:'0'}],canTrade:true,permissions:['SPOT']}});
 if(/ticker\/24hr/.test(u))return r.fulfill({json:[{symbol:'BTCUSDT',openPrice:'60000',lastPrice:'61000',volume:'1',quoteVolume:'1',highPrice:'62000',lowPrice:'59000'}]});
 if(/ticker\/price/.test(u))return r.fulfill({json:[{symbol:'BTCUSDT',price:'61000'}]});
 return r.fulfill({json:[]})});
await p.addInitScript(()=>{localStorage.setItem('bk','x'.repeat(64));localStorage.setItem('bs','y'.repeat(64))});
await p.goto(`http://localhost:${PORT}/`);await p.waitForTimeout(2500);
ok(await p.evaluate(()=>window.__ok===1),'app starts (window.__ok)');
const tab=()=>p.evaluate(()=>document.body.getAttribute('data-tab')),sub=()=>p.evaluate(()=>{const e=document.querySelector('#subnav .on');return e&&e.dataset.sub});
for(const t of ['ana','wal','trd','set','home','ana']){await p.click(`#tabs button[data-tab="${t}"]`);await p.waitForTimeout(200);ok(await tab()===t,`main tab ${t} switches`)}
for(const t of ['ana','set','trd']){await p.click(`#tabs button[data-tab="${t}"]`);await p.waitForTimeout(200);
 if(!await p.isVisible('#subnav')){console.log('PASS tab '+t+' has no sub-nav');continue}
 const subs=await p.$$eval('#subnav button',bs=>bs.map(x=>x.dataset.sub));
 for(const s of subs.slice().reverse().concat(subs)){await p.click(`#subnav button[data-sub="${s}"]`);await p.waitForTimeout(200);ok(await sub()===s,`sub-tab ${t}/${s} switches`)}}
// sub-tab must still work right after a main-tab change (regression v148-v152: body[data-tab] swallowed clicks)
await p.click('#tabs button[data-tab="home"]');await p.click('#tabs button[data-tab="ana"]');await p.click('#subnav button[data-sub="lab"]');await p.waitForTimeout(200);ok(await sub()==='lab','sub-tab after main-tab change');
const th=await p.$$('[data-th]');if(th.length){await p.click('#tabs button[data-tab="set"]');await p.waitForTimeout(200);const b0=await p.$('[data-th="dark"]');if(b0&&await b0.isVisible()){await b0.click();await p.waitForTimeout(150);ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='dark','theme button works')}}
ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
await b.close();srv.close();
console.log(fails.length?`\n${fails.length} FAILED`:'\nALL PASSED');process.exit(fails.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
