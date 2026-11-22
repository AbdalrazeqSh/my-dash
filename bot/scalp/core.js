// Scalp lab core: indicators, strategy signal detectors and trade simulator on 5m bars [t,o,h,l,c,v].
// Same code is used for the historical screen (hist.js) and the forward log (fwd.js). Parameters are FIXED (pre-registered).
const FEE=0.001, FLOOR=0.008, CAP=0.06, SLIP_STOP=0.0005, BAR=3e5;
const IDS=['S1','S2','S3','S4','S5','S6','S7','R1'];
const NAMES={S1:'اختراق افتتاح نيويورك',S2:'اشتعال الحجم',S3:'كنس السيولة والاستعادة',S4:'ارتداد التشبع البيعي',S5:'ارتداد في اتجاه صاعد',S6:'ارتفاع ثم تصحيح (5د)',S7:'استعادة VWAP',R1:'ضابط: دخول عشوائي'};
function prep(b){
  const n=b.length,t=b.map(x=>x[0]),o=b.map(x=>x[1]),h=b.map(x=>x[2]),l=b.map(x=>x[3]),c=b.map(x=>x[4]),v=b.map(x=>x[5]);
  const atr=new Float64Array(n),vma=new Float64Array(n),sma=new Float64Array(n),sd=new Float64Array(n),rsi=new Float64Array(n),vw=new Float64Array(n);
  const ema=p=>{const a=new Float64Array(n),k=2/(p+1);a[0]=c[0];for(let i=1;i<n;i++)a[i]=c[i]*k+a[i-1]*(1-k);return a};
  const e48=ema(48),e144=ema(144),e576=ema(576);
  let tr0=0;for(let i=1;i<n;i++){const tr=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));atr[i]=i<=14?(atr[i-1]*(i-1)+tr)/i:(atr[i-1]*13+tr)/14}
  let sv=0;for(let i=0;i<n;i++){if(i>=20){vma[i]=sv/20;}sv+=v[i];if(i>=20)sv-=v[i-20];}
  // rolling mean/sd of close (20)
  for(let i=19;i<n;i++){let s=0,s2=0;for(let j=i-19;j<=i;j++){s+=c[j];s2+=c[j]*c[j]}const m=s/20;sma[i]=m;sd[i]=Math.sqrt(Math.max(0,s2/20-m*m))}
  // RSI(7) Wilder
  let ag=0,al=0;for(let i=1;i<n;i++){const d=c[i]-c[i-1],g=Math.max(d,0),ls=Math.max(-d,0);if(i<=7){ag+=g/7;al+=ls/7}else{ag=(ag*6+g)/7;al=(al*6+ls)/7}rsi[i]=i<7?50:(al===0?100:100-100/(1+ag/al))}
  // UTC-day anchored VWAP
  let cd=-1,pv=0,vv=0;for(let i=0;i<n;i++){const d=Math.floor(t[i]/864e5);if(d!==cd){cd=d;pv=0;vv=0}const tp=(h[i]+l[i]+c[i])/3;pv+=tp*v[i];vv+=v[i];vw[i]=vv?pv/vv:c[i]}
  return {n,t,o,h,l,c,v,atr,vma,sma,sd,rsi,vw,e48,e144,e576};
}
const nthSun=(y,m,k)=>{const d=new Date(Date.UTC(y,m,1)),f=(7-d.getUTCDay())%7;return Date.UTC(y,m,1+f+7*(k-1))};
const usDST=t=>{const y=new Date(t).getUTCFullYear();return t>=nthSun(y,2,2)&&t<nthSun(y,10,1)};
function hash(a,b){let x=(a*73856093)^(b*19349663);x=Math.imul(x^(x>>>15),2246822519);x=Math.imul(x^(x>>>13),3266489917);return ((x^(x>>>16))>>>0)/4294967296}
const mn=(a,i,j)=>{let m=Infinity;for(let k=i;k<=j;k++)if(a[k]<m)m=a[k];return m};
const mx=(a,i,j)=>{let m=-Infinity;for(let k=i;k<=j;k++)if(a[k]>m)m=a[k];return m};
// detectors return [{s,i,stop,tgtR,tgt,trail,tb,lim?}] ; i = signal bar (closed); entry at open of i+1 (limit for S6)
function detect(P,sid,symIdx,from){
  const {n,t,o,h,l,c,v,atr,vma,sma,sd,rsi,vw,e48,e144,e576}=P,out=[];let cool=-1;const W=580,start=Math.max(W,from||0);
  const push=(s)=>{out.push(s)};
  if(sid==='S1'){
    const seen=new Set();
    for(let i=start;i<n-1;i++){
      const dt=new Date(t[i]),dow=dt.getUTCDay();if(dow===0||dow===6)continue;
      const day=Math.floor(t[i]/864e5),open=day*864e5+(usDST(day*864e5)?13.5:14.5)*36e5;
      if(t[i]<open+9e5||t[i]>=open+75*6e4||seen.has(day))continue;
      const k0=i-Math.round((t[i]-open)/BAR);if(k0<0||t[k0]!==open)continue;
      const rh=mx(h,k0,k0+2),rl=mn(l,k0,k0+2);
      if(c[i]>rh&&v[i]>=1.5*vma[i]){seen.add(day);push({s:'S1',i,stop:rl,tgtR:1.5,tb:18})}
    }
  }else if(sid==='S2'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;
      if(v[i]>=4*vma[i]&&c[i]-o[i]>=1.5*atr[i-1]&&h[i]>l[i]&&(c[i]-l[i])/(h[i]-l[i])>=0.75&&c[i]>mx(h,i-24,i-1)){cool=i+12;push({s:'S2',i,nat:1.5*atr[i],trail:1,tb:12})}}
  }else if(sid==='S3'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;const lo=mn(l,i-48,i-3);
      if(l[i]<lo*(1-0.001)&&c[i]>lo&&h[i]>l[i]&&(Math.min(o[i],c[i])-l[i])/(h[i]-l[i])>=0.5&&v[i]>=1.5*vma[i]){cool=i+12;push({s:'S3',i,stop:l[i]-0.1*atr[i],tgtR:2,tb:18})}}
  }else if(sid==='S4'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;
      if(rsi[i]<15&&c[i]<sma[i]-2.5*sd[i]){cool=i+12;push({s:'S4',i,nat:2*atr[i],tgtPx:sma[i],tb:12})}}
  }else if(sid==='S5'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;
      if(e144[i]>e576[i]&&c[i]>e144[i]&&rsi[i-1]<35&&c[i]>o[i]&&c[i]>h[i-1]&&mn(l,i-6,i)<=e48[i]*1.003){cool=i+12;push({s:'S5',i,stop:mn(l,i-6,i)-0.1*atr[i],tgtR:2,tb:36})}}
  }else if(sid==='S6'){
    for(let p=start;p<n-8;p++){if(p<cool)continue;
      if(!(c[p]/c[p-12]-1>=0.05))continue;
      const st=mn(l,p-24,p);let pk=h[p],pi=p,i=p+1;
      while(i<n){if(h[i]>pk){pk=h[i];pi=i}if(i-pi>=6)break;i++}
      if(i>=n||i-pi<6)break; // not confirmed yet (needs more bars)
      const leg=pk-st;if(!(leg/st>=0.05)){cool=i;continue}
      cool=i+144;push({s:'S6',i,lim:pk-0.5*leg,stop:st*0.998,tgt:pk-0.25*leg,cancelLow:st,cancelHigh:pk,expire:48,tb:288});
    }
  }else if(sid==='S7'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;if(new Date(t[i]).getUTCHours()<2)continue;
      let ok=c[i]>vw[i]&&v[i]>=2*vma[i]&&c[i]>o[i];if(!ok)continue;for(let k=i-12;k<i;k++)if(c[k]>=vw[k]){ok=false;break}
      if(ok){cool=i+12;push({s:'S7',i,stop:mn(l,i-12,i),tgtR:1.5,tb:24})}}
  }else if(sid==='R1'){
    for(let i=start;i<n-1;i++){if(i<cool)continue;if(hash(symIdx+1,Math.floor(t[i]/BAR))<1/120){cool=i+12;push({s:'R1',i,nat:1.5*atr[i],tgtR:1.5,tb:18})}}
  }
  return out;
}
// simulate one signal. slip = per-side entry slippage fraction. returns {st,tE,entry,exit,why,net,R,risk,tX}
function sim(P,sg,slip,fee){
  fee=fee==null?FEE:fee;const {n,t,o,h,l,c}=P;let j,entry,stop=sg.stop,tgt=sg.tgt,risk;
  if(sg.lim!=null){
    let fill=-1;for(let k=sg.i+1;k<=sg.i+sg.expire&&k<n;k++){if(h[k]>sg.cancelHigh||c[k]<sg.cancelLow)return{st:'nofill'};if(l[k]<=sg.lim*(1-0.0005)){fill=k;break}}
    if(fill<0)return{st:(sg.i+sg.expire<n)?'nofill':'pending'};
    j=fill;entry=Math.min(sg.lim,o[j]);
  }else{
    j=sg.i+1;if(j>=n)return{st:'pending'};entry=o[j]*(1+slip);
    if(sg.nat!=null)stop=entry-sg.nat;
  }
  if(!(stop<entry))return{st:'skip'};
  stop=Math.min(stop,entry*(1-FLOOR));risk=(entry-stop)/entry;if(risk>CAP)return{st:'skip'};
  if(sg.tgtR!=null)tgt=entry+sg.tgtR*(entry-stop);
  if(sg.tgtPx!=null){tgt=sg.tgtPx;if(!(tgt>entry+0.5*(entry-stop)))return{st:'skip'}}
  const riskAbs=entry-stop;let mc=entry,x=null,why='',k;
  for(k=j;k<n&&k<=j+sg.tb;k++){
    if(l[k]<=stop){x=Math.min(o[k],stop)*(1-SLIP_STOP);why='S';break}
    if(tgt!=null&&h[k]>=tgt){x=tgt;why='T';break}
    if(sg.trail){mc=Math.max(mc,c[k]);stop=Math.max(stop,mc-riskAbs)}
    if(k===j+sg.tb){x=c[k]*(1-slip);why='X';break}
  }
  if(x==null)return{st:'open',tE:t[j],entry,risk};
  const net=(x*(1-fee))/(entry*(1+fee))-1;
  return{st:'closed',tE:t[j],tX:t[Math.min(k,n-1)],entry,exit:x,why,net,R:net/risk,risk};
}
module.exports={prep,detect,sim,IDS,NAMES,FEE,FLOOR,CAP,BAR};
