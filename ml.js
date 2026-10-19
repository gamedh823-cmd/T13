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

  var api = { predict: predict, charWbNgrams: charWbNgrams };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSCML = api;
})(typeof window !== 'undefined' ? window : globalThis);
