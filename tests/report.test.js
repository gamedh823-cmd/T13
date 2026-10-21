// 정확도 보고서(eval/report.js)가 최신 모델·라벨과 일치하는지 확인한다. 실행: node tests/report.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compute } = require('../eval/report.js');
const ML = require('../ml.js');

const dir = path.join(__dirname, '..', 'eval');
let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log('통과  ' + name);
}

const fresh = compute();

t('저장된 report.json이 지금 모델·라벨로 다시 계산한 결과와 같다(모델을 바꾸면 npm 없이 node eval/report.js로 갱신)', () => {
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  assert.deepStrictEqual(saved, fresh);
});
t('report_data.js가 report.json과 같은 내용이다', () => {
  const js = fs.readFileSync(path.join(dir, 'report_data.js'), 'utf8');
  assert.ok(js.startsWith('window.PSC_REPORT='));
  assert.deepStrictEqual(JSON.parse(js.slice('window.PSC_REPORT='.length).replace(/;\s*$/, '')), fresh);
});
t('확신도 구간 기준이 ml.js의 임계값과 같고, 구간마다 맞은 수가 판정 수를 넘지 않는다', () => {
  assert.strictEqual(fresh.threshold, ML.THRESHOLD);
  assert.strictEqual(fresh.weak, ML.WEAK);
  assert.strictEqual(fresh.calibration.length, 3);
  for (const c of fresh.calibration) assert.ok(c.right <= c.n && c.n > 0, c.label);
});
t('보고서 지표가 0~1 범위이고 개발용 학습 모델이 예전 규칙보다 낮지 않다', () => {
  for (const m of [fresh.dev.rules, fresh.dev.model, fresh.valUnseen, fresh.valHand, fresh.real]) {
    assert.ok(m.precision >= 0 && m.precision <= 1 && m.recall >= 0 && m.recall <= 1 && m.f1 >= 0 && m.f1 <= 1);
  }
  assert.ok(fresh.dev.model.f1 >= fresh.dev.rules.f1);
});

console.log('\n' + n + '개 모두 통과');
