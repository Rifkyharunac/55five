import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const id = n => `2026101010005${String(n).padStart(4,'0')}`;
const history = Array.from({length:12}, (_,i)=>({issueNumber:id(i),number:8}));
let fixture = {issue:id(12),remainingMs:25000,list:history};
let calls=0, active=0, maxActive=0, failing=true;
const server = createServer(async(req,res)=>{
  if(req.url === '/api') {
    calls++; active++; maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,150));
    const fail=failing;
    // First request fails; subsequent automatic retry succeeds.
    if(calls===1) failing=false;
    res.writeHead(fail?502:200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(fail?{error:'offline'}:fixture));active--;return;
  }
  const paths={'/':'index.html','/app.mjs':'app.mjs','/logic.mjs':'logic.mjs'};
  if(!paths[req.url]) {res.writeHead(204);res.end();return;}
  res.setHeader('Content-Type',req.url==='/'?'text/html':'text/javascript');
  res.end(await readFile(new URL('../'+paths[req.url],import.meta.url)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1100,height:820}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://55x4mqd.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Iframe eksternal diisolasi saat uji.</p>'}));
  await page.addInitScript(()=>{Date.now=()=>0;});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText('Data belum tersinkron.',{exact:false}).waitFor();
  await page.locator('#dataBody tr').waitFor({timeout:10000});
  assert.equal(await page.locator('#dataBody tr').count(),1);
  assert.match(await page.locator('#countdown').innerText(),/dtk/);
  assert.match(await page.locator('#dataBody tr').innerText(),/Besar/);
  assert.match(await page.locator('#dataBody tr').innerText(),/Menunggu hasil/);
  console.log('PASS initial failure retries automatically, server clock unaffected by device clock');
  await page.reload();
  await page.getByText('Terhubung.',{exact:false}).waitFor();
  assert.equal(await page.locator('#dataBody tr').count(),1);
  console.log('PASS reload preserves one frozen prediction');
  fixture={issue:'20261011100050001',remainingMs:25000,list:[{issueNumber:id(12),number:8},...history]};
  await page.getByRole('button',{name:'Coba lagi'}).click();
  await page.getByText('WIN',{exact:true}).waitFor();
  assert.equal(await page.locator('#dataBody tr').count(),2);
  assert.match(await page.locator('#accuracy').innerText(),/1\/1/);
  console.log('PASS midnight transition settles only matching period and records accuracy');
  failing=true;
  await page.getByRole('button',{name:'Coba lagi'}).click();
  await page.getByText('Data belum tersinkron.',{exact:false}).waitFor();
  assert.equal(await page.locator('#countdown').innerText(),'Menunggu sinkronisasi');
  assert.equal(await page.locator('#dataBody tr').count(),2);
  failing=false;
  await page.getByRole('button',{name:'Coba lagi'}).click({clickCount:5});
  await page.getByText('Terhubung.',{exact:false}).waitFor();
  assert.equal(maxActive,1);
  console.log('PASS disconnect pauses countdown; repeated retry clicks cannot overlap requests');
  await page.setViewportSize({width:390,height:844});
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../test-results/mobile.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS mobile layout and zero JavaScript errors');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
