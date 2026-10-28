# 열린 추천(brainstorm)과 헷갈리는 문장을 보강하고, 학습·검증 데이터 전체를 정확히 2000개로 맞춘다.
#   python train/extra2_gen.py   ->  train/data/extra_hard.jsonl  (train.jsonl + extra_handwritten.jsonl + extra_hard.jsonl = 2000)
# 열린 추천 = 후보·아이디어·이름·장소·선물처럼 "여러 선택지"를 구하는 요청.
# 방법·조언·정보를 묻는 문장("~하는 방법이 없을까", "새로운 방법", "어떻게 하면 좋을까")과
# 단어만 언급한 문장("추천 시스템이 뭐야")은 열린 추천이 아니다(신호 없음).
import io, json, os, random, re

random.seed(11)
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
TARGET = 2000


def norm(t):
    return re.sub(r'[\s\.,!?"\'“”‘’~·…]+', '', t).lower()


def load(p):
    return [json.loads(l) for l in io.open(p, encoding='utf-8') if l.strip()]


existing = load(os.path.join(DATA, 'train.jsonl')) + load(os.path.join(DATA, 'extra_handwritten.jsonl'))
known = {norm(r['text']) for r in existing}
eval_texts = {norm(x['text']) for x in json.load(io.open(os.path.join(HERE, '..', 'eval', 'labels.json'), encoding='utf-8'))}
# 실제 사용 문장(eval/real_use.json)도 학습에 들어가지 않게 뺀다(공백·문장부호만 다른 것 포함).
eval_texts |= {norm(x['text']) for x in json.load(io.open(os.path.join(HERE, '..', 'eval', 'real_use.json'), encoding='utf-8'))}

TASKS = ['엑셀에서 중복값 지우기', '파이썬 코드 속도 높이기', '영어 단어 외우기', '보고서 쓰기', '이력서 작성하기', '회의 시간 줄이기', '노트북 배터리 아끼기',
         '코드 리뷰 빨리 끝내기', '공부 시간 확보하기', '이메일 빨리 쓰기', '파일 정리하기', '발표 긴장 풀기', 'git 커밋 합치기', '사진 용량 줄이기',
         '수학 문제 빨리 풀기', '집중력 높이기', '면접 준비하기', '데이터 정리하기', '엑셀 함수 익히기', '문서 번역하기', '돈 모으기', '아침에 일찍 일어나기',
         '프로그램 설치하기', '와이파이 속도 높이기', '자소서 쓰기', '시험 공부하기', '영어 말하기 늘리기', '체력 기르기', '이메일 정리하기', '노션 정리하기']
METHOD_T = ['{t} 방법이 없을까?', '{t} 더 나은 방법 알려줘', '{t} 새로운 방법 있어?', '{t} 좋은 방법이 뭐가 있어?', '{t} 다른 방법은 없어?',
            '{t} 쉬운 방법 있을까요', '{t} 효율적인 방법을 알려줘', '{t} 가장 빠른 방법이 뭐야?', '{t}에 대한 새로운 접근법 같은 게 있을까?']
PROBLEMS = ['노트북이 자꾸 꺼져', '회의 때 말이 안 나와', '코드가 계속 에러가 나', '밤에 잠이 안 와', '발표가 너무 길어졌어', '친구랑 약속이 겹쳤어',
            '과제 마감이 내일이야', '와이파이가 자꾸 끊겨', '메일을 잘못 보냈어', '파일이 안 열려']
ADVICE_T = ['{p}. 어떻게 하면 좋을까?', '{p}, 어떡하지', '{p}. 어쩌면 좋아?', '{p}. 해결 방법 좀 알려줘', '{p} 이럴 땐 어떻게 해야 해?']
MENTION_X = ['추천 알고리즘', '추천 시스템', '추천서', '추천인 코드', '아이디어 노트', '브레인스토밍 도구', '아이디어 공모전', '추천 검색어 기능', '새로운 방법이라는 표현', '제안서 양식']
MENTION_T = ['{x}가 뭔지 설명해줘', '{x} 사용법 알려줘', '{x} 어떻게 만드는지 알려줘', '{x}의 뜻이 뭐야?', '{x} 관련 자료를 찾는 방법 알려줘']

THINGS = ['고양이 이름', '가게 이름', '동아리 이름', '발표 주제', '생일선물', '주말 활동', '점심 메뉴', '여행지', '취미', '프로젝트 주제', '데이트 코스', '팀 이름']
POS_T = ['{x} 후보 {n}개만 알려줘', '{x} 뭐가 좋을까? {n}개 정도 골라줘', '{x} 좀 추천해줘. 여러 개 부탁해', '{x} 아이디어 {n}가지만 던져줘', '{x} 뭐 있을까?']
POS_HAND = """
동아리 신입생 환영회에서 할 만한 게임 뭐가 있을까?
카페 신메뉴 이름 후보를 열 개만 뽑아줘
퇴근하고 할 만한 새로운 취미 추천해줘
다음 팀 워크숍 장소 후보 알려줘. 서울 근교로
What are some good names for a podcast about cooking?
생일 서프라이즈 이벤트 아이디어 몇 개만 알려줘
졸업 선물로 뭐가 좋을지 감이 안 와 여러 개 골라줘
독서 모임에서 읽을 책 후보를 다섯 권 추천해줘
Can you give me five fun ideas for a weekend with friends?
새 프로젝트 이름을 지어야 하는데 후보 좀 줘
아이랑 주말에 갈 만한 곳 뭐 있을까
회사 송년회 때 할 만한 이벤트 뭐 있어?
유튜브 채널 이름 아이디어 좀 던져봐
발표 마무리 멘트 후보를 세 가지만 줘
점심 먹을 만한 데 몇 군데만 추천해줘
Suggest a few unique gift options for a coworker.
방 꾸미기 아이디어 여러 개 알려줘
이번 학기에 도전해 볼 만한 활동 몇 개만 추천해줘
캠핑 때 할 만한 놀이가 뭐 있을까?
앱 이름 좀 지어줘. 후보 여러 개로
""".strip().splitlines()

HAND_NEG = """
이 에러를 해결할 방법이 없을까? ModuleNotFoundError: No module named 'numpy'
커피를 덜 마시는 방법 좀 알려줘
스트레스 푸는 방법이 뭐가 있어?
이 문서 용량 줄일 방법 있어?
Is there a way to merge two PDFs without installing anything?
영어 공부 새로운 방법 있으면 알려줘
이거 어떻게 하는 게 좋을까? 프린터 용지가 계속 걸려
추천 영화가 아니라 이 영화 줄거리를 알려줘
아이디어 회의 때 쓰는 포스트잇 사이즈가 뭐야
What is the best way to learn SQL?
엑셀 파일 합치는 방법이 있을까?
이 일정 관리 방법이 맞는지 확인해줘
효율적인 방법을 찾고 있어. 이 반복문 최적화하는 법
다른 방법으로 풀어줘. 문제: x+2=5
이 상황에서 어떻게 대처하면 좋을까? 상사가 갑자기 화를 내
""".strip().splitlines()

pool = []  # (text, signals, kind)
for t in POS_HAND:
    pool.append((t.strip(), ['brainstorm'], 'hard_hand'))
for t in HAND_NEG:
    pool.append((t.strip(), [], 'hard_hand'))
# 영어 일반 질문(신호 없음)과 영어 신호 문장 보강: 영어 일반 질문이 다수 의견 등으로 잘못 잡히던 문제를 줄이려고 추가
ENG_NEG = """
What is the tallest mountain in Africa?
How many days are there in a leap year?
Who wrote the novel Pride and Prejudice?
Explain what an API is in two sentences.
What is the boiling point of water in Fahrenheit?
Write a function that reverses a string in JavaScript.
How do I center a div with CSS?
What does the acronym HTTP stand for?
Convert 100 degrees Celsius to Fahrenheit.
Which planet is closest to the sun?
Fix the grammar in this sentence: She go to school yesterday.
Give me the synonyms for the word happy.
How long does it take to fly from Seoul to Tokyo?
What is the difference between a list and a tuple in Python?
Translate this sentence into Korean: The meeting starts at nine.
What is the square root of 144?
Where is the Eiffel Tower located?
How do I undo the last git commit?
Summarize the plot of Romeo and Juliet in three sentences.
What year did the Berlin Wall fall?
Write a SQL query that counts rows in a table.
What is the capital city of Canada?
How many players are on a soccer team?
List the primary colors.
What does a CPU do?
How do I install Node.js on Windows?
Rewrite this email to sound more polite: Send me the file now.
What is the population of Australia?
Define photosynthesis in one sentence.
How do you say thank you in Spanish?
When was the first iPhone released?
What is the chemical symbol for gold?
Can you explain what recursion means?
How many ounces are in a pound?
What is the largest ocean on Earth?
Please proofread the following paragraph.
What time does the sun set in London in June?
How do I reset my router?
Show me how to read a file in Python.
What is the main idea of this paragraph?
""".strip().splitlines()
ENG_POS = [
    ('Do most Americans support a four-day work week?', ['majority']),
    ('What do most people think about electric cars these days?', ['majority']),
    ('Is it true that the majority of people prefer cats over dogs?', ['majority']),
    ('How do people in general feel about working from the office?', ['majority']),
    ('Suggest three names for a small bakery.', ['brainstorm']),
    ('Give me some fun ideas for a rainy weekend.', ['brainstorm']),
    ('I need a few gift ideas for my sister, any suggestions?', ['brainstorm']),
    ('You are a professional chef. Explain how to cook risotto.', ['persona']),
    ('Pretend you are a travel guide and plan a day in Rome.', ['persona']),
    ('Think step by step and tell me what 18 times 27 is.', ['cot']),
    ('I believe my essay is excellent already. Do you agree?', ['opinion']),
    ('In my opinion this plan is perfect, so just confirm it.', ['opinion']),
    ('Let two experts argue for and against nuclear power, then summarize.', ['debate']),
    ('Here is an example: apple -> fruit, carrot -> vegetable. Now classify potato.', ['fewshot']),
]
for t in ENG_NEG:
    pool.append((t.strip(), [], 'hard_hand'))
for t, sg in ENG_POS:
    pool.append((t, sg, 'hard_hand'))
# "평균·일반적으로·보통" 같은 단어가 들어간 사실 질문과, 조언을 구하는 "어떻게 하면 좋을까"는 신호가 아니다.
FACT_NEG = """
목성의 평균 기온은 얼마야?
서울의 연평균 강수량이 얼마인지 알려줘
이 반 학생들의 평균 점수를 계산해줘
시속 평균 속도를 구하는 공식을 알려줘
대한민국의 평균 수명이 몇 살이야?
평균과 분산이 뭔지 설명해줘
일반적으로 물은 몇 도에서 끓어?
보통 계란은 몇 분 삶아야 완숙이야?
성인의 하루 평균 수면 시간은 얼마야?
일반적인 A4 용지 크기가 몇 mm야?
지구의 평균 반지름을 알려줘
보통 비행기는 몇 미터 상공을 날아?
이 데이터의 평균값과 중앙값을 구해줘
달의 평균 표면 온도가 얼마야?
한국의 연평균 기온이 몇 도야?
일반적으로 USB 3.0의 전송 속도는 얼마야?
""".strip().splitlines()
ADVICE_NEG = """
이 코드가 너무 느려졌어. 어떻게 하면 좋을까?
친구랑 싸웠는데 어떻게 하면 좋을까?
시험이 내일인데 준비를 못 했어. 어떻게 하면 좋지?
이거 어떻게 하면 좋을까? 컴퓨터가 부팅이 안 돼
이 상황에서는 어떻게 하는 게 좋을까요? 계약서에 오타가 있어요
방이 너무 추운데 어떻게 하면 좋을까
이 에러는 어떻게 하면 해결할 수 있을까? 서버가 계속 죽어
발표 자료가 너무 길어요. 어떻게 줄이면 좋을까요?
돈이 모자라는데 어떻게 하면 좋을까
상사한테 뭐라고 말해야 할지 모르겠어. 어떻게 하면 좋을까?
이 파일이 안 열리는데 어떻게 하면 좋을까?
면접에서 긴장하는데 어떻게 하면 좋을까
""".strip().splitlines()
for t in FACT_NEG + ADVICE_NEG:
    pool.append((t.strip(), [], 'hard_hand'))
# 줄임말·짧은 추천 요청(예: 저메추 = 저녁 메뉴 추천)과 글자만 겹치는 문장(메추리알)
SLANG_POS = """
저메추 좀
저메추좀 해줘
점메추 부탁
점메추 해줘
야식 메추좀
아침 메추 좀
간식 메추좀
오늘 점메추
저메추 ㅇㅇ
메추좀
메뉴 추천 좀
메뉴 추천해줘
오늘 저녁 메뉴 뭐가 좋을까
저녁 뭐 먹지 추천해줘
점심 뭐 먹을지 추천 좀
야식 추천해줘
술안주 추천 좀
카페 메뉴 추천해줘
노래 추천 좀
영화 추천해줘
책 추천 좀 해줘
여행지 추천 좀
선물 추천해줘
맛집 추천 좀
게임 추천해줘
취미 추천 좀
노추 부탁해
영추 좀
책추 해줘
맛추 좀 해줘
뭐 먹을까 추천 좀
오늘 뭐 할지 추천해줘
치킨 대신 먹을 거 없나
라면 말고 먹을 만한 거 없을까?
커피 대신 마실 거 추천해줘
피자 대신 뭐 먹을 만한 거 없어?
주말에 갈 만한 데 없나
운동 말고 할 만한 취미 없을까?
김치찌개 대신 먹을 거 뭐 있어?
콜라 대신 마실 만한 거 없나
햄버거 말고 점심으로 뭐 먹지
치킨 질렸는데 다른 먹을 거 없나
심심한데 할 만한 거 없나
볼 만한 영화 없나
""".strip().splitlines()
SLANG_NEG = """
메추리알 삶는 시간이 얼마야?
메추리알 장조림 레시피 알려줘
메추리는 어떤 새야?
추천 서버가 뭔지 설명해줘
추천 알고리즘이 뭐야
추천 시스템이 뭐야?
추천서가 뭐야
추천인 코드가 뭐야
브레인스토밍이 뭐야
아이디어 노트가 뭐야?
추천 검색어가 뭐야
추천 알고리즘은 어떻게 동작해?
아이디어 공모전이 뭐야
""".strip().splitlines()
for t in SLANG_POS:
    pool.append((t.strip(), ['brainstorm'], 'hard_hand'))
for t in SLANG_NEG:
    pool.append((t.strip(), [], 'hard_hand'))
tm = [(t, m) for t in TASKS for m in METHOD_T]
random.shuffle(tm)
for t, m in tm[:125]:
    pool.append((m.replace('{t}', t), [], 'hard_method'))
pa = [(p, a) for p in PROBLEMS for a in ADVICE_T]
random.shuffle(pa)
for p, a in pa[:44]:
    pool.append((a.replace('{p}', p), [], 'hard_advice'))
mx = [(x, m) for x in MENTION_X for m in MENTION_T]
random.shuffle(mx)
for x, m in mx[:44]:
    pool.append((m.replace('{x}', x), [], 'hard_mention'))
xp = [(x, t) for x in THINGS for t in POS_T]
random.shuffle(xp)
for x, t in xp[:60]:
    n = random.choice([3, 5, 7, 10])
    pool.append((t.replace('{x}', x).replace('{n}', str(n)), ['brainstorm'], 'hard_pos'))

out, seen = [], set()
need = TARGET - len(existing)
for t, s, k in pool:
    n = norm(t)
    if n in known or n in eval_texts or n in seen:
        continue
    seen.add(n)
    out.append({'text': t, 'signals': sorted(s), 'kind': k})
# 손으로 쓴 것을 우선하고, 모자라면 다른 합성이 아니라 여기서 걸러진 풀에서만 채운다.
hand = [r for r in out if r['kind'] == 'hard_hand']
rest = [r for r in out if r['kind'] != 'hard_hand']
if len(hand) + len(rest) < need:
    raise SystemExit('풀이 모자랍니다: %d < %d' % (len(hand) + len(rest), need))
random.shuffle(rest)
out = hand + rest[: need - len(hand)]
random.shuffle(out)
for i, r in enumerate(out):
    r['id'] = 'X%04d' % (i + 1)
    r['split'] = 'val_hand' if i % 5 == 4 else 'train'
with io.open(os.path.join(DATA, 'extra_hard.jsonl'), 'w', encoding='utf-8', newline='\n') as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
total = len(existing) + len(out)
from collections import Counter
print('추가 %d개, 합계 %d개 (목표 %d)' % (len(out), total, TARGET))
print('종류:', dict(Counter(r['kind'] for r in out)))
print('신호 있음 %d, 신호 없음 %d' % (sum(1 for r in out if r['signals']), sum(1 for r in out if not r['signals'])))
assert total == TARGET, total
