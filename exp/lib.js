// 가설 검증 실험의 공용 코드: 프롬프트 만들기, 통계, Gemini 호출.
'use strict';
const fs = require('fs');
const path = require('path');

const FACT_KEYS = ['누가', '언제', '어디서', '무엇을', '왜', '어떻게'];

// 조건 C: 논문이 실험한 신호(전문가 역할, 토론, 단계별, 다수 의견)만 덧붙인다. 새 정보는 없다.
const SIGNAL_TEXT =
  '당신은 이 분야에서 20년 경력을 가진 최고 수준의 전문가입니다. ' +
  '두 명의 전문가가 토론하는 형식으로 서로의 답을 반박하고 검증한 뒤, 단계별로 생각 과정을 보여 주며 최종 답을 정리해 주세요. ' +
  '대부분의 사람들이 좋다고 할 만한 답이면 좋겠습니다.';

/** 조건별 프롬프트. A 원문 / B 원문 + 육하원칙 정보 / C 원문 + 논문의 신호만 */
function buildPrompt(q, cond) {
  if (cond === 'A') return q.original;
  if (cond === 'B') {
    const lines = FACT_KEYS.map((k) => '- ' + k + ': ' + q.facts[k]);
    return q.original + '\n\n[상황 정보]\n' + lines.join('\n');
  }
  if (cond === 'C') return q.original + '\n\n' + SIGNAL_TEXT;
  throw new Error('알 수 없는 조건: ' + cond);
}

/** 채점 프롬프트: 조건을 알려 주지 않는다(블라인드). */
function buildJudgePrompt(q, answer) {
  const facts = FACT_KEYS.map((k) => '- ' + k + ': ' + q.facts[k]).join('\n');
  const checks = q.check.map((c, i) => i + 1 + '. ' + c).join('\n');
  return (
    '아래는 사용자의 실제 상황과, 그 사용자가 받은 AI 답변이다. 답변이 이 사용자의 의도에 얼마나 맞는지 채점해라.\n' +
    '사용자의 실제 상황:\n' + facts + '\n\n체크리스트:\n' + checks + '\n\nAI 답변:\n"""\n' + answer + '\n"""\n\n' +
    '각 체크리스트 항목이 답변에서 충족되는지 엄격하게 true/false로 판단하고, 전체적으로 이 사용자가 원하던 답에 가까운 정도를 1(전혀 아님)~5(매우 가까움)로 매겨라. ' +
    '답변이 상황을 몰라서 일반적으로 쓴 것이라도 체크리스트 기준으로만 판단하라. JSON만 출력: {"checks":[true,false,...],"score":3}'
  );
}

function parseJudge(text, nChecks) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try {
    j = JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(j.checks) || j.checks.length !== nChecks || !j.checks.every((x) => typeof x === 'boolean')) return null;
  const s = Number(j.score);
  if (!Number.isInteger(s) || s < 1 || s > 5) return null;
  return { checks: j.checks, score: s };
}

// ---- 통계 -------------------------------------------------------------
function mean(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
}

// 시드 고정 난수(재현 가능한 부트스트랩)
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 짝지은 차이(질문별 B-A)의 평균과 95% 신뢰구간(부트스트랩 10000회, 시드 7) */
function pairedBootstrap(diffs, B = 10000, seed = 7) {
  const r = rng(seed);
  const n = diffs.length;
  const ms = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += diffs[Math.floor(r() * n)];
    ms.push(s / n);
  }
  ms.sort((x, y) => x - y);
  return { mean: mean(diffs), lo: ms[Math.floor(0.025 * B)], hi: ms[Math.floor(0.975 * B) - 1] };
}

function logChoose(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/** 부호검정(양측, 정확): 차이가 0이 아닌 질문 중 양의 개수 */
function signTest(diffs) {
  const pos = diffs.filter((d) => d > 0).length;
  const neg = diffs.filter((d) => d < 0).length;
  const n = pos + neg;
  if (n === 0) return { pos, neg, n, p: 1 };
  const k = Math.min(pos, neg);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(logChoose(n, i) - n * Math.log(2));
  return { pos, neg, n, p: Math.min(1, 2 * tail) };
}

// ---- Gemini 호출 ---------------------------------------------------------
const API = 'https://generativelanguage.googleapis.com/v1beta/';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const p = path.join(__dirname, '.env');
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

async function listModel(key, wantLite) {
  const r = await fetch(API + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  if (!r.ok) throw new Error('모델 목록 실패 ' + r.status);
  const data = await r.json();
  const ok = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/image|live|tts|audio|embed|robotics|computer|thinking-exp|preview/.test(n));
  const pick = ok.filter((n) => /lite/.test(n) === wantLite).sort((a, b) => b.localeCompare(a));
  return pick[0] || ok[0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 답변 한 개를 받고 {text, finishReason}을 돌려준다. 생각 토큰이 출력 한도를 쓰므로 기본 한도를 넉넉히(8192) 둔다. */
async function generateFull(key, model, prompt, opts) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: Object.assign({ temperature: 0.7, maxOutputTokens: 8192 }, opts && opts.generationConfig)
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 90000);
    let r;
    try {
      r = await fetch(API + 'models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
    } catch (e) {
      clearTimeout(to);
      await sleep(5000 * (attempt + 1));
      continue;
    }
    clearTimeout(to);
    if (r.status === 429 || r.status >= 500) {
      await sleep(15000 * (attempt + 1));
      continue;
    }
    if (!r.ok) throw new Error('Gemini ' + r.status);
    const data = await r.json();
    const c = data && data.candidates && data.candidates[0];
    const parts = c && c.content && c.content.parts;
    const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('').trim() : '';
    if (text) return { text, finishReason: (c && c.finishReason) || null };
    await sleep(3000);
  }
  throw new Error('응답을 받지 못했습니다');
}

async function generate(key, model, prompt, opts) {
  return (await generateFull(key, model, prompt, opts)).text;
}

module.exports = { FACT_KEYS, SIGNAL_TEXT, buildPrompt, buildJudgePrompt, parseJudge, mean, rng, pairedBootstrap, signTest, loadKey, listModel, generate, generateFull, sleep };
