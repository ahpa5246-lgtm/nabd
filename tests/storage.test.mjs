import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTransactions, saveTransactions } from '../storage.js';
const fallback=()=>[{id:'demo'}];
test('corrupt or unavailable storage leaves the app usable',()=>{
 for(const storage of [{getItem(){return '{broken'}},{getItem(){throw new Error('denied')}},{getItem(){return '{}'}}])
  assert.deepEqual(loadTransactions(storage,'key',fallback),fallback());
});
test('an intentionally empty ledger stays empty',()=>assert.deepEqual(loadTransactions({getItem:()=> '[]'},'key',fallback),[]));
test('quota errors are reported without crashing',()=>assert.equal(saveTransactions({setItem(){throw new Error('quota')}},'key',[]),false));
