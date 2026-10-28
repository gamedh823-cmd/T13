// Vercel 서버리스 함수: 판정 신고를 개발자 디스코드 채널로 전달
// 웹훅 주소는 소스에 없다. 환경변수 DISCORD_WEBHOOK_URL만 읽는다.
'use strict';

const ALLOWED_ORIGINS = [
  'https://gamedh823-cmd.github.io',
  'https://t13real.vercel.app'
];
const MAX_TEXT = 300;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 3; // IP당 분당 3회 (서버가 살아 있는 동안만 세는 대략적 제한)
const hits = new Map();
const LABELS = {
  debate: '토론 지시',
  persona: '전문가 역할',
  majority: '다수 의견',
  specific: '이미지(구체적)',
  vague: '이미지(막연)',
  cot: '풀이 과정',
  fewshot: '예시',
  opinion: '내 의견',
  brainstorm: '열린 추천'
};

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) hits.clear();
  return false;
}

function list(v) {
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string').map((s) => s.slice(0, 20)).slice(0, 9) : [];
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 쓸 수 있습니다.' });
  if (!allowed) return res.status(403).json({ error: '허용되지 않은 출처입니다.' });

  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return res.status(503).json({ error: 'no_hook' });

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  const text = body && typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return res.status(400).json({ error: '문장이 비어 있습니다.' });
  const mine = list(body.mine);
  const app = list(body.app);

  const name = (id) => LABELS[id] || id;
  const same = mine.length === app.length && mine.every((s) => app.includes(s));
  const onlyApp = app.filter((s) => !mine.includes(s)).map(name);
  const onlyMine = mine.filter((s) => !app.includes(s)).map(name);
  const NL = String.fromCharCode(10);
  const quote = text.split(/\r?\n/).map((l) => '> ' + l).join(NL);
  const compare = same
    ? '✅ 앱 판정이 맞다고 확인했어요'
    : [onlyApp.length ? '➖ 앱만 잡음: ' + onlyApp.join(', ') + ' (잘못 잡힘?)' : '', onlyMine.length ? '➕ 사용자만 체크: ' + onlyMine.join(', ') + ' (놓침?)' : '']
        .filter(Boolean)
        .join(NL);
  const payload = {
    username: '프롬프트 신호 점검기',
    allowed_mentions: { parse: [] }, // 입력 문장 속 @everyone 등이 알림을 울리지 않게
    embeds: [
      {
        title: same ? '📝 판정 신고 · 앱 판정과 같음' : '⚠️ 판정 신고 · 앱 판정과 다름',
        description: '**입력한 문장 (앞 300자)**' + NL + quote,
        color: same ? 0x22c55e : 0xf97316,
        fields: [
          { name: '🤖 앱이 잡은 신호', value: app.map(name).join(', ') || '(없음)', inline: true },
          { name: '🙋 사용자가 체크한 신호', value: mine.map(name).join(', ') || '(없음)', inline: true },
          { name: '🔎 비교', value: compare, inline: false }
        ],
        footer: { text: '프롬프트 신호 점검기 · 판정 신고' },
        timestamp: new Date().toISOString()
      }
    ]
  };
  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream_' + r.status });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};
