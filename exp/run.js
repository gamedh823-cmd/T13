// 실험 실행: 답변 받기와 채점.   (Node 18+, 설치할 것 없음)
//   node exp/run.js dry                         프롬프트와 호출 횟수만 확인(API 안 씀)
//   node exp/run.js answers [--runs 2]          조건 A·B·C로 Gemini 답변 받기 -> exp/results/answers.jsonl
//   node exp/run.js judge                       체크리스트 채점(블라인드) -> exp/results/judgements.jsonl
// 키: 환경변수 GEMINI_API_KEY 또는 exp/.env 파일의 GEMINI_API_KEY=... (이 파일은 git에 올리지 않는다)
// 중간에 멈춰도 다시 실행하면 이어서 한다.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

const args = process.argv.slice(2);
const mode = args[0] || 'dry';
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const RUNS = parseInt(opt('--runs', '2'), 10);
const DELAY = parseInt(opt('--delay', '6500'), 10);
const CONDS = ['A', 'B', 'C'];
// --shard 1/3 처럼 주면 전체 작업 중 1/3만 맡는다(여러 창에서 나눠 돌릴 때). 번호는 1부터.
const [SHARD_I, SHARD_N] = (opt('--shard', '1/1').split('/').map(Number));
let idx = 0;
const mine = () => (idx++ % SHARD_N) === SHARD_I - 1;

const dir = __dirname;
const resDir = path.join(dir, 'results');
fs.mkdirSync(resDir, { recursive: true });
const questions = JSON.parse(fs.readFileSync(path.join(dir, 'questions.json'), 'utf8'));
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
const ansFile = path.join(resDir, 'answers.jsonl');
const judFile = path.join(resDir, 'judgements.jsonl');

async function main() {
  if (mode === 'dry') {
    const q = questions[0];
    for (const c of CONDS) console.log('--- 조건 ' + c + ' (' + L.buildPrompt(q, c).length + '자) ---\n' + L.buildPrompt(q, c) + '\n');
    const n = questions.length * CONDS.length * RUNS;
    console.log('질문 ' + questions.length + '개 × 조건 ' + CONDS.length + '개 × ' + RUNS + '회 = 답변 ' + n + '번 + 채점 ' + n + '번 = 호출 ' + n * 2 + '번');
    console.log('호출 간격 ' + DELAY + 'ms 기준 예상 ' + Math.round((n * 2 * DELAY) / 60000) + '분');
    return;
  }
  const key = L.loadKey();
  if (!key) throw new Error('GEMINI_API_KEY가 없습니다. 환경변수나 exp/.env 에 넣어 주세요.');
  const model = opt('--model', null) || (mode === 'judge' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash');
  console.log('모델:', model);

  if (mode === 'answers') {
    const done = new Set(readJsonl(ansFile).map((r) => r.qid + '|' + r.cond + '|' + r.run));
    let n = 0;
    for (let run = 1; run <= RUNS; run++) {
      for (const q of questions) {
        for (const cond of CONDS) {
          const id = q.id + '|' + cond + '|' + run;
          if (!mine()) continue;
          if (done.has(id)) continue;
          const prompt = L.buildPrompt(q, cond);
          const g = await L.generateFull(key, model, prompt);
          const answer = g.text;
          // finish가 STOP이 아니면(예: MAX_TOKENS) 답이 잘린 것이므로 집계에서 따로 센다.
          fs.appendFileSync(ansFile, JSON.stringify({ qid: q.id, cond, run, model, prompt, answer, chars: answer.length, finish: g.finishReason }) + '\n');
          n++;
          process.stdout.write('\r답변 ' + n + '개 저장 (' + id + ')    ');
          await L.sleep(DELAY);
        }
      }
    }
    console.log('\n완료. 전체 ' + readJsonl(ansFile).length + '개');
    return;
  }

  if (mode === 'judge') {
    const answers = readJsonl(ansFile);
    const done = new Set(readJsonl(judFile).map((r) => r.qid + '|' + r.cond + '|' + r.run));
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    let n = 0, bad = 0;
    for (const a of answers) {
      const id = a.qid + '|' + a.cond + '|' + a.run;
      if (!mine()) continue;
      if (done.has(id)) continue;
      const q = byId[a.qid];
      let parsed = null;
      for (let t = 0; t < 3 && !parsed; t++) {
        const text = await L.generate(key, model, L.buildJudgePrompt(q, a.answer), { generationConfig: { temperature: 0, maxOutputTokens: 400, responseMimeType: 'application/json' } });
        parsed = L.parseJudge(text, q.check.length);
        await L.sleep(DELAY);
      }
      if (!parsed) {
        bad++;
        console.log('\n채점 형식 오류: ' + id);
        continue;
      }
      fs.appendFileSync(judFile, JSON.stringify({ qid: a.qid, cond: a.cond, run: a.run, model, checks: parsed.checks, score: parsed.score }) + '\n');
      n++;
      process.stdout.write('\r채점 ' + n + '개 (' + id + ')    ');
    }
    console.log('\n완료. 채점 ' + readJsonl(judFile).length + '개, 형식 오류 ' + bad + '개');
    return;
  }
  throw new Error('mode는 dry | answers | judge');
}

main().catch((e) => {
  console.error('\n오류:', e.message);
  process.exit(1);
});
