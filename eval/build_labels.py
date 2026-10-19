# 라벨 세트를 만든다. 정답은 "문장이 실제로 요구하는 것"을 기준으로 사람이 붙인 것이고,
# core.js의 정규식을 보고 붙이지 않았다. 신호 id는 core.js의 analyze()가 돌려주는 id와 같다.
#   debate 토론 지시 | persona 전문가 역할 | majority 다수 의견 프레이밍
#   specific 구체적인 이미지 요청 | vague 막연한 이미지 요청
#   cot 풀이 과정 요구 | fewshot 예시 제시 | opinion 내 의견 먼저 밝힘 | brainstorm 열린 추천·아이디어 요청
# 분류(kind): pos 신호가 있는 문장, multi 여러 신호, neg 신호 없는 평범한 문장,
#             negation 신호 표현을 "빼 달라"고 한 문장, mention 신호 단어를 언급만 한 문장,
#             para 키워드 없이 돌려 쓴 신호 문장
# 이 파일은 AI(Claude)가 초안을 쓰고 내가 검토해서 고치는 중이다. 라벨이 틀리면 labels.json이 아니라
# 이 파일을 고치고 다시 실행한다.
import json, sys, io

R = []  # (kind, text, [signals])

def a(kind, text, sig=()):
    R.append((kind, text, list(sig)))

# ---- debate ----
a('pos', '두 명의 전문가가 토론하는 형식으로 7의 222제곱을 13으로 나눈 나머지를 구해 줘', ['debate'])
a('pos', '이 정책의 찬성 입장과 반대 입장이 서로 반박하는 대화를 써 줘', ['debate'])
a('pos', 'A와 B가 토론하듯이 이 문제를 풀어 주고 마지막에 합의된 답만 알려 줘', ['debate'])
a('pos', '장단점을 서로 다른 입장에서 따져 본 뒤에 결론을 내려 줘', ['debate'])
a('para', '한 사람은 이 계획이 좋다고 주장하고 다른 사람은 허점을 찾는 식으로 검토해 줘', ['debate'])
a('para', '네가 두 명이 되어서 한 명이 틀린 곳을 찾아 지적하게 하고 최종 답을 정해 줘', ['debate'])
a('pos', '채식 vs 육식 논쟁을 양쪽 주장으로 정리해 줘', ['debate'])
# ---- persona ----
a('pos', '당신은 이 분야에서 20년 경력을 가진 최고 수준의 전문가입니다. 9876 곱하기 6789는?', ['persona'])
a('pos', '너는 10년차 시니어 백엔드 개발자야. 이 코드를 리뷰해 줘', ['persona'])
a('pos', '변호사의 입장에서 이 계약서 조항을 설명해 줘', ['persona'])
a('para', '넌 친절한 영어 선생님이야. 내가 쓴 문장을 고쳐 줘', ['persona'])
a('pos', '마케팅 전문가로서 신제품 홍보 문구를 제안해 줘', ['persona'])
a('pos', 'You are an expert data scientist. Explain overfitting.', ['persona'])
a('para', '요리사처럼 답해 줘. 계란찜 맛있게 하는 법 알려 줘', ['persona'])
# ---- majority ----
a('pos', '대부분의 사람들은 이 주장에 동의할까요? 한 명을 희생해 다섯 명을 구하는 것은 허용된다.', ['majority'])
a('pos', '요즘 사람들은 전기차를 많이 사나요? 다들 어떻게 생각해?', ['majority'])
a('pos', '한국인 대다수가 이 정책에 찬성하는지 알려 줘', ['majority'])
a('para', '다들 이 노래를 좋아해? 내가 이상한 건지 궁금해', ['majority'])
a('pos', 'What do most people think about remote work?', ['majority'])
a('pos', '보통 사람들은 월급의 몇 퍼센트를 저축한다고 생각해?', ['majority'])
a('para', '여론은 어느 쪽이야? 반대가 더 많아?', ['majority'])
# ---- specific image ----
a('pos', '사진 동아리 신입 부원 모집 포스터를 만들어줘. 파스텔톤 하늘색과 노란색 배색, 상단에 큰 글씨로 "프레임 속으로", 중앙에는 카메라를 든 사람, 산뜻한 느낌으로.', ['specific'])
a('pos', '카페 로고를 그려 줘. 짙은 초록과 베이지 두 가지 색만 쓰고, 원형 안에 커피잔을 가운데 배치, 따뜻하고 손그림 같은 분위기로.', ['specific'])
a('pos', '유튜브 썸네일 이미지: 왼쪽에는 놀란 표정의 남자, 오른쪽 위에 노란 글씨로 "충격 결말", 배경은 어두운 파랑, 영화 포스터 같은 느낌', ['specific'])
a('pos', '운동회 안내 배너를 디자인해 줘. 상단에 "가을 운동회" 문구, 하단에 일시와 장소, 주황색과 흰색 배색, 활기찬 스타일.', ['specific'])
a('pos', 'Create a poster: blue and white palette, title "Open Day" at the top, a school building in the center, clean modern style.', ['specific'])
# ---- vague image ----
a('pos', '동아리 포스터 만들어줘', ['vague'])
a('pos', '로고 하나 그려 줘', ['vague'])
a('pos', '귀여운 고양이 일러스트 만들어 줘', ['vague'])
a('pos', '생일 파티 초대장 디자인 부탁해', ['vague'])
a('pos', 'Make me a banner for my shop.', ['vague'])
# ---- cot ----
a('pos', '단계별로 생각해서 37 곱하기 43을 계산해 줘', ['cot'])
a('pos', '풀이 과정을 하나씩 보여 주면서 이차방정식 x^2-5x+6=0을 풀어 줘', ['cot'])
a('pos', 'Let us think step by step. If a train goes 60km/h for 2.5 hours, how far?', ['cot'])
a('para', '왜 그런 답이 나왔는지 이유를 차근차근 설명하면서 답해 줘', ['cot'])
a('pos', '답만 말하지 말고 어떻게 그렇게 계산했는지 과정도 써 줘', ['cot'])
a('pos', '근거를 들어서 이 주장이 맞는지 논리적으로 풀어 줘', ['cot'])
a('para', '머릿속으로 생각한 순서대로 하나하나 적어 가면서 풀어 줘', ['cot'])
# ---- fewshot ----
a('pos', '입력: 사과 출력: apple. 입력: 바나나 출력: banana. 그럼 입력: 포도 출력은?', ['fewshot'])
a('pos', '예를 들어 "오늘 날씨 좋네요 → 긍정" 같은 식으로 이 문장들의 감정을 분류해 줘', ['fewshot'])
a('pos', 'Example: cat -> 고양이, dog -> 개. Translate: bird', ['fewshot'])
a('para', '이런 식으로 써 줘. "[제목] 한 줄 요약 / [핵심] 세 가지". 이제 이 기사를 정리해 줘', ['fewshot'])
a('pos', '아래 두 개 샘플의 말투를 따라서 새 안내문을 써 줘. 샘플1: 안녕하세요, 부원 여러분! 샘플2: 반갑습니다, 동아리원 여러분!', ['fewshot'])
a('pos', '예: "내일 3시에 만나요" -> 시간 약속. 이 예처럼 아래 메시지 종류를 분류해 줘', ['fewshot'])
a('para', '내가 아래 보여 주는 것과 같은 형식으로 답해 줘. 질문: 수도는? 답: 서울.', ['fewshot'])
# ---- opinion ----
a('pos', '제 생각에는 이 정책이 맞는 것 같은데 어떻게 생각해?', ['opinion'])
a('pos', '내 의견은 재택근무가 생산성을 높인다는 거야. 너도 동의하지?', ['opinion'])
a('para', '난 이 방법이 정답이라고 봐. 근데 너는 어때?', ['opinion'])
a('pos', 'I think this essay is already perfect. Do you agree?', ['opinion'])
a('pos', '내 생각엔 파이썬이 제일 쉬운 언어야. 맞지?', ['opinion'])
a('para', '아무리 봐도 내가 맞는 것 같은데, 틀린 데 있으면 말해 줘', ['opinion'])
a('pos', '제 느낌으로는 이 디자인이 별로인 것 같아요. 의견 줘', ['opinion'])
# ---- brainstorm ----
a('pos', '게임동아리에서 할만한 행사 같은 거 추천해줘. 더 신박한 거 없나', ['brainstorm'])
a('pos', '주말에 뭐 하면 좋을지 아이디어 좀 줘', ['brainstorm'])
a('pos', '새 카페 이름 후보를 브레인스토밍해 줘', ['brainstorm'])
a('para', '심심한데 색다른 거 없을까?', ['brainstorm'])
a('pos', 'Any ideas for a birthday gift for my dad?', ['brainstorm'])
a('pos', '팀 회식 장소 추천해 줘. 참신한 곳이면 좋겠어', ['brainstorm'])
a('para', '졸업 작품 주제로 뭐 하면 좋을까?', ['brainstorm'])
# ---- multi ----
a('multi', '너는 20년차 의사야. 두 명의 의사가 토론하듯이 이 증상의 원인을 따져 줘', ['persona', 'debate'])
a('multi', '제 생각에는 이 방법이 맞는데, 단계별로 풀이 과정을 보여 주고 확인해 줘', ['opinion', 'cot'])
a('multi', '대부분의 사람들은 어떻게 생각해? 내 생각엔 반대가 많을 것 같은데', ['majority', 'opinion'])
a('multi', '변호사로서 단계별로 설명해 줘. 예: "계약 해지 → 통지 의무"', ['persona', 'cot', 'fewshot'])
a('multi', '동아리 모집 포스터를 만들어 줘. 하늘색 배색, 상단에 "함께해요" 문구, 중앙에 사람 일러스트. 비슷한 분위기 예시: "여름 캠프" 포스터', ['specific', 'fewshot'])
a('multi', '요즘 사람들이 많이 하는 취미 아이디어 좀 추천해 줘', ['majority', 'brainstorm'])
a('multi', '전문가 입장에서 찬성과 반대를 번갈아 주장하는 토론을 만들어 줘', ['persona', 'debate'])
a('multi', '내 생각엔 이 로고가 좋은데 더 나은 로고 아이디어 있으면 그려 줘', ['opinion', 'brainstorm', 'vague'])
# ---- neg (신호 없음) ----
for t in [
    '1부터 100까지 자연수의 제곱의 합을 구해 줘',
    '서울에서 부산까지 KTX로 얼마나 걸려?',
    '이 문장을 영어로 번역해 줘: 내일 비가 온다고 합니다.',
    '파이썬에서 리스트를 정렬하는 함수 이름이 뭐야?',
    '감자 조림 레시피 알려 줘',
    '오늘 점심 메뉴를 하나만 정해 줘',
    '이 에러 메시지가 무슨 뜻인지 알려 줘: IndexError: list index out of range',
    '화성의 평균 기온은 얼마야?',
    '다음 주 월요일이 무슨 요일인지 알려 줘',
    '아래 회의 내용을 세 줄로 요약해 줘.',
    '파이어폭스와 크롬의 차이를 표로 정리해 줘',
    'What is the capital of Australia?',
    '엑셀에서 두 열을 합치는 방법이 있어?',
    '자기소개서 첫 문장을 더 매끄럽게 고쳐 줘',
]:
    a('neg', t, [])
# ---- negation (빼 달라고 한 신호) ----
a('negation', '토론하지 말고 7의 222제곱을 13으로 나눈 나머지만 알려줘', [])
a('negation', '토론 없이 바로 답만 줘. 2의 50제곱을 9로 나눈 나머지는?', [])
a('negation', '전문가인 척하지 말고 그냥 편하게 설명해 줘. 인플레이션이 뭐야?', [])
a('negation', '풀이 과정은 필요 없고 정답만 말해 줘. 37 곱하기 43은?', [])
a('negation', '예시는 들지 말고 개념만 설명해 줘. 재귀가 뭐야?', [])
a('negation', '내 의견은 무시하고 객관적으로만 평가해 줘', [])
a('negation', '길게 토론하지 말고, 대신 두 명의 전문가가 토론하듯 풀어 줘', ['debate'])
a('negation', '단계별 설명은 빼고 결과만 줘. 18% 할인된 가격은?', [])
# ---- mention (신호 단어를 언급만 함) ----
a('mention', '토론이란 무엇인지 사전적 의미를 알려 줘', [])
a('mention', '토론 수업에서 쓰는 평가표 양식이 있을까?', [])
a('mention', '전문가가 되려면 어떤 자격증이 필요해?', [])
a('mention', '요즘 사람들이 많이 쓰는 앱 이름을 세 개 알려 줘', [])
a('mention', '학교 토론 대회 일정이 언제인지 달력에 적어 줘', [])
a('mention', '풀이집 PDF를 찾는 방법을 알려 줘', [])
a('mention', '예시라는 단어의 영어 표현은 뭐야?', [])

# 개발용(dev) 80% / 보류용(holdout) 20%: 종류별로 5개마다 1개를 보류로 뺀다(고정 규칙).
count = {}
out = []
for i, (kind, text, sig) in enumerate(R):
    n = count.get(kind, 0)
    count[kind] = n + 1
    split = 'holdout' if n % 5 == 4 else 'dev'
    out.append({'id': 'L%03d' % (i + 1), 'split': split, 'kind': kind, 'text': text, 'signals': sig})

path = sys.argv[1] if len(sys.argv) > 1 else 'eval/labels.json'
with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write('\n')
print('총 %d개 (dev %d, holdout %d)' % (len(out), sum(o['split'] == 'dev' for o in out), sum(o['split'] == 'holdout' for o in out)))
print({k: v for k, v in sorted(count.items())})
