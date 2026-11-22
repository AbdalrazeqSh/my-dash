// Forward paper log for the scalp strategies. Every run: fetch the last ~83h of 5m bars for the top liquid halal coins,
// detect NEW signals (signal bar closed after the first run), and update outcomes of earlier ones. State: data/scalp.json
const fs=require('fs'),path=require('path');
const {prep,detect,sim,IDS,BAR}=require('./core');
const HOST='https://data-api.binance.vision',SF=path.join(__dirname,'..','..','data','scalp.json'),TOP=40;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jget(p){for(let a=0;a<5;a++){try{const r=await fetch(HOST+p);if(r.status===429||r.status===418){await sleep(20000);continue}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){if(a===4)throw e;await sleep(1500)}}}
(async()=>{
  const now=Date.now(),state=fs.existsSync(SF)?JSON.parse(fs.readFileSync(SF,'utf8')):{start:now,trades:{}};
  const s=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8'),hb=new Set(s.match(/var HALAL_BASE="([^"]+)"/)[1].split(','));
  const STB=new Set(['USDC','FDUSD','TUSD','USDP','DAI','EUR','USD1','XUSD','BFUSD','AEUR','PAXG']);
  const tk=await jget('/api/v3/ticker/24hr?type=MINI');
  const U=tk.filter(x=>/USDT$/.test(x.symbol)).map(x=>({s:x.symbol.replace(/USDT$/,''),q:+x.quoteVolume})).filter(x=>hb.has(x.s)&&!STB.has(x.s)&&x.q>(+process.env.MINQ||5e6)).sort((a,b)=>b.q-a.q).slice(0,TOP);
  // also refresh coins that still have unresolved trades
  const openSyms=new Set(Object.values(state.trades).filter(t=>!t.res||t.res.st==='open'||t.res.st==='pending').map(t=>t.sym));
  const list=[...U.map((x,i)=>({s:x.s,rank:i}))];openSyms.forEach(sy=>{if(!list.some(x=>x.s===sy))list.push({s:sy,rank:TOP})});
  let added=0,upd=0,fails=0;
  for(const u of list){
    let ks;try{ks=await jget(`/api/v3/klines?symbol=${u.s}USDT&interval=5m&limit=1000`)}catch(e){fails++;continue}
    const b=ks.filter(k=>+k[6]<now).map(k=>[+k[0],+k[1],+k[2],+k[3],+k[4],+k[7]]);if(b.length<700)continue;
    const P=prep(b),slip=u.rank<10?0.0002:0.0005,tIdx=new Map(P.t.map((t,i)=>[t,i]));
    for(const sid of IDS){for(const sg of detect(P,sid,u.rank,P.n-420)){
      const tS=P.t[sg.i],key=sid+'|'+u.s+'|'+tS;if(state.trades[key]||tS<state.start)continue;
      const {i,...rest}=sg;state.trades[key]={sym:u.s,sid,tS,sig:rest,res:sim(P,sg,slip)};added++}}
    for(const [key,t] of Object.entries(state.trades)){
      if(t.sym!==u.s||(t.res&&!['open','pending'].includes(t.res.st)))continue;
      const i=tIdx.get(t.tS);if(i==null)continue;t.res=sim(P,{...t.sig,i},slip);upd++}
    await sleep(150)}
  fs.mkdirSync(path.dirname(SF),{recursive:true});fs.writeFileSync(SF,JSON.stringify(state));
  const cnt={};Object.values(state.trades).forEach(t=>{const k=t.sid+':'+(t.res?t.res.st:'?');cnt[k]=(cnt[k]||0)+1});
  console.log(`scalp-fwd coins=${list.length} fails=${fails} new=${added} updated=${upd} total=${Object.keys(state.trades).length}`);
})().catch(e=>{console.error('SCALP FWD FAIL',e.message);process.exit(1)});
