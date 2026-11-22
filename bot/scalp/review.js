// Forward review of the scalp strategies against data/SCALP-PREREG.md -> data/scalp-review.md
const fs=require('fs'),path=require('path');
const {IDS,NAMES}=require('./core');
const SF=process.argv[2]||path.join(__dirname,'..','..','data','scalp.json'),OUT=process.argv[3]||path.join(__dirname,'..','..','data','scalp-review.md');
const st=JSON.parse(fs.readFileSync(SF,'utf8')),all=Object.values(st.trades);
const rows=sid=>all.filter(t=>t.sid===sid&&t.res&&t.res.st==='closed').map(t=>({sym:t.sym,tE:t.res.tE,R:t.res.R,why:t.res.why})).sort((a,b)=>a.tE-b.tE);
const m=x=>x.length?x.reduce((s,r)=>s+r.R,0)/x.length:NaN,f=(x,d=2)=>isFinite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
function boot(a,c,B=3000){const D={};const add=(rs,k)=>rs.forEach(r=>{const d=Math.floor(r.tE/864e5);(D[d]=D[d]||[0,0,0,0])[k]+=r.R;D[d][k+1]++});add(a,0);add(c,2);
  const ds=Object.values(D);let seed=99;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296,dif=[];
  for(let b=0;b<B;b++){let sa=0,na=0,sc=0,nc=0;for(let i=0;i<ds.length;i++){const d=ds[Math.floor(rnd()*ds.length)];sa+=d[0];na+=d[1];sc+=d[2];nc+=d[3]}if(na&&nc)dif.push(sa/na-sc/nc)}
  dif.sort((x,y)=>x-y);return dif.length?dif[Math.floor(dif.length*0.01)]:NaN}
const ctrl=rows('R1');let o=`# مراجعة السكالبينج الأمامية\nتاريخ: ${new Date().toISOString().slice(0,16)}Z · بدأ السجل ${new Date(st.start).toISOString().slice(0,16)}Z · إشارات ${all.length}\n\n`;
o+=`| الاستراتيجية | مغلقة | أيام | متوسط R | الفرق عن الضابط | حد 99% للفرق | R نصف1/نصف2 | أكبر عملة من R الموجب | القرار |\n|---|---|---|---|---|---|---|---|---|\n`;
for(const sid of IDS){const rs=rows(sid),days=new Set(rs.map(r=>Math.floor(r.tE/864e5))).size,h=Math.floor(rs.length/2);
  const lo=sid==='R1'?NaN:boot(rs,ctrl),m1=m(rs.slice(0,h)),m2=m(rs.slice(h));
  const pos={};rs.filter(r=>r.R>0).forEach(r=>pos[r.sym]=(pos[r.sym]||0)+r.R);const tp=Object.values(pos).reduce((a,b)=>a+b,0),share=tp>0?Math.max(...Object.values(pos))/tp:0;
  let dec='—';if(sid!=='R1'){dec=rs.length<60||days<20?'بيانات غير كافية':(lo>0&&m1>0&&m2>0&&share<=0.4?'مقبولة':'مرفوضة')}
  o+=`| ${sid} ${NAMES[sid]} | ${rs.length} | ${days} | ${f(m(rs))} | ${sid==='R1'?'—':f(m(rs)-m(ctrl))} | ${f(lo)} | ${f(m1)} / ${f(m2)} | ${Math.round(share*100)}% | ${dec} |\n`}
o+=`\nالشروط: ≥60 صفقة من ≥20 يوماً، حد 99% للفرق عن الضابط > 0، النصفان موجبان، لا عملة فوق 40%.\n`;
fs.writeFileSync(OUT,o);console.log(o);
