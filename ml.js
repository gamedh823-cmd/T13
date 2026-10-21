/*
 * 학습한 신호 분류기를 브라우저와 Node에서 돌린다. (train/train.py가 만든 train/model.json 사용)
 * scikit-learn의 TfidfVectorizer(analyzer='char_wb', ngram_range=(1,4), sublinear_tf=True, 소문자)와
 * 같은 방식으로 글자 n-gram을 세고, 신호별 로지스틱 회귀 점수를 계산한다.
 */
(function (root) {
  'use strict';

  function charWbNgrams(text, minN, maxN) {
    var doc = String(text).toLowerCase().replace(/\s\s+/g, ' ');
    var words = doc.split(/\s+/).filter(function (w) {
      return w.length > 0;
    });
    var grams = [];
    words.forEach(function (w0) {
      var w = ' ' + w0 + ' ';
      for (var n = minN; n <= maxN; n++) {
        var offset = 0;
        grams.push(w.slice(offset, offset + n));
        while (offset + n < w.length) {
          offset++;
          grams.push(w.slice(offset, offset + n));
        }
        if (offset === 0) break; // 단어가 n보다 짧으면 한 번만 센다
      }
    });
    return grams;
  }

  /** 문장 하나에 대해 신호별 확률을 돌려준다. 모델이 이상하면 빈 객체. */
  function predict(model, text) {
    if (!model || !model.vocab || typeof text !== 'string') return {};
    var counts = {};
    charWbNgrams(text, model.ngram[0], model.ngram[1]).forEach(function (g) {
      if (Object.prototype.hasOwnProperty.call(model.vocab, g)) counts[model.vocab[g]] = (counts[model.vocab[g]] || 0) + 1;
    });
    var idx = Object.keys(counts);
    var vals = {};
    var norm = 0;
    idx.forEach(function (i) {
      var v = (1 + Math.log(counts[i])) * model.idf[i];
      vals[i] = v;
      norm += v * v;
    });
    norm = Math.sqrt(norm) || 1;
    var out = {};
    model.signals.forEach(function (s, j) {
      var z = model.intercept[j];
      var row = model.coef[j];
      idx.forEach(function (i) {
        z += (vals[i] / norm) * row[i];
      });
      out[s] = 1 / (1 + Math.exp(-z));
    });
    return out;
  }

  var WEAK = 0.3; // THRESHOLD 미만이어도 이 값 이상이면 "약한 신호"로 따로 보여 준다(확정하지는 않음).
  var THRESHOLD = 0.4; // 이 값 이상이면 신호로 본다. 오탐(엉뚱한 신호)을 줄이려고 개발용 라벨에서 정밀도가 높은 쪽을 골랐다.

  /**
   * 규칙 분석 결과(analysis)에 학습 모델의 판단을 입힌다.
   * 모델이 없거나 이상하면 규칙 결과를 그대로 돌려준다(앱이 멈추지 않게).
   * 모델이 찾은 신호는 "찾은 표현"이 없으면 evidence를 null로 둔다(화면에서 따로 설명).
   */
  function combine(analysis, model, thr) {
    if (!analysis || !analysis.ok || !model) return analysis;
    var t = typeof thr === 'number' ? thr : THRESHOLD;
    var p = predict(model, analysis.text);
    var ids = Object.keys(p);
    if (!ids.length) return analysis;
    var byRule = {};
    analysis.signals.forEach(function (s) {
      byRule[s.id] = s;
    });
    var out = [];
    var weak = [];
    ids.forEach(function (id) {
      if (p[id] < t && p[id] >= WEAK) weak.push({ id: id, prob: p[id] });
      if (p[id] >= t) out.push({ id: id, evidence: byRule[id] ? byRule[id].evidence : null, prob: p[id], features: byRule[id] && byRule[id].features });
    });
    // 이미지 요청은 구체적(specific)과 막연함(vague) 중 하나만 남긴다.
    var sp = out.filter(function (s) { return s.id === 'specific'; })[0];
    var vg = out.filter(function (s) { return s.id === 'vague'; })[0];
    if (sp && vg) out = out.filter(function (s) { return s !== (sp.prob >= vg.prob ? vg : sp); });
    var res = {};
    Object.keys(analysis).forEach(function (k) { res[k] = analysis[k]; });
    // 확정한 이미지 신호(specific/vague)가 이미 있으면 같은 칸의 약한 신호는 지운다.
    var haveImg = out.some(function (s) { return s.id === 'specific' || s.id === 'vague'; });
    weak = weak.filter(function (w) { return !(haveImg && (w.id === 'specific' || w.id === 'vague')); });
    res.signals = out;
    res.weak = weak;
    res.probs = p;
    res.engine = 'model';
    return res;
  }

  var api = { predict: predict, charWbNgrams: charWbNgrams, combine: combine, THRESHOLD: THRESHOLD, WEAK: WEAK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSCML = api;
})(typeof window !== 'undefined' ? window : globalThis);
