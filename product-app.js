import {createDemoTransactions} from './demo-data.js';
import {runAgents,runScenario,compactMoney,todayIso,addDays,fullDate} from './agents.js';
import {parseCsvTransactions,combineWithoutDuplicates,validateStoredTransactions,validateTransaction} from './transaction-utils.js';

const ROOT=document.querySelector('#app');
const TOAST=document.querySelector('#toast');
const TX_KEY='nabd.transactions.v1';
const BAL_KEY='nabd.opening-balance.v1';
const VIEWS=[['overview','لوحة التحكم','layout-dashboard'],['transactions','الحركات المالية','arrow-left-right'],
 ['analytics','التحليلات','chart'],['scenarios','ماذا لو؟','sliders'],['agents','قرارات نبض','sparkles'],['settings','الإعدادات','settings']];
const ICONS={
 'layout-dashboard':'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 'arrow-left-right':'<path d="M7 7h14m-4-4 4 4-4 4M17 17H3m4-4-4 4 4 4"/>',
 'chart':'<path d="M4 19V5m0 14h16M8 16v-4m4 4V7m4 9v-6m4 6V4"/>',
 'sliders':'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="16" cy="17" r="3" fill="white"/>',
 'sparkles':'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>',
 'settings':'<circle cx="12" cy="12" r="3"/><path d="m12 2 2 2 3-.3.8 3 2.6 1.5-1.5 2.7 1.5 2.6-2.6 1.5-.8 3-3-.3-2 2-2-2-3 .3-.8-3-2.6-1.5 1.5-2.6-1.5-2.7 2.6-1.5.8-3 3 .3Z"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>','download':'<path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/>',
 'wallet':'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M5 6V4h13M15 13h6"/>',
 'trend':'<path d="m3 17 7-7 5 3 6-8M16 5h5v5"/>','arrow-up':'<path d="M12 19V5m-5 5 5-5 5 5"/>',
 'arrow-down':'<path d="M12 5v14m-5-5 5 5 5-5"/>','chevron':'<path d="m9 18 6-6-6-6"/>',
 'search':'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>','calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 'shield':'<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
 'file':'<path d="M7 2h8l5 5v15H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z"/><path d="M15 2v6h5M8 13h8M8 17h8"/>',
 'edit':'<path d="m4 17-1 4 4-1L19 8l-3-3L4 17Z"/><path d="m14 7 3 3"/>','trash':'<path d="M4 7h16M8 7V4h8v3m-9 0 1 14h8l1-14M10 10v8m4-8v8"/>',
 'check':'<path d="m4 12 5 5L20 6"/>','alert':'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v1"/>',
 'filter':'<path d="M4 6h16M7 12h10m-7 6h4"/>','menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
 'close':'<path d="M5 5 19 19M19 5 5 19"/>','info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 'layers':'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>'
};
const ic=(name,size=20)=>'<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.info)+'</svg>';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value)+' د.ع';
const isDemoLedger=rows=>rows.length===16&&rows.every(row=>/^d(?:[1-9]|1[0-6])$/.test(row.id));
const number=value=>Number.isSafeInteger(value)&&Math.abs(value)<=1_000_000_000_000?value:null;
const state={view:'overview',transactions:[],demo:false,error:null,openingBalance:0,range:'30',search:'',type:'all',status:'all',
  modal:null,editId:null,scenario:{extraCollection:0,reduceExpensesPct:0,delayLargeExpenseDays:0},mobileMenu:false, page:1};
const load=()=>{
  try{
    const saved=localStorage.getItem(TX_KEY);
    state.transactions=saved===null?createDemoTransactions():validateStoredTransactions(JSON.parse(saved));
    state.demo=saved===null||isDemoLedger(state.transactions);
  }catch(err){state.error='تعذّر قراءة السجل المحفوظ. لم نمسح أو نعدّل البيانات الأصلية.';}
  try{
    const n=number(Number(localStorage.getItem(BAL_KEY)??'0'));
    state.openingBalance=n??0;
  }catch{}
};
load();
function save(rows, demoFlag=false){
  try{localStorage.setItem(TX_KEY,JSON.stringify(validateStoredTransactions(rows)));}
  catch(err){notify('تعذّر الحفظ. بقيت بياناتك السابقة كما هي.');return false;}
  state.transactions=rows;state.demo=demoFlag;return true;
}
function notify(message){if(!TOAST)return;TOAST.textContent=message;TOAST.hidden=false;clearTimeout(notify.handle);notify.handle=setTimeout(()=>{TOAST.hidden=true;},4800);}
function download(name,text,type='application/json'){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function report(){return runAgents(state.transactions,{openingBalance:state.openingBalance});}
function dateWindow(){
  if(state.range==='all')return '0000-01-01';
  if(state.range==='month')return todayIso().slice(0,7)+'-01';
  return addDays(todayIso(),-(Number(state.range)-1));
}
function eligible(row){const from=dateWindow(),until=todayIso();return row.date>=from&&row.date<=until;}
function summary(rows=state.transactions){
 const included=rows.filter(t=>t.status==='completed'&&eligible(t));
 return {income:included.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
 expenses:included.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
 count:included.length};
}
function groupedMonths(){
  const now=todayIso(), out=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now+'T12:00:00');
    d.setMonth(d.getMonth()-i);
    const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0')].join('-');
    const rows=state.transactions.filter(t=>t.status==='completed'&&t.date.slice(0,7)===key&&t.date<=now);
    out.push({key,label:new Intl.DateTimeFormat('ar-IQ',{month:'short'}).format(d),
      income:rows.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
      expenses:rows.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)});
  }
  return out;
}
function categoryExpenses(){
  const group=new Map();
  state.transactions.filter(t=>t.status==='completed'&&t.type==='expense'&&eligible(t))
   .forEach(t=>group.set(t.category,(group.get(t.category)||0)+t.amount));
  return [...group.entries()].map(([category,amount])=>({category,amount})).sort((a,b)=>b.amount-a.amount);
}
function baseLayout(content,r){
 const nav=VIEWS.map(v=>'<button class="nav-item '+(state.view===v[0]?'active':'')+'" data-v="'+v[0]+'" '+(state.view===v[0]?'aria-current="page"':'')+'>'+ic(v[2],20)+'<span>'+v[1]+'</span></button>').join('');
 const current=VIEWS.find(v=>v[0]===state.view)?.[1]||'لوحة التحكم';
 const source=state.demo?'<span class="data-pill sample">بيانات تجريبية</span>':'<span class="data-pill private">محفوظة على هذا الجهاز</span>';
 return '<a class="skip-link" href="#workspace">انتقل إلى المحتوى</a>'+
 '<div class="workspace"><aside class="sidebar '+(state.mobileMenu?'open':'')+'" aria-label="قائمة التنقل">'+
 '<div class="brand"><span class="brand-icon">'+ic('sparkles',25)+'</span><div><strong>نَبض</strong><small>NABD / FINANCE</small></div></div>'+
 '<div class="sidebar-caption">مساحة العمل</div><nav class="nav-list">'+nav+'</nav>'+
 '<div class="sidebar-bottom"><div class="security-note">'+ic('shield',22)+'<div><b>خصوصيتك أولاً</b><span>لا تُرفع الحركات إلى خادم نبض</span></div></div>'+
 '<button class="sidebar-help" data-v="settings">'+ic('info',18)+' تفاصيل البيانات والنسخ الاحتياطية</button></div></aside>'+
 '<div class="main-shell"><header class="topbar"><div class="breadcrumbs">'+
 '<button class="mobile-toggle" id="toggle-menu" aria-label="فتح القائمة">'+ic('menu')+'</button>'+
 '<span class="crumb-dot"></span><span>مساحة العمل</span>'+ic('chevron',15)+'<strong>'+current+'</strong></div>'+
 '<div class="top-actions"><label class="range-pick" for="range-control">الفترة <select id="range-control"><option value="30" '+(state.range==='30'?'selected':'')+'>آخر 30 يومًا</option><option value="90" '+(state.range==='90'?'selected':'')+'>آخر 90 يومًا</option><option value="month" '+(state.range==='month'?'selected':'')+'>الشهر الحالي</option><option value="all" '+(state.range==='all'?'selected':'')+'>الكل</option></select></label>'+source+'<span class="today-badge">'+ic('calendar',16)+' '+escapeHTML(fullDate(todayIso()))+'</span>'+
 '<button class="round-btn" id="export-report" title="تصدير ملخص مالي" aria-label="تصدير ملخص مالي">'+ic('download',18)+'</button></div></header>'+
 '<main id="workspace" class="page-body">'+
 (state.demo?'<div class="demo-banner" role="status">'+ic('info',19)+' <div><b>هذه بيانات للعرض فقط</b><span>كل الأرقام افتراضية. عند إضافة أول حركة حقيقية نبدأ سجلًا نظيفًا.</span></div><button id="start-fresh">بدء سجل حقيقي</button></div>':'')+
 content+'</main></div></div>'+
 '<nav class="mobile-tabs" aria-label="التنقل السريع">'+VIEWS.slice(0,5).map(v=>'<button data-v="'+v[0]+'" class="'+(state.view===v[0]?'active':'')+'">'+ic(v[2],19)+'<span>'+v[1]+'</span></button>').join('')+'</nav>'+
 (state.modal?renderModal():'');
}
function header(title,subtitle,buttons=''){
 return '<div class="page-heading"><div><div class="eyebrow">نَبض / مركز القرار المالي</div><h1>'+title+'</h1><p>'+subtitle+'</p></div><div class="heading-actions">'+buttons+'</div></div>';
}
function btn(label,action,icon='plus',kind='primary'){
 return '<button class="btn btn-'+kind+'" id="'+action+'">'+ic(icon,18)+label+'</button>';
}
function metric(label,value,iconName,kind,foot){
 return '<article class="metric-card '+(kind||'')+'"><div class="metric-top"><span>'+label+'</span><div class="mini-icon">'+ic(iconName,20)+'</div></div>'+
 '<strong class="metric-value" dir="ltr">'+money(value)+'</strong><div class="metric-bottom">'+foot+'</div></article>';
}
function trendChart(){
 const months=groupedMonths(),max=Math.max(1,...months.flatMap(m=>[m.income,m.expenses]));
 return '<section class="panel chart-panel"><div class="panel-head"><div><h2>الحركة المالية</h2><p>الوارد والصادر المكتمل خلال آخر ستة أشهر</p></div>'+
 '<div class="chart-legend"><span><i class="dot purple"></i> الوارد</span><span><i class="dot peach"></i> الصادر</span></div></div>'+
 '<div class="chart-grid"><div class="chart-guides" aria-hidden="true"><span></span><span></span><span></span><span></span></div>'+
 '<div class="months">'+months.map(m=>'<div class="month-col" title="'+escapeHTML(m.key+' — وارد: '+money(m.income)+'، صادر: '+money(m.expenses))+'">'+
 '<div class="bar-group"><i class="bar revenue" style="height:'+Math.max(1,m.income/max*100).toFixed(1)+'%"></i>'+
 '<i class="bar expense" style="height:'+Math.max(1,m.expenses/max*100).toFixed(1)+'%"></i></div><span>'+escapeHTML(m.label)+'</span></div>').join('')+'</div></div></section>';
}
function zeroGraph(forecast){
 const values=forecast.map(p=>p.balance),max=Math.max(1,...values.map(x=>Math.abs(x)));
 return '<div class="forecast-bars" role="img" aria-label="الرصيد المتوقع يوميًا خلال أربعة عشر يومًا، الأحمر يعني قيمة سالبة">'+
 forecast.map((p,i)=>'<div class="forecast-slot" title="'+escapeHTML(p.date+' : '+money(p.balance))+'"><div class="forecast-positive">'+
 (p.balance>=0?'<i style="height:'+Math.max(2,p.balance/max*100)+'%"></i>':'')+'</div><div class="forecast-negative">'+
 (p.balance<0?'<i style="height:'+Math.max(2,-p.balance/max*100)+'%"></i>':'')+'</div><small>'+(i%3===0?p.date.slice(5):'')+'</small></div>').join('')+'</div>';
}
function transactionRows(rows,limit=5){
 if(!rows.length)return '<div class="empty-state">'+ic('file',28)+'<b>لا توجد حركات مطابقة</b><span>غيّري البحث أو أضيفي حركة جديدة</span></div>';
 return '<div class="transaction-list">'+rows.slice(0,limit).map(t=>'<div class="transaction-row">'+
 '<span class="transaction-symbol '+(t.type==='income'?'incoming':'outgoing')+'">'+ic(t.type==='income'?'arrow-down':'arrow-up',19)+'</span>'+
 '<div class="transaction-main"><strong>'+escapeHTML(t.description)+'</strong><span>'+escapeHTML(t.category)+' · '+escapeHTML(fullDate(t.date))+'</span></div>'+
 '<span class="status-chip '+t.status+'">'+(t.status==='completed'?'مكتملة':'مجدولة')+'</span>'+
 '<strong class="transaction-amount '+t.type+'" dir="ltr">'+(t.type==='income'?'+':'−')+money(t.amount)+'</strong>'+
 '<div class="row-actions"><button title="تعديل" aria-label="تعديل '+escapeHTML(t.description)+'" data-edit="'+escapeHTML(t.id)+'">'+ic('edit',17)+'</button><button title="حذف" aria-label="حذف '+escapeHTML(t.description)+'" data-delete="'+escapeHTML(t.id)+'">'+ic('trash',17)+'</button></div></div>').join('')+'</div>';
}
function overview(r){
 const total=summary(),last=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const next=r.risks.filter(x=>x.severity==='high');
 const status=next.length?'يوجد ما يحتاج مراجعتك':'لم يُرصد عجز عاجل';
 const riskText=next.length?'تابع الالتزامات والتواريخ التي اكتشفها نبض':'هذا تقدير مستند إلى الحركات التي أدخلتها، وليس رصيدًا بنكيًا مؤكّدًا';
 return header('صباح الخير، هذه صورة أموالك','كل قرار جيد يبدأ بمعلومة واضحة عن التدفقات والالتزامات',
    btn('حركة جديدة','new-transaction','plus')+btn('استيراد ملف','show-import','download','secondary'))+
 '<section class="spotlight"><div class="spotlight-copy"><span class="spotlight-tag">'+ic('sparkles',16)+' قراءة مالية مباشرة</span>'+
 '<h2>'+status+'</h2><p>'+riskText+'</p><button class="spotlight-link" data-v="agents">افتح قراءة المخاطر '+ic('chevron',17)+'</button></div>'+
 '<div class="spotlight-side"><span>أقل رصيد متوقع خلال 14 يومًا</span><strong dir="ltr">'+money(Math.min(...r.forecast.map(x=>x.balance)))+'</strong>'+
 '<small>سيناريو مبني على المواعيد المسجلة</small><span class="spotlight-orb"></span></div></section>'+
 '<section class="metrics-grid">'+metric('الصافي المسجّل',r.currentBalance,'wallet','violet','يشمل رصيدًا افتتاحيًا مقداره '+money(state.openingBalance))+
 metric('الوارد خلال الفترة',total.income,'arrow-down','',state.range==='month'?'منذ بداية الشهر':'حركات مكتملة')+
 metric('الصادر خلال الفترة',total.expenses,'arrow-up','',state.range==='month'?'منذ بداية الشهر':'حركات مكتملة')+
 metric('صافي الفترة',total.income-total.expenses,'trend','', 'الوارد ناقص الصادر فقط')+'</section>'+
 '<div class="content-grid"><div class="content-primary">'+trendChart()+
 '<section class="panel"><div class="panel-head"><div><h2>آخر الحركات</h2><p>سجل قابل للتعديل، وليس مجرد قائمة عرض</p></div><button class="inline-link" data-v="transactions">عرض الكل '+ic('chevron',16)+'</button></div>'+
 transactionRows(last,5)+'</section></div>'+
 '<div class="content-secondary">'+riskPanel(r)+categoryPanel()+'</div></div>';
}
function riskPanel(r){
 const high=r.risks.filter(v=>v.severity==='high');
 return '<section class="panel risk-panel"><div class="panel-head"><div><h2>تنبيهات نبض</h2><p>ملاحظات قابلة للتفسير</p></div><span class="count-badge">'+r.risks.length+'</span></div>'+
 (r.risks.length?r.risks.slice(0,3).map(x=>'<article class="insight-item">'+
 '<span class="insight-icon '+(x.severity==='high'?'hot':'')+'">'+ic(x.severity==='high'?'alert':'info',18)+'</span>'+
 '<div><strong>'+escapeHTML(x.title)+'</strong><p>'+escapeHTML(x.detail)+'</p></div></article>').join('')
 :'<div class="quiet-state">'+ic('check',24)+' لا توجد إشارات مخاطر بارزة ضمن البيانات الحالية.</div>')+
 '<button class="text-link" data-v="agents">جميع التنبيهات '+ic('chevron',17)+'</button></section>';
}
function categoryPanel(){
 const parts=categoryExpenses(),sum=parts.reduce((s,p)=>s+p.amount,0);
 const colors=['#7753DC','#B9A5F1','#EDB2AC','#FFCDA4','#8CBDB0','#D6D6EA'];
 const conic=parts.length?parts.reduce((acc,p,i)=>{const from=acc.end;const end=from+p.amount/sum*100;acc.list.push(colors[i%colors.length]+' '+from.toFixed(1)+'% '+end.toFixed(1)+'%');acc.end=end;return acc;},{end:0,list:[]}).list.join(','):'#edeaf5 0% 100%';
 return '<section class="panel category-panel"><div class="panel-head"><div><h2>أين تذهب المصروفات؟</h2><p>للفترة المحددة في لوحة التحكم</p></div></div>'+
 '<div class="donut-wrap"><div class="donut" style="background:conic-gradient('+conic+')"><div class="donut-hole"><span>المصروفات</span><strong>'+money(sum)+'</strong></div></div></div>'+
 (parts.length?parts.slice(0,4).map((p,i)=>'<div class="category-row"><span><i style="background:'+colors[i%colors.length]+'"></i>'+escapeHTML(p.category)+'</span><b>'+Math.round(p.amount/sum*100)+'%</b></div>').join(''):
 '<p class="muted">لا توجد مصروفات مكتملة في الفترة.</p>')+'</section>';
}
function filteredTransactions(){
 const query=state.search.trim().toLocaleLowerCase('ar');
 return state.transactions.filter(t=>(state.type==='all'||t.type===state.type)&&
  (state.status==='all'||t.status===state.status)&&
  (!query||[t.description,t.category,t.channel,String(t.amount)].some(x=>String(x).toLocaleLowerCase('ar').includes(query))))
 .sort((a,b)=>b.date.localeCompare(a.date));
}
function transactionsView(){
 const all=filteredTransactions(),pageSize=20,last=Math.ceil(all.length/pageSize),page=Math.max(1,Math.min(state.page,last||1));
 state.page=page;
 const rows=all.slice((page-1)*pageSize,page*pageSize);
 return header('كل حركة لها قصة','أضف حركاتك، صحّح التفاصيل، وتابع التدفق المالي من مصدر واحد',
 btn('إضافة حركة','new-transaction','plus')+btn('استيراد CSV','show-import','download','secondary'))+
 '<section class="panel list-panel"><div class="tool-row"><label class="search-box">'+ic('search',19)+
 '<input id="search-transaction" placeholder="ابحث بالوصف أو التصنيف أو المبلغ" value="'+escapeHTML(state.search)+'" aria-label="البحث في الحركات"></label>'+
 '<label class="compact-select"><span>النوع</span><select id="filter-type"><option value="all">الكل</option><option value="income" '+(state.type==='income'?'selected':'')+'>وارد</option><option value="expense" '+(state.type==='expense'?'selected':'')+'>صادر</option></select></label>'+
 '<label class="compact-select"><span>الحالة</span><select id="filter-status"><option value="all">الكل</option><option value="completed" '+(state.status==='completed'?'selected':'')+'>مكتملة</option><option value="scheduled" '+(state.status==='scheduled'?'selected':'')+'>مجدولة</option></select></label>'+
 '<button class="btn btn-soft" id="export-csv">'+ic('download',17)+' تصدير الظاهر</button></div>'+
 '<div class="list-caption"><span>'+all.length+' حركة مطابقة</span><span>يُعرض الأحدث أولاً</span></div>'+transactionRows(rows,20)+
 '<div class="pager"><button id="page-prev" '+(page<=1?'disabled':'')+'>السابق</button><span>صفحة '+page+' من '+Math.max(1,last)+'</span><button id="page-next" '+(page>=last?'disabled':'')+'>التالي</button></div></section>';
}
function analyticsView(r){
 const totals=summary(),cats=categoryExpenses(),sum=cats.reduce((a,c)=>a+c.amount,0);
 return header('من الأرقام إلى الفهم','التحليل هنا مشتق من سجلك الحقيقي، ولا يعتمد على نسب تجريبية',
 btn('عرض الحركات','go-transactions','arrow-left-right','secondary'))+
 '<section class="metrics-grid analytics-metrics">'+metric('حركات الفترة المكتملة',totals.count,'layers','violet','عدد العمليات الموثقة داخل السجل')+
 metric('إجمالي الوارد',totals.income,'arrow-down','','الفترة الحالية')+
 metric('إجمالي الصادر',totals.expenses,'arrow-up','','الفترة الحالية')+
 metric('الفرق النقدي',totals.income-totals.expenses,'trend','','لا يمثل ربحًا محاسبيًا')+'</section>'+
 '<div class="content-grid"><div class="content-primary">'+trendChart()+
 '<section class="panel"><div class="panel-head"><div><h2>تفصيل المصروفات حسب التصنيف</h2><p>الأعلى إنفاقًا أولاً</p></div></div>'+
 (cats.length?cats.map((p,i)=>'<div class="breakdown-item"><div><strong>'+escapeHTML(p.category)+'</strong><span>'+money(p.amount)+'</span></div>'+
 '<div class="progress-track"><i style="width:'+((p.amount/sum)*100).toFixed(2)+'%;background:'+['#7753DC','#B9A5F1','#EDB2AC','#84BAAD'][i%4]+'"></i></div></div>').join(''):
 '<div class="empty-state">لا توجد مصروفات مكتملة لتحليلها في هذه الفترة.</div>')+'</section></div>'+
 '<div class="content-secondary">'+categoryPanel()+
 '<section class="panel data-panel">'+ic('info',22)+'<h3>كيف نقرأ هذه الأرقام؟</h3><p>الفرق بين الوارد والصادر هو فرق التدفقات المسجلة فقط، وليس صافي الربح. قد تكون هناك ديون، مخزون، ضرائب أو التزامات غير مدخلة.</p></section></div></div>';
}
function scenariosView(r){
 const s=state.scenario,after=runScenario(state.transactions,s,{openingBalance:state.openingBalance});
 const beforeMinimum=Math.min(...r.forecast.map(p=>p.balance)),afterMinimum=Math.min(...after.forecast.map(p=>p.balance));
 const slider=(key,label,min,max,step,unit)=>'<label class="scenario-control"><div><strong>'+label+'</strong><span>'+ (unit==='%'?s[key]+'%':unit==='day'?s[key]+' يوم':money(s[key]))+'</span></div>'+
 '<input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+s[key]+'" data-scenario="'+key+'" aria-label="'+label+'"></label>';
 return header('جرّب القرار قبل اتخاذه','مختبر ماذا لو يغيّر افتراضات حسابية فقط؛ لا يحوّل أو يسحب أموالاً',
 btn('إعادة الافتراضات','reset-scenario','sliders','secondary'))+
 '<div class="scenario-layout"><section class="panel scenario-input"><div class="panel-head"><div><h2>افتراضات السيناريو</h2><p>حرّك المؤشرات وشاهد النتيجة المحسوبة</p></div></div>'+
 slider('extraCollection','تحصيل إضافي مفترض',0,2000000,50000,'money')+
 slider('reduceExpensesPct','خفض المصروفات المجدولة',0,40,5,'%')+
 slider('delayLargeExpenseDays','تأجيل أكبر دفعة',0,14,1,'day')+
 '<div class="scenario-disclaimer">'+ic('info',19)+' التأجيل يتطلب اتفاقًا فعليًا مع الدائن، والتحصيل ليس مضمونًا.</div></section>'+
 '<div class="scenario-results"><div class="scenario-compare"><article><span>أقل رصيد قبل</span><strong dir="ltr">'+money(beforeMinimum)+'</strong></article><article class="after"><span>أقل رصيد بعد</span><strong dir="ltr">'+money(afterMinimum)+'</strong></article></div>'+
 '<section class="panel"><div class="panel-head"><div><h2>مسار السيولة بعد التعديل</h2><p>أربعة عشر يومًا، باستعمال المواعيد المسجلة</p></div></div>'+zeroGraph(after.forecast)+
 '<p class="forecast-caption">'+escapeHTML(after.explanation)+'</p></section></div></div>';
}
function agentsView(r){
 const names=['المدخلات','التدفق النقدي','المخاطر','فهم السبب','الإجراءات','التفسير'];
 return header('قرارات قابلة للتفسير','ست مراحل تحليل حسابية تعمل محليًا، دون ادعاء أنها نماذج ذكاء اصطناعي مستقلة',
 btn('مختبر السيناريو','go-scenarios','sliders','secondary'))+
 '<section class="decision-intro"><span>'+ic('shield',24)+'</span><div><h2>نعرض سبب كل تنبيه، وليس مجرد تقييم غامض</h2><p>النتائج تعتمد على التاريخ والمبلغ والحالة التي أدخلتها. راجع الرصيد الافتتاحي والحركات المتأخرة قبل اتخاذ قرار مالي.</p></div></section>'+
 '<div class="agent-grid">'+r.agentResults.map((a,i)=>'<article class="panel agent-card"><div class="agent-number">'+String(i+1).padStart(2,'0')+'</div>'+
 '<h3>'+names[i]+'</h3><p>'+escapeHTML(a.summary)+'</p><span class="agent-label '+(a.status==='warning'?'warning':'')+'">'+(a.status==='warning'?'تنبيه':'مكتمل')+'</span></article>').join('')+'</div>'+
 '<section class="panel"><div class="panel-head"><div><h2>التنبيهات التي تحتاج إجراء</h2><p>مرتبة بحسب طبيعتها ومرتبطة بالحركات المسجلة</p></div></div>'+
 (r.risks.length?r.risks.map(a=>'<div class="insight-item">'+ic(a.severity==='high'?'alert':'info',20)+'<div><strong>'+escapeHTML(a.title)+'</strong><p>'+escapeHTML(a.detail)+'</p></div></div>').join(''):
 '<div class="quiet-state">لا توجد إشارات خطر بارزة. عدم وجود تنبيه لا يثبت صحة البيانات.</div>')+
 '<h3 class="next-steps">الإجراءات المقترحة</h3>'+r.actions.map((a,i)=>'<div class="action-line"><b>'+String(i+1).padStart(2,'0')+'</b>'+
 '<div><strong>'+escapeHTML(a.title)+'</strong><p>'+escapeHTML(a.detail)+'</p><small>'+(a.impact==null?'الأثر المالي غير محسوب':'هدف حسابي افتراضي '+money(a.impact))+'</small></div></div>').join('')+'</section>';
}
function settingsView(){
 return header('الإعدادات والخصوصية','إدارة بياناتك والافتراضات التي تعتمد عليها الحسابات')+
 '<div class="settings-grid"><section class="panel"><div class="panel-head"><div><h2>أساس الحساب</h2><p>حتى لا نخلط صافي الحركات بالرصيد الحقيقي</p></div></div>'+
 '<form id="balance-form"><label class="form-field"><span>الرصيد الافتتاحي بالدينار العراقي</span><input id="opening-balance" type="number" min="-1000000000000" max="1000000000000" step="1" required value="'+state.openingBalance+'"></label>'+
 '<p class="field-hint">ضع الرصيد الموجود قبل أول حركة في السجل. لا نعتبر الصافي رصيدًا بنكيًا مؤكدًا إلا بعد المصالحة.</p><button class="btn btn-primary" type="submit">'+ic('check',18)+' حفظ الرصيد</button></form></section>'+
 '<section class="panel"><div class="panel-head"><div><h2>نسخ احتياطية وملفات</h2><p>لا تعتمد على تخزين المتصفح وحده</p></div></div>'+
 '<div class="setting-actions"><button class="setting-button" id="backup">'+ic('download',21)+'<span><b>تصدير نسخة احتياطية</b><small>ملف JSON يحتفظ بالحركات والرصيد الافتتاحي</small></span></button>'+
 '<label class="setting-button file-label">'+ic('file',21)+'<span><b>استعادة نسخة</b><small>استبدال السجل بعد التأكيد</small></span><input id="restore" type="file" accept=".json,application/json" aria-label="اختيار النسخة الاحتياطية"></label>'+
 '<button class="setting-button" id="export-csv">'+ic('download',21)+'<span><b>تصدير الحركات CSV</b><small>بياناتك بصيغة جدول</small></span></button></div></section>'+
 '<section class="panel"><div class="panel-head"><div><h2>البيانات المحلية</h2><p>إجراءات تستوجب التأكيد</p></div></div>'+
 '<div class="setting-actions"><button class="setting-button" id="demo-reset">'+ic('layers',20)+'<span><b>العودة إلى بيانات العرض</b><small>استبدال السجل ببيانات افتراضية</small></span></button>'+
 '<button class="setting-button danger" id="clear-ledger">'+ic('trash',20)+'<span><b>مسح جميع الحركات</b><small>لا يمكن التراجع دون نسخة احتياطية</small></span></button></div></section>'+
 '<section class="panel privacy-card">'+ic('shield',29)+'<h2>البيانات على جهازك</h2><p>النسخة الحالية لا تحتوي حسابات حقيقية أو مزامنة أو تشفير سجلات المستخدمين. لا تستخدم جهازًا مشتركًا لحفظ بيانات تجارية حساسة، واحتفظ بالنسخة الاحتياطية في مكان آمن.</p>'+
 '<a href="./privacy.html">سياسة الخصوصية</a> · <a href="./terms.html">شروط الاستخدام</a></section></div>';
}
function formFields(edit){
 const today=todayIso(),t=edit||{date:today,amount:'',type:'income',status:'completed',channel:'cash',category:'مبيعات',description:''};
 return '<form id="transaction-form"><div class="form-grid"><label class="form-field"><span>نوع الحركة</span><select name="type"><option value="income" '+(t.type==='income'?'selected':'')+'>وارد</option><option value="expense" '+(t.type==='expense'?'selected':'')+'>صادر</option></select></label>'+
 '<label class="form-field"><span>حالة الحركة</span><select name="status"><option value="completed" '+(t.status==='completed'?'selected':'')+'>مكتملة</option><option value="scheduled" '+(t.status==='scheduled'?'selected':'')+'>مجدولة</option></select></label>'+
 '<label class="form-field"><span>المبلغ بالدينار</span><input name="amount" inputmode="numeric" type="number" min="1" max="10000000000" step="1" required value="'+escapeHTML(t.amount)+'"></label>'+
 '<label class="form-field"><span>التاريخ</span><input name="date" type="date" required value="'+escapeHTML(t.date)+'"></label>'+
 '<label class="form-field"><span>التصنيف</span><input name="category" maxlength="120" required value="'+escapeHTML(t.category)+'"></label>'+
 '<label class="form-field"><span>وسيلة الدفع</span><select name="channel">'+[['cash','نقدي'],['zaincash','زين كاش'],['bank','مصرف'],['other','أخرى']].map(x=>'<option value="'+x[0]+'" '+(t.channel===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
 '<label class="form-field field-full"><span>الوصف</span><textarea name="description" maxlength="500" required rows="3" placeholder="سبب الحركة أو اسم الجهة">'+escapeHTML(t.description)+'</textarea></label></div>'+
 '<p class="form-note" id="form-error" role="alert"></p>'+
 '<div class="modal-actions"><button class="btn btn-secondary" type="button" id="cancel-modal">إلغاء</button><button class="btn btn-primary" type="submit">'+ic('check',17)+' حفظ الحركة</button></div></form>';
}
function renderModal(){
 if(state.modal==='import')return '<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><div><span class="eyebrow">رفع ملف محلي</span><h2 id="dialog-title">استيراد حركات CSV</h2></div><button class="close-modal" aria-label="إغلاق">'+ic('close')+'</button></div>'+
 '<p>يُفحص الملف بالكامل قبل حفظ أي حركة. الأعمدة: date,amount,type,category,description,channel,status.</p>'+
 '<label class="upload-zone">'+ic('file',28)+'<strong>اختر ملف CSV من جهازك</strong><span>لا يُرفع إلى خادم نبض</span><input id="csv" type="file" accept=".csv,text/csv" aria-label="استيراد حركات CSV"></label>'+
 '<div class="modal-actions"><button id="get-template" class="btn btn-secondary">تحميل قالب</button><button id="cancel-modal" class="btn btn-secondary">إغلاق</button></div></section></div>';
 return '<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><div><span class="eyebrow">سجل نبض</span>'+
 '<h2 id="dialog-title">'+(state.editId?'تعديل حركة':'إضافة حركة جديدة')+'</h2></div><button class="close-modal" aria-label="إغلاق">'+ic('close')+'</button></div>'+
 '<p>كل مبلغ يتم تسجيله يؤثر على التحليل مباشرة بعد الحفظ.</p>'+formFields(state.transactions.find(t=>t.id===state.editId))+'</section></div>';
}
function safeCsvCell(v){
 let text=String(v??'');
 if(/^[\s]*[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
function exportCsv(rows){
 const keys=['date','amount','type','category','description','channel','status'];
 const csv='\uFEFF'+keys.join(',')+'\n'+rows.map(row=>keys.map(k=>safeCsvCell(row[k])).join(',')).join('\n');
 download('nabd-transactions.csv',csv,'text/csv;charset=utf-8');
}
function render(){
 if(state.error){
  ROOT.innerHTML='<main class="recovery"><div class="panel"><h1>توقفنا لحماية سجلّك</h1><p>'+escapeHTML(state.error)+'</p><button id="raw-save" class="btn btn-secondary">تنزيل السجل الخام</button><button id="reset-storage" class="btn btn-danger">بدء سجل جديد بعد التأكيد</button></div></main>';
  bindRecovery();return;
 }
 const r=report();
 const content=state.view==='overview'?overview(r):state.view==='transactions'?transactionsView():
 state.view==='analytics'?analyticsView(r):state.view==='scenarios'?scenariosView(r):state.view==='agents'?agentsView(r):settingsView();
 ROOT.innerHTML=baseLayout(content,r);
 document.title='نَبض — '+(VIEWS.find(x=>x[0]===state.view)?.[1]||'لوحة التحكم');
 bind();
}
function bindRecovery(){
 document.querySelector('#raw-save')?.addEventListener('click',()=>download('nabd-unreadable-ledger.txt',localStorage.getItem(TX_KEY)||'','text/plain'));
 document.querySelector('#reset-storage')?.addEventListener('click',()=>{
  if(confirm('ستُستبدل البيانات القديمة. هل نزّلت النسخة الخام؟')&&save([],false)){state.error=null;render();}
 });
}
function refresh(){render();}
function openModal(mode,id=null){state.modal=mode;state.editId=id;render();setTimeout(()=>document.querySelector('.dialog input:not([type=file])')?.focus(),0);}
function bind(){
 document.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.v;state.mobileMenu=false;state.modal=null;state.page=1;render();window.scrollTo?.(0,0)}));
 document.querySelector('#toggle-menu')?.addEventListener('click',()=>{state.mobileMenu=!state.mobileMenu;render();});
 document.querySelector('#range-control')?.addEventListener('change',e=>{state.range=e.target.value;render();});
 document.querySelector('#new-transaction')?.addEventListener('click',()=>openModal('edit'));
 document.querySelector('#show-import')?.addEventListener('click',()=>openModal('import'));
 document.querySelector('#go-transactions')?.addEventListener('click',()=>{state.view='transactions';render()});
 document.querySelector('#go-scenarios')?.addEventListener('click',()=>{state.view='scenarios';render()});
 document.querySelector('#export-report')?.addEventListener('click',()=>download('nabd-analysis.json',JSON.stringify(report(),null,2)));
 document.querySelector('#start-fresh')?.addEventListener('click',()=>{if(confirm('ابدأ سجلًا جديدًا دون بيانات العرض؟')){if(save([],false))render();}});
 document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openModal('edit',b.dataset.edit)));
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{
  const item=state.transactions.find(x=>x.id===b.dataset.delete);
  if(item&&confirm('حذف الحركة «'+item.description+'» نهائيًا؟')){
   const next=state.transactions.filter(x=>x.id!==item.id);
   if(save(next,false)){notify('حُذفت الحركة');render();}
  }
 }));
 const form=document.querySelector('#transaction-form');
 form?.addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(form),previous=state.transactions.find(t=>t.id===state.editId);
  try{
   const item=validateTransaction(Object.fromEntries(data),1);
   item.id=previous?.id||'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
   const base=state.demo?[]:state.transactions;
   const next=previous?base.map(x=>x.id===item.id?item:x):base.concat(item);
   if(save(next,false)){state.modal=null;state.editId=null;render();notify('حُفظت الحركة بنجاح');}
  }catch(err){const error=document.querySelector('#form-error');if(error)error.textContent=err.message;}
 });
 const close=()=>{state.modal=null;state.editId=null;render();};
 document.querySelector('.close-modal')?.addEventListener('click',close);
 document.querySelector('#cancel-modal')?.addEventListener('click',close);
 document.querySelector('#get-template')?.addEventListener('click',()=>{
  download('nabd-template.csv','date,amount,type,category,description,channel,status\n'+todayIso()+',125000,income,مبيعات,مبيعات اليوم,cash,completed','text/csv;charset=utf-8');
 });
 const csv=document.querySelector('#csv');
 csv?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>8_000_000)throw new Error('الملف أكبر من الحد المسموح');
   const items=parseCsvTransactions(await file.text(),'csv-'+Date.now());
   const current=state.demo?[]:state.transactions;
   const result=combineWithoutDuplicates(current,items);
   if(result.skipped && !confirm('وجدنا '+result.skipped+' حركة مطابقة تمامًا لما في السجل أو مكررة داخل الملف. هل تريد تجاهل المطابقات وإضافة باقي الحركات فقط؟'))return;
   if(save(result.transactions,false)){state.modal=null;state.view='transactions';render();notify('أضفنا '+result.added+' حركة، وتجاهلنا '+result.skipped+' مكرر.');}
  }catch(err){notify('تعذّر الاستيراد؛ لم نغيّر بياناتك: '+err.message);}
 });
 document.querySelector('#search-transaction')?.addEventListener('input',e=>{
  const start=e.target.selectionStart;state.search=e.target.value;state.page=1;render();
  const input=document.querySelector('#search-transaction');input?.focus();try{input?.setSelectionRange(start,start)}catch{}
 });
 document.querySelector('#filter-type')?.addEventListener('change',e=>{state.type=e.target.value;state.page=1;render()});
 document.querySelector('#filter-status')?.addEventListener('change',e=>{state.status=e.target.value;state.page=1;render()});
 document.querySelector('#page-prev')?.addEventListener('click',()=>{state.page--;render()});
 document.querySelector('#page-next')?.addEventListener('click',()=>{state.page++;render()});
 document.querySelector('#export-csv')?.addEventListener('click',()=>exportCsv(state.view==='transactions'?filteredTransactions():state.transactions));
 document.querySelectorAll('[data-scenario]').forEach(input=>input.addEventListener('change',e=>{state.scenario[e.target.dataset.scenario]=Number(e.target.value);render()}));
 document.querySelector('#reset-scenario')?.addEventListener('click',()=>{state.scenario={extraCollection:0,reduceExpensesPct:0,delayLargeExpenseDays:0};render()});
 document.querySelector('#balance-form')?.addEventListener('submit',e=>{
  e.preventDefault();const n=number(Number(document.querySelector('#opening-balance').value));
  if(n===null){notify('أدخل عددًا صحيحًا ضمن الحدود المسموحة');return;}
  try{localStorage.setItem(BAL_KEY,String(n));state.openingBalance=n;render();notify('تم حفظ الرصيد الافتتاحي');}
  catch{notify('تعذّر حفظ الرصيد الافتتاحي');}
 });
 document.querySelector('#backup')?.addEventListener('click',()=>download('nabd-backup.json',JSON.stringify({version:2,transactions:state.transactions,openingBalance:state.openingBalance},null,2)));
 document.querySelector('#restore')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>2_000_000)throw new Error('ملف كبير جدًا');
   const raw=JSON.parse(await file.text());
   const rows=validateStoredTransactions(Array.isArray(raw)?raw:raw.transactions);
   const opening=number(Number(Array.isArray(raw)?0:raw.openingBalance??0));
   if(opening===null)throw new Error('الرصيد الافتتاحي غير صالح');
   if(!confirm('ستُستبدل كل الحركات الحالية. هل حفظت نسخة احتياطية؟'))return;
   const oldOpening=localStorage.getItem(BAL_KEY);
   try{localStorage.setItem(BAL_KEY,String(opening));}
   catch{throw new Error('تعذّر حفظ الرصيد الافتتاحي؛ لم نستبدل الحركات');}
   if(!save(rows,false)){
    try{if(oldOpening===null)localStorage.removeItem(BAL_KEY);else localStorage.setItem(BAL_KEY,oldOpening);}catch{}
    return;
   }
   state.openingBalance=opening;render();notify('تمت استعادة النسخة الاحتياطية');
  }catch(err){notify('لم نستعد الملف: '+err.message);}
 });
 document.querySelector('#demo-reset')?.addEventListener('click',()=>{if(confirm('استبدال كل السجل ببيانات العرض؟')&&save(createDemoTransactions(),true))render()});
 document.querySelector('#clear-ledger')?.addEventListener('click',()=>{if(confirm('مسح جميع الحركات؟ لا يمكن التراجع دون نسخة احتياطية.')&&save([],false))render()});
}
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
