import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgents, runScenario, addDays} from '../agents.js';

const today='2026-10-17';
const tx=(id,date,amount,type,status='scheduled',description='مستحقات',channel='cash')=>({
  id,date,amount,type,status,description,channel,category:'عام'
});

test('report includes 14-day horizon plus day zero and all local calendar dates',()=>{
  const report=runAgents([], {today});
  assert.equal(report.forecast.length,15);
  assert.equal(report.forecast[0].date,today);
  assert.equal(report.forecast[14].date,'2026-10-31');
  assert.equal(addDays('2024-02-28',1),'2024-02-29');
});

test('future completed income is not treated as current cash',()=>{
  const report=runAgents([
    tx('past','2026-10-16',500000,'income','completed'),
    tx('future','2026-10-20',10000000,'income','completed')
  ],{today});
  assert.equal(report.currentBalance,500000);
  assert.equal(report.inflow30d,500000);
  assert.equal(report.dataQuality.futureCompleted,1);
  assert.ok(report.risks.some(r=>r.id==='future-completed'));
});

test('overdue expenses conservatively lower day-zero cash and overdue income is uncertain',()=>{
  const report=runAgents([
    tx('paid','2026-10-16',900000,'income','completed'),
    tx('overdue-expense','2026-10-13',1000000,'expense'),
    tx('overdue-income','2026-10-10',5000000,'income')
  ],{today});
  assert.equal(report.currentBalance,900000);
  assert.equal(report.forecast[0].balance,-100000);
  assert.ok(report.risks.some(r=>r.id==='overdue-payment'));
  assert.ok(report.risks.some(r=>r.id==='overdue-receivable'));
  assert.ok(report.risks.some(r=>r.id==='negative-balance'));
});

test('30-day totals exclude future and older completed events',()=>{
  const report=runAgents([
    tx('old','2026-09-16',300000,'income','completed'),
    tx('recent','2026-09-18',500000,'income','completed'),
    tx('end','2026-10-17',100000,'expense','completed'),
    tx('future','2026-10-18',1234,'expense','completed')
  ],{today});
  assert.equal(report.inflow30d,500000);
  assert.equal(report.outflow30d,100000);
  assert.equal(report.currentBalance,700000);
});

test('what-if expense reduction preserves integer IQD and original inputs',()=>{
  const original=[tx('one','2026-10-20',1255,'expense')];
  const simulated=runScenario(original,{extraCollection:0,reduceExpensesPct:10,delayLargeExpenseDays:0},{today});
  assert.equal(original[0].amount,1255);
  assert.equal(simulated.forecast[3].outflow,1130);
  assert.equal(simulated.dataQuality.invalid,0);
});

test('opening balance is optional but explicit in calculation; scheduled receivables count only on date',()=>{
  const report=runAgents([tx('later','2026-10-20',50000,'income')],{today,openingBalance:60000});
  assert.equal(report.currentBalance,60000);
  assert.equal(report.forecast[0].balance,60000);
  assert.equal(report.forecast[3].balance,110000);
});

test('negative forecast is not falsely described as stable',()=>{
  const report=runAgents([tx('unpaid','2026-10-16',5000,'expense')],{today});
  assert.ok(report.risks.some(r=>r.severity==='high'));
  assert.ok(!report.explanation.includes('السيولة تبدو مستقرة'));
});
