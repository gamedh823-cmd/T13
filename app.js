(function () {
  'use strict';
  var PSC = window.PSC;
  if (!PSC) {
    var warn = document.createElement('p');
    warn.className = 'err';
    warn.textContent = '점검 로직(core.js)을 불러오지 못했어요. Ctrl+F5로 새로고침하고, 파일로 열었다면 폴더 안의 core.js가 index.html 옆에 있는지 확인해 주세요.';
    document.querySelector('.wrap').insertBefore(warn, document.querySelector('.wrap').firstChild);
    return;
  }
  var PROXY_URL = 'https://t13real.vercel.app/api/suggest';
  var EXAMPLES = [
    '두 명의 전문가 A와 B가 토론하는 형식으로 풀어 주세요. A가 먼저 풀고 B가 허점을 반박한 뒤 합의한 답을 내세요. 문제: 7의 222제곱을 13으로 나눈 나머지는?',
    '당신은 이 분야에서 20년 경력을 가진 최고 수준의 전문가입니다. 9876 × 6789는 얼마인가요?',
    '대부분의 사람들은 이 주장에 동의할까요? 대부분의 사람들이 어떻게 생각할지 말해 주세요. 주장: 한 명을 희생해 다섯 명을 구하는 것은 허용된다.',
    '사진 동아리 신입 부원 모집 포스터를 만들어줘. 파스텔톤 하늘색과 노란색 배색, 상단에 큰 글씨로 "프레임 속으로, 함께", 중앙에는 카메라를 든 사람 일러스트, 하단에는 모집 기간을 넣은 산뜻한 느낌으로.'
  ];

  function $(id) {
    return document.getElementById(id);
  }
  // 사용자 입력이 들어갈 수 있는 곳은 모두 textContent로만 쓴다(HTML로 해석하지 않음).
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function showErr(node, msg) {
    node.textContent = msg || '';
    node.hidden = !msg;
  }

  var state = { analysis: null };

  $('scope').textContent = PSC.PAPER.scope;

  function render() {
    var a = state.analysis;
    var box = $('signals');
    clear(box);
    if (!a || !a.ok) {
      $('result').hidden = true;
      $('len-card').hidden = true;
      $('sug-card').hidden = true;
      return;
    }
    $('result').hidden = false;
    if (!a.signals.length) {
      box.appendChild(
        el('div', 'none', '논문이 다룬 네 가지 신호(토론 지시, 전문가 역할, 다수 의견, 이미지 요청의 구체성)를 이 프롬프트에서 찾지 못했어요. 신호가 없는 질문은 논문이 비교한 기준(통제) 조건과 같습니다. 위의 예시 버튼으로 어떤 신호가 잡히는지 볼 수 있어요.')
      );
    }
    a.signals.forEach(function (s) {
      var f = PSC.finding(s.id);
      var card = el('div', 'sig');
      if (f.lit) card.appendChild(el('span', 'tag', '선행 연구 기반 · 이번 실험 아님'));
      card.appendChild(el('h3', '', f.title));
      card.appendChild(el('p', 'found', '찾은 표현: “' + s.evidence + '”'));
      card.appendChild(el('p', 'verdict', f.verdict));
      var ul = el('ul');
      f.lines.forEach(function (l) {
        ul.appendChild(el('li', '', l));
      });
      card.appendChild(ul);
      card.appendChild(el('p', 'advice', '→ ' + f.advice));
      box.appendChild(card);
    });
    if (a.truncated) box.appendChild(el('p', 'note', '입력이 ' + PSC.MAX_LEN + '자를 넘어 앞부분만 점검했어요.'));

    $('sug-card').hidden = false;
    renderLength();
    var ul2 = $('rules');
    clear(ul2);
    PSC.ruleSuggestions(a).forEach(function (t) {
      ul2.appendChild(el('li', '', t));
    });
    $('llm').hidden = true;
  }

  function renderLength() {
    var a = state.analysis;
    var out = $('len-out');
    var card = $('len-card');
    clear(out);
    if (!a || !a.ok) return;
    var o = PSC.observedRatios(a.signals.map(function (s) {
      return s.id;
    }));
    // 토론·역할 신호가 없으면 논문에 관찰값이 없으므로 예측하지 않고 카드를 숨긴다.
    card.hidden = !o;
    $('n3').textContent = o ? '3' : '2';
    if (!o) return;
    var label = o.condition === 'D' ? '토론 지시를 넣었더니' : '전문가 역할을 넣었더니';
    out.appendChild(el('p', 'lead', label + ', 같은 문제의 답 글자 수가 신호 없을 때보다 이렇게 달라졌어요 (조건당 10문제 평균).'));
    var max = Math.max.apply(null, o.rows.map(function (r) { return r.ratio; }).concat([1]));
    var bars = el('div', 'bars');
    o.rows.forEach(function (r) {
      var row = el('div', 'bar on');
      row.appendChild(el('span', '', r.name));
      var track = el('span', 'track');
      var fill = el('span', 'fill');
      fill.style.width = Math.max(3, Math.round((r.ratio / max) * 100)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'v', r.ratio.toFixed(2) + '배'));
      bars.appendChild(row);
      var det = el('p', 'note', r.name + ': 평균 ' + Math.round(r.from).toLocaleString('ko-KR') + '자 → ' + Math.round(r.to).toLocaleString('ko-KR') + '자, 정답 ' + r.correctFrom + '/10 → ' + r.correctTo + '/10');
      det.style.margin = '0 0 4px 0';
      bars.appendChild(det);
    });
    out.appendChild(bars);
    out.appendChild(el('p', 'note', '이것은 내 질문의 답 길이를 맞히는 예측이 아니라, 논문의 계산·세기 문제 실험에서 관찰된 값입니다. 다른 종류의 질문에서는 달라질 수 있어요.'));
    if (o.untestedCombo) out.appendChild(el('p', 'note', '토론 지시와 전문가 역할을 함께 쓴 조합은 실험하지 않아, 토론 수치만 보여 줍니다.'));
  }

  function run() {
    showErr($('err'), '');
    var a = PSC.analyze($('prompt').value);
    if (!a.ok) {
      state.analysis = null;
      showErr($('err'), a.error);
      render();
      return;
    }
    state.analysis = a;
    render();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ask() {
    var a = state.analysis;
    var out = $('llm');
    var btn = $('ask');
    if (!a || !a.ok) return;
    btn.disabled = true;
    out.hidden = false;
    out.textContent = '묻는 중… (최대 20초)';
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, 20000);
    fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: a.text.slice(0, 1500),
        signals: a.signals.map(function (s) {
          return s.id;
        })
      }),
      signal: ctrl.signal
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (r) {
        if (r.ok && r.body && r.body.text) {
          out.textContent = r.body.text;
          return;
        }
        var why = (r.body && r.body.error) || '';
        out.textContent =
          why === 'rate_limited' ? '요청이 너무 잦아요. 1분 뒤에 다시 눌러 주세요. 위 규칙 제안은 그대로 쓸 수 있어요.'
          : why === 'no_key' ? 'AI 제안 기능이 아직 켜져 있지 않아요. 위 규칙 제안을 참고하세요.'
          : '지금은 AI 제안을 받지 못했어요(' + (why || '알 수 없는 오류') + '). 위 규칙 제안을 참고하세요.';
      })
      .catch(function () {
        out.textContent = '서버에 연결하지 못했어요. 인터넷 연결이나 이 파일을 내 컴퓨터에서 연 경우일 수 있어요. 위 규칙 제안을 참고하세요.';
      })
      .then(function () {
        clearTimeout(timer);
        btn.disabled = false;
      });
  }

  $('run').addEventListener('click', run);
  $('ask').addEventListener('click', ask);
  $('prompt').addEventListener('input', function () {
    var n = this.value.length;
    $('count').textContent = n ? n + '자' : '';
  });
  $('prompt').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
  });
  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () {
      $('prompt').value = EXAMPLES[Number(b.getAttribute('data-ex'))] || '';
      $('prompt').dispatchEvent(new Event('input'));
      run();
    });
  });
})();
