import {createDemoTransactions as demo} from './demo-data.js';
import {runAgents, runScenario, answerQuestion, compactMoney, fullDate, todayIso, addDays} from './agents.js';
import {parseCsvTransactions, validateStoredTransactions, combineWithoutDuplicates, MAX_CSV_CHARS} from './transaction-utils.js';

const A=document.querySelector('#app'),T=document.querySelector('#toast'),K='nabd.transactions.v1';
let tx=[],startupFault=null,isDemo=false,view='overview';
let sc={extraCollection:0,reduceExpensesPct:0,delayLargeExpenseDays:0};
let msgs=[{r:'n',t:'اسألني عن الرصيد، العجز، المصروفات أو أول خطوة لازم تسويها.'}];
try{
  const stored=localStorage.getItem(K);
  if(stored===null){tx=demo();isDemo=true;}
  else {
    tx=validateStoredTransactions(JSON.parse(stored));
    isDemo=tx.length===16&&tx.every(t=>/^d(?:[1-9]|1[0-6])$/.test(t.id));
  }
}catch(error){
  // Do not silently overwrite corrupted financial data.
  startupFault={raw:null};
  try{startupFault.raw=localStorage.getItem(K);}catch{}
}
const nav=[['overview','نظرة عامة'],['transactions','الحركات'],['agents','الوكلاء'],['scenarios','السيناريوهات'],['assistant','اسأل نبض'],['settings','الإعدادات']];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=s=>{T.textContent=s;T.hidden=false;setTimeout(()=>T.hidden=true,4000)};
const persist=(rows,demoMode=false)=>{
  try{localStorage.setItem(K,JSON.stringify(rows));tx=rows;isDemo=demoMode;return true;}
  catch{toast('فشل حفظ البيانات على هذا الجهاز. لم نطبّق التغيير. صدّر نسخة احتياطية وتحقق من مساحة المتصفح.');return false;}
};
const dl=(name,contents,type='text/plain')=>{
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([contents],{type}));
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
const confirmReplace=message=>window.confirm(message);

function shell(x){return`<a class="skip-link" href="#main-content">تجاوز القائمة</a><div class="shell"><aside><h2>⌁ نَبض <small>NABD</small></h2><div class="local">● يعمل محليًا — بياناتك لا تغادر الجهاز</div><nav>${nav.map(n=>`<button data-v="${n[0]}" class="${view==n[0]?'on':''}">${n[1]}</button>`).join('')}</nav><footer>Multi-Agent Cashflow Engine v1.0</footer></aside><main id="main-content"><header><div><small>مركز القرار المالي</small><h1>${nav.find(n=>n[0]==view)[1]}</h1></div><button id="run">تشغيل التحليل</button></header><div class="content">${x}</div></main></div>`}
function cashChart(r){let min=Math.min(...r.forecast.map(x=>x.balance)),max=Math.max(...r.forecast.map(x=>x.balance)),span=max-min||1;return`<div class="bars">${r.forecast.map((p,i)=>`<div title="${fullDate(p.date)} — ${compactMoney(p.balance)}"><i class="${p.balance<0?'bad':''}" style="height:${20+Math.max(0,(p.balance-min)/span*80)}%"></i>${i%3==0?`<small>${p.date.slice(5)}</small>`:''}</div>`).join('')}</div>`}
function overview(r){let neg=r.forecast.find(x=>x.balance<0);return`<section class="hero"><div><b>✦ خلاصة نبض</b><h2>${neg?'ضغط سيولة قادم قبل أن يتحول إلى مشكلة.':'السيولة مستقرة ضمن فترة التوقع.'}</h2><p>${r.explanation}</p><button data-v="scenarios">جرّب سيناريو حل</button></div><div class="orb ${neg?'red':''}"><small>${neg?'العجز المتوقع':'الفترة'}</small><strong>${neg?compactMoney(Math.abs(neg.balance)):'14 يوم'}</strong></div></section><section class="stats"><article><small>الصافي المسجّل (رصيد افتتاحي 0)</small><b>${compactMoney(r.currentBalance)}</b></article><article><small>الوارد / 30 يوم</small><b class="ok">${compactMoney(r.inflow30d)}</b></article><article><small>الصادر / 30 يوم</small><b>${compactMoney(r.outflow30d)}</b></article><article><small>هامش التشغيل</small><b>${r.runwayDays??'—'} يوم</b></article></section><div class="cols"><section class="card"><h3>توقع السيولة — 14 يومًا</h3>${cashChart(r)}</section><section class="card"><h3>المخاطر</h3>${r.risks.length?r.risks.map(x=>`<div class="risk ${x.severity}"><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></div>`).join(''):'<p class="muted">لا توجد مخاطر بارزة.</p>'}</section></div><section class="card"><h3>خطة العمل</h3><div class="actions">${r.actions.map((x,i)=>`<article><em>${i+1}</em><b>${esc(x.title)}</b><p>${esc(x.detail)}</p><small>${x.impact==null?'الأثر المالي غير محسوب؛ يحتاج تحققًا':'هدف حسابي افتراضي: '+compactMoney(x.impact)}</small></article>`).join('')}</div></section>`}
function transactions(){return`<section class="card"><div class="head"><div><h3>الحركات المالية</h3><p class="muted">استورد CSV أو استخدم بيانات العرض.</p></div><div><label class="btn file-pick">استيراد CSV<input id="csv" type="file" accept=".csv,text/csv" class="visually-hidden" aria-label="اختر ملف CSV من جهازك"></label><button id="tpl">قالب CSV</button></div></div><div class="table"><table><tr><th>التاريخ</th><th>الوصف</th><th>الحالة</th><th>المبلغ</th></tr>${[...tx].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr><td>${fullDate(x.date)}</td><td>${esc(x.description)}</td><td>${x.status=='completed'?'مكتملة':'مجدولة'}</td><td class="${x.type=='income'?'ok':'out'}">${x.type=='income'?'+':'−'} ${compactMoney(x.amount)}</td></tr>`).join('')}</table></div></section>`}
function agents(r){return`<section class="card intro"><b>Multi-Agent Decision Engine</b><h2>ستة وكلاء، ولكل واحد مسؤولية قابلة للفحص.</h2><p class="muted">Observe → Calculate → Detect → Reason → Plan → Explain</p></section><div class="agents">${r.agentResults.map((x,i)=>`<article class="card"><em>${i+1}</em><small>${esc(x.agent.toUpperCase())}</small><h3>${esc(x.label)}</h3><p>${esc(x.summary)}</p><span class="${x.status}">${x.status=='warning'?'يحتاج انتباه':'تم'}</span></article>`).join('')}</div>`}
function scenarios(){let b=runAgents(tx),r=runScenario(tx,sc),bm=Math.min(...b.forecast.map(x=>x.balance)),sm=Math.min(...r.forecast.map(x=>x.balance));return`<section class="card"><h3>مختبر ماذا لو؟</h3><p class="muted">كل تغيير يعيد تشغيل الوكلاء على السيناريو الجديد.</p>${slider('extraCollection','تحصيل إضافي',0,2000000,50000,compactMoney(sc.extraCollection))}${slider('reduceExpensesPct','خفض المصروفات',0,40,5,sc.reduceExpensesPct+'%')}${slider('delayLargeExpenseDays','تأجيل أكبر دفعة',0,14,1,sc.delayLargeExpenseDays+' يوم')}</section><section class="compare"><article><small>قبل</small><b class="${bm<0?'out':''}">${compactMoney(bm)}</b></article><strong>←</strong><article><small>بعد</small><b class="${sm<0?'out':'ok'}">${compactMoney(sm)}</b></article></section><section class="card"><h3>${r.forecast.some(x=>x.balance<0)?'العجز ما زال موجودًا':'لا يظهر عجز خلال 14 يومًا؛ ربما تأجّل إلى ما بعد الفترة'}</h3>${cashChart(r)}<p>${r.explanation}</p></section>`}
function slider(k,l,min,max,step,s){return`<label class="slider"><span>${l}<b>${s}</b></span><input data-s="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${sc[k]}"></label>`}
function assistant(r){return`<div class="chat"><section class="card"><h3>نبض ●</h3><div class="messages">${msgs.map(x=>`<p class="${x.r}">${esc(x.t)}</p>`).join('')}</div><div class="ask"><input id="q" placeholder="مثال: متى راح يصير عندي عجز؟"><button id="ask">إرسال</button></div></section><aside class="card"><h3>أسئلة سريعة</h3>${['كم رصيدي الحالي؟','متى راح يصير عندي عجز؟','كم صرفت آخر 30 يوم؟','شنو أول خطوة أسويها؟'].map(x=>`<button data-q="${x}">${x}</button>`).join('')}<p class="muted">الإجابات مبنية على بياناتك ومحرك محلي deterministic، بدون API خارجي.</p></aside></div>`}
function settings(r){return`<div class="cols"><section class="card"><h3>البيانات</h3><button id="backup">تصدير Backup</button><label class="btn file-pick">استعادة Backup<input id="restore" type="file" accept=".json,application/json" class="visually-hidden" aria-label="اختر نسخة احتياطية بصيغة JSON"></label><button id="report">تصدير تقرير التحليل</button></section><section class="card"><h3>وضع العرض</h3><button id="demo">إعادة Demo</button><button id="clear" class="danger">مسح البيانات</button></section></div><section class="card"><h3>الخصوصية</h3><p class="muted">البيانات والتحليل محفوظان داخل المتصفح. نبض أداة دعم قرار وليس بديلًا عن المحاسب.</p><a href="privacy.html">سياسة الخصوصية</a> · <a href="terms.html">شروط الاستخدام</a></section>`}
function bind(){
  document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;render()});
  document.querySelector('#run').onclick=()=>{render();toast('أُعيد احتساب التحليل من البيانات المسجلة. راجع افتراضات الرصيد.')};
  const csv=document.querySelector('#csv');
  if(csv)csv.onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>MAX_CSV_CHARS*4)throw new Error('ملف CSV كبير جدًا');
      const prefix='csv-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const rows=parseCsvTransactions(await file.text(),prefix);
      const existing=isDemo?[]:tx;
      const merged=combineWithoutDuplicates(existing,rows);
      if(persist(merged.transactions,false)){
        render();
        toast('أضيفت '+merged.added+' حركة؛ تم تجاهل '+merged.skipped+' مكرر.');
      }
    }catch(error){toast('لم نضف أي حركة: '+(error?.message||'فشل الاستيراد'))}
    finally{e.target.value=''}
  };
  document.querySelector('#tpl')?.addEventListener('click',()=>{
    const today=todayIso(),due=addDays(today,4);
    dl('nabd-template.csv','date,amount,type,category,description,channel,status\n'+today+',850000,income,مبيعات,مبيعات اليوم,zaincash,completed\n'+due+',1200000,expense,موردون,دفعة مورد,bank,scheduled','text/csv;charset=utf-8');
  });
  document.querySelectorAll('[data-s]').forEach(x=>{
    x.oninput=()=>{const b=x.closest('.slider')?.querySelector('b');if(b)b.textContent=x.dataset.s==='reduceExpensesPct'?x.value+'%':x.dataset.s==='delayLargeExpenseDays'?x.value+' يوم':compactMoney(+x.value)};
    x.onchange=()=>{sc[x.dataset.s]=+x.value;render()};
  });
  document.querySelector('#ask')?.addEventListener('click',ask);
  document.querySelector('#q')?.addEventListener('keydown',e=>e.key==='Enter'&&ask());
  document.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>{document.querySelector('#q').value=x.dataset.q;ask()});
  document.querySelector('#backup')?.addEventListener('click',()=>dl('nabd-backup.json',JSON.stringify(tx,null,2),'application/json'));
  document.querySelector('#report')?.addEventListener('click',()=>dl('nabd-report.json',JSON.stringify(runAgents(tx),null,2),'application/json'));
  const restore=document.querySelector('#restore');
  if(restore)restore.onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('النسخة الاحتياطية أكبر من الحد المسموح');
      const rows=validateStoredTransactions(JSON.parse(await file.text()));
      if(confirmReplace('استعادة '+rows.length+' حركة؟ سيُستبدل السجل الحالي كله. احفظ نسخة احتياطية أولًا.')){
        if(persist(rows,false)){render();toast('استُعيدت '+rows.length+' حركة')}
      }
    }catch(error){toast('فشلت الاستعادة دون تغيير بياناتك: '+(error?.message||'ملف غير صالح'))}
    finally{e.target.value=''}
  };
  document.querySelector('#demo')?.addEventListener('click',()=>{
    if(confirmReplace('سيستبدل هذا الإجراء كل الحركات ببيانات عرض. هل صدّرت نسخة احتياطية؟')){
      if(persist(demo(),true))render()
    }
  });
  document.querySelector('#clear')?.addEventListener('click',()=>{
    if(confirmReplace('حذف جميع الحركات الموجودة على هذا المتصفح؟ لا يمكن التراجع دون Backup.')){
      if(persist([],false))render()
    }
  });
}
function ask(){let q=document.querySelector('#q')?.value.trim();if(!q)return;msgs.push({r:'u',t:q},{r:'n',t:answerQuestion(q,runAgents(tx))});render()}
function render(){
  if(startupFault){
    A.innerHTML='<main class="content"><section class="card"><h1>تعذّر قراءة البيانات المحفوظة</h1><p>لم نكتب فوق الملف الأصلي. يمكنك تنزيل البيانات التالفة لمحاولة استعادتها أو بدء سجل جديد بعد التأكد.</p><button id="salvage">تنزيل النسخة الخام</button> <button id="recover" class="danger">بدء سجل فارغ بعد التأكيد</button></section></main>';
    document.querySelector('#salvage').onclick=()=>dl('nabd-unreadable-storage.txt',startupFault.raw??'Storage unavailable');
    document.querySelector('#recover').onclick=()=>{
      if(confirmReplace('سيتم استبدال السجل الذي تعذّر قراءته. هل نزّلت النسخة الخام؟')){
        if(persist([],false)){startupFault=null;render()}
      }
    };
    return;
  }
  const r=runAgents(tx);
  const x=view==='overview'?overview(r):view==='transactions'?transactions():view==='agents'?agents(r):view==='scenarios'?scenarios():view==='assistant'?assistant(r):settings(r);
  const note=isDemo
    ?'<div class="notice" role="status"><b>وضع العرض:</b> الأرقام افتراضية. أول CSV صالح سيبدأ سجلًا جديدًا بدل خلطه بالبيانات التجريبية.</div>'
    :'<div class="notice" role="status">الحساب يبدأ من رصيد افتتاحي مفترض أنه صفر. إذا كانت الحركات لا تشمل التاريخ الكامل، فقد لا يساوي الصافي رصيدك الفعلي. راجع النتائج قبل أي قرار مالي.</div>';
  A.innerHTML=shell(note+x);bind();
}
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
