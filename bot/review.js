// Weekly review of the forward log (data/state.json) against data/PREREG.md. No dependencies.
// Usage: node bot/review.js [state.json] [out.md]
const fs=require('fs'),path=require('path');
const SF=process.argv[2]||path.join(__dirname,'..','data','state.json'),OUT=process.argv[3]||path.join(__dirname,'..','data','review.md');
const st=JSON.parse(fs.readFileSync(SF,'utf8')),ev=Object.values(st.events||{}).sort((a,b)=>a.t-b.t);
const cnt={};ev.forEach(e=>cnt[e.st]=(cnt[e.st]||0)+1);
const cl=ev.filter(e=>e.st==='closed'&&e.r&&e.r.R!=null);
const m=x=>x.length?x.reduce((s,v)=>s+v,0)/x.length:NaN,f=(x,d=2)=>isFinite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
const day=e=>Math.floor(e.t/864e5);
function boot(es,B=4000){const byD={};es.forEach(e=>(byD[day(e)]=byD[day(e)]||[]).push(e.r.R));const ds=Object.keys(byD);if(ds.length<2)return[NaN,NaN];const ms=[];
 let seed=12345;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
 for(let b=0;b<B;b++){let s=0,n=0;for(let i=0;i<ds.length;i++){const d=byD[ds[Math.floor(rnd()*ds.length)]];for(const v of d){s+=v;n++}}ms.push(s/n)}
 ms.sort((a,b)=>a-b);return[ms[Math.floor(B*0.05)],ms[Math.floor(B*0.95)]]}
const R=cl.map(e=>e.r.R),days=new Set(cl.map(day)).size,[lo,hi]=boot(cl);
const half=Math.floor(cl.length/2),h1=m(cl.slice(0,half).map(e=>e.r.R)),h2=m(cl.slice(half).map(e=>e.r.R));
const wins=R.filter(x=>x>0),loss=R.filter(x=>x<=0);
const fills=cl.flatMap(e=>e.r.fills||[]),why=[0,0,0];fills.forEach(x=>{if(x.res!=null)why[x.res]++});
const resolved=(cnt.closed||0)+(cnt.nofill||0);
const A1=cl.length>=70&&days>=15,A2=lo>0,A3=h1>0&&h2>0;
const verdict=!A1?'بيانات غير كافية: لا قرار.':(A2&&A3?'القبول: الميزة مثبتة بحسب القاعدة المسجّلة.':'الرفض: لا ميزة مثبتة، لا نكبّر الحجم.');
const hr=e=>new Date(e.t).getUTCHours(),lon=cl.filter(e=>hr(e)>=7&&hr(e)<13),oth=cl.filter(e=>!(hr(e)>=7&&hr(e)<13));
const last=ev.length?new Date(ev[ev.length-1].t).toISOString():'—',first=ev.length?new Date(ev[0].t).toISOString().slice(0,10):'—';
const wk=ev.filter(e=>Date.now()-e.t<7*864e5).length;
let o=`# مراجعة السجل الأمامي الآلي\nتاريخ المراجعة: ${new Date().toISOString().slice(0,16)}Z · من ${first} · آخر حدث ${last}\n\n`;
o+=`## القرار\n**${verdict}**\n\n`;
o+=`## الشروط المسجّلة مسبقاً\n- ≥70 حدثاً مغلقاً من ≥15 يوماً: ${cl.length} حدثاً، ${days} أياماً ${A1?'✓':'✗'}\n- الحد الأدنى لفاصل 90% لمتوسط R > 0: ${f(lo)} (الفاصل ${f(lo)} إلى ${f(hi)}) ${A2?'✓':'✗'}\n- متوسط R في النصفين: ${f(h1)} و${f(h2)} ${A3?'✓':'✗'}\n\n`;
o+=`## الأرقام\n- أحداث مسجّلة ${ev.length} (آخر 7 أيام: ${wk}) · ${Object.entries(cnt).map(([k,v])=>k+' '+v).join(' · ')}\n- متوسط R: ${f(m(R))} · نسبة الأحداث الرابحة: ${cl.length?Math.round(wins.length/cl.length*100):'—'}%\n- متوسط الربح ${f(m(wins))} · متوسط الخسارة ${f(m(loss))}\n- مصدر الخروج (لكل تنفيذ): مهلة ${why[0]} · هدف ${why[1]} · وقف ${why[2]}\n- نسبة التنفيذ بين المحسومة: ${resolved?Math.round((cnt.closed||0)/resolved*100):'—'}%\n\n`;
o+=`## الفرضية الثانوية (لندن 07–13 UTC) — وصفية\n- لندن: n=${lon.length}، متوسط ${f(m(lon.map(e=>e.r.R)))}\n- بقية الجلسات: n=${oth.length}، متوسط ${f(m(oth.map(e=>e.r.R)))}\n- ${lon.length>=30?'العينة كافية للقراءة الوصفية':'العينة لا تزال أقل من 30: لا تُقرأ'}\n`;
fs.writeFileSync(OUT,o);console.log(o);
