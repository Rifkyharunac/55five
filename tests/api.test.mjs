import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
function response() { return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}}; }
const current={issueNumber:'20261010100050012',endTime:'2026-10-10 10:00:30',serviceTime:'2026-10-10 10:00:05'};
test('API validates both responses and supplies full IDs and server countdown', async t => {
  t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>({code:0,data:url.endsWith('GetGameIssue')?current:{list:[{issueNumber:'20261010100050011',number:'8'}]}})}));
  const res=response();await handler({method:'GET'},res);
  assert.equal(res.code,200);assert.equal(res.body.issue,current.issueNumber);
  assert.equal(res.body.list[0].hasil,8);assert.ok(res.body.remainingMs<=25000 && res.body.remainingMs>24000);
  assert.match(res.headers['Cache-Control'],/no-store/);
});
test('upstream HTTP failure is not a successful result', async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:false}));
  const res=response();await handler({method:'GET'},res);assert.equal(res.code,502);
});
test('upstream business error is rejected even with data',async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({code:4,data:current})}));
  const res=response();await handler({method:'GET'},res);assert.equal(res.code,502);
});
test('unsupported methods do not access upstream',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('unexpected request');});
  const res=response();await handler({method:'POST'},res);assert.equal(res.code,405);
});
