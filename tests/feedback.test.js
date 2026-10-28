// 판정 신고 함수(api/feedback.js)의 입력 검사·제한·디스코드 전달 형식을 확인한다. 실행: node tests/feedback.test.js
'use strict';
const assert = require('assert');
const handler = require('../api/feedback.js');

let n = 0;
async function t(name, fn) {
  await fn();
  n++;
  console.log('통과  ' + name);
}
function call(opts) {
  const res = { code: 0, body: null, headers: {} };
  res.setHeader = (k, v) => (res.headers[k] = v);
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  res.end = () => res;
  const req = {
    method: opts.method || 'POST',
    headers: Object.assign({ origin: 'https://gamedh823-cmd.github.io', 'x-forwarded-for': opts.ip || '1.1.1.1' }, opts.headers),
    body: opts.body
  };
  return handler(req, res).then(() => res);
}

(async () => {
  delete process.env.DISCORD_WEBHOOK_URL;
  await t('웹훅이 설정되지 않으면 503 no_hook', async () => {
    const r = await call({ body: { text: 'a', mine: [], app: [] }, ip: '9.0.0.1' });
    assert.strictEqual(r.code, 503);
    assert.strictEqual(r.body.error, 'no_hook');
  });
  process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/hook';
  await t('허용되지 않은 출처는 403', async () => {
    const r = await call({ headers: { origin: 'https://evil.example' }, body: { text: 'a' }, ip: '9.0.0.2' });
    assert.strictEqual(r.code, 403);
  });
  await t('빈 문장은 400', async () => {
    const r = await call({ body: { text: '   ' }, ip: '9.0.0.3' });
    assert.strictEqual(r.code, 400);
  });
  await t('디스코드로 보낼 때 멘션을 막고 문장을 300자로 자른다', async () => {
    let sent = null;
    global.fetch = async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return { ok: true };
    };
    const r = await call({ body: { text: '@everyone ' + 'ㅁ'.repeat(500), mine: ['persona'], app: ['persona', 'cot'] }, ip: '9.0.0.4' });
    assert.strictEqual(r.code, 200);
    assert.deepStrictEqual(sent.body.allowed_mentions, { parse: [] });
    assert.strictEqual(sent.body.embeds[0].fields[0].value.length, 300);
    assert.strictEqual(sent.body.embeds[0].fields[3].value, '다름');
  });
  await t('같은 IP는 분당 3회까지만 받는다', async () => {
    global.fetch = async () => ({ ok: true });
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await call({ body: { text: 'x', mine: [], app: [] }, ip: '9.0.0.5' })).code);
    assert.deepStrictEqual(codes, [200, 200, 200, 429]);
  });
  console.log(n + '개 모두 통과');
})();
