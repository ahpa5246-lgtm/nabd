import test from 'node:test';
import assert from 'node:assert/strict';
import {saveTransactions} from '../storage.js';
test('failed persistence invokes the application warning callback',()=>{
 let warning='';
 assert.equal(saveTransactions({setItem(){throw new Error('quota')}},'key',[],message=>warning=message),false);
 assert.ok(warning.length>0);
});
