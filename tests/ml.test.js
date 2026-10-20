// 학습 모델 연결(ml.js)과 앱이 쓰는 combine()을 확인한다. 실행: node tests/ml.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const ML = require('../ml.js');
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'train', 'model.json'), 'utf8'));
const js = fs.readFileSync(path.join(__dirname, '..', 'train', 'model.js'), 'utf8');
let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log('통과  ' + name);
}
const ids = (a) => a.signals.map((s) => s.id);
const run = (text) => ML.combine(C.analyze(text), model);

t('model.js와 model.json의 내용이 같다', () => {
  assert.ok(js.startsWith('window.PSC_MODEL='));
  assert.deepStrictEqual(JSON.parse(js.slice('window.PSC_MODEL='.length).replace(/;\s*$/, '')), model);
});
t('열린 추천: 방법을 묻는 "없을까"는 열린 추천이 아님', () => {
  for (const q of ['엑셀에서 중복값 지우는 방법이 없을까?', '영어 단어 빨리 외우는 새로운 방법 알려줘', '추천 시스템이 어떻게 동작하는지 설명해 줘']) {
    assert.ok(!ids(run(q)).includes('brainstorm'), q);
  }
});
t('열린 추천: 후보·이름·장소를 구하는 요청은 열린 추천', () => {
  for (const q of ['고양이 이름 후보 좀 지어 줘', '주말에 데이트 갈 만한 곳 추천해 줘', '동아리 MT 때 할 만한 게임 뭐 있을까?']) {
    assert.ok(ids(run(q)).includes('brainstorm'), q);
  }
});
t('부정 표현과 신호 없는 문장은 신호 0개', () => {
  assert.deepStrictEqual(ids(run('토론하지 말고 답만 알려줘')), []);
  assert.deepStrictEqual(ids(run('서울에서 부산까지 KTX로 얼마나 걸려?')), []);
});
t('이미지 요청은 specific과 vague가 동시에 나오지 않음', () => {
  for (const q of ['카페 포스터 하나만 만들어줘', '가을 포스터 만들어줘. 베이지 배경, 상단에 "책 읽는 가을", 가운데 단풍잎, 따뜻한 분위기']) {
    const r = ids(run(q));
    assert.ok(!(r.includes('specific') && r.includes('vague')), q);
  }
});
t('모델이 없거나 입력이 이상해도 규칙 결과를 그대로 돌려줌(멈추지 않음)', () => {
  const a = C.analyze('두 명의 전문가가 토론하는 형식으로 풀어 줘');
  assert.strictEqual(ML.combine(a, null), a);
  assert.strictEqual(ML.combine(a, {}), ML.combine(a, {})); // 빈 모델 객체도 예외 없음
  assert.deepStrictEqual(ML.combine({ ok: false, error: 'x' }, model), { ok: false, error: 'x' });
  assert.strictEqual(ML.combine(null, model), null);
});
t('모델이 찾은 신호에는 evidence가 없을 수 있고, 규칙이 찾은 표현이 있으면 그대로 쓴다', () => {
  const a = run('두 명의 전문가가 토론하는 형식으로 7의 222제곱을 13으로 나눈 나머지를 구해 줘');
  const d = a.signals.find((s) => s.id === 'debate');
  assert.ok(d && typeof d.evidence === 'string');
  assert.strictEqual(a.engine, 'model');
});
t('모든 신호 id에 논문 결과 문장이 있다(모델이 내는 id와 화면 카드가 맞음)', () => {
  for (const id of model.signals) assert.ok(C.finding(id), id);
});

console.log('\n' + n + '개 모두 통과');
