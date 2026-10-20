// 채점: 라벨 세트(eval/labels.json)로 core.js의 신호 감지가 얼마나 맞는지 잰다.
// 실행: node eval/score.js [dev|holdout|all] [--set real]   (--set real: 실제로 앱에 넣어 본 문장 eval/real_use.json)
//   예) node eval/score.js [dev|holdout|all] [--engine rules|model|union|vote] [--thr 0.3] [--low 0.1] [--errors] [--md 파일경로]
//   기본은 dev(개발용), 기본 엔진은 rules(기준선). holdout(보류용)은 개선을 마친 뒤 마지막에 한 번만 잰다.
//   rules  규칙(정규식) 감지만
//   model  학습 모델(train/model.json)만. 확률 >= thr 이면 신호로 본다
//   union  규칙이 잡은 것 + 모델이 잡은 것 (합집합)
//   vote   모델이 잡은 것 + 규칙이 잡았고 모델 확률이 low 이상인 것 (규칙의 오탐을 모델이 걸러 냄)
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const ML = require('../ml.js');

const args = process.argv.slice(2);
const split = ['dev', 'holdout', 'all'].includes(args[0]) ? args[0] : 'dev';
const showErrors = args.includes('--errors');
function opt(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
const engine = opt('--engine', 'rules');
const thr = parseFloat(opt('--thr', '0.3'));
const low = parseFloat(opt('--low', '0.1'));
if (!['rules', 'model', 'union', 'vote'].includes(engine)) throw new Error('엔진은 rules|model|union|vote');
const model = engine === 'rules' ? null : JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'train', 'model.json'), 'utf8'));

function predictSet(text) {
  const r = C.analyze(text);
  const rule = new Set(r.ok ? r.signals.map((s) => s.id) : []);
  if (engine === 'rules') return rule;
  const p = ML.predict(model, text);
  const mod = new Set(Object.keys(p).filter((k) => p[k] >= thr));
  if (engine === 'model') return mod;
  if (engine === 'union') return new Set([...rule, ...mod]);
  const out = new Set(mod);
  rule.forEach((k) => {
    if ((p[k] || 0) >= low) out.add(k);
  });
  return out;
}
const mdIdx = args.indexOf('--md');
const mdPath = mdIdx >= 0 ? args[mdIdx + 1] : null;

const useReal = args.includes('--set') && opt('--set', 'labels') === 'real';
const labels = JSON.parse(fs.readFileSync(path.join(__dirname, useReal ? 'real_use.json' : 'labels.json'), 'utf8'));
const items = useReal ? labels : labels.filter((l) => split === 'all' || l.split === split);
const SIGNALS = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm'];

const stat = {};
SIGNALS.forEach((s) => (stat[s] = { tp: 0, fp: 0, fn: 0, support: 0 }));
const errors = [];
const byKind = {};

for (const it of items) {
  const pred = predictSet(it.text);
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
lines.push(`채점 대상: ${useReal ? 'real(실제 사용 문장)' : split} ${items.length}개 · 엔진 ${engine}` + (engine === 'rules' ? '' : ` (thr ${thr}` + (engine === 'vote' ? `, low ${low}` : '') + ')'));
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
