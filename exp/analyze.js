// 집계: 체크리스트 충족률과 점수를 조건(A 원문 / B 육하원칙 정보 / C 논문의 신호만)별로 비교한다.
//   node exp/analyze.js   ->  exp/results/summary.json, summary.md, summary_data.js
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

const COND_NAME = { A: 'A 원문', B: 'B 육하원칙 정보', C: 'C 논문의 신호만' };

/** 질문별·조건별로 회차를 평균 낸 뒤, 세 조건이 모두 채점된 질문만 비교한다. */
function compute(questions, answers, judgements) {
  const key = (q, c) => q + '|' + c;
  const fil = {}, sco = {}, chr = {};
  for (const j of judgements) {
    const k = key(j.qid, j.cond);
    (fil[k] = fil[k] || []).push(j.checks.filter(Boolean).length / j.checks.length);
    (sco[k] = sco[k] || []).push(j.score);
  }
  for (const a of answers) (chr[key(a.qid, a.cond)] = chr[key(a.qid, a.cond)] || []).push(a.chars);
  const qs = questions.filter((q) => ['A', 'B', 'C'].every((c) => fil[key(q.id, c)] && fil[key(q.id, c)].length));
  const perQ = qs.map((q) => {
    const row = { id: q.id, type: q.type };
    for (const c of ['A', 'B', 'C']) {
      row[c] = { fulfil: L.mean(fil[key(q.id, c)]), score: L.mean(sco[key(q.id, c)]), chars: L.mean(chr[key(q.id, c)] || []), runs: fil[key(q.id, c)].length };
    }
    return row;
  });
  const cond = {};
  for (const c of ['A', 'B', 'C']) {
    cond[c] = {
      name: COND_NAME[c],
      fulfil: L.mean(perQ.map((r) => r[c].fulfil)),
      score: L.mean(perQ.map((r) => r[c].score)),
      chars: L.mean(perQ.map((r) => r[c].chars)),
      promptChars: L.mean(qs.map((q) => L.buildPrompt(q, c).length))
    };
  }
  const pairs = [['B', 'A'], ['B', 'C'], ['C', 'A']];
  const compare = {};
  for (const metric of ['fulfil', 'score']) {
    for (const [x, y] of pairs) {
      const diffs = perQ.map((r) => r[x][metric] - r[y][metric]);
      compare[metric + ':' + x + '-' + y] = Object.assign({ metric, x, y, n: diffs.length }, L.pairedBootstrap(diffs), L.signTest(diffs));
    }
  }
  const byType = {};
  for (const t of [...new Set(perQ.map((r) => r.type))]) {
    const rows = perQ.filter((r) => r.type === t);
    byType[t] = { n: rows.length };
    for (const c of ['A', 'B', 'C']) byType[t][c] = L.mean(rows.map((r) => r[c].fulfil));
  }
  return { n: perQ.length, nQuestions: questions.length, runsPerCell: perQ.length ? Math.min(...perQ.map((r) => Math.min(r.A.runs, r.B.runs, r.C.runs))) : 0, cond, compare, byType, perQ };
}

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '-');

function toMarkdown(s) {
  const L2 = [];
  L2.push('# 가설 검증 실험 결과');
  L2.push('');
  L2.push('질문 ' + s.n + '개(전체 ' + s.nQuestions + '개 중 세 조건이 모두 채점된 것) × 조건 3개 × 질문당 ' + s.runsPerCell + '회 이상. 같은 AI, 새 대화, 채점은 조건을 가린 상태(블라인드).');
  L2.push('');
  L2.push('| 조건 | 체크리스트 충족률 | 의도 근접 점수(1~5) | 답변 길이(자) | 프롬프트 길이(자) |');
  L2.push('|---|---|---|---|---|');
  for (const c of ['A', 'B', 'C']) L2.push('| ' + s.cond[c].name + ' | ' + pct(s.cond[c].fulfil) + ' | ' + f2(s.cond[c].score) + ' | ' + Math.round(s.cond[c].chars) + ' | ' + Math.round(s.cond[c].promptChars) + ' |');
  L2.push('');
  L2.push('## 조건 비교 (질문별로 짝지은 차이, 95% 신뢰구간 = 부트스트랩 10000회)');
  L2.push('');
  L2.push('| 비교 | 지표 | 평균 차이 | 95% 신뢰구간 | 개선/악화 질문 수 | 부호검정 p |');
  L2.push('|---|---|---|---|---|---|');
  for (const k of Object.keys(s.compare)) {
    const c = s.compare[k];
    const d = c.metric === 'fulfil' ? (c.mean * 100).toFixed(1) + '%p' : c.mean.toFixed(2);
    const ci = c.metric === 'fulfil' ? '[' + (c.lo * 100).toFixed(1) + ', ' + (c.hi * 100).toFixed(1) + ']%p' : '[' + c.lo.toFixed(2) + ', ' + c.hi.toFixed(2) + ']';
    L2.push('| ' + COND_NAME[c.x] + ' − ' + COND_NAME[c.y] + ' | ' + (c.metric === 'fulfil' ? '충족률' : '점수') + ' | ' + d + ' | ' + ci + ' | ' + c.pos + ' / ' + c.neg + ' | ' + f2(c.p) + ' |');
  }
  L2.push('');
  L2.push('## 질문 유형별 충족률');
  L2.push('');
  L2.push('| 유형 | 질문 수 | A 원문 | B 육하원칙 | C 신호만 |');
  L2.push('|---|---|---|---|---|');
  for (const t of Object.keys(s.byType)) L2.push('| ' + t + ' | ' + s.byType[t].n + ' | ' + pct(s.byType[t].A) + ' | ' + pct(s.byType[t].B) + ' | ' + pct(s.byType[t].C) + ' |');
  L2.push('');
  L2.push('## 해석할 때 주의');
  L2.push('');
  L2.push('- 체크리스트는 사용자 의도(육하원칙 정보)에서 만들었으므로 B가 유리한 구조다. 그래서 정보 없이 신호만 붙인 C와 비교해서, 같은 길이의 말이라도 정보가 있어야 의도에 맞는지를 본다.');
  L2.push('- 채점은 Gemini가 했고 조건은 가렸지만, 사람이 한 것이 아니라서 사람 채점과의 일치는 따로 확인해야 한다.');
  L2.push('- 질문 24개, 한 AI, 의도는 내가 정한 가상 상황이라 실제 사용자 전체로 일반화할 수 없다.');
  return L2.join('\n') + '\n';
}

if (require.main === module) {
  const dir = path.join(__dirname, 'results');
  const rd = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
  const s = compute(questions, rd('answers.jsonl'), rd('judgements.jsonl'));
  if (!s.n) {
    console.log('채점된 결과가 아직 없습니다. node exp/run.js answers, judge 를 먼저 실행하세요.');
    process.exit(0);
  }
  const slim = Object.assign({}, s, { perQ: undefined });
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(s, null, 1) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'summary.md'), toMarkdown(s), 'utf8');
  fs.writeFileSync(path.join(dir, 'summary_data.js'), 'window.PSC_EXPERIMENT=' + JSON.stringify(slim) + ';\n', 'utf8');
  console.log(toMarkdown(s));
}

module.exports = { compute, toMarkdown, COND_NAME };
