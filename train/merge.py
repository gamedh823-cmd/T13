# Workbench로 만든 학습 문장(train/data/workbench_gen.jsonl)을 검증하고 걸러서 train/data/workbench_clean.jsonl로 저장한다.
#   python train/merge.py
# 걸러 내는 것: 형식이 틀린 줄, 알 수 없는 신호 id, 너무 짧거나 긴 문장, 이미 있는 문장(학습·평가용),
#               평가용 라벨(eval/labels.json)과 거의 같은 문장, 전화번호·이메일처럼 보이는 개인정보.
# 라벨의 의미는 자동으로 맞는지 알 수 없다. 대신 기존 모델이 크게 반대하는 문장(예: 신호가 있다는데 확률이 아주 낮음)을
# 따로 모아 train/data/workbench_review.txt에 적으니, 그 문장은 사람이 보고 지우거나 고친다.
import io, json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
VALID = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm']
SRC = os.path.join(DATA, 'workbench_gen.jsonl')
OUT = os.path.join(DATA, 'workbench_clean.jsonl')
REVIEW = os.path.join(DATA, 'workbench_review.txt')


def norm(t):
    return re.sub(r'[\s\.,!?"\'“”‘’~·…]+', '', t).lower()


if not os.path.exists(SRC):
    sys.exit('train/data/workbench_gen.jsonl 파일이 없습니다. Workbench 결과를 이 위치에 두세요.')

known = set()
for fn in ('train.jsonl',):
    p = os.path.join(DATA, fn)
    if os.path.exists(p):
        for l in io.open(p, encoding='utf-8'):
            if l.strip():
                known.add(norm(json.loads(l)['text']))
eval_texts = {norm(x['text']) for x in json.load(io.open(os.path.join(HERE, '..', 'eval', 'labels.json'), encoding='utf-8'))}

PII = re.compile(r'(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})|([\w.+-]+@[\w-]+\.[\w.]+)|(\d{6}[-\s]?\d{7})')
rej = Counter()
rows, seen = [], set()
for ln, line in enumerate(io.open(SRC, encoding='utf-8'), 1):
    line = line.strip()
    if not line:
        continue
    try:
        r = json.loads(line)
    except Exception:
        rej['JSON 아님'] += 1
        continue
    if not isinstance(r, dict) or not isinstance(r.get('text'), str) or not isinstance(r.get('signals'), list):
        rej['text/signals 형식 틀림'] += 1
        continue
    text = r['text'].strip()
    sig = r['signals']
    if not all(isinstance(s, str) and s in VALID for s in sig):
        rej['알 수 없는 신호 id'] += 1
        continue
    if len(set(sig)) != len(sig):
        rej['신호 중복'] += 1
        continue
    if not (4 <= len(text) <= 600):
        rej['길이(4~600자) 벗어남'] += 1
        continue
    if PII.search(text):
        rej['개인정보처럼 보임'] += 1
        continue
    n = norm(text)
    if n in eval_texts:
        rej['평가용 라벨과 같은 문장'] += 1
        continue
    if n in known or n in seen:
        rej['중복'] += 1
        continue
    seen.add(n)
    rows.append({'text': text, 'signals': sorted(sig), 'kind': 'wb', 'split': 'train'})

for i, r in enumerate(rows):
    r['id'] = 'W%04d' % (i + 1)
with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

# 의심 라벨: 기존 모델(train/model.json)과 크게 어긋나는 문장
review = []
mp = os.path.join(HERE, 'model.json')
if os.path.exists(mp):
    sys.path.insert(0, HERE)
    model = json.load(io.open(mp, encoding='utf-8'))
    import math
    from collections import defaultdict

    def grams(text):
        doc = re.sub(r'\s\s+', ' ', text.lower())
        out = []
        for w in doc.split():
            w = ' ' + w + ' '
            for n in range(1, 5):
                o = 0
                out.append(w[o:o + n])
                while o + n < len(w):
                    o += 1
                    out.append(w[o:o + n])
                if o == 0:
                    break
        return out

    def proba(text):
        c = defaultdict(int)
        for g in grams(text):
            if g in model['vocab']:
                c[model['vocab'][g]] += 1
        vals = {i: (1 + math.log(v)) * model['idf'][i] for i, v in c.items()}
        norm_ = math.sqrt(sum(v * v for v in vals.values())) or 1
        res = {}
        for j, s in enumerate(model['signals']):
            z = model['intercept'][j] + sum(vals[i] / norm_ * model['coef'][j][i] for i in vals)
            res[s] = 1 / (1 + math.exp(-z))
        return res

    for r in rows:
        p = proba(r['text'])
        gold = set(r['signals'])
        bad = [s for s in VALID if (s in gold and p[s] < 0.05) or (s not in gold and p[s] > 0.9)]
        if bad:
            review.append('%s %s 라벨=%s 의심=%s | %s' % (r['id'], r['kind'], ','.join(sorted(gold)) or '없음', ','.join(bad), r['text']))
io.open(REVIEW, 'w', encoding='utf-8', newline='\n').write('\n'.join(review) + ('\n' if review else ''))

print('읽은 줄 %d → 남긴 문장 %d개 (%s)' % (ln if 'ln' in dir() else 0, len(rows), OUT))
print('걸러 낸 것:', dict(rej) if rej else '없음')
sc = Counter()
for r in rows:
    for s in r['signals']:
        sc[s] += 1
print('신호별:', dict(sc), '| 신호 없음:', sum(1 for r in rows if not r['signals']))
print('사람이 볼 의심 라벨 %d개 → %s' % (len(review), REVIEW))
