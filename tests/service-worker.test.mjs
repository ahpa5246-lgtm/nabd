import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function worker(){
 const events={},deleted=[];
 vm.runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{
  URL,self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>events[name]=fn},
  caches:{keys:async()=>['nabd-v1','nabd-v2','another-app'],delete:async key=>deleted.push(key),match:async()=>undefined},fetch:async()=>({ok:true})
 });return {events,deleted};
}
test('activation removes only obsolete NABD caches',async()=>{
 const {events,deleted}=worker();let pending;
 events.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(deleted,['nabd-v1']);
});
for(const request of [{method:'POST',url:'https://example.test/api'},{method:'GET',url:'https://other.test/file'}])
 test('foreign or modifying requests bypass the offline cache: '+request.method+' '+request.url,()=>{
  const {events}=worker();let intercepted=false;
  events.fetch({request,respondWith(){intercepted=true}});
  assert.equal(intercepted,false);
 });
