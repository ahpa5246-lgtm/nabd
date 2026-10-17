const dayMs = 86400000
export const todayIso = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const money = value => new Intl.NumberFormat('ar-IQ',{style:'currency',currency:'IQD',maximumFractionDigits:0}).format(Math.round(value))
export const compactMoney = value => {
  const a=Math.abs(value), s=value<0?'-':''
  if(a>=1e9)return `${s}${(a/1e9).toFixed(1)} مليار د.ع`
  if(a>=1e6)return `${s}${(a/1e6).toFixed(1)} مليون د.ع`
  if(a>=1e3)return `${s}${(a/1e3).toFixed(0)} ألف د.ع`
  return `${Math.round(value).toLocaleString('ar-IQ')} د.ع`
}
export const fullDate = iso => new Intl.DateTimeFormat('ar-IQ',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${iso}T12:00:00`))
export const shortDate = iso => new Intl.DateTimeFormat('ar-IQ',{month:'short',day:'numeric'}).format(new Date(`${iso}T12:00:00`))

function completedBalance(items, today){return items.filter(t=>t.status==='completed'&&t.date<=today).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0)}
function recentTotals(items,today,days=30){const cutoff=addDays(today,-days+1);return items.filter(t=>t.status==='completed'&&t.date>=cutoff&&t.date<=today).reduce((a,t)=>{a[t.type==='income'?'inflow':'outflow']+=t.amount;return a},{inflow:0,outflow:0})}
function forecast(items,today,days=14,openingBalance=0){
  let balance=openingBalance+completedBalance(items,today);
  const scheduled=items.filter(t=>t.status==='scheduled'),out=[];
  for(let i=0;i<=days;i++){
    const date=addDays(today,i);
    // Conservative assumption: overdue outgoing obligations fall due immediately.
    // Overdue incoming receivables are NOT counted as money already collected.
    const list=scheduled.filter(t=>t.date===date || (i===0&&t.date<today&&t.type==='expense'));
    const inflow=list.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0);
    const outflow=list.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0);
    balance+=inflow-outflow;out.push({date,balance,inflow,outflow});
  }
  return out;
}
function detectRisks(items,points,currentBalance,today){const risks=[],negative=points.find(p=>p.balance<0);
const overdueOut=items.filter(t=>t.status==='scheduled'&&t.date<today&&t.type==='expense');
const overdueIn=items.filter(t=>t.status==='scheduled'&&t.date<today&&t.type==='income');
if(overdueOut.length)risks.push({id:'overdue-payment',severity:'high',title:'دفعات متأخرة غير مسددة',amount:overdueOut.reduce((sum,t)=>sum+t.amount,0),detail:'أُدخلت الالتزامات المتأخرة في اليوم الأول من التوقع احتياطيًا. راجع إن كانت لا تزال مستحقة.'});
if(overdueIn.length)risks.push({id:'overdue-receivable',severity:'medium',title:'تحصيلات متأخرة وغير مؤكدة',amount:overdueIn.reduce((sum,t)=>sum+t.amount,0),detail:'لم نحتسب التحصيلات المتأخرة ضمن السيولة المتوقعة، حتى يتم تأكيد استلامها.'});if(negative)risks.push({id:'negative-balance',severity:'high',title:'عجز سيولة متوقع',date:negative.date,amount:Math.abs(negative.balance),detail:`الرصيد المتوقع ينخفض تحت الصفر في ${fullDate(negative.date)}.`,evidence:[`العجز المتوقع: ${compactMoney(Math.abs(negative.balance))}`,`الرصيد الحالي: ${compactMoney(currentBalance)}`]});const expenses=items.filter(t=>t.status==='scheduled'&&t.type==='expense'),largest=[...expenses].sort((a,b)=>b.amount-a.amount)[0];if(largest&&largest.amount>Math.max(currentBalance*.35,750000))risks.push({id:'large-payment',severity:negative?'high':'medium',title:'دفعة كبيرة قادمة',date:largest.date,amount:largest.amount,detail:`${largest.description} ستسحب جزءًا كبيرًا من السيولة المتاحة.`,evidence:[`قيمة الدفعة: ${compactMoney(largest.amount)}`,`موعدها: ${fullDate(largest.date)}`]});const zi=items.filter(t=>t.status==='completed'&&t.date<=today&&t.type==='income'&&t.channel==='zaincash').reduce((s,t)=>s+t.amount,0),inc=items.filter(t=>t.status==='completed'&&t.date<=today&&t.type==='income').reduce((s,t)=>s+t.amount,0);if(inc>0&&zi/inc>.6)risks.push({id:'channel-concentration',severity:'low',title:'اعتماد مرتفع على قناة واحدة',detail:'جزء كبير من التحصيلات يأتي من ZainCash؛ راقب أي تأخر في التسوية.',evidence:[`نسبة دخل ZainCash: ${Math.round(zi/inc*100)}%`]});return risks}
function buildActions(items,risks,points){const a=[],negative=points.find(p=>p.balance<0),incoming=items.filter(t=>t.status==='scheduled'&&t.type==='income').sort((x,y)=>y.amount-x.amount)[0],large=items.filter(t=>t.status==='scheduled'&&t.type==='expense').sort((x,y)=>y.amount-x.amount)[0];if(negative){const gap=Math.ceil(Math.abs(negative.balance)*1.15/50000)*50000;a.push({id:'collect-gap',title:`حصّل ${compactMoney(gap)} قبل ${fullDate(negative.date)}`,detail:'هذا يضيف هامش أمان فوق العجز المتوقع بدل تغطيته بالحد الأدنى فقط.',impact:gap,urgency:'today'})}if(large)a.push({id:'negotiate-supplier',title:'فاوِض على تقسيم أكبر دفعة مورد',detail:`قسّم دفعة «${large.description}» إلى جزأين أو حرّك جزءًا منها عدة أيام إذا أمكن.`,impact:Math.round(large.amount*.4),urgency:'this-week'});if(incoming)a.push({id:'confirm-receivable',title:'ثبّت موعد أكبر تحصيل قادم',detail:`تأكد من تحصيل «${incoming.description}» في موعده لأن التوقع يعتمد عليه.`,impact:incoming.amount,urgency:'today'});if(!risks.some(r=>r.severity==='high'))a.push({id:'buffer',title:'كوّن احتياطي سيولة',detail:'احتفظ بجزء من التدفقات القادمة كحاجز بدل إعادة صرف كل الفائض مباشرة.',impact:250000,urgency:'monitor'});return a.slice(0,4)}
function explanation(balance,points,risks,actions){const n=points.find(p=>p.balance<0);if(n)return `نبض شايف أن عندك ${compactMoney(balance)} حاليًا، لكن حسب الحركات المجدولة الرصيد راح ينزل تحت الصفر في ${fullDate(n.date)} بحوالي ${compactMoney(Math.abs(n.balance))}. السبب مو ضعف المبيعات وحده؛ توقيت الدفعات الكبيرة أسرع من التحصيلات. أول أولوية الآن: ${actions[0]?.title||'زيادة هامش السيولة قبل موعد العجز'}.`;const min=points.reduce((a,b)=>a.balance<b.balance?a:b);const pending=risks.filter(r=>r.id==='overdue-payment'||r.id==='overdue-receivable'||r.id==='future-completed');return `${pending.length?'لا يظهر عجز حسابي حاليًا، لكن توجد حركات متأخرة أو غير متسقة تحتاج مراجعة.':'لا يظهر عجز حسابي ضمن البيانات المتاحة.'} أقل رصيد متوقع هو ${compactMoney(min.balance)} في ${fullDate(min.date)}. الأرقام تفترض صحة السجل والرصيد الافتتاحي.`}
export function runAgents(items,options={}){
  const today=options.today||todayIso(), openingBalance=options.openingBalance||0;
  const valid=items.filter(t=>Number.isSafeInteger(t.amount)&&t.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&['income','expense'].includes(t.type)&&['completed','scheduled'].includes(t.status));
  const futureCompleted=valid.filter(t=>t.status==='completed'&&t.date>today);
  const balance=openingBalance+completedBalance(valid,today),totals=recentTotals(valid,today),points=forecast(valid,today,14,openingBalance);
  const runway=totals.outflow>0?Math.max(0,Math.floor(balance/(totals.outflow/30))):null;
  const risks=detectRisks(valid,points,balance,today);
  if(futureCompleted.length)risks.unshift({id:'future-completed',severity:'high',title:'حركات مكتملة بتاريخ مستقبلي',detail:'لم تُحتسب الحركات المكتملة بتاريخ لاحق لليوم في الرصيد. يرجى تصحيح التاريخ أو الحالة.'});
  const actions=buildActions(valid,risks,points),exp=explanation(balance,points,risks,actions);
  return{generatedAt:new Date().toISOString(),currentBalance:balance,inflow30d:totals.inflow,outflow30d:totals.outflow,runwayDays:runway,forecast:points,risks,actions,explanation:exp,
  dataQuality:{invalid:items.length-valid.length,futureCompleted:futureCompleted.length,overdueExpenses:valid.filter(t=>t.status==='scheduled'&&t.type==='expense'&&t.date<today).length},
  agentResults:[{agent:'observer',label:'وكيل المراقبة',status:'success',summary:`تمت قراءة ${valid.length} حركة صالحة من ${items.length}، مع ${futureCompleted.length} حركة مكتملة بتاريخ مستقبلي.`},{agent:'cashflow',label:'وكيل السيولة',status:points.some(p=>p.balance<0)?'warning':'success',summary:`الرصيد الحالي ${compactMoney(balance)}، والتوقع ممتد 14 يومًا.`},{agent:'risk',label:'وكيل المخاطر',status:risks.some(r=>r.severity==='high')?'warning':'success',summary:risks.length?`اكتشف ${risks.length} إشارة تحتاج الانتباه.`:'لا توجد مخاطر بارزة حاليًا.'},{agent:'reasoner',label:'وكيل التحليل',status:'success',summary:risks.find(r=>r.id==='large-payment')?.detail||(risks[0]?.detail||'التدفق الحالي متوازن ضمن البيانات المتاحة.')},{agent:'planner',label:'وكيل التخطيط',status:'success',summary:`بنى ${actions.length} إجراءات عملية مرتبة حسب الأولوية.`},{agent:'explainer',label:'وكيل الشرح',status:'success',summary:'حوّل التحليل إلى توصية مفهومة بدون مصطلحات محاسبية معقدة.'}]}}
export function runScenario(items,input,options={}){const c=items.map(t=>({...t}));if(input.extraCollection>0){c.push({id:'scenario-collection',date:addDays(options.today||todayIso(),2),amount:input.extraCollection,type:'income',category:'سيناريو',description:'تحصيل إضافي',channel:'other',status:'scheduled'})}if(input.reduceExpensesPct>0)c.forEach(t=>{if(t.status==='scheduled'&&t.type==='expense')t.amount=Math.max(1,Math.round(t.amount*(1-input.reduceExpensesPct/100)))});if(input.delayLargeExpenseDays>0){const l=c.filter(t=>t.status==='scheduled'&&t.type==='expense').sort((a,b)=>b.amount-a.amount)[0];if(l){l.date=addDays(l.date,input.delayLargeExpenseDays)}}return runAgents(c,options)}
export function answerQuestion(q,report){q=q.trim().toLowerCase();if(!q)return 'اكتب سؤالك عن السيولة، العجز، المصروفات أو الإجراء الذي يجب تبدأ به.';const n=report.forecast.find(p=>p.balance<0);if(/عجز|ينفد|يخلص|سيولة/.test(q))return n?`نعم. وفق البيانات الحالية أول عجز متوقع في ${fullDate(n.date)} ويبلغ تقريبًا ${compactMoney(Math.abs(n.balance))}.`:'لا يظهر عجز خلال 14 يومًا.';if(/اسوي|أفعل|اولوية|أولوية|حل|شنو/.test(q))return report.actions[0]?`${report.actions[0].title}. ${report.actions[0].detail}`:'لا توجد خطوة طارئة الآن؛ راقب الدفعات والتحصيلات.';if(/صرف|مصاريف|مصروف/.test(q))return `إجمالي المصروفات المكتملة خلال آخر 30 يومًا هو ${compactMoney(report.outflow30d)}.`;if(/دخل|مبيعات|وارد/.test(q))return `إجمالي التدفقات الداخلة خلال آخر 30 يومًا هو ${compactMoney(report.inflow30d)}.`;if(/رصيد|عندي/.test(q))return `الرصيد المحسوب من الحركات المكتملة حاليًا هو ${compactMoney(report.currentBalance)}.`;return report.explanation}
