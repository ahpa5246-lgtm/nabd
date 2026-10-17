import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE='http://127.0.0.1:8765/';
await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:'ar-IQ'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor({timeout:15000});
 await page.getByText('بيانات تجريبية').first().waitFor();
 await page.screenshot({path:'artifacts/nabd-dashboard-desktop.png',fullPage:true});
 assert.ok(await page.locator('.metric-card').count()===4);
 assert.ok(await page.locator('.month-col').count()===6);
 assert.ok(await page.locator('.sidebar .nav-item').count()>=6);
 // Real form save should replace fake dataset (never append samples).
 await page.locator('#new-transaction').click();
 await page.locator('#transaction-form [name=description]').fill('بيع عراقي حقيقي');
 await page.locator('#transaction-form [name=amount]').fill('123456');
 await page.locator('#transaction-form [name=date]').fill('2026-10-15');
 await page.locator('#transaction-form [name=category]').fill('مبيعات');
 await page.locator('#transaction-form button[type=submit]').click();
 const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')));
 assert.equal(ledger.length,1,'real data must never combine with demo transactions');
 assert.equal(ledger[0].amount,123456);
 assert.equal(await page.getByText('بيانات تجريبية').count(),0);
 await page.locator('.sidebar [data-v=transactions]').click();
 await page.getByText('بيع عراقي حقيقي').first().waitFor();
 await page.locator('#search-transaction').fill('كلمة لا توجد');
 assert.equal(await page.getByText('لا توجد حركات مطابقة').count(),1);
 await page.locator('#search-transaction').fill('بيع');
 assert.equal(await page.getByText('بيع عراقي حقيقي').count(),1);
 // Editing affects storage, charts, and the same transaction id.
 await page.locator('[data-edit]').first().click();
 await page.locator('#transaction-form [name=amount]').fill('220000');
 await page.locator('#transaction-form button[type=submit]').click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1'))))[0].amount,220000);
 await page.locator('.sidebar [data-v=analytics]').click();
 await page.getByRole('heading',{name:'من الأرقام إلى الفهم'}).waitFor();
 assert.ok((await page.locator('.metric-card').allTextContents()).some(x=>x.includes('220')));
 // Opening balance changes derived report, no fake wallet/account.
 await page.locator('.sidebar [data-v=settings]').click();
 await page.locator('#opening-balance').fill('500000');
 await page.locator('#balance-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('nabd.opening-balance.v1')),'500000');
 await page.locator('.sidebar [data-v=overview]').click();
 assert.ok((await page.locator('.metric-card').first().textContent()).includes('720'));
 // CSV import: meaningful quoted description and deduplication.
 await page.locator('#show-import').click();
 const csv='date,amount,type,category,description,channel,status\n2026-10-16,50000,expense,موردون,"دفعة, للمورد",cash,completed\n';
 await page.locator('#csv').setInputFiles({name:'transactions.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')))).length,2);
 await page.locator('#show-import').click();
 await page.locator('#csv').setInputFiles({name:'transactions.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')))).length,2);
 // Simulations use their own calculations.
 await page.locator('.sidebar [data-v=scenarios]').click();
 await page.getByRole('heading',{name:'جرّب القرار قبل اتخاذه'}).waitFor();
 await page.locator('[data-scenario=extraCollection]').fill('150000');
 await page.locator('[data-scenario=extraCollection]').dispatchEvent('change');
 assert.ok((await page.locator('.scenario-compare').textContent()).includes('بعد'));
 // Destructive action confirmation and actual state update.
 await page.locator('.sidebar [data-v=transactions]').click();
 await page.locator('[data-delete]').first().click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('nabd.transactions.v1')))).length,1);
 assert.deepEqual(errors,[],'No client-side JavaScript errors');
 await context.close();
 // Fresh mobile first-run; no claims of production auth or paid backend.
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ar-IQ'});
 const mobilePage=await mobile.newPage();
 const mobileErrors=[];mobilePage.on('pageerror',e=>mobileErrors.push(e.message));
 await mobilePage.goto(BASE,{waitUntil:'domcontentloaded'});
 await mobilePage.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor({timeout:12000});
 await mobilePage.screenshot({path:'artifacts/nabd-dashboard-mobile.png',fullPage:true});
 const overflow=await mobilePage.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,'mobile viewport must not overflow horizontally by '+overflow+'px');
 await mobilePage.locator('.mobile-tabs [data-v=transactions]').click();
 await mobilePage.getByRole('heading',{name:'كل حركة لها قصة'}).waitFor();
 await mobilePage.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:16000});
 await mobile.setOffline(true);
 await mobilePage.reload({waitUntil:'domcontentloaded'});
 await mobilePage.getByRole('heading',{name:'صباح الخير، هذه صورة أموالك'}).waitFor();
 await mobile.setOffline(false);
 assert.deepEqual(mobileErrors,[]);
 await mobile.close();
 console.log('PASS: product dashboard, computed metrics, CRUD, CSV/duplicate, search, opening balance, scenarios, mobile and PWA offline');
}finally{await browser.close();}
