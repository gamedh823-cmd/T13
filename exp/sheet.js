// 사람 블라인드 평가 시트를 만든다.   node exp/sheet.js [--n 8]
//   exp/sheet/rater_sheet.md     평가자에게 보내는 문서(조건 이름 없음, 답변 순서는 섞음)
//   exp/sheet/ratings_template.csv  평가자가 채우는 표
//   exp/sheet/sheet_key.json     어느 답변이 A/B/C인지 적은 열쇠(평가자에게 보내지 않는다)
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

const n = parseInt((process.argv.includes('--n') ? process.argv[process.argv.indexOf('--n') + 1] : '8'), 10);
const dir = __dirname;
const questions = JSON.parse(fs.readFileSync(path.join(dir, 'questions.json'), 'utf8'));
const rows = fs.readFileSync(path.join(dir, 'results', 'answers.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// 유형마다 같은 수의 질문(앞에서부터)을 고른다.
const types = [...new Set(questions.map((q) => q.type))];
const per = Math.max(1, Math.floor(n / types.length));
const chosen = [];
for (const t of types) chosen.push(...questions.filter((q) => q.type === t).slice(0, per));

const rand = L.rng(4242);
const key = {};
const md = ['# 답변 평가 부탁드려요', '', '질문마다 "사용자의 상황"과 AI 답변 3개(X·Y·Z)가 있어요. **이 사용자가 원하던 답에 얼마나 가까운지** 각 답변에 1~5점을 주고, 가장 좋은 답변 하나를 골라 주세요. (1 = 전혀 아님, 5 = 매우 가까움)', '', '- 답변이 길다고 점수를 더 주지 말고, 상황에 맞는지만 봐 주세요.', '- 어떤 조건으로 만든 답인지는 알려 드리지 않아요.', ''];
const csv = ['rater,qid,score_X,score_Y,score_Z,best'];
for (const q of chosen) {
  const items = ['A', 'B', 'C'].map((c) => rows.find((r) => r.qid === q.id && r.cond === c && r.run === 1)).filter(Boolean);
  if (items.length < 3) continue;
  const order = items.map((it) => ({ it, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.it);
  key[q.id] = { X: order[0].cond, Y: order[1].cond, Z: order[2].cond };
  md.push('## ' + q.id + ' (' + q.type + ')', '', '**사용자의 상황**');
  for (const k of L.FACT_KEYS) md.push('- ' + k + ': ' + q.facts[k]);
  md.push('');
  ['X', 'Y', 'Z'].forEach((lab, i) => md.push('### 답변 ' + lab, '', order[i].answer.replace(/\r/g, ''), ''));
  md.push('점수: X=__ Y=__ Z=__ / 가장 좋은 답변: __', '', '---', '');
  csv.push(',' + q.id + ',,,,');
}
fs.mkdirSync(path.join(dir, 'sheet'), { recursive: true });
fs.writeFileSync(path.join(dir, 'sheet', 'rater_sheet.md'), md.join('\n'), 'utf8');
fs.writeFileSync(path.join(dir, 'sheet', 'ratings_template.csv'), csv.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'sheet', 'sheet_key.json'), JSON.stringify(key, null, 1) + '\n', 'utf8');
console.log('평가 질문 ' + Object.keys(key).length + '개, 답변 ' + Object.keys(key).length * 3 + '개');
