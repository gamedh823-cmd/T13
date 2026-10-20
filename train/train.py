# 신호 감지 분류기 학습: 글자 n-gram TF-IDF + 신호별 로지스틱 회귀(다중 라벨).
#   python train/train.py            -> 학습하고 평가 결과를 출력, train/model.json 저장
# 평가는 두 가지로 나눠 한다.
#   1) val_unseen: 학습에서 못 본 신호 문구로 만든 문장(합성). "처음 보는 표현을 잡는가"
#   2) eval/labels.json dev: 사람이 검토하는 평가용 라벨(학습에 안 씀). 기준선 규칙과 같은 문장으로 비교
import io, json, os, sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
SIGNALS = ['debate', 'persona', 'majority', 'specific', 'vague', 'cot', 'fewshot', 'opinion', 'brainstorm']


def load_jsonl(p):
    return [json.loads(l) for l in io.open(p, encoding='utf-8') if l.strip()]


train_all = load_jsonl(os.path.join(HERE, 'data', 'train.jsonl'))
train = [r for r in train_all if r['split'] == 'train']
val_unseen = [r for r in train_all if r['split'] == 'val_unseen']
# 직접 쓴 문장(extra_handwritten)과 Workbench 문장(workbench_clean)은 있으면 학습에 더한다. --no-extra 로 빼고 비교할 수 있다.
val_hand = []
if '--no-extra' not in sys.argv:
    for fn in ('extra_handwritten.jsonl', 'extra_hard.jsonl', 'workbench_clean.jsonl'):
        if fn == 'extra_hard.jsonl' and '--no-hard' in sys.argv:
            continue
        p = os.path.join(HERE, 'data', fn)
        if os.path.exists(p):
            rows = load_jsonl(p)
            train += [r for r in rows if r['split'] == 'train']
            val_hand += [r for r in rows if r['split'] == 'val_hand']
else:
    p = os.path.join(HERE, 'data', 'extra_handwritten.jsonl')
    if os.path.exists(p):
        val_hand = [r for r in load_jsonl(p) if r['split'] == 'val_hand']
print('학습 문장 %d개' % len(train))
labels = json.load(io.open(os.path.join(HERE, '..', 'eval', 'labels.json'), encoding='utf-8'))
human_dev = [r for r in labels if r['split'] == 'dev']


def Y(rows):
    return np.array([[1 if s in r['signals'] else 0 for s in SIGNALS] for r in rows])


vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(1, 4), min_df=2, sublinear_tf=True, max_features=6000, lowercase=True)
Xtr = vec.fit_transform([r['text'] for r in train])
ytr = Y(train)

models = []
for j, s in enumerate(SIGNALS):
    m = LogisticRegression(C=8.0, max_iter=2000, class_weight='balanced')
    m.fit(Xtr, ytr[:, j])
    models.append(m)


def predict(rows, thr=0.5):  # noqa
    X = vec.transform([r['text'] for r in rows])
    P = np.column_stack([m.predict_proba(X)[:, 1] for m in models])
    return P, (P >= thr).astype(int)


def report(name, rows, thr=0.5):
    P, pred = predict(rows, thr)
    y = Y(rows)
    print('\n== %s (%d개, 임계값 %.2f) ==' % (name, len(rows), thr))
    print('신호          정답  맞게  오탐  놓침  정밀도 재현율  F1')
    tp = fp = fn = 0
    for j, s in enumerate(SIGNALS):
        a = int(((pred[:, j] == 1) & (y[:, j] == 1)).sum())
        b = int(((pred[:, j] == 1) & (y[:, j] == 0)).sum())
        c = int(((pred[:, j] == 0) & (y[:, j] == 1)).sum())
        tp += a; fp += b; fn += c
        p = a / (a + b) if a + b else float('nan')
        r = a / (a + c) if a + c else float('nan')
        f = 2 * p * r / (p + r) if p + r else float('nan')
        print('%-12s %4d %5d %5d %5d   %.2f   %.2f  %.2f' % (s, y[:, j].sum(), a, b, c, p, r, f))
    mp = tp / (tp + fp) if tp + fp else float('nan')
    mr = tp / (tp + fn) if tp + fn else float('nan')
    print('전체(micro)  정밀도 %.2f 재현율 %.2f F1 %.2f' % (mp, mr, 2 * mp * mr / (mp + mr)))
    return pred


THR = float(sys.argv[sys.argv.index('--thr') + 1]) if '--thr' in sys.argv else 0.5
report('학습에서 못 본 표현(val_unseen)', val_unseen, THR)
if val_hand:
    report('직접 쓴 새 말투(val_hand, 학습에 안 씀)', val_hand, THR)
pred = report('사람이 검토하는 평가용 라벨 dev', human_dev, THR)

if '--errors' in sys.argv:
    y = Y(human_dev)
    print('\n틀린 사례')
    for i, r in enumerate(human_dev):
        for j, s in enumerate(SIGNALS):
            if pred[i, j] != y[i, j]:
                print('- [%s %s] %s %s: %s' % (r['id'], r['kind'], '오탐' if pred[i, j] else '놓침', s, r['text']))

# 브라우저에서 쓸 가중치 저장 (어휘, idf, 계수, 절편)
vocab = vec.vocabulary_
model = {
    'signals': SIGNALS,
    'ngram': [1, 4],
    'vocab': {k: int(v) for k, v in vocab.items()},
    'idf': [round(float(x), 4) for x in vec.idf_],
    'coef': [[round(float(x), 4) for x in m.coef_[0]] for m in models],
    'intercept': [round(float(m.intercept_[0]), 4) for m in models],
}
with io.open(os.path.join(HERE, 'model.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
# 로컬 파일(index.html을 더블클릭)로 열어도 모델을 읽을 수 있게 같은 내용을 JS 파일로도 저장한다.
with io.open(os.path.join(HERE, 'model.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('window.PSC_MODEL=')
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('\nmodel.json 저장: %.0f KB, 어휘 %d개' % (os.path.getsize(os.path.join(HERE, 'model.json')) / 1024, len(vocab)))
