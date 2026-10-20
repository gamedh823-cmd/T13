// 라벨 세트와 채점 도구가 정상인지 확인한다. 실행: node tests/eval.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const labels = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'labels.json'), 'utf8'));
const VALID = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm'];
let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log('통과  ' + name);
}

t('라벨 id가 모두 다르고 문장이 비어 있지 않다', () => {
  assert.strictEqual(new Set(labels.map((l) => l.id)).size, labels.length);
  assert.ok(labels.every((l) => typeof l.text === 'string' && l.text.trim().length >= 4));
});
t('정답 신호는 알려진 id뿐이고 중복이 없다', () => {
  for (const l of labels) {
    assert.ok(l.signals.every((s) => VALID.includes(s)), l.id);
    assert.strictEqual(new Set(l.signals).size, l.signals.length, l.id);
  }
});
t('개발용과 보류용이 나뉘어 있고 같은 문장이 양쪽에 없다', () => {
  const dev = labels.filter((l) => l.split === 'dev').map((l) => l.text);
  const hold = labels.filter((l) => l.split === 'holdout').map((l) => l.text);
  assert.ok(dev.length >= 60 && hold.length >= 10);
  assert.ok(hold.every((x) => !dev.includes(x)));
});
t('모든 신호에 정답 문장이 있다', () => {
  for (const s of VALID) assert.ok(labels.some((l) => l.signals.includes(s)), s);
});
t('채점은 같은 입력에 같은 결과를 낸다', () => {
  const run = () => execFileSync('node', [path.join(__dirname, '..', 'eval', 'score.js'), 'dev'], { encoding: 'utf8' });
  assert.strictEqual(run(), run());
});
t('실제 사용 문장 세트가 형식에 맞고 개발·보류용 문장과 겹치지 않는다', () => {
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'real_use.json'), 'utf8'));
  assert.ok(real.length >= 1);
  assert.ok(real.every((r) => typeof r.text === 'string' && Array.isArray(r.signals) && r.signals.every((s) => VALID.includes(s))));
  const lab = new Set(labels.map((l) => l.text));
  assert.ok(real.every((r) => !lab.has(r.text)));
});

console.log('\n' + n + '개 모두 통과');
