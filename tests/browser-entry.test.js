import test from 'node:test';
import assert from 'node:assert/strict';

// Runs the real browser entrypoint with an inert DOM, no network or dependency.
test('demo stays distinct from real imports, malformed CSV is atomic, and user text is escaped', async()=>{
  const state=new Map(), nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{id,innerHTML:'',textContent:'',hidden:true,
      value:'',addEventListener(name,fn){this[name]=fn},onclick:null,onchange:null});
    return nodes.get(id);
  };
  const nav=['overview','transactions','agents','scenarios','assistant','settings']
    .map(v=>({dataset:{v},onclick:null}));
  globalThis.document={
    querySelector(selector){return node(selector)},
    querySelectorAll(selector){return selector==='[data-v]'?nav:[]},
  };
  globalThis.localStorage={
    getItem(key){return state.has(key)?state.get(key):null},
    setItem(key,value){state.set(key,value)},
  };
  globalThis.window={confirm:()=>true};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  await import('../app.js?ui-smoke=1');

  assert.match(node('#app').innerHTML,/وضع العرض/);
  assert.equal(state.has('nabd.transactions.v1'),false,'demo must not overwrite initial local storage');

  const input=node('#csv');
  const header='date,amount,type,category,description,channel,status\n';
  const first=header+'2026-10-13,125000,income,مبيعات,تحصيل,cash,completed\n';
  const upload=async content=>input.onchange({target:{files:[{size:content.length,text:async()=>content}],value:'fake.csv'}});
  await upload(first);
  let rows=JSON.parse(state.get('nabd.transactions.v1'));
  assert.equal(rows.length,1,'first real import must replace the demo');
  assert.doesNotMatch(node('#app').innerHTML,/وضع العرض/);

  await upload(first);
  rows=JSON.parse(state.get('nabd.transactions.v1'));
  assert.equal(rows.length,1,'same CSV imported twice must not duplicate transactions');

  await upload(first+'invalid\n');
  rows=JSON.parse(state.get('nabd.transactions.v1'));
  assert.equal(rows.length,1,'partial import must never persist if a row is invalid');

  const dangerous='<img src=x onerror=alert(1)>';
  const second=header+'2026-10-19,1250000,expense,موردون,"'+dangerous+'",bank,scheduled\n';
  await upload(second);
  const agentsButton=nav.find(b=>b.dataset.v==='agents');
  agentsButton.onclick();
  const markup=node('#app').innerHTML;
  assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!markup.includes('<img src=x onerror=alert(1)>'));

  const restore=node('#restore');
  await restore.onchange({target:{files:[{size:2,text:async()=>JSON.stringify([rows[0])]}],value:'backup.json'}});
  assert.equal(JSON.parse(state.get('nabd.transactions.v1')).length,1,'restore replaces saved state');
});
