import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:8765/';
await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:1366,height:850},locale:'ar-IQ'});
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByText('وضع العرض:').waitFor({timeout:12000});
  await page.screenshot({path:'artifacts/nabd-desktop-demo.png',fullPage:true});

  const clientErrors=[];
  page.on('pageerror',error=>clientErrors.push(String(error)));
  await page.getByRole('button',{name:'الحركات'}).click();
  const csv='date,amount,type,category,description,channel,status\n2026-10-10,120000,income,مبيعات,"تحصيل, اختبار",cash,completed\n';
  await page.locator('#csv').setInputFiles({
    name:'synthetic-only.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
  });
  await page.getByText('تحصيل, اختبار').waitFor({timeout:6000});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')).length),1);
  assert.equal(await page.getByText('وضع العرض:').count(),0);

  await page.locator('#csv').setInputFiles({
    name:'synthetic-only.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
  });
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')).length),1);

  // Verify a corrupted saved ledger cannot be silently replaced.
  await page.evaluate(()=>localStorage.setItem('nabd.transactions.v1','{broken-data'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('تعذّر قراءة البيانات المحفوظة').waitFor({timeout:6000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('nabd.transactions.v1')),'{broken-data');

  // Fresh first-visit demo; mobile viewport and offline reload test.
  const mobile=await browser.newContext({viewport:{width:390,height:844},locale:'ar-IQ'});
  const mpage=await mobile.newPage();
  await mpage.goto(base,{waitUntil:'domcontentloaded'});
  await mpage.getByText('وضع العرض:').waitFor({timeout:10000});
  await mpage.screenshot({path:'artifacts/nabd-mobile-demo.png',fullPage:true});
  await mpage.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:15000});
  await mobile.setOffline(true);
  await mpage.reload({waitUntil:'domcontentloaded'});
  await mpage.getByText('وضع العرض:').waitFor({timeout:10000});
  await mobile.setOffline(false);
  if(clientErrors.length)throw new Error('Browser script errors: '+clientErrors.join(' ; '));
  console.log('PASS: desktop data imports, duplicate guard, damaged ledger; mobile screenshot and offline reload');
  await mobile.close();
  await context.close();
} finally {
  await browser.close();
}
