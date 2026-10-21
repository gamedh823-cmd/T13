// 정확도 보고서를 만든다: 앱 화면의 "판정을 얼마나 믿을 수 있나요?" 절이 이 결과를 보여 준다.
//   node eval/report.js   ->  eval/report.json, eval/report_data.js (window.PSC_REPORT)
// 숫자는 손으로 적지 않고 이 스크립트가 라벨 세트와 학습 모델로 계산한다.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const ML = require('../ml.js');

const ROOT = path.join(__dirname, '..');
const SIGNALS = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm'];
const readJsonl = (f) =>
  fs
    .readFileSync(path.join(ROOT, 'train', 'data', f), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

function metrics(items, predictSet) {
  let tp = 0, fp = 0, fn = 0;
  for (const it of items) {
    const pred = predictSet(it.text);
    const gold = new Set(it.signals);
    for (const s of SIGNALS) {
      const g = gold.has(s);
      const p = pred.has(s);
      if (g && p) tp++;
      else if (!g && p) fp++;
      else if (g && !p) fn++;
    }
  }
  const p = tp + fp ? tp / (tp + fp) : 0;
  const r = tp + fn ? tp / (tp + fn) : 0;
  return { n: items.length, tp, fp, fn, precision: p, recall: r, f1: p + r ? (2 * p * r) / (p + r) : 0 };
}

function compute() {
  const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'train', 'model.json'), 'utf8'));
  const labels = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'labels.json'), 'utf8'));
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'real_use.json'), 'utf8'));
  const dev = labels.filter((l) => l.split === 'dev');
  const valUnseen = readJsonl('train.jsonl').filter((r) => r.split === 'val_unseen');
  const valHand = [...readJsonl('extra_handwritten.jsonl'), ...readJsonl('extra_hard.jsonl')].filter((r) => r.split === 'val_hand');

  const rules = (t) => {
    const r = C.analyze(t);
    return new Set(r.ok ? r.signals.map((s) => s.id) : []);
  };
  const mod = (t) => {
    const p = ML.predict(model, t);
    return new Set(Object.keys(p).filter((k) => p[k] >= ML.THRESHOLD));
  };

  // 확신도 구간별 실제 정확도(보정): 개발용 + 학습에 쓰지 않은 검증 문장 전체에서
  const pool = [...dev, ...valUnseen, ...valHand];
  const edges = [
    { lo: ML.WEAK, hi: ML.THRESHOLD, label: '약한 신호 (' + Math.round(ML.WEAK * 100) + '~' + Math.round(ML.THRESHOLD * 100) + '%)' },
    { lo: ML.THRESHOLD, hi: 0.7, label: '확정, 보통 (' + Math.round(ML.THRESHOLD * 100) + '~70%)' },
    { lo: 0.7, hi: 1.0001, label: '확정, 높음 (70% 이상)' }
  ];
  const bins = edges.map((e) => ({ label: e.label, lo: e.lo, hi: e.hi, n: 0, right: 0 }));
  for (const it of pool) {
    const p = ML.predict(model, it.text);
    for (const s of SIGNALS) {
      const b = bins.find((x) => p[s] >= x.lo && p[s] < x.hi);
      if (!b) continue;
      b.n++;
      if (it.signals.includes(s)) b.right++;
    }
  }
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v]));
  return {
    threshold: ML.THRESHOLD,
    weak: ML.WEAK,
    dev: { rules: round(metrics(dev, rules)), model: round(metrics(dev, mod)) },
    valUnseen: round(metrics(valUnseen, mod)),
    valHand: round(metrics(valHand, mod)),
    real: round(metrics(real, mod)),
    calibration: bins.map((b) => ({ label: b.label, n: b.n, right: b.right, rate: b.n ? Math.round((b.right / b.n) * 100) : null })),
    note: '임계값은 개발용 라벨과 오탐 사례를 보고 정했고, 오탐 사례를 보고 학습 문장을 보강했기 때문에 개발용 점수는 실제보다 높을 수 있다. 보류용(holdout) 20개는 아직 재지 않았다.'
  };
}

if (require.main === module) {
  const rep = compute();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(rep, null, 1) + '\n', 'utf8');
  fs.writeFileSync(path.join(__dirname, 'report_data.js'), 'window.PSC_REPORT=' + JSON.stringify(rep) + ';\n', 'utf8');
  console.log(JSON.stringify(rep, null, 1));
}
module.exports = { compute };
