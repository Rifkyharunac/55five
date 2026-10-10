import test from 'node:test';
import assert from 'node:assert/strict';
import { predict } from '../logic.mjs';
const id=n=>String(20261010100050000n+BigInt(n));
const history=n=>Array.from({length:n},(_,i)=>({issueNumber:id(i),number:i%3?2:8}));
test('47 results provide an experimental estimate without passing the signal gate',()=>{
  const prediction=predict(history(47),id(47));
  assert.equal(prediction.label,null);
  assert.equal(prediction.reason,'insufficient');
  assert.ok(['Kecil','Besar'].includes(prediction.estimate?.label));
  assert.equal(prediction.estimate.version,1);
});
test('an early estimate cannot see the target or future outcome',()=>{
  const data=history(47);
  assert.deepEqual(predict([...data,{issueNumber:id(47),number:9},{issueNumber:id(48),number:9}],id(47)),predict(data,id(47)));
});
import { applySnapshot, restore, estimateAccuracy, wilson, learningProgress } from '../logic.mjs';
test('initial progress explains the 47-result screenshot',()=>{
  assert.deepEqual(learningProgress(47,0),{training:47,validation:0,remaining:153});
  assert.deepEqual(learningProgress(100,100),{training:100,validation:100,remaining:0});
});
test('too little data, tied frequencies and missing previous period produce no estimate',()=>{
  assert.equal(predict(history(9),id(9)).estimate.label,null);
  assert.equal(predict(history(47),id(49)).estimate.label,null);
  const tied=Array.from({length:10},(_,i)=>({issueNumber:id(i),number:i%2?2:8}));
  assert.equal(predict(tied,id(10)).estimate.label,null);
});
test('Wilson reflects uncertainty for 3 of 7 and handles empty or extreme samples',()=>{
  assert.equal(wilson(0,0),null);
  const ci=wilson(3,7);
  assert.ok(Math.abs(ci.low-.1582)<.001);
  assert.ok(Math.abs(ci.high-.7495)<.001);
  assert.ok(wilson(7,7).low<.7);
  assert.ok(wilson(0,7).high>.3);
});
test('estimate performance includes misses and excludes unresolved, old or tied predictions',()=>{
  const row=(label,result)=>({prediction:{estimate:{version:1,label}},result});
  const scored=estimateAccuracy([row('Besar',8),row('Kecil',8),row('Besar',null),row(null,8),{prediction:{label:'Besar'},result:8}]);
  assert.equal(scored.total,2);assert.equal(scored.wins,1);
});
test('decisions and estimates survive reload and cannot be rewritten by later history',()=>{
  let state=applySnapshot({issue:null,rows:[],history:[]},{issue:id(47),list:history(47)});
  const original=structuredClone(state.rows[0].prediction);
  state=restore(JSON.stringify({...state,version:1}));
  state=applySnapshot(state,{issue:id(47),list:history(47).map(r=>({...r,number:8}))});
  assert.deepEqual(state.rows[0].prediction,original);
});
test('migration does not invent estimates for old decisions',()=>{
  const p=predict(history(47),id(47));delete p.estimate;
  let state={issue:id(47),history:history(47),rows:[{issue:id(47),prediction:p,result:null}]};
  state=applySnapshot(state,{issue:id(48),list:[{issueNumber:id(47),number:8}]});
  assert.equal(state.rows[1].prediction.estimate,undefined);
  assert.equal(estimateAccuracy(state.rows).total,0);
});
