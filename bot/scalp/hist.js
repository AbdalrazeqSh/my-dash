// Historical screen of the scalp strategies (fixed parameters, no tuning). Output: data/scalp-hist.md
// Usage: node bot/scalp/hist.js   (env DAYS=180 TOP=30 SYNTH=1 for an offline smoke test)
const fs=require('fs'),path=require('path');
const {prep,detect,sim,IDS,NAMES,BAR}=require('./core');
const DAYS=+process.env.DAYS||180,TOP=+process.env.TOP||30,SYNTH=!!process.env.SYNTH,HOST='https://data-api.binance.vision';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jget(p){for(let a=0;a<6;a++){try{const r=await fetch(HOST+p);if(r.status===429||r.status===418){await sleep(20000);continue}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){if(a===5)throw e;await sleep(1500)}}}
function halalBase(){const s=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');const m=s.match(/var HALAL_BASE="([^"]+)"/);return new Set(m[1].split(','))}
async function universe(){
  if(SYNTH)return['AAA','BBB','CCC','DDD','EEE'].map((s,i)=>({s,rank:i}));
  const hb=halalBase(),tk=await jget('/api/v3/ticker/24hr?type=MINI'),STB=new Set(['USDC','FDUSD','TUSD','USDP','DAI','EUR','USD1','XUSD','BFUSD','AEUR','PAXG']);
  const L=tk.filter(x=>/USDT$/.test(x.symbol)).map(x=>({s:x.symbol.replace(/USDT$/,''),q:+x.quoteVolume})).filter(x=>hb.has(x.s)&&!STB.has(x.s)&&x.q>1e7).sort((a,b)=>b.q-a.q).slice(0,TOP);
  return L.map((x,i)=>({s:x.s,rank:i}))}
async function bars(sym,now){
  if(SYNTH){let seed=sym.charCodeAt(0),r=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;const out=[];let p=100,t=now-(DAYS*288+700)*BAR;for(let i=0;i<DAYS*288+700;i++){const vol=0.0015*(1+(r()<0.02?6:0)),o=p,c=p*(1+(r()-0.5)*vol*3.4),h=Math.max(o,c)*(1+r()*vol),l=Math.min(o,c)*(1-r()*vol);out.push([t,o,h,l,c,(50+r()*100)*(r()<0.03?6:1)]);p=c;t+=BAR}return out}
  const need=DAYS*288+700,end=Math.floor(now/BAR)*BAR;let t=end-need*BAR,out=[];
  while(t<end){const j=await jget(`/api/v3/klines?symbol=${sym}USDT&interval=5m&limit=1000&startTime=${t}`);if(!j.length)break;for(const k of j){if(+k[6]>now)continue;out.push([+k[0],+k[1],+k[2],+k[3],+k[4],+k[7]])}t=+j[j.length-1][0]+BAR;await sleep(120)}
  return out}
function rng(seed){return()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296}
function stats(rows){const R=rows.map(r=>r.R),n=R.length,m=n?R.reduce((a,b)=>a+b,0)/n:NaN,w=R.filter(x=>x>0),ls=R.filter(x=>x<=0);
  const gp=w.reduce((a,b)=>a+b,0),gl=-ls.reduce((a,b)=>a+b,0);return{n,m,win:n?w.length/n:NaN,pf:gl>0?gp/gl:NaN,why:['S','T','X'].map(k=>rows.filter(r=>r.why===k).length)}}
function dayBoot(a,c,B=2000){ // a: rows of strategy, c: rows of control; returns [lowOwn,lowDiff]
  const D={};const add=(rows,k)=>rows.forEach(r=>{const d=Math.floor(r.tE/864e5);(D[d]=D[d]||[0,0,0,0])[k]+=r.R;D[d][k+1]++});add(a,0);add(c,2);
  const ds=Object.keys(D).map(k=>D[k]),rnd=rng(777),own=[],dif=[];
  for(let b=0;b<B;b++){let sa=0,na=0,sc=0,nc=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];sa+=d[0];na+=d[1];sc+=d[2];nc+=d[3]}
    if(na)own.push(sa/na);if(na&&nc)dif.push(sa/na-sc/nc)}
  own.sort((x,y)=>x-y);dif.sort((x,y)=>x-y);const q=(x,p)=>x.length?x[Math.floor(x.length*p)]:NaN;return[q(own,0.01),q(dif,0.01),q(dif,0.5)]}
(async()=>{
  const now=Date.now(),U=await universe(),rows=[];let done=0;const cut=now-DAYS*864e5;
  const work=async()=>{while(U.length){const u=U.shift(),b=await bars(u.s,now);if(b.length<800){console.log('skip',u.s,b.length);continue}
    const P=prep(b),from=P.t.findIndex(x=>x>=cut),slip=u.rank<10?0.0002:0.0005;
    for(const sid of IDS){for(const sg of detect(P,sid,u.rank,from)){const r=sim(P,sg,slip);if(r.st==='closed')rows.push({sid,sym:u.s,tE:r.tE,R:r.R,net:r.net,why:r.why,entry:r.entry,exit:r.exit,risk:r.risk})}}
    done++;console.log('coin',u.s,done,'trades so far',rows.length)}};
  await Promise.all([work(),work(),work()]);
  const ctrl=rows.filter(r=>r.sid==='R1'),cs=stats(ctrl);
  let md=`# غربلة تاريخية للسكالبينج (شموع 5 دقائق)\nتاريخ: ${new Date().toISOString().slice(0,16)}Z · ${DAYS} يوماً · العملات: ${done} (الأعلى سيولة من قائمتك المباحة) · رسوم 0.1% لكل طرف + انزلاق · وقف أدنى 0.8%\n\n`;
  md+=`> قواعد ثابتة مسجّلة مسبقاً، بلا ضبط. العتبة: الحد الأدنى لفاصل 99% (تجميع حسب اليوم) للفرق عن الضابط العشوائي > 0. انحياز البقاء قائم (عملات اليوم فقط).\n\n`;
  md+=`| الاستراتيجية | صفقات | متوسط R | ربح% | PF | R برسوم BNB | حد 99% (ذاتي) | الفرق عن الضابط | حد 99% للفرق | R النصف1/النصف2 | أكبر عملة | خروج وقف/هدف/مهلة |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const res={};
  for(const sid of IDS){const rs=rows.filter(r=>r.sid===sid).sort((a,b)=>a.tE-b.tE),s=stats(rs);if(!rs.length){md+=`| ${sid} ${NAMES[sid]} | 0 | | | | | | | | | | |\n`;continue}
    const f2=0.00075,mb=rs.reduce((a,r)=>a+((r.exit*(1-f2))/(r.entry*(1+f2))-1)/r.risk,0)/rs.length;
    const [lo,ld,md50]=sid==='R1'?[NaN,NaN,NaN]:dayBoot(rs,ctrl),h=Math.floor(rs.length/2),m1=stats(rs.slice(0,h)).m,m2=stats(rs.slice(h)).m;
    const byC={};rs.forEach(r=>byC[r.sym]=(byC[r.sym]||0)+r.R);const tot=Object.values(byC).reduce((a,b)=>a+b,0),top=Math.max(...Object.values(byC)),topn=Object.keys(byC).find(k=>byC[k]===top);
    const f=(x,d=2)=>isFinite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
    md+=`| ${sid} ${NAMES[sid]} | ${s.n} | ${f(s.m)} | ${isFinite(s.win)?Math.round(s.win*100):'—'}% | ${isFinite(s.pf)?s.pf.toFixed(2):'—'} | ${f(mb)} | ${f(lo)} | ${sid==='R1'?'—':f(s.m-cs.m)} | ${f(ld)} | ${f(m1)} / ${f(m2)} | ${topn} ${tot>0?Math.round(top/tot*100)+'%':'—'} | ${s.why.join('/')} |\n`;
    res[sid]={n:s.n,m:s.m,lo,diff:s.m-cs.m,ld,m1,m2}}
  md+=`\nالضابط العشوائي: ${cs.n} صفقة، متوسط R ${cs.m.toFixed(3)} (هذا هو أثر الرسوم والسوق وحدهما).\n`;
  const out=process.env.OUT||path.join(__dirname,'..','..','data','scalp-hist.md');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,md);fs.writeFileSync(out.replace(/\.md$/,'.json'),JSON.stringify(res));console.log(md);
})().catch(e=>{console.error(e);process.exit(1)});
