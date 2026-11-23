// SMC rules historical test on 1h/4h. Pre-registered: data/SMC-PREREG.md. No tuning.
// Usage: node bot/smc/hist.js   (env DAYS=1095 TOP=40 SYNTH=1 for an offline smoke test)
const fs=require('fs'),path=require('path');
const DAYS=+process.env.DAYS||1095,TOP=+process.env.TOP||40,SYNTH=!!process.env.SYNTH,HOST='https://data-api.binance.vision';
const H=3600e3,FEE=0.001,FLOOR=0.008,CAP=0.08,MAXB=60,K=3,NCTRL=3,Q=0.006;
const IDS=['A1','A2','A3','A4'],NAMES={A1:'كسر الهيكل',A2:'أوردر بلوك+FVG',A3:'سحب سيولة',A4:'سحب سيولة في اتجاه صاعد'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jget(p){for(let a=0;a<6;a++){try{const r=await fetch(HOST+p);if(r.status===429||r.status===418){await sleep(20000);continue}if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){if(a===5)throw e;await sleep(1500)}}}
function halalBase(){const s=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');const m=s.match(/var HALAL_BASE="([^"]+)"/);return new Set(m[1].split(','))}
async function universe(){
  if(SYNTH)return['AAA','BBB','CCC','DDD','EEE'].map((s,i)=>({s,rank:i}));
  const hb=halalBase(),tk=await jget('/api/v3/ticker/24hr?type=MINI'),STB=new Set(['USDC','FDUSD','TUSD','USDP','DAI','EUR','USD1','XUSD','BFUSD','AEUR','PAXG']);
  return tk.filter(x=>/USDT$/.test(x.symbol)).map(x=>({s:x.symbol.replace(/USDT$/,''),q:+x.quoteVolume})).filter(x=>hb.has(x.s)&&!STB.has(x.s)&&x.q>(+process.env.MINQ||5e6)).sort((a,b)=>b.q-a.q).slice(0,TOP).map((x,i)=>({s:x.s,rank:i}))}
async function bars1h(sym,now){
  const n=DAYS*24,end=Math.floor(now/H)*H;
  if(SYNTH){let seed=sym.charCodeAt(0)*7919,r=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;const out=[];let p=100,t=end-n*H,drift=0;
    for(let i=0;i<n;i++){if(i%200===0)drift=(r()-0.5)*0.0006;const o=p,c=p*(1+drift+(r()-0.5)*0.012),hh=Math.max(o,c)*(1+r()*0.004),ll=Math.min(o,c)*(1-r()*0.004);out.push([t,o,hh,ll,c,100]);p=c;t+=H}return out}
  let t=end-n*H,out=[];
  while(t<end){const j=await jget(`/api/v3/klines?symbol=${sym}USDT&interval=1h&limit=1000&startTime=${t}`);if(!j.length)break;for(const k of j){if(+k[6]>now)continue;out.push([+k[0],+k[1],+k[2],+k[3],+k[4],+k[7]])}t=+j[j.length-1][0]+H;await sleep(120)}
  return out}
function pack(b){return{t:b.map(x=>x[0]),o:b.map(x=>x[1]),h:b.map(x=>x[2]),l:b.map(x=>x[3]),c:b.map(x=>x[4]),n:b.length}}
function agg4(b){const g={};for(const x of b){const k=Math.floor(x[0]/(4*H));(g[k]=g[k]||[]).push(x)}
  return Object.keys(g).sort((a,b)=>a-b).map(k=>g[k]).filter(a=>a.length===4&&a[0][0]%(4*H)===0).map(a=>[a[0][0],a[0][1],Math.max(...a.map(x=>x[2])),Math.min(...a.map(x=>x[3])),a[3][4],0])}
function signals(P){
  const {o,h,l,c,n}=P,out=[],isSH=new Array(n).fill(false),isSL=new Array(n).fill(false);
  for(let i=K;i<n-K;i++){let a=true,b=true;for(let k=1;k<=K;k++){if(h[i-k]>=h[i]||h[i+k]>h[i])a=false;if(l[i-k]<=l[i]||l[i+k]<l[i])b=false}isSH[i]=a;isSL[i]=b}
  let SH=null,SL=null,trend=0,mLow=null,pend=null;
  for(let j=2*K+2;j<n-1;j++){
    const s=j-K;if(isSH[s])SH={p:h[s],i:s,b:false};if(isSL[s])SL={p:l[s],i:s,sw:false,bd:false};
    if(SH&&!SH.b&&c[j]>SH.p&&c[j-1]>SH.p){SH.b=true;trend=1;let li=SH.i;for(let q=SH.i;q<=j;q++)if(l[q]<l[li])li=q;mLow=l[li];
      let ih=-Infinity;for(let q=li;q<=j;q++)if(h[q]>ih)ih=h[q];
      out.push({sid:'A1',idx:j+1,stop:mLow,tgt:null});
      let fvg=false;for(let q=li+1;q<j;q++)if(l[q+1]>h[q-1]){fvg=true;break}
      if(fvg){let ob=-1;for(let q=Math.min(li+1,j);q>=Math.max(li-4,0);q--)if(c[q]<o[q]){ob=q;break}
        if(ob>=0)pend={lo:l[ob],hi:h[ob],from:j+1,until:j+24,ih}}}
    if(SL&&!SL.bd&&c[j]<SL.p&&c[j-1]<SL.p){SL.bd=true;trend=-1}
    if(trend===1&&mLow!=null&&c[j]<mLow&&c[j-1]<mLow)trend=0;
    if(pend&&j>=pend.from){if(j>pend.until||c[j]<pend.lo)pend=null;else if(l[j]<=pend.hi&&c[j]>o[j]&&c[j]>pend.lo){out.push({sid:'A2',idx:j+1,stop:pend.lo,tgt:pend.ih});pend=null}}
    if(SL&&!SL.sw&&l[j]<SL.p){SL.sw=true;if(c[j]>SL.p&&trend>=0){out.push({sid:'A3',idx:j+1,stop:l[j],tgt:null});if(trend===1)out.push({sid:'A4',idx:j+1,stop:l[j],tgt:null})}}
  }
  return out.sort((a,b)=>a.idx-b.idx)}
function sim(P,idx,stop,tgt,slip){
  const {o,h,l,c,t,n}=P;if(idx>=n-1)return null;
  const e=o[idx]*(1+slip);let st=stop,risk=(e-st)/e;
  if(!(st<e))return null;if(risk<FLOOR){st=e*(1-FLOOR);risk=FLOOR}if(risk>CAP)return null;
  const tg=tgt==null?e*(1+2*risk):tgt;if(tg<e*(1+risk))return null;
  const end=Math.min(n-1,idx+MAXB);let x=null,why='T',m=idx;
  for(;m<=end;m++){if(l[m]<=st){x=st*(1-slip);why='S';break}if(h[m]>=tg){x=tg;why='X';break}if(m===end){x=c[m]*(1-slip)}}
  const mm=Math.min(m,end),net=(x*(1-FEE))/(e*(1+FEE))-1;
  return{tE:t[mm],iE:mm,R:net/risk,risk,tgtPct:tg/e-1,entry:e,exit:x,why}}
function rng(seed){return()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function stats(rows){const R=rows.map(r=>r.R),n=R.length,m=n?R.reduce((a,b)=>a+b,0)/n:NaN,w=R.filter(x=>x>0),ls=R.filter(x=>x<=0),gp=w.reduce((a,b)=>a+b,0),gl=-ls.reduce((a,b)=>a+b,0);
  return{n,m,win:n?w.length/n:NaN,pf:gl>0?gp/gl:NaN}}
function dayBoot(a,c,B=2000){const D={};const add=(rows,k)=>rows.forEach(r=>{const d=Math.floor(r.tE/864e5);(D[d]=D[d]||[0,0,0,0])[k]+=r.R;D[d][k+1]++});add(a,0);add(c,2);
  const ds=Object.keys(D).map(k=>D[k]),rnd=rng(777),dif=[];
  for(let b=0;b<B;b++){let sa=0,na=0,sc=0,nc=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];sa+=d[0];na+=d[1];sc+=d[2];nc+=d[3]}if(na&&nc)dif.push(sa/na-sc/nc)}
  dif.sort((x,y)=>x-y);return dif.length?dif[Math.floor(dif.length*Q)]:NaN}
(async()=>{
  const now=Date.now(),U=await universe(),T=[],rows=[];let done=0;
  const work=async()=>{while(U.length){const u=U.shift(),b=await bars1h(u.s,now);if(b.length<2000){console.log('skip',u.s,b.length);continue}
    const slip=u.rank<10?0.0003:0.0006;
    for(const tf of ['1h','4h']){const P=pack(tf==='1h'?b:agg4(b));if(P.n<500)continue;const free={};
      for(const sg of signals(P)){const key=sg.sid;if(sg.idx<(free[key]||0))continue;const r=sim(P,sg.idx,sg.stop,sg.tgt,slip);if(!r)continue;free[key]=r.iE+1;
        rows.push({sid:sg.sid,tf,sym:u.s,tE:r.tE,R:r.R,entry:r.entry,exit:r.exit,risk:r.risk,ctrl:false});
        const rd=rng(hash(u.s+sg.sid+tf+sg.idx));
        for(let k=0;k<NCTRL;k++){const ci=50+Math.floor(rd()*(P.n-MAXB-60));const e0=P.o[ci];const cr=sim(P,ci,e0*(1-r.risk),e0*(1+r.tgtPct)*(1+slip),slip);
          if(cr)rows.push({sid:sg.sid,tf,sym:u.s,tE:cr.tE,R:cr.R,ctrl:true})}}}
    done++;console.log('coin',u.s,done,'rows',rows.length)}};
  await Promise.all([work(),work(),work()]);
  let md=`# اختبار قواعد SMC على 1س و4س\nتاريخ: ${new Date().toISOString().slice(0,16)}Z · ${DAYS} يومًا · العملات: ${done} · القواعد وشروط القبول في data/SMC-PREREG.md (مسجّلة قبل التشغيل)\n\n`;
  md+=`| الاستراتيجية | الفريم | صفقات | متوسط R | ربح% | PF | ضابط R | الفرق | حد 99.4% للفرق | R النصف1/2 | أكبر عملة | R بالسنة | النتيجة |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const res={},f=(x,d=2)=>isFinite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
  for(const sid of IDS)for(const tf of ['1h','4h']){
    const rs=rows.filter(r=>r.sid===sid&&r.tf===tf&&!r.ctrl).sort((a,b)=>a.tE-b.tE),cs=rows.filter(r=>r.sid===sid&&r.tf===tf&&r.ctrl);
    if(!rs.length){md+=`| ${sid} ${NAMES[sid]} | ${tf} | 0 |||||||||||\n`;continue}
    const s=stats(rs),c=stats(cs),lo=dayBoot(rs,cs),h=Math.floor(rs.length/2),m1=stats(rs.slice(0,h)).m,m2=stats(rs.slice(h)).m;
    const byC={},byY={},cnt={};rs.forEach(r=>{byC[r.sym]=(byC[r.sym]||0)+r.R;const y=new Date(r.tE).getUTCFullYear();byY[y]=(byY[y]||0)+r.R;cnt[y]=(cnt[y]||0)+1});
    const pos=Object.values(byC).filter(x=>x>0).reduce((a,b)=>a+b,0),top=Math.max(...Object.values(byC)),topn=Object.keys(byC).find(k=>byC[k]===top),share=pos>0&&top>0?top/pos:0;
    const ok=s.n>=150&&lo>0&&m1>0&&m2>0&&share<=0.4;
    md+=`| ${sid} ${NAMES[sid]} | ${tf} | ${s.n} | ${f(s.m)} | ${Math.round(s.win*100)}% | ${isFinite(s.pf)?s.pf.toFixed(2):'—'} | ${f(c.m)} | ${f(s.m-c.m)} | ${f(lo)} | ${f(m1)} / ${f(m2)} | ${topn} ${Math.round(share*100)}% | ${Object.keys(byY).sort().map(y=>y.slice(2)+':'+f(byY[y]/cnt[y],2)).join(' ')} | ${ok?'✔ صمد':'✘ لم يصمد'} |\n`;
    res[sid+'_'+tf]={n:s.n,m:s.m,ctrl:c.m,diff:s.m-c.m,lo,m1,m2,share,ok}}
  const out=process.env.OUT||path.join(__dirname,'..','..','data','smc-hist.md');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,md);fs.writeFileSync(out.replace(/\.md$/,'.json'),JSON.stringify(res));console.log(md);
})().catch(e=>{console.error(e);process.exit(1)});
