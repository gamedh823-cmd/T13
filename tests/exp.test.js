// 가설 검증 실험 코드(exp/)의 테스트. API는 부르지 않는다. 실행: node tests/exp.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../exp/lib.js');
const { compute } = require('../exp/analyze.js');

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exp', 'questions.json'), 'utf8'));
let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log('통과  ' + name);
}

t('질문 24개: 유형 4가지 각 6개, id 중복 없음, 육하원칙 6칸과 체크리스트 5개', () => {
  assert.strictEqual(questions.length, 24);
  assert.strictEqual(new Set(questions.map((q) => q.id)).size, 24);
  for (const ty of ['추천', '기획', '글쓰기', '조언']) assert.strictEqual(questions.filter((q) => q.type === ty).length, 6);
  for (const q of questions) {
    assert.deepStrictEqual(Object.keys(q.facts), L.FACT_KEYS);
    assert.ok(Object.values(q.facts).every((v) => typeof v === 'string' && v.length >= 3));
    assert.strictEqual(q.check.length, 5);
  }
});
t('질문에 전화번호·이메일·주민번호 같은 개인정보가 없다', () => {
  const s = JSON.stringify(questions);
  assert.ok(!/\d{2,3}-\d{3,4}-\d{4}/.test(s));
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(s));
  assert.ok(!/\d{6}-\d{7}/.test(s));
});
t('프롬프트: A는 원문 그대로, B는 원문과 육하원칙 6줄, C는 원문과 신호 문구(새 정보 없음)', () => {
  const q = questions[0];
  assert.strictEqual(L.buildPrompt(q, 'A'), q.original);
  const b = L.buildPrompt(q, 'B');
  assert.ok(b.startsWith(q.original));
  for (const k of L.FACT_KEYS) assert.ok(b.includes('- ' + k + ': ' + q.facts[k]));
  const c = L.buildPrompt(q, 'C');
  assert.ok(c.startsWith(q.original) && c.includes('20년 경력') && c.includes('토론') && c.includes('단계별'));
  for (const k of L.FACT_KEYS) assert.ok(!c.includes(q.facts[k]));
  assert.throws(() => L.buildPrompt(q, 'D'));
});
t('채점 프롬프트는 조건(A/B/C)을 드러내지 않는다', () => {
  const p = L.buildJudgePrompt(questions[0], '답변 예시');
  assert.ok(!/조건|원문|육하원칙|신호/.test(p.replace(/체크리스트|사용자의 실제 상황/g, '')));
});
t('채점 결과 파싱: 정상, 코드블록, 형식 오류', () => {
  assert.deepStrictEqual(L.parseJudge('{"checks":[true,false,true],"score":4}', 3), { checks: [true, false, true], score: 4 });
  assert.deepStrictEqual(L.parseJudge('```json\n{"checks":[true],"score":1}\n```', 1), { checks: [true], score: 1 });
  assert.strictEqual(L.parseJudge('{"checks":[true],"score":9}', 1), null);
  assert.strictEqual(L.parseJudge('{"checks":[true,true],"score":3}', 3), null);
  assert.strictEqual(L.parseJudge('이건 JSON이 아님', 3), null);
  assert.strictEqual(L.parseJudge(undefined, 3), null);
});
t('부호검정: 8 대 0이면 p=0.0078, 5 대 5면 p=1, 전부 0이면 p=1', () => {
  assert.ok(Math.abs(L.signTest([1, 1, 1, 1, 1, 1, 1, 1]).p - 0.0078125) < 1e-9);
  assert.strictEqual(L.signTest([1, 1, 1, 1, 1, -1, -1, -1, -1, -1]).p, 1);
  assert.strictEqual(L.signTest([0, 0, 0]).p, 1);
});
t('부트스트랩: 같은 입력이면 같은 결과(시드 고정), 차이가 모두 같으면 신뢰구간도 그 값', () => {
  const d = [0.2, 0.4, 0.1, 0.3, 0.5];
  assert.deepStrictEqual(L.pairedBootstrap(d), L.pairedBootstrap(d));
  const c = L.pairedBootstrap([0.25, 0.25, 0.25, 0.25]);
  assert.ok(Math.abs(c.lo - 0.25) < 1e-9 && Math.abs(c.hi - 0.25) < 1e-9);
});
t('집계: 가짜 채점 결과에서 B>A 차이가 양수로 나오고, 세 조건이 모두 채점되지 않은 질문은 뺀다', () => {
  const qs = questions.slice(0, 4);
  const jud = [];
  const ans = [];
  for (const q of qs.slice(0, 3)) {
    for (const [c, k] of [['A', 1], ['B', 4], ['C', 1]]) {
      jud.push({ qid: q.id, cond: c, run: 1, checks: [1, 2, 3, 4, 5].map((i) => i <= k), score: k });
      ans.push({ qid: q.id, cond: c, run: 1, chars: 100 * k });
    }
  }
  jud.push({ qid: qs[3].id, cond: 'A', run: 1, checks: [true, true, true, true, true], score: 5 }); // B·C 없음 -> 제외
  const s = compute(qs, ans, jud);
  assert.strictEqual(s.n, 3);
  assert.ok(Math.abs(s.cond.A.fulfil - 0.2) < 1e-9 && Math.abs(s.cond.B.fulfil - 0.8) < 1e-9);
  assert.ok(s.compare['fulfil:B-A'].mean > 0.5 && s.compare['fulfil:B-A'].pos === 3);
  assert.ok(Math.abs(s.compare['fulfil:C-A'].mean) < 1e-9);
});

console.log('\n' + n + '개 모두 통과');
