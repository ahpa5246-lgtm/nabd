export function iso(offset) {
  const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10)
}

export function createDemoTransactions() {
  return [
    ['d1',-29,1250000,'income','مبيعات','مبيعات أسبوعية','cash','completed'],
    ['d2',-26,760000,'expense','موردون','شراء بضاعة','cash','completed'],
    ['d3',-22,980000,'income','مبيعات','مبيعات متجر','zaincash','completed'],
    ['d4',-20,350000,'expense','إيجار','إيجار المحل','cash','completed'],
    ['d5',-17,1430000,'income','مبيعات','دفعة مبيعات','zaincash','completed'],
    ['d6',-13,920000,'expense','موردون','تسديد مورد','bank','completed'],
    ['d7',-10,1100000,'income','مبيعات','مبيعات نقدية وإلكترونية','cash','completed'],
    ['d8',-7,280000,'expense','تشغيل','كهرباء ونقل وإنترنت','cash','completed'],
    ['d9',-4,1180000,'income','مبيعات','مبيعات نهاية الأسبوع','zaincash','completed'],
    ['d10',-2,410000,'expense','رواتب','أجور مساعدة','cash','completed'],
    ['d11',2,520000,'income','تحصيل','مبلغ مستحق من زبون','zaincash','scheduled'],
    ['d12',4,2300000,'expense','موردون','دفعة المورد الرئيسية','bank','scheduled'],
    ['d13',6,780000,'income','مبيعات','مبيعات متوقعة','cash','scheduled'],
    ['d14',8,1450000,'expense','موردون','طلبية الموسم','bank','scheduled'],
    ['d15',10,930000,'income','تحصيل','مستحقات عملاء','zaincash','scheduled'],
    ['d16',13,650000,'income','مبيعات','مبيعات متوقعة','cash','scheduled'],
  ].map(([id,off,amount,type,category,description,channel,status]) => ({id,date:iso(off),amount,type,category,description,channel,status}))
}
