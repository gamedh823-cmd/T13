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
      $('fb-card').hidden = true;
      $('tabs').hidden = true;
      $('pane-fix').hidden = true;
      $('tab-fix').hidden = true;
      $('tab-fb').hidden = true;
      $('fb-open-card').hidden = true;
      setPane('check');
      return;
    }
    $('result').hidden = false;
    var found = {};
    var prob = {};
    a.signals.forEach(function (s) {
      found[s.id] = true;
      if (typeof s.prob === 'number') prob[s.id] = s.prob;
    });
    var weakIds = {};
    (a.weak || []).forEach(function (w) {
      weakIds[w.id] = w.prob;
    });
    var grid = el('div', 'check');
    var hit = 0;
    PSC.CHECKLIST.forEach(function (c) {
      var ids = c.ids || [c.id];
      var on = ids.some(function (i) {
        return found[i];
      });
      if (on) hit++;
      var wk = !on && ids.some(function (i) {
        return weakIds[i] !== undefined;
      });
      var chip = el('span', 'ck' + (on ? ' on' : '') + (wk ? ' weak' : '') + (c.own ? '' : ' lit'), (on ? '✔ ' : wk ? '△ ' : '– ') + c.label);
      var info = FB_INFO[(c.ids || [c.id])[0]];
      if (info) chip.title = info[0] + ' (예: ' + info[1] + ')';
      grid.appendChild(chip);
    });
    var nWeak = Object.keys(weakIds).length;
    box.appendChild(el('p', 'sum', PSC.CHECKLIST.length + '가지 신호 중 ' + hit + '가지가 이 프롬프트에 있어요' + (nWeak ? ' (약한 신호 ' + nWeak + '가지)' : '')));
    box.appendChild(grid);
    box.appendChild(el('p', 'note', '진한 칸은 이번 논문이 직접 실험한 신호 4가지, 옅은 칸은 선행 연구에서 가져온 신호 4가지입니다.' + (nWeak ? ' △는 확률이 낮아 확정하지 않은 약한 신호예요(' + Object.keys(weakIds).map(function (k) { return k + ' ' + Math.round(weakIds[k] * 100) + '%'; }).join(', ') + ').' : '')));
    if (a.skipped && a.skipped.length) {
      var seen = {};
      var parts = [];
      a.skipped.forEach(function (k) {
        if (!seen[k.text]) {
          seen[k.text] = 1;
          parts.push('“' + k.text + '”');
        }
      });
      box.appendChild(el('p', 'note', '빼 달라는 표현이 붙어 있어 신호로 세지 않았어요: ' + parts.join(', ')));
    }
    if (!a.signals.length) {
      var snip = a.text.replace(/\s+/g, ' ').trim();
      if (snip.length > 40) snip = snip.slice(0, 40) + '…';
      box.appendChild(
        el('div', 'none', '입력하신 “' + snip + '”에는 위 8가지 신호가 없어서, 논문이 비교한 기준(신호 없음) 조건과 같아요. 이 문장처럼 곁들인 말 없이 사실이나 정보를 묻는 질문은 보통 신호가 없어요. 신호가 없는 건 나쁜 게 아니라 “곁들인 말 때문에 답이 달라질 일이 없다”는 뜻이에요. 위의 예시 버튼으로 각 신호가 어떻게 잡히는지 볼 수 있어요.')
      );
    }
    a.signals.forEach(function (s) {
      var f = PSC.finding(s.id);
      var card = el('div', 'sig');
      if (f.lit) card.appendChild(el('span', 'tag', '선행 연구 기반 · 이번 실험 아님'));
      card.appendChild(el('h3', '', f.title));
      card.appendChild(el('p', 'found', (s.evidence ? '찾은 표현: “' + s.evidence + '”' : '문장 전체의 맥락으로 판단했어요 (학습한 모델)') + (typeof s.prob === 'number' ? ' · 확신도 ' + Math.round(s.prob * 100) + '%' : '')));
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
    renderFeedback();
    renumber();
    var ul2 = $('rules');
    clear(ul2);
    PSC.ruleSuggestions(a).forEach(function (t) {
      ul2.appendChild(el('li', '', t));
    });
    $('llm').hidden = true;
    $('tabs').hidden = true;
    $('pane-fix').hidden = true;
    $('tab-fix').hidden = true;
    $('tab-fb').hidden = true;
    $('fb-open-card').hidden = false;
    setPane('check');
  }

  function setPane(name) {
    document.querySelector('.wrap').setAttribute('data-view', name);
    ['check', 'fix', 'fb'].forEach(function (k) {
      $('tab-' + k).classList.toggle('on', k === name);
    });
  }

  function renumber() {
    var i = 1;
    document.querySelectorAll('.card').forEach(function (c) {
      var n = c.querySelector('h2 .n');
      if (n && !c.hidden) n.textContent = String(i++);
    });
  }

  // ---- 판정 신고: 맞는 신호를 골라 JSON 한 줄로 복사한다(서버로 보내지 않음) ----
  var FB_LABELS = {
    debate: '토론 지시', persona: '전문가 역할', majority: '다수 의견', specific: '이미지(구체적)', vague: '이미지(막연)',
    cot: '풀이 과정', fewshot: '예시', opinion: '내 의견', brainstorm: '열린 추천'
  };

  // 각 신호의 뜻(한 줄)과 예시. eval/README.md의 라벨 기준과 같은 정의다.
  var FB_INFO = {
    debate: ['두 입장이나 두 전문가가 서로 주장하고 반박하게 하는 요청', '“찬성과 반대가 토론하듯 풀어 줘”'],
    persona: ['AI에게 직업·역할을 주고 그 입장에서 답하게 하는 요청', '“너는 20년 경력 의사야”'],
    majority: ['내 의견이 아니라 “대부분의 사람들은 어떻게 생각해?”를 묻는 질문', '“다들 이걸 어떻게 생각해?”'],
    specific: ['색·배치·문구·분위기 중 3가지 이상을 자세히 적은 이미지 요청', '“하늘색 배경, 위에 큰 제목, 따뜻한 느낌의 포스터”'],
    vague: ['요소를 거의 적지 않은 짧은 이미지 요청', '“카페 포스터 만들어 줘”'],
    cot: ['답만이 아니라 풀이 과정이나 이유를 단계별로 쓰게 하는 요청', '“단계별로 풀이 과정을 보여 줘”'],
    fewshot: ['따라 할 예시나 샘플을 같이 주는 경우', '“입력: 사과 출력: apple 이런 식으로 해 줘”'],
    opinion: ['내 생각을 먼저 말하고 동의나 평가를 구하는 질문', '“내 생각엔 이게 맞는데 어때?”'],
    brainstorm: ['후보·아이디어·이름·장소처럼 여러 선택지를 구하는 요청 (방법을 묻는 건 아님)', '“동아리에서 할 만한 행사 추천해 줘”']
  };

  function renderFeedback() {
    var a = state.analysis;
    var card = $('fb-card');
    var grid = $('fb-grid');
    clear(grid);
    $('fb-done').textContent = '';
    grid.className = 'fblist';
    card.hidden = !(a && a.ok);
    if (!(a && a.ok)) return;
    var now = {};
    a.signals.forEach(function (s) {
      now[s.id] = true;
    });
    Object.keys(FB_LABELS).forEach(function (id) {
      var row = el('label', 'fbrow');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      cb.checked = !!now[id];
      var txt = el('span', 'fbtxt');
      txt.appendChild(el('b', '', FB_LABELS[id]));
      txt.appendChild(el('span', 'fbdesc', FB_INFO[id][0]));
      txt.appendChild(el('span', 'fbex', '예: ' + FB_INFO[id][1]));
      row.appendChild(cb);
      row.appendChild(txt);
      grid.appendChild(row);
    });
  }

  function copyFeedback() {
    var a = state.analysis;
    if (!(a && a.ok)) return;
    var sig = [];
    $('fb-grid').querySelectorAll('input:checked').forEach(function (cb) {
      sig.push(cb.value);
    });
    var line = JSON.stringify({ text: a.text.slice(0, 300), signals: sig, 앱판정: a.signals.map(function (s) { return s.id; }) });
    var done = function (ok) {
      $('fb-done').textContent = ok ? '복사했어요. 개발자에게 붙여 넣어 보내 주세요.' : '복사에 실패했어요. 글자를 직접 선택해 복사해 주세요: ' + line;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(line).then(function () { done(true); }, function () { done(false); });
    } else done(false);
  }

  // ---- 정확도 보고: eval/report.js가 계산한 숫자를 그대로 보여 준다 ----
  function renderReport() {
    var R = window.PSC_REPORT;
    var box = $('report');
    var body = $('report-body');
    if (!R || !box || !body) return;
    clear(body);
    function pct(x) {
      return Math.round(x * 100) + '%';
    }
    body.appendChild(el('p', 'lead', '신호 판정은 학습한 모델이 합니다. 아래 숫자는 학습에 쓰지 않은 문장으로 잰 것이고, 신호 하나 단위(문장 속 신호가 맞게 잡혔는지)로 셉니다.'));
    var t1 = el('table', 'rep');
    var head = el('tr');
    ['기준', '문장 수', '정밀도', '재현율', 'F1'].forEach(function (h) {
      head.appendChild(el('th', '', h));
    });
    t1.appendChild(head);
    [
      ['개발용 라벨 · 예전 규칙(비교용)', R.dev.rules],
      ['개발용 라벨 · 학습 모델(지금 앱)', R.dev.model],
      ['처음 보는 표현(합성)', R.valUnseen],
      ['직접 쓴 새 말투', R.valHand],
      ['실제 사용 문장', R.real]
    ].forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('td', '', row[0]));
      tr.appendChild(el('td', '', String(row[1].n)));
      tr.appendChild(el('td', '', pct(row[1].precision)));
      tr.appendChild(el('td', '', pct(row[1].recall)));
      tr.appendChild(el('td', '', pct(row[1].f1)));
      t1.appendChild(tr);
    });
    body.appendChild(t1);
    body.appendChild(el('p', 'note', '정밀도 = 앱이 잡은 신호 중 맞은 비율, 재현율 = 실제 신호 중 앱이 잡은 비율. 실제 사용 문장은 4개뿐이라 참고용입니다.'));
    body.appendChild(el('h3', 'mini', '확신도별로 실제 얼마나 맞았나'));
    var t2 = el('table', 'rep');
    var h2 = el('tr');
    ['확신도 구간', '판정 수', '맞은 수', '맞은 비율'].forEach(function (h) {
      h2.appendChild(el('th', '', h));
    });
    t2.appendChild(h2);
    R.calibration.forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', '', c.label));
      tr.appendChild(el('td', '', String(c.n)));
      tr.appendChild(el('td', '', String(c.right)));
      tr.appendChild(el('td', '', c.rate === null ? '-' : c.rate + '%'));
      t2.appendChild(tr);
    });
    body.appendChild(t2);
    body.appendChild(el('p', 'note', '확신도 ' + Math.round(R.threshold * 100) + '% 이상이면 신호로 확정하고, ' + Math.round(R.weak * 100) + '~' + Math.round(R.threshold * 100) + '%는 △ 약한 신호로만 보여 줍니다. 약한 신호는 절반 정도만 맞으니 참고만 하세요.'));
    body.appendChild(el('p', 'note', R.note));
    box.hidden = false;
  }

  // ---- 가설 검증 실험 결과: exp/analyze.js가 계산한 숫자를 그대로 보여 준다(파일이 없으면 숨김) ----
  function renderExperiment() {
    var S = window.PSC_EXPERIMENT;
    var box = $('exp');
    var body = $('exp-body');
    if (!S || !box || !body || !S.cond) return;
    clear(body);
    function pct(x) {
      return isFinite(x) ? Math.round(x * 100) + '%' : '-';
    }
    function pp(x) {
      return (x * 100).toFixed(1) + '%p';
    }
    body.appendChild(el('p', 'lead', '답이 정해져 있지 않은 질문(추천·기획·글쓰기·조언) ' + S.n + '개를 세 가지 방식으로 Gemini에게 물었습니다. A 원문, B 원문 + 육하원칙 정보, C 원문 + 논문이 실험한 신호만(전문가 역할·토론·단계별, 정보 없음). 답은 조건을 가린 채 의도 체크리스트로 채점했습니다.'));
    var t1 = el('table', 'rep');
    var head = el('tr');
    ['조건', '체크리스트 충족률', '의도 근접 점수(1~5)', '답변 길이(자)', '프롬프트 길이(자)'].forEach(function (h) {
      head.appendChild(el('th', '', h));
    });
    t1.appendChild(head);
    ['A', 'B', 'C'].forEach(function (c) {
      var r = S.cond[c];
      var tr = el('tr');
      [r.name, pct(r.fulfil), r.score.toFixed(2), String(Math.round(r.chars)), String(Math.round(r.promptChars))].forEach(function (v) {
        tr.appendChild(el('td', '', v));
      });
      t1.appendChild(tr);
    });
    body.appendChild(t1);
    body.appendChild(el('h3', 'mini', '조건 비교 (질문별 짝지은 차이, 95% 신뢰구간)'));
    var t2 = el('table', 'rep');
    var h2 = el('tr');
    ['비교', '평균 차이(충족률)', '95% 신뢰구간', '개선 / 악화 질문', '부호검정 p'].forEach(function (h) {
      h2.appendChild(el('th', '', h));
    });
    t2.appendChild(h2);
    [['fulfil:B-A', 'B − A'], ['fulfil:B-C', 'B − C'], ['fulfil:C-A', 'C − A']].forEach(function (p) {
      var c = S.compare[p[0]];
      if (!c) return;
      var tr = el('tr');
      [p[1], pp(c.mean), '[' + pp(c.lo) + ', ' + pp(c.hi) + ']', c.pos + ' / ' + c.neg, (c.p < 0.001 ? '<0.001' : c.p.toFixed(3))].forEach(function (v) {
        tr.appendChild(el('td', '', v));
      });
      t2.appendChild(tr);
    });
    body.appendChild(t2);
    body.appendChild(el('p', 'note', '체크리스트는 사용자 의도(육하원칙 정보)에서 만들어서 B에 유리한 구조입니다. 그래서 정보 없이 신호만 붙인 C와 비교해, 같은 길이의 말이라도 정보가 있어야 의도에 맞는지를 봅니다. 질문 ' + S.n + '개, 한 AI(Gemini), 의도는 제가 정한 가상 상황, 채점은 Gemini라서 경향으로만 읽어 주세요. 자세한 설계와 한계는 저장소의 docs와 exp/results를 보세요.'));
    box.hidden = false;
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
    if (a.ok && window.PSCML && window.PSC_MODEL) a = window.PSCML.combine(a, window.PSC_MODEL);
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

  // 응답이 "1) 한 줄 진단 … 2) 고친 프롬프트 …" 꼴이면 둘로 나눠 보여 주고, 아니면 통째로 보여 준다.
  function showLlm(out, text) {
    clear(out);
    var m = String(text).split(/\n?\s*2\)\s*고친\s*프롬프트\s*[:：]?\s*/);
    if (m.length >= 2 && m[1].trim()) {
      var dx = m[0].replace(/^\s*1\)\s*한\s*줄\s*진단\s*[:：]?\s*/, '').trim();
      var fx = m.slice(1).join(' ').trim();
      if (dx) {
        out.appendChild(el('p', 'dxl', '한 줄 진단'));
        out.appendChild(el('p', 'dx', dx));
      }
      out.appendChild(el('p', 'dxl', '이렇게 고쳐 보세요'));
      out.appendChild(el('p', 'fx', fx));
      var b = el('button', 'btn primary', '고친 프롬프트 복사');
      b.type = 'button';
      b.addEventListener('click', function () {
        var done = function (ok) {
          b.textContent = ok ? '복사했어요' : '복사 실패: 직접 선택해 주세요';
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fx).then(function () { done(true); }, function () { done(false); });
        } else done(false);
      });
      out.appendChild(b);
    } else {
      out.appendChild(el('p', 'fx', String(text)));
    }
  }

  function ask() {
    var a = state.analysis;
    var out = $('llm');
    var btn = $('ask');
    if (!a || !a.ok) return;
    btn.disabled = true;
    out.hidden = false;
    $('pane-fix').hidden = false;
    $('tabs').hidden = false;
    $('tab-fix').hidden = false;
    $('tab-fb').hidden = false;
    setPane('fix');
    clear(out);
    out.appendChild(el('p', 'dx', '묻는 중… (최대 20초)'));
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, 20000);
    fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: a.text,
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
          showLlm(out, r.body.text);
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

  window.addEventListener('load', function () {
    renderReport();
    renderExperiment();
    setTimeout(function () {
      renderReport();
      renderExperiment();
    }, 800);
  });
  $('run').addEventListener('click', run);
  $('ask').addEventListener('click', ask);
  $('tab-check').addEventListener('click', function () {
    setPane('check');
  });
  $('tab-fix').addEventListener('click', function () {
    setPane('fix');
  });
  $('tab-fb').addEventListener('click', function () {
    setPane('fb');
  });
  $('fb-open').addEventListener('click', function () {
    $('tabs').hidden = false;
    $('tab-fb').hidden = false;
    setPane('fb');
  });
  $('fb-copy').addEventListener('click', copyFeedback);
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
      // 예시는 입력칸만 채운다. 결과는 '점검하기'를 눌러야 나온다.
      state.analysis = null;
      showErr($('err'), '');
      render();
      $('prompt').focus();
    });
  });
})();
