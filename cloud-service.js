import {CLOUD_CONFIG} from './cloud-config.js';
import {validateTransaction,validateStoredTransactions} from './transaction-utils.js';

// Published frontend key is safe WITH properly deployed RLS. NEVER use a secret
// or service_role key here; cloud mode refuses these key prefixes.
export function cloudConfigured(config=CLOUD_CONFIG) {
  if (!config || typeof config.url!=='string' || typeof config.publishableKey!=='string') return false;
  let url;
  try {url=new URL(config.url);} catch{return false;}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) return false;
  const key=config.publishableKey.trim();
  return key.length>20 && !/^(sb_secret_|service_role)/i.test(key);
}
export const CLOUD_ENABLED=cloudConfigured();
export const CLOUD_LIMIT=10000;
const SESSION_KEY='nabd.cloud.session.v1';
const parseJson=async res=>{const text=await res.text();try{return text?JSON.parse(text):null;}catch{return null;}};
const failure=(status,message)=>new Error(status===401?'انتهت صلاحية الجلسة؛ سجّل الدخول مجددًا.':status===403?'لا تملك صلاحية هذا الإجراء.':status===409?'حدث تعارض في تعديل البيانات؛ حدّث الصفحة أولًا.':message||'تعذر الوصول إلى قاعدة البيانات. لم نعتمد التغيير.');

export class CloudClient {
  constructor({config=CLOUD_CONFIG,transport=globalThis.fetch?.bind(globalThis),storage=globalThis.sessionStorage,clock=()=>Date.now()}={}){
    if(!cloudConfigured(config))throw new Error('إعداد الاتصال السحابي غير صالح.');
    if(!transport)throw new Error('Fetch is required');
    this.url=config.url.replace(/\/$/,'');
    this.key=config.publishableKey;
    this.transport=transport;
    this.storage=storage;
    this.clock=clock;
    this.session=null;
  }
  _headers(accessToken,extra={}){
    return {'apikey':this.key,'Authorization':'Bearer '+(accessToken||this.key),
      'Accept':'application/json',...extra};
  }
  async _request(path,{method='GET',body,auth=true,headers={}}={}){
    if(auth)await this._ensureSession();
    let response;
    try {
      response=await this.transport(this.url+path,{method,headers:this._headers(auth?this.session.access_token:null,{
        ...(body===undefined?{}:{'Content-Type':'application/json'}),...headers
      }),...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit'});
    } catch {
      throw new Error('الاتصال غير متاح. لا تُحفظ التغييرات حتى يعود الإنترنت.');
    }
    const data=await parseJson(response);
    if(!response.ok){
      if(response.status===401&&auth)this.clearSession();
      throw failure(response.status,response.status>=500?'الخدمة غير متاحة حاليًا.':data?.message||data?.error_description||data?.hint);
    }
    return data;
  }
  _setSession(data){
    const access=data?.access_token,refresh=data?.refresh_token;
    if(!access||!refresh)throw new Error('لم يُرجع خادم الدخول جلسة صالحة.');
    this.session={access_token:access,refresh_token:refresh,
      expires_at:Math.floor(this.clock()/1000)+Number(data.expires_in||3600)};
    try {this.storage?.setItem(SESSION_KEY,JSON.stringify(this.session));}
    catch {throw new Error('لا يمكن حفظ جلسة الدخول لهذه النافذة؛ جرّب تفعيل sessionStorage.');}
  }
  clearSession(){
    this.session=null;try{this.storage?.removeItem(SESSION_KEY);}catch{}
  }
  async _ensureSession(){
    if(!this.session)throw new Error('يجب تسجيل الدخول أولًا.');
    if(this.session.expires_at<=Math.floor(this.clock()/1000)+45){
      const old=this.session.refresh_token;
      const data=await this._request('/auth/v1/token?grant_type=refresh_token',
        {method:'POST',body:{refresh_token:old},auth:false});
      this._setSession(data);
    }
  }
  async restoreSession(){
    let raw;
    try {raw=this.storage?.getItem(SESSION_KEY);}catch{return false;}
    if(!raw)return false;
    try{
      const saved=JSON.parse(raw);
      if(!saved||typeof saved.access_token!=='string'||typeof saved.refresh_token!=='string'||
         !Number.isSafeInteger(saved.expires_at))throw Error('invalid');
      this.session=saved;
      await this._ensureSession();
      await this._request('/auth/v1/user');
      return true;
    }catch{this.clearSession();return false;}
  }
  async signUp(email,password){
    return this._request('/auth/v1/signup',{method:'POST',auth:false,body:{email,password}});
  }
  async signIn(email,password){
    const data=await this._request('/auth/v1/token?grant_type=password',
      {method:'POST',auth:false,body:{email,password}});
    this._setSession(data);
    await this._request('/auth/v1/user');
    return true;
  }
  async signOut(){
    if(this.session){
      try{await this._request('/auth/v1/logout',{method:'POST'});}catch{}
    }
    this.clearSession();
  }
  async listWorkspaces(){
    return this._request('/rest/v1/nabd_workspaces?select=id,name,opening_balance_iqd,currency,created_at&order=created_at.asc');
  }
  async createWorkspace(name){
    const value=String(name||'').trim();
    if(value.length<2||value.length>100)throw Error('اكتب اسم متجر بين حرفين و100 حرف.');
    const user=await this._request('/auth/v1/user');
    if(!user?.id)throw Error('جلسة المستخدم غير صالحة.');
    const data=await this._request('/rest/v1/nabd_workspaces?select=id,name,opening_balance_iqd,currency',
      {method:'POST',body:{owner_id:user.id,name:value},headers:{Prefer:'return=representation'}});
    if(!Array.isArray(data)||data.length!==1)throw Error('لم يكتمل إنشاء مساحة العمل.');
    return data[0];
  }
  async listTransactions(workspaceId){
    const all=[];
    for(let start=0;start<CLOUD_LIMIT;start+=500){
      const end=Math.min(start+499,CLOUD_LIMIT-1);
      const path='/rest/v1/nabd_transactions?select=id,workspace_id,date,amount,type,category,description,channel,status,version'
        +'&workspace_id=eq.'+encodeURIComponent(workspaceId)+'&order=date.desc,id.desc';
      const data=await this._request(path,{headers:{Range:start+'-'+end}});
      if(!Array.isArray(data))throw Error('استجابة بيانات الحركات غير متوقعة.');
      all.push(...data);
      if(data.length<500)return validateCloudRows(all);
    }
    throw Error('بلغ السجل حد المزامنة الآمن 10,000 حركة. يلزم نقل القراءة إلى صفحات قبل إضافة المزيد.');
  }
  async insertRecords(workspaceId,rows){
    if(!rows.length)return;
    if(rows.length>1000)throw Error('كل دفعة سحابية محدودة بـ1000 حركة للمراجعة.');
    const payload=rows.map((row,i)=>{
      const t=validateTransaction(row,i+1);
      return {id:globalThis.crypto.randomUUID(),workspace_id:workspaceId,date:t.date,
        amount:t.amount,type:t.type,category:t.category,description:t.description,
        channel:t.channel,status:t.status};
    });
    await this._request('/rest/v1/nabd_transactions',{method:'POST',body:payload,headers:{Prefer:'return=minimal'}});
  }
  async updateRecord(workspaceId,before,after){
    const t=validateTransaction(after);
    if(!before||!Number.isSafeInteger(before.version)||before.version<1)throw Error('نسخة الحركة غير معروفة؛ أعد التحميل.');
    const path='/rest/v1/nabd_transactions?id=eq.'+encodeURIComponent(before.id)+
      '&workspace_id=eq.'+encodeURIComponent(workspaceId)+'&version=eq.'+before.version+
      '&select=id,version';
    const body={date:t.date,amount:t.amount,type:t.type,category:t.category,
      description:t.description,channel:t.channel,status:t.status};
    const result=await this._request(path,{method:'PATCH',body,headers:{Prefer:'return=representation'}});
    if(!Array.isArray(result)||result.length!==1)throw Error('هذه الحركة تغيّرت من جهاز آخر. أعد المزامنة قبل تعديلها.');
  }
  async deleteRecord(workspaceId,before){
    if(!before||!Number.isSafeInteger(before.version))throw Error('أعد المزامنة قبل الحذف.');
    const path='/rest/v1/nabd_transactions?id=eq.'+encodeURIComponent(before.id)+
      '&workspace_id=eq.'+encodeURIComponent(workspaceId)+'&version=eq.'+before.version+
      '&select=id';
    const result=await this._request(path,{method:'DELETE',headers:{Prefer:'return=representation'}});
    if(!Array.isArray(result)||result.length!==1)throw Error('تغيّرت الحركة أو حُذفت من جهاز آخر. أعد المزامنة.');
  }
  async saveDifference(workspaceId,before,after){
    if(after.length>CLOUD_LIMIT)throw Error('عدد الحركات يتجاوز الحد المدعوم.');
    const previous=new Map(before.map(row=>[row.id,row]));
    const updated=new Map(after.map(row=>[row.id,row]));
    const additions=after.filter(row=>!previous.has(row.id));
    const deleted=before.filter(row=>!updated.has(row.id));
    const changed=after.filter(row=>{
      const old=previous.get(row.id);
      return old&&['date','amount','type','category','description','channel','status']
        .some(key=>old[key]!==row[key]);
    });
    if((Number(additions.length>0)+Number(deleted.length>0)+Number(changed.length>0))>1)
      throw Error('العملية المختلطة تتطلب معاملة واحدة. استخدم الاستعادة المحمية أو نفّذ التعديلات منفصلة.');
    if(additions.length)await this.insertRecords(workspaceId,additions);
    if(deleted.length>1||changed.length>1)throw Error('نفّذ تعديل أو حذف حركة واحدة في كل عملية.');
    if(deleted.length)await this.deleteRecord(workspaceId,deleted[0]);
    if(changed.length)await this.updateRecord(workspaceId,previous.get(changed[0].id),changed[0]);
  }
  async updateOpeningBalance(workspaceId,balance){
    if(!Number.isSafeInteger(balance)||Math.abs(balance)>1_000_000_000_000)throw Error('الرصيد الافتتاحي غير صالح.');
    const path='/rest/v1/nabd_workspaces?id=eq.'+encodeURIComponent(workspaceId)+'&select=id,opening_balance_iqd';
    const result=await this._request(path,{method:'PATCH',body:{opening_balance_iqd:balance},
      headers:{Prefer:'return=representation'}});
    if(!Array.isArray(result)||result.length!==1)throw Error('لا توجد صلاحية لحفظ رصيد هذا المتجر.');
  }
  async replaceLedger(workspaceId,rows,openingBalance){
    if(rows.length>1000)throw Error('استعادة السجل السحابي محدودة بـ1000 حركة مرة واحدة.');
    const verified=validateStoredTransactions(rows);
    if(!Number.isSafeInteger(openingBalance)||Math.abs(openingBalance)>1_000_000_000_000)
      throw Error('الرصيد الافتتاحي غير صالح.');
    const records=verified.map(({date,amount,type,category,description,channel,status})=>
      ({date,amount,type,category,description,channel,status}));
    const result=await this._request('/rest/v1/rpc/nabd_replace_ledger',
      {method:'POST',body:{w:workspaceId,records,balance:openingBalance}});
    if(result!==records.length)throw Error('لم يؤكد الخادم استعادة جميع الحركات.');
  }
}
export function validateCloudRows(rows){
  if(!Array.isArray(rows)||rows.length>CLOUD_LIMIT)throw Error('عدد الحركات خارج الحد.');
  const ids=new Set();
  return rows.map((raw,index)=>{
    const t=validateTransaction(raw,index+1);
    if(!/^[a-f0-9-]{36}$/i.test(t.id)||!Number.isSafeInteger(raw.version)||raw.version<1||
       ids.has(t.id))throw Error('معرّف أو نسخة سحابية غير صالحة.');
    ids.add(t.id);
    return {...t,version:raw.version};
  });
}
