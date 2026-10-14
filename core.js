/*
 * 프롬프트 신호 점검기 — 핵심 로직 (브라우저와 Node 양쪽에서 동작)
 *
 * 논문: 「프롬프트에 곁들인 신호는 AI의 답을 바꾸는가?
 *        ChatGPT·Gemini·Claude 세 AI에 대한 반복 실험」 (유지원, 2026-10-06)
 *
 * 아래 PAPER의 모든 숫자는 논문 표에서 그대로 옮겼다(표 번호를 옆에 적음).
 * 숫자를 바꾸려면 논문이 아니라 이 상수만 고치면 되고, tests/core.test.js가 논문 값과 어긋나면 알려 준다.
 */
(function (root) {
  'use strict';

  var MAX_LEN = 4000; // 이보다 긴 입력은 잘라서 점검한다(멈추지 않게)

  var PAPER = {
    title: '프롬프트에 곁들인 신호는 AI의 답을 바꾸는가?',
    subtitle: 'ChatGPT·Gemini·Claude 세 AI에 대한 반복 실험',
    pdf: 'https://gamedh823-cmd.github.io/T10/paper.pdf',
    scope:
      '이 수치는 계산·세기 문제 10개를 모델·조건당 10회씩 푼 실험(포스터 실험은 조건당 5장)에서 나왔습니다. ' +
      '다른 종류의 질문에는 그대로 확장할 수 없고, 대부분의 p값은 참고용입니다.',
    ais: {
      chatgpt: { name: 'ChatGPT' },
      gemini: { name: 'Gemini' },
      claude: { name: 'Claude' }
    },
    // 표 14·18: 응답 글자 수 평균. C=아무 신호 없음(통제), P=전문가 역할 한 줄, D=두 전문가 토론 지시
    length: {
      chatgpt: { C: 210.6, P: 250.1, D: 713.6 },
      gemini: { C: 432.9, P: 441.0, D: 1865.1 },
      claude: { C: 273.6, P: 300.2, D: 1483.0 }
    },
    // 표 14: 10문제 중 정답 수
    correct: {
      chatgpt: { C: 9, P: 8, D: 9 },
      gemini: { C: 10, P: 10, D: 10 },
      claude: { C: 10, P: 10, D: 10 }
    },
    // 표 15: 검증 표현 평균(검산·재확인 등)
    verify: {
      chatgpt: { C: 0.6, P: 1.4, D: 4.0 },
      gemini: { C: 1.6, P: 1.8, D: 9.3 },
      claude: { C: 1.0, P: 0.9, D: 7.1 }
    },
    // 표 9: 포스터 5장끼리의 색 다양성 (A=구체적 설명, B=그냥 요청)
    diversity: {
      chatgpt: { A: 0.113, B: 0.448 },
      gemini: { A: 0.25, B: 0.421 },
      claude: { A: 0.527, B: 0.587 }
    },
    // 표 12: 육교 딜레마 입장(찬성/유보/반대), X=개인 의견, Y=다수 의견
    majority: {
      chatgpt: { X: [1, 3, 6], Y: [0, 0, 10], p: 0.087 },
      gemini: { X: [10, 0, 0], Y: [7, 0, 3], p: 0.21 },
      claude: { X: [0, 0, 10], Y: [0, 0, 10], p: 1.0 }
    }
  };

  // ---- 신호 감지 규칙(정규식) ----------------------------------------------
  // 논문은 신호를 "프롬프트에 곁들인 말"로 정의했다. 여기서는 그 말이 들어 있는지만 본다.
  var RULES = {
    debate: /(두|2)\s*명의?\s*(전문가|사람|AI)|토론|반박|찬반|논쟁|서로\s*(다른\s*)?(입장|의견)|장단점\s*(을\s*)?(비교|따져)|반대\s*입장|전문가\s*A\s*(와|과)\s*(전문가\s*)?B|debate|rebut|two experts?|pros and cons/i,
    persona: /(당신|너|넌|네가)\s*(은|는|이)?\s*[^.\n]{0,25}(전문가|경력|엔지니어|교수|박사|변호사|의사|선생|멘토|컨설턴트|기획자|마케터)|\d+\s*년\s*(간\s*)?(차|경력)|전문가(로서|처럼|의\s*입장)|[가-힣A-Za-z ]{1,12}(처럼|입장에서)\s*(답|말|설명|조언|추천|생각)|역할(을)?\s*(맡|해)|you are an? [^.\n]{0,30}(expert|specialist|professor|engineer|consultant)|act as|as an? (expert|professional)/i,
    majority: /(대부분|다수|보통|일반적으로|많은|다들|요즘|사람들)\s*(의\s*)?(사람|이|사람들|들)?[^.\n]{0,14}(동의|생각|반대|찬성|느낄|말할|어떨|많이|선호|좋아|하는|쓰는)|다수\s*의견|인기\s*(있는|많은)|트렌드|most people|majority|what do (most|many) people|popular/i,
    cot: /단계별|차근차근|step[- ]by[- ]step|풀이|생각의?\s*과정|과정(을|도)\s*(설명|보여|써)|이유(를|도)\s*(설명|말|적)|근거(를|도)\s*(설명|들|말|적)|왜\s*그런|let'?s think|explain (your|the) (reasoning|steps)/i,
    fewshot: /예시\s*[:：]|예\s*[:：)]|예를\s*들(어|면)|이런\s*식(으로)?|[\"“'][^\"”']{2,40}[\"”']\s*(처럼|같은\s*(식|느낌))|입력\s*[:：][\s\S]{0,60}출력\s*[:：]|few[- ]shot|example\s*[:：]|for example|such as/i,
    opinion: /(내|제|나의)\s*(생각|의견|느낌|판단)(에는|은|으로는|엔|이)?|나는\s*[^.\n]{0,24}(같|맞|옳|그렇|좋)(다고|은데|아|다)|[가-힣 ]{1,20}인\s*것\s*같은데|아니지\s*않아|맞지\s*않아|I (think|believe|feel) |in my opinion/i,
    brainstorm: /추천|아이디어|브레인스토밍|뭐\s*(할|하면|있)|할\s*만한|없을까|신박|색다른|참신|새로운\s*(거|것|방법)|recommend|ideas?|brainstorm|suggest/i,
    image: /포스터|이미지|그림|일러스트|로고|디자인|배너|썸네일|그려|poster|image|illustration|logo|banner|thumbnail/i
  };
  // 이미지 요청이 "구체적"인지 가늠하는 특징 5개. 논문의 조건 A(색·배치·문구·분위기까지 적음)를 흉내 낸 것.
  var SPECIFIC = {
    color: /파스텔|하늘색|노란|노랑|빨간|빨강|파란|파랑|초록|보라|분홍|주황|검정|흰색|배색|톤|색상|\b#[0-9a-f]{3,6}\b|blue|yellow|red|green|pastel/i,
    layout: /상단|중앙|하단|왼쪽|오른쪽|가운데|배치|위쪽|아래쪽|top|center|bottom|left|right/i,
    quote: /["'“”‘’「」『』][^"'“”‘’「」『』]{2,}["'“”‘’「」『』]/,
    mood: /느낌|분위기|스타일|감성|톤앤매너|vibe|style|mood/i,
    long: null // 글자 수 60자 이상
  };
  var SPECIFIC_MIN = 3; // 5개 중 3개 이상이면 "구체적"

  function clean(input) {
    if (typeof input !== 'string') return '';
    // 제어문자를 지우고 앞뒤 공백을 자른다.
    return input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  }

  // "토론하지 말고", "토론 없이", "don't debate"처럼 신호를 빼 달라는 표현이 붙어 있는지 본다.
  var NEG_AFTER = /^[^.\n]{0,12}?(하지\s*(말|마|않|맙)|말고|말아|빼고|빼\s*줘|빼\s*주|제외|필요\s*(없|하지)|안\s*(해|써|쓰)|금지|없이)/;
  var NEG_BEFORE = /(없이|빼고|제외|no|without|don'?t|do not|never)\s*$/i;

  function isNegated(text, idx, len) {
    var after = text.slice(idx + len, idx + len + 16);
    var before = text.slice(Math.max(0, idx - 10), idx);
    return NEG_AFTER.test(after) || NEG_BEFORE.test(before);
  }

  // 부정되지 않은 첫 일치를 돌려준다. 부정돼서 건너뛴 표현은 skipped에 모은다.
  function firstMatch(re, text, skipped, id) {
    var g = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
    var m;
    while ((m = g.exec(text)) !== null) {
      if (m[0] === '') {
        g.lastIndex++;
        continue;
      }
      if (skipped && isNegated(text, m.index, m[0].length)) {
        skipped.push({ id: id, text: m[0].trim() });
        continue;
      }
      return m[0];
    }
    return null;
  }

  function specificity(text) {
    var hits = [];
    ['color', 'layout', 'quote', 'mood'].forEach(function (k) {
      if (SPECIFIC[k].test(text)) hits.push(k);
    });
    if (text.length >= 60) hits.push('long');
    return hits;
  }

  /**
   * 프롬프트를 점검한다. 예외를 던지지 않고 항상 {ok, ...}를 돌려준다.
   * ok=false이면 error에 사용자에게 보여 줄 문장이 있다.
   */
  function analyze(input) {
    if (typeof input !== 'string') {
      return { ok: false, error: '글자를 입력해 주세요.' };
    }
    var text = clean(input);
    if (!text) return { ok: false, error: '점검할 프롬프트를 붙여 넣어 주세요.' };
    if (text.length < 4) return { ok: false, error: '너무 짧아요. 한 문장 이상 적어 주세요.' };
    var truncated = false;
    if (text.length > MAX_LEN) {
      text = text.slice(0, MAX_LEN);
      truncated = true;
    }

    var signals = [];
    var skipped = [];
    var ev;
    if ((ev = firstMatch(RULES.debate, text, skipped, 'debate'))) signals.push({ id: 'debate', evidence: ev });
    if ((ev = firstMatch(RULES.persona, text, skipped, 'persona'))) signals.push({ id: 'persona', evidence: ev });
    if ((ev = firstMatch(RULES.majority, text, skipped, 'majority'))) signals.push({ id: 'majority', evidence: ev });
    if ((ev = firstMatch(RULES.cot, text, skipped, 'cot'))) signals.push({ id: 'cot', evidence: ev });
    if ((ev = firstMatch(RULES.fewshot, text, skipped, 'fewshot'))) signals.push({ id: 'fewshot', evidence: ev });
    if ((ev = firstMatch(RULES.opinion, text, skipped, 'opinion'))) signals.push({ id: 'opinion', evidence: ev });
    if ((ev = firstMatch(RULES.brainstorm, text, skipped, 'brainstorm'))) signals.push({ id: 'brainstorm', evidence: ev });
    if (RULES.image.test(text)) {
      var spec = specificity(text);
      if (spec.length >= SPECIFIC_MIN) {
        signals.push({ id: 'specific', evidence: firstMatch(RULES.image, text), features: spec });
      } else {
        signals.push({ id: 'vague', evidence: firstMatch(RULES.image, text), features: spec });
      }
    }
    return { ok: true, text: text, length: text.length, truncated: truncated, signals: signals, skipped: skipped };
  }

  /**
   * 논문에서 관찰된 응답 길이 배율. "예측"이 아니라 계산·세기 문제 10개(모델·조건당 10회)에서
   * 신호 없는 조건 대비 평균 글자 수가 몇 배였는지를 그대로 보여 준다.
   * 토론·전문가 역할 신호가 없으면 null (관찰된 변화가 없는 상황).
   */
  function observedRatios(signalIds) {
    var ids = signalIds || [];
    var cond = ids.indexOf('debate') >= 0 ? 'D' : ids.indexOf('persona') >= 0 ? 'P' : null;
    if (!cond) return null;
    return {
      condition: cond,
      untestedCombo: ids.indexOf('debate') >= 0 && ids.indexOf('persona') >= 0,
      rows: Object.keys(PAPER.length).map(function (k) {
        var L = PAPER.length[k];
        return { ai: k, name: PAPER.ais[k].name, from: L.C, to: L[cond], ratio: L[cond] / L.C, correctFrom: PAPER.correct[k].C, correctTo: PAPER.correct[k][cond] };
      })
    };
  }

  function pct(n) {
    return Math.round(n * 100);
  }

  // 신호별 "논문이 밝힌 것" 문장. aiKey를 주면 그 AI 수치를 맨 앞에 둔다.
  function finding(id, aiKey) {
    var P = PAPER;
    var name = aiKey ? P.ais[aiKey].name : null;
    switch (id) {
      case 'debate': {
        var r = Object.keys(P.length).map(function (k) {
          return P.ais[k].name + ' ' + (P.length[k].D / P.length[k].C).toFixed(1) + '배';
        });
        return {
          title: '토론 지시 (두 전문가가 토론하게 함)',
          verdict: '정답률은 안 바뀌고, 답만 3~5배 길어졌어요',
          lines: [
            '정답률: 혼자 풀기와 토론이 세 AI 모두 같았습니다 (Claude 10/10 대 10/10, Gemini 10/10 대 10/10, ChatGPT 9/10 대 9/10). 이 조건에서는 차이가 없다는 것도 결과입니다.',
            '응답 길이: 평균 글자 수가 ' + r.join(', ') + ' 늘었고, 검증 표현도 늘었습니다 (순열검정 p 0.003~0.004, 참고용).',
            '주의: ChatGPT의 한 사례에서는 두 전문가가 같은 틀린 답(8)에 합의했습니다. 토론이 정답을 보장하지 않았습니다.'
          ],
          advice: '정답만 필요하면 토론 지시를 빼는 쪽이 짧고 같은 결과였습니다. 점검 과정이 필요할 때만 쓰세요.'
        };
      }
      case 'persona': {
        var parts = Object.keys(P.length).map(function (k) {
          return P.ais[k].name + ' ' + pct(P.length[k].P / P.length[k].C - 1) + '%';
        });
        return {
          title: '전문가 역할 부여 (“당신은 20년 경력의…”)',
          verdict: '정답률도 말투도 일관되게 안 바뀌었어요',
          lines: [
            '정답 수: Claude·Gemini는 둘 다 10/10이라 차이를 볼 수 없었고, ChatGPT는 9/10에서 8/10이었지만 같은 문제(Q13)를 틀린 사례가 섞여 역할 때문이라고 읽기 어렵습니다.',
            '응답 길이 변화: ' + parts.join(', ') + ' (ChatGPT만 p=0.007, 지표를 여러 개 본 가운데 하나).',
            '“전문가로서” 같은 자기언급은 세 AI 모두 30건 중 0건이었습니다.'
          ],
          advice: '한 줄짜리 역할 문구를 정확도를 위해 넣는다면 이번 실험에서는 효과를 확인하지 못했습니다. 대신 원하는 형식을 구체적으로 적는 편이 확실합니다.'
        };
      }
      case 'majority': {
        var M = P.majority;
        return {
          title: '다수 의견 프레이밍 (“대부분의 사람들은 …?”)',
          verdict: 'AI마다 반응이 달라서 확정할 수 없어요',
          lines: [
            'ChatGPT: 개인 의견에선 반대 6·유보 3·찬성 1, 다수 의견에선 반대 10 (p=' + M.chatgpt.p + ').',
            'Gemini: 찬성 10에서 7로 줄었습니다 (p=' + M.gemini.p + ').',
            'Claude: 두 질문이 완전히 같았습니다 (p=' + M.claude.p + ').',
            '같은 문장에 대한 AI 간 기본 입장 차이(Gemini 찬성 10, Claude 반대 10)가 질문 틀을 바꾼 효과보다 훨씬 컸습니다.'
          ],
          advice: '“다수가 어떻게 생각하나”는 내 의견을 묻는 것과 다른 질문일 수 있습니다. 의견을 알고 싶다면 질문을 하나로 정해서 묻고, 답이 AI마다 갈린다는 점을 감안하세요.'
        };
      }
      case 'specific': {
        var D = P.diversity;
        var line = Object.keys(D).map(function (k) {
          return P.ais[k].name + ' ' + D[k].B.toFixed(3) + ' → ' + D[k].A.toFixed(3);
        });
        return {
          title: '구체적인 이미지 요청 (색·위치·문구를 모두 적음)',
          verdict: '같은 요청을 여러 번 하면 결과가 서로 비슷해졌어요',
          lines: [
            '포스터 5장끼리의 색 다양성(0이면 같은 색 구성, 1에 가까울수록 다름) — 그냥 요청 → 구체적 설명: ' + line.join(', ') + '.',
            '세 AI 모두 낮아졌지만 정도는 달랐습니다. Claude는 거의 차이가 없었습니다(0.587 → 0.527).',
            '다양성 지표는 이 연구가 정한 것이고, 조건당 5장입니다.'
          ],
          advice: '결과를 일관되게 만들고 싶다면 구체적 설명이 맞는 방법입니다. 서로 다른 시안이 필요하면 색·배치 중 일부를 비워 두세요.'
        };
      }
      case 'brainstorm':
        return {
          lit: true,
          title: '열린 추천·아이디어 요청 (“뭐 할 만한 거 없을까?”)',
          verdict: '조건을 적을수록 답이 비슷해지고, 비울수록 다양해져요 (이미지 실험에서 유추)',
          lines: [
            '이번 논문은 글로 된 아이디어 요청을 직접 실험하지 않았습니다.',
            '다만 포스터 실험(H1)에서 구체적으로 설명할수록 같은 요청의 결과가 서로 비슷해졌습니다(색 다양성 ChatGPT 0.448 → 0.113). 아이디어 요청에도 같은 경향이 있을지는 확인되지 않았습니다.'
          ],
          advice: '다양한 후보가 필요하면 조건을 최소로 두고 여러 번 물어보고, 하나로 좁힐 때는 예산·인원·기간 같은 조건을 넣으세요.'
        };
      case 'cot':
        return {
          lit: true,
          title: '풀이 과정 요구 (“단계별로 생각해 줘”)',
          verdict: '선행 연구에서 추론이 좋아졌다고 보고된 방식이에요',
          lines: [
            '이번 논문은 이 신호를 따로 실험하지 않았습니다. 모든 조건에서 풀이 과정을 자유롭게 쓰게 했기 때문에 비교할 수 없었습니다.',
            '선행 연구(Wei et al., 2022)는 풀이 과정을 쓰게 하는 chain-of-thought가 추론을 개선한다고 보고했습니다.'
          ],
          advice: '계산·논리 문제에서는 쓸 만한 신호로 알려져 있습니다. 다만 같은 문제를 풀 때 토론 지시처럼 답이 길어질 수 있습니다.'
        };
      case 'fewshot':
        return {
          lit: true,
          title: '예시 제시 (few-shot)',
          verdict: '선행 연구에서 과제 수행의 기본 방법으로 자리 잡은 방식이에요',
          lines: [
            '이번 논문의 텍스트 실험(H2~H4)은 예시를 넣지 않았습니다. 예시는 포스터 요청의 구체적 설명(H1)에서만 다루었습니다.',
            '선행 연구(Brown et al., 2020)는 프롬프트에 예시를 주는 few-shot이 모델이 과제를 수행하는 기본 방법이 되었다고 보고했습니다.'
          ],
          advice: '예시를 주면 그 형식을 따라 하는 경향이 큽니다. 다양한 답을 원하면 예시를 두세 개 서로 다르게 주세요.'
        };
      case 'opinion':
        return {
          lit: true,
          title: '내 의견을 먼저 밝힘 (“제 생각에는 …”)',
          verdict: 'AI가 내 생각에 맞춰 줄 수 있어요 (아첨 경향)',
          lines: [
            '이번 논문은 내 의견을 먼저 밝히는 조건을 실험하지 않았습니다. 다수 의견 프레이밍(H2)만 다루었습니다.',
            '선행 연구(Sharma et al., 2024)는 AI가 사용자의 견해에 맞추는 경향(아첨)이 있다고 보고했습니다.'
          ],
          advice: '객관적인 판단이 필요하면 내 의견을 빼고 물어보고, 반대 입장의 근거도 함께 요청해 보세요.'
        };
      case 'vague': {
        var D2 = P.diversity;
        return {
          title: '짧고 막연한 이미지 요청',
          verdict: '같은 요청을 여러 번 하면 시안이 다양하게 나왔어요',
          lines: [
            '그냥 요청한 포스터 5장의 색 다양성: ChatGPT ' + D2.chatgpt.B.toFixed(3) + ', Gemini ' + D2.gemini.B.toFixed(3) + ', Claude ' + D2.claude.B.toFixed(3) + ' (구체적으로 쓴 경우보다 모두 높음).'
          ],
          advice: '여러 시안을 보고 고르려는 단계에 알맞습니다. 하나로 정했다면 색·배치·문구를 적어 일관되게 만드세요.'
        };
      }
      default:
        return null;
    }
  }

  // 규칙 기반 개선 제안(LLM 없이 항상 동작). 프록시가 실패해도 이 결과를 보여 준다.
  function ruleSuggestions(analysis) {
    var out = [];
    if (!analysis || !analysis.ok) return out;
    var ids = analysis.signals.map(function (s) {
      return s.id;
    });
    if (ids.indexOf('debate') >= 0)
      out.push('정답만 필요하면 토론 지시를 지우고 “풀이 후 마지막 줄에 정답만 적어 줘”로 바꿔 보세요. 답이 3~5배 짧아집니다.');
    if (ids.indexOf('persona') >= 0)
      out.push('역할 한 줄 대신 “무엇을, 어떤 형식으로, 몇 줄로”를 적으면 말투 변화를 기대하지 않아도 됩니다.');
    if (ids.indexOf('majority') >= 0)
      out.push('“대부분의 사람들은”을 빼고 “이 주장에 동의하나요? 근거 두 가지와 반대 의견 한 가지를 적어 줘”처럼 한 질문으로 묻어 보세요.');
    if (ids.indexOf('specific') >= 0)
      out.push('여러 시안이 필요하면 색 지시를 한 가지만 남기고 배치는 비워 두세요.');
    if (ids.indexOf('brainstorm') >= 0)
      out.push('아이디어를 넓게 받으려면 조건을 비워 두고 “서로 다른 5가지”를 요청하고, 고른 뒤에 예산·인원·기간으로 좁히세요.');
    if (ids.indexOf('cot') >= 0)
      out.push('풀이 과정을 요구하면 계산·논리 문제에 도움이 된다고 알려져 있지만 답이 길어집니다. 결과만 필요하면 “마지막 줄에 정답만” 한 줄을 더하세요.');
    if (ids.indexOf('fewshot') >= 0)
      out.push('예시를 두세 개 서로 다르게 주면 하나의 형식에 갇히는 것을 줄일 수 있습니다.');
    if (ids.indexOf('opinion') >= 0)
      out.push('내 의견을 빼고 물은 뒤 “반대 입장의 근거도 알려 줘”를 덧붙여 AI가 내 생각에 맞추는 것을 줄여 보세요.');
    if (ids.indexOf('vague') >= 0)
      out.push('하나로 정할 단계라면 색(2가지), 배치(위·중앙·아래), 넣을 문구를 한 문장씩 더하세요.');
    var miss = gaps(analysis.text).map(function (g) {
      return g.label;
    });
    if (miss.length)
      out.push('질문에 빠진 정보: ' + miss.join(', ') + '. 아는 것만 한 줄씩 더하면 AI가 방향을 덜 헤매고 원하는 답에 가까워집니다.');
    if (!out.length)
      out.push('논문이 다룬 네 가지 신호가 없는 깔끔한 프롬프트입니다. 목적(무엇을, 어떤 형식으로)이 한 문장에 들어 있는지만 확인하세요.');
    return out;
  }

  // ---- 질문 구체화 가이드 ---------------------------------------------------
  // 논문 수치가 아니라 일반적인 프롬프트 작성 요령이다. 근거는 두 가지뿐이다:
  // (1) 포스터 실험(H1): 구체적으로 설명할수록 같은 요청의 결과가 일관됐다.
  // (2) 선행 연구(Sclar et al., 2024): 프롬프트 형식의 사소한 차이가 결과를 크게 바꿀 수 있다.
  var GAPS = [
    { id: 'context', key: '상황', label: '상황·대상', q: '누가, 어떤 상황에서 쓰나요?', ph: '예: 대학 게임 동아리, 부원 20명, 초보도 참여', re: /우리|저는|제가|내가|나는|동아리|학교|회사|팀|상황|배경|대상|초보|학생|직장|고객|친구|가족|사용자|for (a|an|my|our)/i },
    { id: 'goal', key: '원하는 결과', label: '원하는 결과', q: '답으로 정확히 무엇을 얻고 싶나요?', ph: '예: 이번 학기에 열 행사 3개와 각각의 진행 방식', re: /알려|추천|만들|써\s*줘|작성|설명|정리|요약|비교|풀어|계산|번역|구해|해\s*줘|해\s*주세요|\?|tell me|write|explain|list/i, minLen: 25 },
    { id: 'constraints', key: '조건', label: '조건·제약', q: '지켜야 할 조건이 있나요? (예산·인원·기간·장소 등)', ph: '예: 예산 10만 원 이하, 3주 안에, 교내에서', re: /예산|인원|기간|시간|장소|조건|제한|이하|이상|까지|안에|\d+\s*(명|원|일|주|분|시간|개월)|within|budget|deadline/i },
    { id: 'format', key: '형식', label: '답의 형식', q: '답을 어떤 모양으로 받고 싶나요?', ph: '예: 표로, 항목마다 한 줄 설명, 총 5개', re: /줄|문장|표|목록|리스트|단계|글자|개조식|형식|분량|\d+\s*(개|가지|줄|문장|자)|bullet|table|json|format/i },
    { id: 'criteria', key: '고르는 기준', label: '고르는 기준', q: '여러 후보 중 무엇을 가장 중요하게 보나요?', ph: '예: 참여하기 쉬운 것, 준비가 적은 것 우선', re: /기준|우선|중요|가장|제일|장단점|비교|고려|특히|priority|criteria/i }
  ];

  /** 빠진 정보 목록. 항상 배열을 돌려주고, 입력이 이상하면 빈 배열이다. */
  function gaps(input) {
    var text = clean(typeof input === 'string' ? input : '');
    if (text.length < 4) return [];
    return GAPS.filter(function (g) {
      if (g.minLen && text.length < g.minLen) return true;
      return !g.re.test(text);
    }).map(function (g) {
      return { id: g.id, key: g.key, label: g.label, q: g.q, ph: g.ph };
    });
  }

  var api = {
    PAPER: PAPER,
    MAX_LEN: MAX_LEN,
    SIGNAL_IDS: ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm'],
    // 화면의 체크리스트용: 'vague'는 'specific'과 같은 칸(이미지 요청의 구체성)을 쓴다.
    CHECKLIST: [
      { id: 'debate', label: '토론 지시', own: true },
      { id: 'persona', label: '전문가 역할', own: true },
      { id: 'majority', label: '다수 의견', own: true },
      { id: 'image', label: '이미지 요청 구체성', own: true, ids: ['specific', 'vague'] },
      { id: 'cot', label: '풀이 과정 요구' },
      { id: 'fewshot', label: '예시 제시' },
      { id: 'opinion', label: '내 의견 먼저' },
      { id: 'brainstorm', label: '열린 추천 요청' }
    ],
    analyze: analyze,
    gaps: gaps,
    observedRatios: observedRatios,
    finding: finding,
    ruleSuggestions: ruleSuggestions
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSC = api;
})(typeof window !== 'undefined' ? window : globalThis);
