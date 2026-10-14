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

// ---- 예상 길이 ----
t('예상 길이: 토론이면 논문 비율만큼 늘어남 (Claude, 평소 300자)', () => {
  const e = C.estimateLength('claude', ['debate'], 300);
  assert.ok(e.ok);
  assert.strictEqual(e.condition, 'D');
  assert.strictEqual(e.estimate, Math.round((300 * 1483.0) / 273.6));
});
t('예상 길이: 평소 길이를 안 쓰면 논문 평균 사용', () => {
  const e = C.estimateLength('gemini', [], '');
  assert.ok(e.ok);
  assert.strictEqual(e.estimate, 433);
});
t('예상 길이: 잘못된 숫자·AI는 오류 메시지', () => {
  assert.strictEqual(C.estimateLength('claude', [], 'abc').ok, false);
  assert.strictEqual(C.estimateLength('claude', [], -5).ok, false);
  assert.strictEqual(C.estimateLength('claude', [], 1e9).ok, false);
  assert.strictEqual(C.estimateLength('nope', [], 100).ok, false);
});
t('예상 길이: 토론+역할 조합은 안 해 본 조합으로 표시', () => {
  assert.strictEqual(C.estimateLength('claude', ['debate', 'persona'], 100).untestedCombo, true);
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
