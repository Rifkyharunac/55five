import test from 'node:test';
import assert from 'node:assert/strict';
import { predict } from '../logic.mjs';
const id=n=>String(20261010100050000n+BigInt(n));
const sequence=(n,fn)=>Array.from({length:n},(_,i)=>({issueNumber:id(i),number:fn(i)}));
test('seven outcomes cannot justify a signal',()=>{
  const result=predict(sequence(17,()=>2),id(17));
  assert.equal(result.label,null);
  assert.equal(result.reason,'insufficient');
});
test('constant outcomes do not beat the frequency baseline',()=>{
  assert.equal(predict(sequence(350,()=>2),id(350)).label,null);
});
test('a stable synthetic transition can pass validation',()=>{
  const result=predict(sequence(350,i=>i%2?8:2),id(350));
  assert.equal(result.label,'Kecil');
  assert.ok(result.evaluation.brier < result.evaluation.baselineBrier);
});
import { walkForward } from '../model.mjs';
test('future and target outcomes cannot change an earlier prediction',()=>{
  const history=sequence(350,i=>i%2?8:2);
  const before=predict(history,id(350));
  assert.deepEqual(predict([...history,{issueNumber:id(350),number:8},{issueNumber:id(351),number:8}],id(350)),before);
  const prefix=walkForward(history.slice(0,180));
  const longer=walkForward(history.slice(0,220));
  assert.deepEqual(longer.slice(0,prefix.length),prefix);
});
test('missing periods and day rollover are not invented transitions',()=>{
  const history=sequence(350,i=>i%2?8:2);
  assert.equal(predict(history,id(351)).reason,'gap');
  assert.equal(predict(history,'20261011100050000').reason,'gap');
});
test('balanced history with no first-order signal is skipped',()=>{
  const result=predict(sequence(350,i=>i%4<2?2:8),id(350));
  assert.equal(result.label,null);
  assert.equal(result.reason,'baseline');
});
test('seeded independent synthetic data does not pass the filter',()=>{
  let seed=42;
  const history=sequence(500,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32<.5?2:8;});
  assert.equal(predict(history,id(500)).label,null);
});
import { restore } from '../logic.mjs';
test('legacy decisions are preserved and malformed new diagnostics are rejected',()=>{
  const legacy={issue:id(10),prediction:{label:'Kecil',samples:10,bigRate:.4},result:8};
  const state={version:1,rows:[legacy],history:[]};
  assert.deepEqual(restore(JSON.stringify(state)).rows,[legacy]);
  const prediction=predict(sequence(350,i=>i%2?8:2),id(350));
  prediction.evaluation.brier='broken';
  assert.equal(restore(JSON.stringify({...state,rows:[{issue:id(350),prediction,result:null}]})).rows.length,0);
});
test('history capacity supports validation without losing full issue IDs',()=>{
  const history=sequence(700,i=>i%2?8:2);
  const state=restore(JSON.stringify({version:1,rows:[],history}));
  assert.equal(state.history.length,700);
});
