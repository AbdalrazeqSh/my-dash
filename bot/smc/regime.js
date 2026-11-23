// Market-regime filter test. Pre-registered: data/REGIME-PREREG.md. No tuning.
// Usage: node bot/smc/regime.js   (env DAYS=1095 TOP=40 SYNTH=1 for an offline smoke test)
const fs=require('fs'),path=require('path');
const DAYS=+process.env.DAYS||1095,TOP=+process.env.TOP||40,SYNTH=!!process.env.SYNTH,HOST='https://data-api.binance.vision';
const H=3600e3,FEE=0.001,K=3,W=6,QB=0.0017,MINC=SYNTH?3:10;

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
    for(let i=0;i<n;i++){if(i%200===0)drift=(r()-0.5)*0.0006;const o=p,c=p*(1+drift+(r()-0.5)*0.012),hh=Math.max(o,c)*(1+r()*0.004),ll=Math.min(o,c)*(1-r()*0.004);out.push([t,o,hh,ll,c,50+r()*100*(r()<0.05?4:1)]);p=c;t+=H}return out}
  let t=end-n*H,out=[];
  while(t<end){const j=await jget(`/api/v3/klines?symbol=${sym}USDT&interval=1h&limit=1000&startTime=${t}`);if(!j.length)break;for(const k of j){if(+k[6]>now)continue;out.push([+k[0],+k[1],+k[2],+k[3],+k[4],+k[7]])}t=+j[j.length-1][0]+H;await sleep(120)}
  return out}
function pack(b){return{t:b.map(x=>x[0]),o:b.map(x=>x[1]),h:b.map(x=>x[2]),l:b.map(x=>x[3]),c:b.map(x=>x[4]),n:b.length}}
function agg4(b){const g={};for(const x of b){const k=Math.floor(x[0]/(4*H));(g[k]=g[k]||[]).push(x)}
  return Object.keys(g).sort((a,b)=>a-b).map(k=>g[k]).filter(a=>a.length===4&&a[0][0]%(4*H)===0).map(a=>[a[0][0],a[0][1],Math.max(...a.map(x=>x[2])),Math.min(...a.map(x=>x[3])),a[3][4],0])}

function trendArr(P){const {h,l,c,n}=P,tr=new Int8Array(n),isSH=new Array(n).fill(false),isSL=new Array(n).fill(false);
  for(let i=K;i<n-K;i++){let a=true,b=true;for(let k=1;k<=K;k++){if(h[i-k]>=h[i]||h[i+k]>h[i])a=false;if(l[i-k]<=l[i]||l[i+k]<l[i])b=false}isSH[i]=a;isSL[i]=b}
  let SH=null,SL=null,t=0,mLow=null;
  for(let j=2*K+2;j<n;j++){const s=j-K;if(isSH[s])SH={p:h[s],i:s,b:false};if(isSL[s])SL={p:l[s],i:s,bd:false};
    if(SH&&!SH.b&&c[j]>SH.p&&c[j-1]>SH.p){SH.b=true;t=1;let li=SH.i;for(let q=SH.i;q<=j;q++)if(l[q]<l[li])li=q;mLow=l[li]}
    if(SL&&!SL.bd&&c[j]<SL.p&&c[j-1]<SL.p){SL.bd=true;t=-1}
    if(t===1&&mLow!=null&&c[j]<mLow&&c[j-1]<mLow)t=0;tr[j]=t}
  return tr}
function momentum(b){const n=b.length,up=new Int8Array(n),dn=new Int8Array(n);let tra=[];
  for(let i=1;i<n;i++){const pc=b[i-1][4];tra.push(Math.max(b[i][2]-b[i][3],Math.abs(b[i][2]-pc),Math.abs(b[i][3]-pc)));
    if(i<21)continue;let atr=0;for(let q=i-14;q<i;q++)atr+=Math.max(b[q][2]-b[q][3],Math.abs(b[q][2]-b[q-1][4]),Math.abs(b[q][3]-b[q-1][4]));atr/=14;
    let av=0;for(let q=i-20;q<i;q++)av+=b[q][5];av/=20;
    const body=Math.abs(b[i][4]-b[i][1]);if(body>=1.5*atr&&b[i][5]>=1.5*av){if(b[i][4]>b[i][1])up[i]=1;else dn[i]=1}}
  return{up,dn}}
function rng(seed){return()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296}
function boot(ds,B=6000){const rnd=rng(4242),dif=[];for(let b=0;b<B;b++){let a=0,na=0,c=0,nc=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];a+=d[0];na+=d[1];c+=d[2];nc+=d[3]}if(na&&nc)dif.push(a/na-c/nc)}dif.sort((x,y)=>x-y);return dif.length?dif[Math.floor(dif.length*QB)]:NaN}
(async()=>{
  const now=Date.now(),U=await universe(),C=[];let done=0;
  const work=async()=>{while(U.length){const u=U.shift(),b=await bars1h(u.s,now);if(b.length<2000){console.log('skip',u.s,b.length);continue}
    const P4=pack(agg4(b)),tr4=trendArr(P4),m=momentum(b);C.push({s:u.s,rank:u.rank,b,P4,tr4,m});done++;console.log('coin',u.s,done)}};
  await Promise.all([work(),work(),work()]);
  // market breadth per hour
  const BR=new Map();
  for(const c of C){const n=c.b.length;let su=0,sd=0;for(let i=0;i<n;i++){su+=c.m.up[i];sd+=c.m.dn[i];if(i>=W){su-=c.m.up[i-W];sd-=c.m.dn[i-W]}
    if(i>=W+21){const t=c.b[i][0],e=BR.get(t)||[0,0];e[0]+=su-sd;e[1]++;BR.set(t,e)}}}
  const Bv=[];for(const [t,e] of BR)if(e[1]>=MINC)Bv.push(e[0]/e[1]);Bv.sort((x,y)=>x-y);
  const hi=Bv[Math.floor(Bv.length*0.8)],lo=Bv[Math.floor(Bv.length*0.2)];
  const TESTS={BULL:o=>o.bs===1,TREND:o=>o.tr===1,BOTH:o=>o.bs===1&&o.tr===1,BEAR:o=>o.bs===-1},HZ=[4,24],D={};
  for(const k in TESTS)for(const hz of HZ)D[k+'_'+hz]={};
  const mid=now-DAYS*864e5/2;
  for(const c of C){const {b,P4,tr4}=c,n=b.length,slip=c.rank<10?0.0003:0.0006;let j4=-1;
    for(let i=W+21;i<n-1-24;i++){const t=b[i][0];while(j4+1<P4.n&&P4.t[j4+1]<=t-3*H)j4++;
      const e=BR.get(t);if(!e||e[1]<MINC)continue;const B=e[0]/e[1],bs=(B>=hi&&B>0)?1:(B<=lo&&B<0)?-1:0,tr=j4>=0?tr4[j4]:0;
      const o={bs,tr};const day=Math.floor(t/864e5);
      for(const hz of HZ){if(b[i+1+hz][0]-b[i+1][0]!==hz*H)continue;
        const r=(b[i+1+hz][1]*(1-slip-FEE))/(b[i+1][1]*(1+slip+FEE))-1;
        for(const k in TESTS){const d=D[k+'_'+hz];const x=d[day]||(d[day]=[0,0,0,0,t<mid?0:1]);x[2]+=r;x[3]++;if(TESTS[k](o)){x[0]+=r;x[1]++}}}}}
  let md=`# اختبار «حالة السوق»\nتاريخ: ${new Date().toISOString().slice(0,16)}Z · ${DAYS} يومًا · العملات: ${done} · حد زخم شرائي B≥${hi.toFixed(3)} · بيعي B≤${lo.toFixed(3)} · القواعد في data/REGIME-PREREG.md\n\n`;
  md+=`| الحالة | الأفق | مشاهدات | % من الوقت | متوسط العائد بالحالة | متوسط الكل | الفرق | حد 99.83% للفرق | الفرق نصف1/2 | عائد الحالة نصف1/2 | النتيجة |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const NM={BULL:'زخم شرائي للسوق',TREND:'اتجاه 4س صاعد',BOTH:'الاثنان معًا',BEAR:'زخم بيعي (معلومة)'},res={},f=x=>isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(2)+'%':'—';
  for(const k in TESTS)for(const hz of HZ){const ds=Object.values(D[k+'_'+hz]);let sS=0,nS=0,sA=0,nA=0;ds.forEach(d=>{sS+=d[0];nS+=d[1];sA+=d[2];nA+=d[3]});
    const half=h=>{let a=0,an=0,c=0,cn=0;ds.filter(d=>d[4]===h).forEach(d=>{a+=d[0];an+=d[1];c+=d[2];cn+=d[3]});return[an?a/an:NaN,cn?c/cn:NaN]};
    const [s1,a1]=half(0),[s2,a2]=half(1),lb=boot(ds),ok=k!=='BEAR'&&nS>=2000&&lb>0&&s1-a1>0&&s2-a2>0&&s1>0&&s2>0;
    md+=`| ${NM[k]} | ${hz}س | ${nS} | ${nA?(nS/nA*100).toFixed(0):'—'}% | ${f(nS?sS/nS:NaN)} | ${f(sA/nA)} | ${f(nS?sS/nS-sA/nA:NaN)} | ${k==='BEAR'?'—':f(lb)} | ${f(s1-a1)} / ${f(s2-a2)} | ${f(s1)} / ${f(s2)} | ${k==='BEAR'?'معلومة':ok?'✔ صمد':'✘ لم يصمد'} |\n`;
    res[k+'_'+hz]={n:nS,mean:nS?sS/nS:NaN,all:sA/nA,lb,ok}}
  const out=process.env.OUT||path.join(__dirname,'..','..','data','regime-hist.md');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,md);fs.writeFileSync(out.replace(/\.md$/,'.json'),JSON.stringify(res));console.log(md);
})().catch(e=>{console.error(e);process.exit(1)});
