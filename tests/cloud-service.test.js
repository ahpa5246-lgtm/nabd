import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudConfigured,CloudClient,validateCloudRows} from '../cloud-service.js';

const config={url:'https://merchant-tests.supabase.co',publishableKey:'sb_publishable_mock_token_0000000000000'};
const fakeStore=()=>{
  const m=new Map();
  return {getItem:key=>m.get(key)||null,setItem:(key,v)=>m.set(key,v),
          removeItem:key=>m.delete(key),has:key=>m.has(key)};
};
const ok=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const sample=(version=1)=>({
  id:'11111111-1111-4111-8111-111111111111',
  workspace_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  date:'2026-10-17',amount:250000,type:'income',category:'مبيعات',
  description:'مبيعات اليوم',channel:'cash',status:'completed',version
});

test('public key validation refuses service keys, insecure URLs and forged privileged JWT',()=>{
  assert.equal(cloudConfigured(config),true);
  assert.equal(cloudConfigured({...config,url:'http://merchant-tests.supabase.co'}),false);
  assert.equal(cloudConfigured({...config,publishableKey:'sb_secret_really_not_for_browser'}),false);
  const legacyJWT=role=>'eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
  assert.equal(cloudConfigured({...config,publishableKey:legacyJWT('service_role')}),false);
  assert.equal(cloudConfigured({...config,publishableKey:legacyJWT('anon')}),true);
});

test('sign-in and refresh retain tokens in tab memory, never automatically in localStorage',async()=>{
  const calls=[],storage=fakeStore();let now=1700000000000;
  const client=new CloudClient({config,storage,clock:()=>now,transport:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('grant_type=password'))return ok({access_token:'user-access',refresh_token:'rotate-this',expires_in:60});
    if(url.includes('grant_type=refresh_token'))return ok({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600});
    if(url.endsWith('/auth/v1/user'))return ok({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
    if(url.includes('nabd_workspaces'))return ok([]);
    return ok({message:'missing handler'},400);
  }});
  await client.signIn('shop@example.test','somepassword');
  assert.equal(client.session.access_token,'user-access');
  assert.ok(storage.has('nabd.cloud.session.v1'));
  now+=20000;
  await client.listWorkspaces();
  assert.equal(client.session.access_token,'new-access');
  assert.ok(calls.some(c=>c.options.headers.Authorization==='Bearer new-access'));
  assert.ok(calls.filter(c=>c.url.includes('grant_type=password')).every(c=>!c.options.headers.Authorization),
    'Signed-out publishable API calls do not misuse a fake Bearer key');
  client.clearSession();
  assert.equal(storage.getItem('nabd.cloud.session.v1'),null);
});

test('optimistic lock fails closed when another device already edited row',async()=>{
  const storage=fakeStore();
  const calls=[];
  const client=new CloudClient({config,storage,transport:async(url,options)=>{
    calls.push(url);
    if(url.includes('grant_type=password'))return ok({access_token:'token',refresh_token:'refresh',expires_in:3600});
    if(url.endsWith('/auth/v1/user'))return ok({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
    if(url.includes('nabd_transactions'))return ok([]);
    return ok([]);
  }});
  await client.signIn('user@example.test','password');
  await assert.rejects(()=>client.updateRecord('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sample(4),sample(4)),/تغيّرت/);
  assert.ok(calls.some(url=>url.includes('version=eq.4')));
});

test('cloud list rejects invalid numeric money and bad version instead of silent drop',()=>{
  assert.equal(validateCloudRows([sample(1)]).length,1);
  assert.throws(()=>validateCloudRows([{...sample(),amount:1.25}]),/المبلغ/);
  assert.throws(()=>validateCloudRows([{...sample(),version:0}]),/نسخة/);
  assert.throws(()=>validateCloudRows([sample(),sample()]),/مكرر|نسخة/);
});

test('read API/network errors never pretend to commit financial data',async()=>{
  const storage=fakeStore();
  const client=new CloudClient({config,storage,transport:async url=>{
    if(url.includes('grant_type=password'))return ok({access_token:'token',refresh_token:'refresh',expires_in:3600});
    if(url.endsWith('/auth/v1/user'))return ok({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
    throw new Error('offline');
  }});
  await client.signIn('user@example.test','password');
  await assert.rejects(()=>client.listWorkspaces(),/الاتصال غير متاح/);
});
