// 사람 평가 집계.   node exp/human.js exp/sheet/ratings.csv
// CSV 열: rater,qid,score_X,score_Y,score_Z,best   (best는 X, Y, Z 중 하나)
// sheet_key.json으로 조건을 알아낸 뒤 조건별 평균 점수와 "가장 좋다고 고른 비율"을 낸다.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split(',').map((s) => s.trim());
  return lines.slice(1).map((l) => {
    const c = l.split(',').map((s) => s.trim());
    return Object.fromEntries(head.map((h, i) => [h, c[i]]));
  });
}

function summarize(rows, key) {
  const score = { A: [], B: [], C: [] };
  const best = { A: 0, B: 0, C: 0 };
  let nBest = 0;
  const raters = new Set();
  const perQ = {};
  for (const r of rows) {
    const k = key[r.qid];
    if (!k) continue;
    const sc = { X: Number(r.score_X), Y: Number(r.score_Y), Z: Number(r.score_Z) };
    if (!Object.values(sc).every((v) => Number.isFinite(v) && v >= 1 && v <= 5)) continue;
    raters.add(r.rater);
    for (const lab of ['X', 'Y', 'Z']) {
      score[k[lab]].push(sc[lab]);
      (perQ[r.qid] = perQ[r.qid] || { A: [], B: [], C: [] })[k[lab]].push(sc[lab]);
    }
    if (['X', 'Y', 'Z'].includes(r.best)) {
      best[k[r.best]]++;
      nBest++;
    }
  }
  return {
    raters: raters.size,
    ratings: Object.values(score).reduce((a, b) => a + b.length, 0) / 3,
    meanScore: { A: L.mean(score.A), B: L.mean(score.B), C: L.mean(score.C) },
    bestRate: { A: nBest ? best.A / nBest : NaN, B: nBest ? best.B / nBest : NaN, C: nBest ? best.C / nBest : NaN },
    nBest,
    perQ
  };
}

module.exports = { parseCsv, summarize };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.log('사용법: node exp/human.js exp/sheet/ratings.csv');
    process.exit(0);
  }
  const key = JSON.parse(fs.readFileSync(path.join(__dirname, 'sheet', 'sheet_key.json'), 'utf8'));
  const s = summarize(parseCsv(fs.readFileSync(file, 'utf8')), key);
  console.log(JSON.stringify(s, null, 1));
}
