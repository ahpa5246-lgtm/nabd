import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const origin='https://merchant-test.supabase.co';
const users=new Map([
 ['one@example.test',{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',password:'password-A-123',token:'jwt-A'}],
 ['two@example.test',{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',password:'password-B-123',token:'jwt-B'}],
]);
const workspace=new Map(),transactions=new Map();
let simulateOffline=false,serial=1;
const send=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
const bearer=request=>request.headers()['authorization']?.replace(/^Bearer /,'');
const who=request=>[...users.values()].find(u=>u.token===bearer(request))||null;

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 await context.route('**/cloud-config.js',route=>route.fulfill({
   contentType:'text/javascript',
   body:"export const CLOUD_CONFIG={url:'"+origin+"',publishableKey:'sb_publishable_mock_only_12345678901234567890'};"
 }));
 await context.route(origin+'/**',async route=>{
  if(simulateOffline)return route.abort('failed');
  const request=route.request(),u=new URL(request.url()),path=u.pathname,method=request.method();
  let payload;try{payload=request.postDataJSON()}catch{payload={}}
  if(path==='/auth/v1/token'&&u.searchParams.get('grant_type')==='password'){
    const user=users.get(payload.email);
    return user?.password===payload.password?send(route,{access_token:user.token,refresh_token:'refresh-'+user.token,expires_in:3600})
      :send(route,{message:'Wrong credentials'},400);
  }
  if(path==='/auth/v1/user'){
    const user=who(request);return user?send(route,{id:user.id,email:[...users].find(([,v])=>v===user)?.[0]}):send(route,{message:'unauthorized'},401);
  }
  if(path==='/auth/v1/logout')return send(route,null);
  if(path==='/auth/v1/signup')return send(route,{user:{id:'pending'},identities:[]});
  if(!who(request))return send(route,{message:'not authenticated'},401);
  const user=who(request);
  if(path==='/rest/v1/nabd_workspaces'){
    if(method==='GET')return send(route,[...workspace.values()].filter(w=>w.owner_id===user.id).map(w=>({...w})));
    if(method==='POST'){
      if(payload.owner_id!==user.id)return send(route,{message:'rls'},403);
      const w={id:'11111111-1111-4111-8111-'+String(serial++).padStart(12,'0'),name:payload.name,
        owner_id:user.id,currency:'IQD',opening_balance_iqd:0};
      workspace.set(w.id,w);return send(route,[w],201);
    }
    if(method==='PATCH'){
      const id=u.searchParams.get('id')?.replace('eq.',''),w=workspace.get(id);
      if(!w||w.owner_id!==user.id)return send(route,[]);
      w.opening_balance_iqd=payload.opening_balance_iqd;return send(route,[w]);
    }
  }
  if(path==='/rest/v1/nabd_transactions'){
    const w=u.searchParams.get('workspace_id')?.replace('eq.','');
    if(method==='GET')return send(route,[...transactions.values()].filter(t=>workspace.get(t.workspace_id)?.owner_id===user.id&&t.workspace_id===w));
    if(method==='POST'){
      const rows=Array.isArray(payload)?payload:[payload];
      if(rows.some(t=>workspace.get(t.workspace_id)?.owner_id!==user.id))return send(route,{message:'rls'},403);
      for(const t of rows)transactions.set(t.id,{...t,version:1});
      return send(route,null,201);
    }
    const id=u.searchParams.get('id')?.replace('eq.',''),old=transactions.get(id);
    if(!old||workspace.get(old.workspace_id)?.owner_id!==user.id)return send(route,[]);
    if(Number(u.searchParams.get('version')?.replace('eq.',''))!==old.version)return send(route,[]);
    if(method==='PATCH'){
      const next={...old,...payload,version:old.version+1};
      transactions.set(id,next);return send(route,[{id:next.id,version:next.version}]);
    }
    if(method==='DELETE'){transactions.delete(id);return send(route,[{id}]);}
  }
  if(path==='/rest/v1/rpc/nabd_replace_ledger'){
    if(workspace.get(payload.w)?.owner_id!==user.id)return send(route,{message:'rls'},403);
    for(const [k,row] of transactions)if(row.workspace_id===payload.w)transactions.delete(k);
    for(const row of payload.records||[]){
      const id='33333333-3333-4333-8333-'+String(serial++).padStart(12,'0');
      transactions.set(id,{...row,id,workspace_id:payload.w,version:1});
    }
    workspace.get(payload.w).opening_balance_iqd=payload.balance;return send(route,payload.records.length);
  }
  return send(route,{message:'unexpected route '+path},500);
 });
 const page=await context.newPage(),jsErrors=[];
 page.on('pageerror',e=>jsErrors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'الدخول إلى مساحة نبض'}).waitFor({timeout:10000});
 assert.equal(await page.locator('.metric-card').count(),0,'no financial dashboard before login');

 await page.locator('[name=email]').fill('one@example.test');
 await page.locator('[name=password]').fill('password-A-123');
 await page.getByRole('button',{name:'تسجيل الدخول'}).click();
 await page.getByRole('heading',{name:'إنشاء مساحة عمل'}).waitFor();
 await page.locator('[name=name]').fill('متجر ألف');
 await page.getByRole('button',{name:'إنشاء مساحة المتجر'}).click();
 await page.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor();
 assert.ok((await page.getByText('متجر ألف').count())>0);

 await page.locator('#new-transaction').click();
 await page.locator('[name=amount]').fill('123450');
 await page.locator('[name=date]').fill('2026-10-16');
 await page.locator('#transaction-form [name=description]').fill('بيع حقيقي سحابي');
 await page.locator('#transaction-form button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#new-transaction')!==null);
 assert.equal(transactions.size,1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('nabd.transactions.v1')),null,
   'remote mode must not silently store financial ledger in localStorage');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor();
 assert.equal(await page.getByText('بيع حقيقي سحابي').count(),1,'server record survives reload');

 // Network failure MUST NOT commit UI-only or localStorage success.
 simulateOffline=true;
 await page.locator('#new-transaction').click();
 await page.locator('[name=amount]').fill('9999');
 await page.locator('[name=date]').fill('2026-10-17');
 await page.locator('#transaction-form [name=description]').fill('should fail');
 await page.locator('#transaction-form button[type=submit]').click();
 await page.waitForTimeout(500);
 assert.equal(transactions.size,1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('nabd.transactions.v1')),null);
 simulateOffline=false;
 await page.locator('#cancel-modal').click();

 await page.locator('#cloud-logout').click();
 await page.getByRole('heading',{name:'الدخول إلى مساحة نبض'}).waitFor();
 await page.locator('[name=email]').fill('two@example.test');
 await page.locator('[name=password]').fill('password-B-123');
 await page.getByRole('button',{name:'تسجيل الدخول'}).click();
 await page.getByRole('heading',{name:'إنشاء مساحة عمل'}).waitFor();
 await page.locator('[name=name]').fill('متجر باء');
 await page.getByRole('button',{name:'إنشاء مساحة المتجر'}).click();
 await page.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor();
 assert.equal(await page.getByText('بيع حقيقي سحابي').count(),0);
 const bobId=await page.evaluate(()=>sessionStorage.getItem('nabd.cloud.session.v1'));
 assert.ok(bobId.includes('jwt-B'));
 assert.deepEqual(jsErrors,[]);
 console.log('PASS: cloud login, tenant onboarding, persisted CRUD, separate merchant, fail-closed offline');
 await context.close();
} finally {await browser.close();}
