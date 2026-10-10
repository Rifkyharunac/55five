import test from 'node:test';
import assert from 'node:assert/strict';
import { issueId, normalizeResults, predict, applySnapshot, accuracy, restore, serverRemaining } from '../logic.mjs';
const id = n => `2026101010005${String(n).padStart(4,'0')}`;
const history = Array.from({length:12}, (_,i) => ({issueNumber:id(i),number:8}));
const empty = () => ({issue:null,history:[],rows:[]});
const snap = (n,list=history) => ({issue:id(n),list});
test('full issue ids preserve leading zeros and reject lossy numbers', () => {
  assert.equal(issueId('00001010100050001'), '00001010100050001');
  assert.equal(issueId(20261010100050001), null);
});
test('history rejects malformed results and conflicting duplicates', () => {
  assert.deepEqual(normalizeResults([{issueNumber:id(1),number:2},{issueNumber:id(1),number:8}, {issueNumber:id(2),number:'8x'}]), []);
});
test('predictions use only earlier history and skip insufficient/tied data', () => {
  assert.equal(predict(history,id(12)).label,'Besar');
  assert.equal(predict(history,id(3)).label,null);
  assert.equal(predict([...history,{issueNumber:id(20),number:0}],id(12)).samples,12);
  assert.equal(predict(history.map((r,i)=>({...r,number:i%2?1:8})),id(12)).label,null);
});
test('previous result never settles current issue; repeats keep one frozen prediction', () => {
  let state = applySnapshot(empty(),snap(12));
  const prediction = state.rows[0].prediction;
  state = applySnapshot(state,snap(12,history.map(r=>({...r,number:1}))));
  assert.equal(state.rows.length,1);
  assert.equal(state.rows[0].result,null);
  assert.deepEqual(state.rows[0].prediction,prediction);
});
test('delayed results settle exact issues including after a day change', () => {
  let state = applySnapshot(empty(),snap(12));
  state = applySnapshot(state,{issue:'20261011100050001',list:[{issueNumber:id(12),number:8}]});
  assert.equal(state.rows[1].result,8);
  assert.equal(state.rows[0].result,null);
  assert.deepEqual(accuracy(state.rows),{total:1,wins:1});
  assert.throws(()=>applySnapshot(state,snap(13)));
});
test('no retrospective predictions and no invalid settlement', () => {
  assert.equal(applySnapshot(empty(),snap(12,[{issueNumber:id(12),number:8}])).rows.length,0);
  let state=applySnapshot(empty(),snap(12));
  state=applySnapshot(state,snap(13,[{issueNumber:id(12),number:null}]));
  assert.equal(state.rows[1].result,null);
});
test('reload preserves decisions and settled accuracy; corrupt storage recovers', () => {
  const state=applySnapshot(empty(),snap(12));
  assert.deepEqual(restore(JSON.stringify({...state,version:1})),state);
  assert.deepEqual(restore('{bad'),empty());
  assert.deepEqual(accuracy([{prediction:{label:null},result:8}]),{total:0,wins:0});
});
test('countdown uses server timestamps across midnight', () => {
  assert.equal(serverRemaining({endTime:'2026-10-11 00:00:00',serviceTime:'2026-10-10 23:59:45'}),15000);
  assert.equal(serverRemaining({endTime:'bad',serviceTime:null}),null);
  assert.equal(serverRemaining({endTime:'2026-10-10 10:00:00',serviceTime:'2026-10-10 10:00:01'}),null);
});
