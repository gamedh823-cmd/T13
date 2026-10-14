// 실행: node tests/core.test.js   (설치할 것 없음, Node 18 이상)
'use strict';
const assert = require('assert');
const C = require('../core.js');

let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log('통과  ' + name);
}
const ids = (r) => r.signals.map((s) => s.id);

// ---- 논문 수치가 표와 같은지 (표 14·18) ----
t('논문 수치: 토론 배율이 3.4/4.3/5.4배', () => {
  const r = (k) => (C.PAPER.length[k].D / C.PAPER.length[k].C).toFixed(1);
  assert.strictEqual(r('chatgpt'), '3.4');
  assert.strictEqual(r('gemini'), '4.3');
  assert.strictEqual(r('claude'), '5.4');
});
t('논문 수치: 정답 수 (표 14)', () => {
  assert.deepStrictEqual(C.PAPER.correct.chatgpt, { C: 9, P: 8, D: 9 });
  assert.deepStrictEqual(C.PAPER.correct.gemini, { C: 10, P: 10, D: 10 });
});

// ---- 신호 감지 ----
t('토론 지시 감지', () => {
  const r = C.analyze('두 명의 전문가 A와 B가 토론하는 형식으로 7의 222제곱을 13으로 나눈 나머지를 구해 줘');
  assert.ok(r.ok);
  assert.ok(ids(r).includes('debate'));
});
t('전문가 역할 감지', () => {
  assert.ok(ids(C.analyze('당신은 이 분야에서 20년 경력을 가진 최고 수준의 전문가입니다. 37×43을 계산해 줘')).includes('persona'));
});
t('다수 의견 감지', () => {
  assert.ok(ids(C.analyze('대부분의 사람들은 이 주장에 동의할까요? 어떻게 생각할지 말해 주세요.')).includes('majority'));
});
t('구체적 이미지 요청 감지', () => {
  const r = C.analyze('동아리 포스터를 만들어줘. 파스텔톤 하늘색과 노란색 배색, 상단에 큰 글씨로 "프레임 속으로", 중앙에는 카메라를 든 사람, 산뜻한 느낌으로.');
  assert.ok(ids(r).includes('specific'), JSON.stringify(r.signals));
});
t('막연한 이미지 요청 감지', () => {
  assert.ok(ids(C.analyze('동아리 포스터 만들어줘')).includes('vague'));
});
t('신호 없는 질문은 신호 0개', () => {
  const r = C.analyze('1부터 100까지 자연수의 제곱의 합을 구해 줘');
  assert.ok(r.ok);
  assert.strictEqual(r.signals.length, 0);
});
t('평범한 글의 "A는 B"는 토론으로 오인하지 않음', () => {
  assert.strictEqual(ids(C.analyze('a는 b보다 크다. 이 부등식을 증명해 줘')).length, 0);
});

t('선행 연구 기반 신호 3개 감지', () => {
  assert.ok(ids(C.analyze('단계별로 생각해서 37 곱하기 43을 풀어 줘')).includes('cot'));
  assert.ok(ids(C.analyze('예를 들어 입력: 사과 출력: apple. 이제 바나나를 번역해 줘')).includes('fewshot'));
  assert.ok(ids(C.analyze('제 생각에는 이 정책이 맞는데 어떻게 생각해?')).includes('opinion'));
});
t('선행 연구 신호는 lit 표시가 있고 이번 실험 수치는 쓰지 않음', () => {
  for (const id of ['cot', 'fewshot', 'opinion']) assert.strictEqual(C.finding(id).lit, true);
  assert.strictEqual(C.finding('debate').lit, undefined);
});

t('관대한 감지: 열린 추천 요청·내 의견·다수 표현', () => {
  assert.ok(ids(C.analyze('게임동아리에서 할만한 행사 같은 거 추천해줘. 더 신박한 거 없나')).includes('brainstorm'));
  assert.ok(ids(C.analyze('요즘 사람들은 이거 많이 쓰나? 내 생각엔 별로인 것 같은데')).includes('majority'));
  assert.ok(ids(C.analyze('요즘 사람들은 이거 많이 쓰나? 내 생각엔 별로인 것 같은데')).includes('opinion'));
});
t('체크리스트는 8칸', () => {
  assert.strictEqual(C.CHECKLIST.length, 8);
});

// ---- 질문 구체화 ----
t('빠진 정보: 막연한 질문은 여러 칸이 비어 있다고 나옴', () => {
  const g = C.gaps('행사 추천해줘').map((x) => x.id);
  assert.ok(g.includes('context') && g.includes('constraints') && g.includes('format'));
});
t('빠진 정보: 조건·형식이 있으면 그 칸은 빠짐', () => {
  const g = C.gaps('우리 동아리(부원 20명)에서 예산 10만 원 이하로 열 행사를 표로 5개 추천해줘. 참여하기 쉬운 걸 가장 중요하게 봐줘.').map((x) => x.id);
  assert.deepStrictEqual(g, []);
});
t('빠진 정보: 이상한 입력은 빈 배열', () => {
  for (const v of [null, undefined, 5, {}, '', '  ']) assert.deepStrictEqual(C.gaps(v), []);
});
t('프롬프트 만들기: 채운 칸만 붙고 빈 칸·긴 값·이상한 입력은 안전', () => {
  const p = C.buildPrompt('행사 추천해줘', { context: '게임 동아리', format: '표로 5개', constraints: '   ' });
  assert.ok(p.startsWith('행사 추천해줘\n\n[추가 정보]'));
  assert.ok(p.includes('- 상황: 게임 동아리') && p.includes('- 형식: 표로 5개'));
  assert.ok(!p.includes('조건'));
  assert.strictEqual(C.buildPrompt('원문', {}), '원문');
  assert.strictEqual(C.buildPrompt('', { context: 'x' }), '');
  assert.strictEqual(C.buildPrompt(null, null), '');
  assert.ok(C.buildPrompt('q', { goal: 'a'.repeat(5000) }).length < 400);
});

// ---- 잘못된 입력에도 멈추지 않음 ----
t('빈 문자열·공백·너무 짧은 입력', () => {
  for (const v of ['', '   ', '\n\n', 'a']) {
    const r = C.analyze(v);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error);
  }
});
t('문자열이 아닌 입력(null, 숫자, 객체, 배열, undefined)', () => {
  for (const v of [null, undefined, 123, {}, [], true]) {
    const r = C.analyze(v);
    assert.strictEqual(r.ok, false);
  }
});
t('아주 긴 입력은 잘라서 점검', () => {
  const r = C.analyze('토론 '.repeat(50000));
  assert.ok(r.ok);
  assert.strictEqual(r.truncated, true);
  assert.strictEqual(r.text.length, C.MAX_LEN);
});
t('제어문자·HTML·이모지가 섞여도 예외 없음', () => {
  const r = C.analyze('\u0000<script>alert(1)</script> 😀 토론해 줘');
  assert.ok(r.ok);
});

// ---- 관찰된 길이 배율 ----
t('배율: 토론이면 논문 비율(3.4/4.3/5.4)을 그대로 돌려줌', () => {
  const o = C.observedRatios(['debate']);
  assert.strictEqual(o.condition, 'D');
  assert.deepStrictEqual(o.rows.map((r) => r.ratio.toFixed(1)), ['3.4', '4.3', '5.4']);
});
t('배율: 전문가 역할이면 P 조건', () => {
  assert.strictEqual(C.observedRatios(['persona']).condition, 'P');
});
t('배율: 토론·역할 신호가 없으면 null (예측하지 않음)', () => {
  assert.strictEqual(C.observedRatios([]), null);
  assert.strictEqual(C.observedRatios(['majority', 'specific']), null);
  assert.strictEqual(C.observedRatios(undefined), null);
});
t('배율: 토론+역할 조합은 안 해 본 조합으로 표시', () => {
  assert.strictEqual(C.observedRatios(['debate', 'persona']).untestedCombo, true);
});

// ---- 문장 생성 ----
t('모든 신호 id에 논문 결과 문장이 있음', () => {
  for (const id of C.SIGNAL_IDS) {
    const f = C.finding(id);
    assert.ok(f && f.title && f.verdict && f.lines.length && f.advice, id);
  }
});
t('개선 제안은 신호가 없어도 한 줄 이상', () => {
  assert.ok(C.ruleSuggestions(C.analyze('안녕하세요 오늘 날씨 알려줘')).length >= 1);
  assert.deepStrictEqual(C.ruleSuggestions(C.analyze('')), []);
});

console.log('\n' + n + '개 모두 통과');
