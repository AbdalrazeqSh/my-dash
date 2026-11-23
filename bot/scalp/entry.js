// Entry-method study (see data/ENTRY-PREREG.md): same signals, same exits, different entry mechanisms/filters.
const fs=require('fs'),path=require('path');
const {prep,detect,sim}=require('./core');
const DAYS=+process.env.DAYS||180,TOP=+process.env.TOP||40,SYNTH=!!process.env.SYNTH,HOST='https://data-api.binance.vision',BAR=3e5;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jget(p){for(let a=0;a<6;a++){try{const r=await fetch(HOST+p);if(r.status===429||r.status===418){await sleep(20000);continue}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){if(a===5)throw e;await sleep(1500)}}}
async function bars(sym,now){
  if(SYNTH){let seed=sym.charCodeAt(0),r=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;const out=[];let p=100,t=Math.floor(now/BAR)*BAR-(DAYS*288+700)*BAR;for(let i=0;i<DAYS*288+700;i++){const vol=0.0015*(1+(r()<0.02?6:0)),o=p,c=p*(1+(r()-0.5)*vol*3.4),h=Math.max(o,c)*(1+r()*vol),l=Math.min(o,c)*(1-r()*vol);out.push([t,o,h,l,c,(50+r()*100)*(r()<0.03?6:1)]);p=c;t+=BAR}return out}
  const need=DAYS*288+700,end=Math.floor(now/BAR)*BAR;let t=end-need*BAR,out=[];
  while(t<end){const j=await jget(`/api/v3/klines?symbol=${sym}USDT&interval=5m&limit=1000&startTime=${t}`);if(!j.length)break;for(const k of j){if(+k[6]>now)continue;out.push([+k[0],+k[1],+k[2],+k[3],+k[4],+k[7]])}t=+j[j.length-1][0]+BAR;await sleep(120)}
  return out}
const VARS=[['M','M',[]],['L5','L5',[]],['LL','LL',[]],['CF','CF',[]],['F_BTC','M',['BTC']],['F_LIQ','M',['LIQ']],['F_NYH','M',['NYH']],['F_VOL2','M',['VOL2']],['L5+F_BTC','L5',['BTC']],['L5+F_NYH','L5',['NYH']],['L5+F_LIQ','L5',['LIQ']],['CF+F_BTC','CF',['BTC']]];
const BASE=['S1','S2','S3','S4','S5','S7','R1'];
function rng(seed){return()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296}
(async()=>{
  const now=Date.now(),cut=now-DAYS*864e5,split=now-90*864e5;
  let U;if(SYNTH)U=['AAA','BBB','CCC','DDD'].map((s,i)=>({s,rank:i}));else{
    const hb=new Set(fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8').match(/var HALAL_BASE="([^"]+)"/)[1].split(',')),STB=new Set(['USDC','FDUSD','TUSD','USDP','DAI','EUR','USD1','XUSD','BFUSD','AEUR','PAXG']);
    const tk=await jget('/api/v3/ticker/24hr?type=MINI');U=tk.filter(x=>/USDT$/.test(x.symbol)).map(x=>({s:x.symbol.replace(/USDT$/,''),q:+x.quoteVolume})).filter(x=>hb.has(x.s)&&!STB.has(x.s)&&x.q>5e6).sort((a,b)=>b.q-a.q).slice(0,TOP).map((x,i)=>({s:x.s,rank:i}))}
  const btcB=await bars(SYNTH?'AAA':'BTC',now),btc=new Map();btcB.forEach((b,i)=>{if(i>=12)btc.set(b[0],b[4]/btcB[i-12][4]-1)});
  const recs=[];let done=0;const queue=U.slice();
  const work=async()=>{while(queue.length){const u=queue.shift(),b=await bars(u.s,now);if(b.length<800)continue;const P=prep(b),from=P.t.findIndex(x=>x>=cut),slip=u.rank<10?0.0002:0.0005;
    for(const sid of BASE){for(const sg of detect(P,sid,u.rank,from)){
      const m0=sim(P,sg,slip);if(m0.st!=='closed')continue;const tS=P.t[sg.i],h=new Date(tS).getUTCHours();
      const ok={BTC:(btc.get(tS)??0)>-0.003,LIQ:u.rank<10,NYH:h>=13&&h<17,VOL2:P.v[sg.i]>=2*P.vma[sg.i]};
      const r={sid,tS,test:tS>=split,v:{}};
      for(const [nm,mode,fl] of VARS){let res;if(!fl.every(f=>ok[f]))res=null;else res=nm==='M'?m0:sim(P,{...sg,ev:mode},slip);r.v[nm]=(res&&res.st==='closed')?res.R:null}
      recs.push(r)}}
    done++;console.log('coin',u.s,done,'signals',recs.length)}};
  await Promise.all([work(),work(),work()]);
  const f=(x,d=2)=>isFinite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
  function boot(rs,nm,B=2000){const D={};rs.forEach(r=>{const d=Math.floor(r.tS/864e5);const x=(r.v[nm]??0)-r.v.M;(D[d]=D[d]||[0,0]);D[d][0]+=x;D[d][1]++});const ds=Object.values(D),rnd=rng(4242),out=[];
    for(let b=0;b<B;b++){let s=0,n=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];s+=d[0];n+=d[1]}out.push(s/n)}out.sort((a,b)=>a-b);return out[Math.floor(B*0.01)]}
  function bootPT(rs,nm,B=2000){const D={};rs.forEach(r=>{const d=Math.floor(r.tS/864e5);const z=(D[d]=D[d]||[0,0,0,0]);if(r.v[nm]!=null){z[0]+=r.v[nm];z[1]++}z[2]+=r.v.M;z[3]++});const ds=Object.values(D),rnd=rng(9191),out=[];
    for(let b=0;b<B;b++){let a=0,na=0,c=0,nc=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];a+=d[0];na+=d[1];c+=d[2];nc+=d[3]}if(na)out.push(a/na-c/nc)}out.sort((x,y)=>x-y);return out.length?out[Math.floor(out.length*0.01)]:NaN}
  function row(rs,nm){const tr=rs.filter(r=>r.v[nm]!=null),N=rs.length,sum=tr.reduce((a,r)=>a+r.v[nm],0),base=rs.reduce((a,r)=>a+r.v.M,0)/N;return{n:tr.length,share:tr.length/N,pt:tr.length?sum/tr.length:NaN,po:sum/N,diff:sum/N-base,lo:nm==='M'?NaN:boot(rs,nm),ptd:nm==='M'?NaN:(tr.length?sum/tr.length-rs.reduce((a,r)=>a+r.v.M,0)/N:NaN),ptlo:nm==='M'?NaN:bootPT(rs,nm)}}
  function table(rs,title){let t=`### ${title} (${rs.length} إشارة أساسية)\n| الطريقة | منفَّذ% | متوسط R/صفقة | R/فرصة | الفرق عن M | حد 99% | تدريب: فرق R/فرصة | اختبار: فرق | اختبار: حد 99% | اختبار: R/صفقة | فرق R/صفقة (كل الفترة) | حد 99% لفرق R/صفقة |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    const tr=rs.filter(r=>!r.test),te=rs.filter(r=>r.test);
    for(const [nm] of VARS){const a=row(rs,nm),b=row(tr,nm),c=row(te,nm);t+=`| ${nm} | ${Math.round(a.share*100)}% | ${f(a.pt)} | ${f(a.po)} | ${nm==='M'?'—':f(a.diff)} | ${nm==='M'?'—':f(a.lo)} | ${nm==='M'?'—':f(b.diff)} | ${nm==='M'?'—':f(c.diff)} | ${nm==='M'?'—':f(c.lo)} | ${f(c.pt)} | ${nm==='M'?'—':f(a.ptd)} | ${nm==='M'?'—':f(a.ptlo)} |\n`}return t+'\n'}
  let md=`# دراسة طرق الدخول (180 يوماً، ${done} عملة، شموع 5د)\nتاريخ: ${new Date().toISOString().slice(0,16)}Z · القواعد في data/ENTRY-PREREG.md · الاختبار = آخر 90 يوماً.\n\n`;
  md+=`> ملاحظة قراءة: «R/فرصة» يكافئ الامتناع عن الصفقة، لذلك يتحسن لأي فلتر يقلل الصفقات الخاسرة. المقياس الحاسم لجودة الدخول هو «R/صفقة» وفرقه عن M.\n\n`+table(recs,'كل الإشارات')+table(recs.filter(r=>r.sid==='R1'),'الإشارات العشوائية فقط (عزل أثر الآلية)')+table(recs.filter(r=>r.sid!=='R1'),'إشارات الاستراتيجيات فقط');
  const out=process.env.OUT||path.join(__dirname,'..','..','data','entry-study.md');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,md);console.log(md);
})().catch(e=>{console.error(e);process.exit(1)});
