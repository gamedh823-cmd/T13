// 채점: 라벨 세트(eval/labels.json)로 core.js의 신호 감지가 얼마나 맞는지 잰다.
// 실행: node eval/score.js [dev|holdout|all] [--errors] [--md 파일경로]
//   기본은 dev(개발용). holdout(보류용)은 개선을 마친 뒤 마지막에 한 번만 잰다.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../core.js');

const args = process.argv.slice(2);
const split = ['dev', 'holdout', 'all'].includes(args[0]) ? args[0] : 'dev';
const showErrors = args.includes('--errors');
const mdIdx = args.indexOf('--md');
const mdPath = mdIdx >= 0 ? args[mdIdx + 1] : null;

const labels = JSON.parse(fs.readFileSync(path.join(__dirname, 'labels.json'), 'utf8'));
const items = labels.filter((l) => split === 'all' || l.split === split);
const SIGNALS = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm'];

const stat = {};
SIGNALS.forEach((s) => (stat[s] = { tp: 0, fp: 0, fn: 0, support: 0 }));
const errors = [];
const byKind = {};

for (const it of items) {
  const r = C.analyze(it.text);
  const pred = new Set(r.ok ? r.signals.map((s) => s.id) : []);
  const gold = new Set(it.signals);
  const k = (byKind[it.kind] = byKind[it.kind] || { n: 0, exact: 0 });
  k.n++;
  let exact = true;
  for (const s of SIGNALS) {
    const g = gold.has(s);
    const p = pred.has(s);
    if (g) stat[s].support++;
    if (g && p) stat[s].tp++;
    else if (!g && p) {
      stat[s].fp++;
      exact = false;
      errors.push({ id: it.id, kind: it.kind, type: '오탐(없는데 잡음)', signal: s, text: it.text });
    } else if (g && !p) {
      stat[s].fn++;
      exact = false;
      errors.push({ id: it.id, kind: it.kind, type: '놓침(있는데 못 잡음)', signal: s, text: it.text });
    }
  }
  if (exact) k.exact++;
}

const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : ' - ');
let tp = 0, fp = 0, fn = 0;
const rows = [];
let macroSum = 0, macroN = 0;
for (const s of SIGNALS) {
  const { tp: a, fp: b, fn: c, support } = stat[s];
  tp += a; fp += b; fn += c;
  const p = a + b ? a / (a + b) : NaN;
  const r = a + c ? a / (a + c) : NaN;
  const f1 = p + r ? (2 * p * r) / (p + r) : NaN;
  if (support > 0 && Number.isFinite(f1)) { macroSum += f1; macroN++; } else if (support > 0) { macroN++; }
  rows.push({ s, support, a, b, c, p, r, f1 });
}
const mp = tp + fp ? tp / (tp + fp) : NaN;
const mr = tp + fn ? tp / (tp + fn) : NaN;
const mf = mp + mr ? (2 * mp * mr) / (mp + mr) : NaN;

const lines = [];
lines.push(`채점 대상: ${split} ${items.length}개 · core.js 감지 규칙`);
lines.push('');
lines.push('| 신호 | 정답 수 | 맞게 잡음 | 오탐 | 놓침 | 정밀도 | 재현율 | F1 |');
lines.push('|---|---|---|---|---|---|---|---|');
rows.forEach((x) => lines.push(`| ${x.s} | ${x.support} | ${x.a} | ${x.b} | ${x.c} | ${f(x.p)} | ${f(x.r)} | ${f(x.f1)} |`));
lines.push(`| **전체(micro)** | ${rows.reduce((t, x) => t + x.support, 0)} | ${tp} | ${fp} | ${fn} | ${f(mp)} | ${f(mr)} | ${f(mf)} |`);
lines.push('');
lines.push(`신호별 F1 평균(macro, 정답이 있는 신호만): ${f(macroSum / macroN)}`);
lines.push('');
lines.push('문장 종류별로 신호 집합이 정답과 정확히 같은 비율');
lines.push('');
lines.push('| 종류 | 문장 수 | 정확히 일치 |');
lines.push('|---|---|---|');
Object.keys(byKind).sort().forEach((k) => lines.push(`| ${k} | ${byKind[k].n} | ${byKind[k].exact} (${Math.round((byKind[k].exact / byKind[k].n) * 100)}%) |`));
if (showErrors) {
  lines.push('');
  lines.push(`틀린 사례 ${errors.length}건`);
  errors.forEach((e) => lines.push(`- [${e.id} ${e.kind}] ${e.type} ${e.signal}: ${e.text}`));
}

const out = lines.join('\n');
console.log(out);
if (mdPath) fs.writeFileSync(path.resolve(mdPath), out + '\n', 'utf8');
