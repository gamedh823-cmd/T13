# 학습용 프롬프트 데이터를 만든다 (합성 데이터, 개인정보 없음).
#   python train/gen.py   ->  train/data/train.jsonl
# 표현 사전(문구·본문·주제)은 내가 직접 쓴 것이고, 문장은 그 사전을 조합해 만든다.
# 라벨은 조합할 때 이미 알고 있으므로 따로 붙이지 않는다.
#
# 일반화 검사용 분할: 신호 문구는 번호가 4로 나눠 3 남는 것(1/4)을 "처음 보는 문구(unseen)"로 따로 빼서,
# 학습에는 쓰지 않고 "학습에서 못 본 표현도 잡는가"를 재는 데 쓴다.
# eval/labels.json(사람이 검토하는 평가용 라벨)의 문장은 학습에 들어가지 않게 마지막에 걸러 낸다.
import json, random, io, os, sys

random.seed(7)

# ---------------------------------------------------------------- 본문(신호 없는 일반 요청) ----
BODIES = [
    '7의 222제곱을 13으로 나눈 나머지를 구해 줘', '9876 곱하기 6789를 계산해 줘', '1부터 100까지 자연수의 제곱의 합을 구해 줘',
    '농도 10% 소금물 200g에 소금 20g을 더 넣으면 농도가 얼마가 되는지 알려 줘', '100! 끝에 연속으로 붙는 0이 몇 개인지 알려 줘',
    '이차방정식 x^2-5x+6=0을 풀어 줘', '시속 60km로 2시간 30분 달리면 몇 km인지 계산해 줘', '18% 할인된 가격이 얼마인지 계산해 줘',
    '파이썬에서 리스트를 정렬하는 방법을 알려 줘', 'SQL에서 두 테이블을 합치는 쿼리를 작성해 줘', '자바스크립트에서 배열 중복을 제거하는 코드를 보여 줘',
    '이 에러 메시지가 무슨 뜻인지 설명해 줘: IndexError: list index out of range', 'git에서 마지막 커밋을 취소하는 명령어를 알려 줘',
    '엑셀에서 두 열을 합치는 방법을 알려 줘', '리눅스에서 파일 크기를 확인하는 명령어를 알려 줘', '정규식으로 이메일 주소를 찾는 패턴을 만들어 줘',
    '다음 문장을 영어로 번역해 줘: 내일 비가 온다고 합니다', '이 문장을 더 자연스러운 한국어로 고쳐 줘', '아래 회의 내용을 세 줄로 요약해 줘',
    '자기소개서 첫 문장을 매끄럽게 고쳐 줘', '이메일 인사말을 정중하게 다듬어 줘', '이 글의 맞춤법을 확인해 줘', '이 단락을 두 문장으로 줄여 줘',
    '감자 조림 레시피를 알려 줘', '계란찜을 부드럽게 만드는 방법을 알려 줘', '김치볶음밥에 넣을 재료를 정리해 줘', '오늘 점심 메뉴를 하나만 정해 줘',
    '서울에서 부산까지 KTX로 얼마나 걸리는지 알려 줘', '다음 주 월요일이 무슨 요일인지 알려 줘', '화성의 평균 기온을 알려 줘', '광합성이 일어나는 과정을 요약해 줘',
    '인플레이션이 무엇인지 설명해 줘', '재귀 함수가 무엇인지 설명해 줘', '블록체인의 기본 원리를 설명해 줘', '미분과 적분의 관계를 설명해 줘',
    '파이어폭스와 크롬의 차이를 표로 정리해 줘', '전기차와 하이브리드차의 유지비를 비교해 줘', '아이폰과 갤럭시의 차이를 정리해 줘', '이 두 문장의 의미가 같은지 알려 줘',
    '이 코드에서 버그를 찾아 줘', '이 함수의 시간 복잡도를 알려 줘', '이 SQL 쿼리가 느린 이유를 알려 줘', '이 JSON을 보기 좋게 정리해 줘',
    '면접에서 자기소개를 어떻게 시작하면 좋은지 알려 줘', '이력서에 쓸 프로젝트 설명을 세 줄로 써 줘', '회의록 양식을 하나 만들어 줘', '발표 첫 문장을 하나 제안해 줘',
    '독후감 첫 문단을 써 줘', '이 시의 분위기를 한 문장으로 말해 줘', '이 소설의 줄거리를 간단히 요약해 줘', '노래 가사의 의미를 해석해 줘',
    '여행 가방에 꼭 넣을 것을 목록으로 정리해 줘', '일주일 운동 계획표를 만들어 줘', '하루 물 섭취량을 계산해 줘', '다이어트 중 간식으로 먹을 것을 알려 줘',
    '이 영수증의 합계를 계산해 줘', '월급의 20%를 저축하면 1년에 얼마인지 계산해 줘', '대출 이자를 계산하는 공식을 알려 줘', '환율 계산 방법을 알려 줘',
    '이 문장의 주어와 서술어를 찾아 줘', '영어 현재완료 시제의 쓰임을 설명해 줘', '이 단어의 반대말을 알려 줘', '이 표현이 맞는 문법인지 확인해 줘',
    '이 논문 초록을 한 문장으로 요약해 줘', '이 통계표를 해석해 줘', '표본 크기를 정하는 방법을 알려 줘', '상관관계와 인과관계의 차이를 알려 줘',
    '이 그래프가 의미하는 바를 설명해 줘', '평균과 중앙값의 차이를 알려 줘', '확률에서 조건부 확률이 뭔지 알려 줘', '행렬 곱셈 방법을 알려 줘',
    '이 이미지 파일을 줄이는 방법을 알려 줘', 'PDF를 워드로 바꾸는 방법을 알려 줘', '윈도우에서 화면을 캡처하는 단축키를 알려 줘', '맥에서 폴더를 압축하는 방법을 알려 줘',
    '도커 컨테이너를 재시작하는 명령어를 알려 줘', '깃허브 페이지를 켜는 방법을 알려 줘', 'API 키를 안전하게 보관하는 방법을 알려 줘', 'HTTP 상태 코드 404의 의미를 알려 줘',
    '지구와 달 사이의 거리를 알려 줘', '물이 끓는 온도가 높이에 따라 왜 달라지는지 알려 줘', '번개가 치는 원리를 알려 줘', '계절이 생기는 이유를 알려 줘',
    '조선시대 신분제도를 요약해 줘', '1차 세계대전이 일어난 배경을 알려 줘', '산업혁명이 가져온 변화를 정리해 줘', '민주주의의 기본 원칙을 알려 줘',
    '리액트에서 상태를 관리하는 방법을 알려 줘', 'CSS로 가운데 정렬하는 방법을 알려 줘', '반응형 웹의 기본 개념을 알려 줘', '웹 접근성에서 기본으로 챙길 것을 알려 줘',
    '택배가 늦을 때 보낼 문의 메시지를 써 줘', '친구에게 보낼 생일 축하 메시지를 써 줘', '교수님께 보낼 면담 요청 메일을 써 줘', '환불 요청 문구를 정중하게 써 줘',
    '고양이가 밥을 안 먹을 때 확인할 것을 알려 줘', '화분이 시드는 이유를 알려 줘', '냉장고에서 냄새를 없애는 방법을 알려 줘', '운동화 세탁하는 방법을 알려 줘',
]
TAILS = ['', '', '', ' 부탁해', ' 급해', ' 고마워', ' 빨리', ' 간단하게', ' 자세히']

# ---------------------------------------------------------------- 신호 문구 ----
# 각 항목: 본문 앞에 붙이는 문구(PRE)와 뒤에 붙이는 문구(POST). 번호 % 4 == 3 은 unseen.
DEBATE_PRE = [
    '두 명의 전문가가 토론하는 형식으로 ', '찬성과 반대 두 입장이 서로 반박하면서 ', 'A와 B가 토론하듯이 ', '서로 다른 입장의 두 사람이 논쟁하듯 ',
    '한 사람은 주장하고 다른 사람은 허점을 찾는 식으로 ', '두 AI가 서로 틀린 곳을 지적해 가며 ', '찬반 토론 형식으로 ', '일부러 반대 의견을 세워서 반박하게 하면서 ',
    '전문가 둘이 의견을 주고받으며 ', '두 사람이 번갈아 반박하는 대화로 ', '토론자 두 명이 맞서는 방식으로 ', 'Have two experts debate and rebut each other to ',
    '전문가 A가 먼저 답하고 전문가 B가 반박한 뒤 ', '내부에서 두 명이 논쟁을 벌여서 ', '서로 다른 두 관점이 부딪히게 해서 ', '찬성 측 반대 측으로 나눠 토론시켜 ',
]
DEBATE_POST = [
    '두 명이 토론해서 합의된 답을 알려 줘', '찬성 쪽과 반대 쪽 주장을 번갈아 보여 주고 결론을 내 줘', '토론 후 최종 합의안만 정리해 줘', '서로 반박한 뒤에 결론을 내려 줘',
    '두 전문가의 논쟁을 거쳐서 답을 정해 줘', 'Make two experts argue about it and give the agreed answer.', '한쪽이 틀린 점을 찾아 지적하게 하고 최종 답을 줘', '둘이 토론한 내용도 같이 보여 줘',
]
PERSONA_PRE = [
    '당신은 이 분야에서 20년 경력을 가진 전문가입니다. ', '너는 10년차 시니어 개발자야. ', '넌 친절한 선생님이야. ', '전문 변호사의 입장에서 ', '의사로서 ',
    '마케팅 전문가처럼 ', '당신은 세계 최고의 번역가입니다. ', '너는 꼼꼼한 회계사야. ', '역할: 경력 15년의 컨설턴트. ', 'You are an expert tutor. ',
    'Act as a senior engineer. ', '교수님처럼 ', '당신은 베테랑 요리사입니다. ', '너는 데이터 과학자라고 생각하고 ', '경력 30년의 건축가로서 ', '심리상담사의 관점에서 ',
]
PERSONA_POST = [
    '경력 20년 전문가처럼 답해 줘', '전문가의 말투로 답해 줘', '선생님이 설명하듯이 말해 줘', '그 분야 최고 전문가가 되어서 답해 줘', 'Answer as a professional would.', '의사 선생님처럼 차분하게 답해 줘',
]
COT_PRE = [
    '단계별로 생각해서 ', '풀이 과정을 하나씩 보여 주면서 ', '이유를 차근차근 설명하면서 ', "Let's think step by step. ", '과정도 같이 써서 ', '근거를 들어가며 ',
    '어떻게 그렇게 되는지 순서대로 적으면서 ', '생각한 순서대로 하나하나 적어 가면서 ', 'Show your reasoning and ', '중간 계산을 모두 보이면서 ', '왜 그런지 하나씩 따져 보면서 ', '논리적으로 풀어서 ',
]
COT_POST = [
    '풀이 과정도 함께 적어 줘', '어떻게 그렇게 나왔는지 순서대로 설명해 줘', '답만 말하지 말고 과정도 보여 줘', '이유를 단계별로 알려 줘', 'Please explain your steps.', '근거도 같이 써 줘',
]

# 문장 단위 생성 재료
TOPICS = [  # 다수 의견용: (주제 서술) -> "…에 대해"
    '재택근무', '전기차', '원격 수업', '사형제도', '기본소득', '주 4일 근무제', '비건 식단', 'AI 그림', '명절 차례', '대학 입시 제도',
    '최저임금 인상', '배달앱 수수료', '무인 매장', '셀프 계산대', '군대 복무 기간', '조기 영어교육', '청소년 SNS 제한', '반려동물 양육', '핵 발전', '채식주의',
]
MAJ_T = [
    '{t}에 대해 대부분의 사람들은 어떻게 생각해?', '{t}, 요즘 사람들은 찬성하는 편이야?', '{t}에 대해 다들 어떻게 생각하는지 알려 줘', '{t}에 대해 한국인 대다수는 어떻게 보는지 알려 줘',
    '보통 사람들은 {t}을(를) 어떻게 평가해?', '{t} 찬반 여론은 어느 쪽이 더 많아?', 'What do most people think about {te}?', '{t}에 대한 일반적인 시각은 어때?',
    '다수 의견은 {t}에 찬성이야 반대야?', '{t}, 사람들 대부분은 어떻게 느낄까?', '{t}에 대해 세상 사람들은 어떻게 생각한다고 봐?', '{t}에 대해 많은 사람들이 동의할까?',
]
TOPICS_EN = ['remote work', 'electric cars', 'online classes', 'basic income', 'a four-day work week', 'AI art', 'nuclear power', 'veganism']

CLAIMS = [
    '재택근무가 생산성을 높인다', '파이썬이 가장 배우기 쉬운 언어다', '이 정책이 옳다', '아침형 인간이 더 성공한다', '독서보다 영상이 더 효율적이다',
    '이 방법이 정답이다', '전기차가 곧 대세가 된다', '대학은 꼭 가야 한다', '이 디자인이 별로다', '이 에세이는 이미 완벽하다', '코딩은 수학을 잘해야 한다', '주식은 장기 투자가 답이다',
    '이 가격은 너무 비싸다', '내 계획이 가장 효율적이다', '이 코드는 문제가 없다', '이 번역이 가장 자연스럽다',
]
OP_T = [
    '제 생각에는 {c}고 보는데 어떻게 생각해?', '내 의견은 {c}는 거야. 너도 동의하지?', '난 {c}고 봐. 근데 너는 어때?', '내 생각엔 {c}는 것 같은데 맞지?',
    '아무리 봐도 {c}는 것 같은데, 틀린 데 있으면 말해 줘', '제 느낌으로는 {c}는 쪽이에요. 의견 줘', '나는 {c}고 확신해. 네 생각을 들려줘', '내가 보기엔 {c}는 게 확실한데 평가해 줘',
    'I think {ce}. Do you agree?', '제 판단으로는 {c}고 생각해요. 어떠세요?', '솔직히 난 {c}고 생각하는데 반박할 수 있어?', '내 입장은 이미 정해졌어. {c}는 거야. 확인만 해 줘',
]
CLAIMS_EN = ['this essay is already perfect', 'Python is the easiest language', 'remote work is better', 'this design is bad']

DOMAINS = ['게임 동아리', '독서 모임', '대학 학과 행사', '직장 팀', '가족 모임', '친구들과의 주말', '동네 카페', '스터디 그룹', '봉사 동아리', '신입생 환영회', '스타트업 팀', '체육대회']
THINGS = ['행사', '활동', '이벤트', '프로젝트 주제', '이름', '선물', '여행지', '회식 장소', '놀이', '모임 주제', '발표 소재', '졸업 작품 주제']
BS_T = [
    '{d}에서 할 만한 {x} 추천해 줘', '{d}에 어울리는 {x} 아이디어 좀 줘', '{d}의 {x}를 브레인스토밍해 줘', '{d}에서 색다른 {x} 없을까?', '{d}에서 할 {x}, 참신한 걸로 추천해 줘',
    'Any ideas for {de}?', '{d} {x} 뭐 하면 좋을까?', '{d}에서 한 번도 안 해 본 {x} 후보를 여러 개 줘', '{d}에서 신박한 {x} 좀 생각해 줘', '{d}를 위한 {x} 아이디어를 10개만 줘',
    '{d} {x}로 뭐가 좋을지 제안해 줘', '{d}에서 쓸 만한 {x} 목록을 만들어 줘',
]
DOMAINS_EN = ['a team event', 'my dad birthday gift', 'a weekend trip', 'a club name']

# fewshot: (입력, 출력) 예시쌍
PAIRS = [('사과', 'apple'), ('바나나', 'banana'), ('고양이', 'cat'), ('학교', 'school'), ('오늘 날씨 좋네요', '긍정'), ('배송이 너무 늦어요', '부정'), ('내일 3시에 만나요', '약속'), ('환불해 주세요', '요청'),
         ('서울', '대한민국'), ('파리', '프랑스'), ('2+3', '5'), ('4*6', '24')]
FS_TASK = ['이제 {x}의 결과를 알려 줘', '그럼 "{x}"는 어떻게 돼?', '같은 방식으로 "{x}"를 처리해 줘', '이제 새 입력 "{x}"에 답해 줘']
NEW_IN = ['포도', '우체국', '정말 고마워요', '비밀번호를 잊어버렸어요', '도쿄', '7*8', '토마토', '다음 주에 뵙겠습니다']
FS_FORMS = [
    lambda p, q, t: f'입력: {p[0]} 출력: {p[1]}. 입력: {q[0]} 출력: {q[1]}. {t}',
    lambda p, q, t: f'예를 들어 "{p[0]} → {p[1]}", "{q[0]} → {q[1]}" 같은 식이야. {t}',
    lambda p, q, t: f'Example: {p[0]} -> {p[1]}, {q[0]} -> {q[1]}. {t}',
    lambda p, q, t: f'예: "{p[0]}"는 {p[1]}. 예: "{q[0]}"는 {q[1]}. {t}',
    lambda p, q, t: f'이런 식으로 해 줘. {p[0]} => {p[1]} / {q[0]} => {q[1]}. {t}',
    lambda p, q, t: f'아래 샘플을 보고 따라 해 줘. 샘플1: {p[0]} - {p[1]} 샘플2: {q[0]} - {q[1]}. {t}',
    lambda p, q, t: f'내가 보여 주는 것과 같은 형식으로 답해 줘. 질문: {p[0]} 답: {p[1]}. 질문: {q[0]} 답: {q[1]}. {t}',
    lambda p, q, t: f'few-shot: [{p[0]}] -> [{p[1]}], [{q[0]}] -> [{q[1]}]. {t}',
]

# 이미지
SUBJ = ['사진 동아리 신입 부원 모집 포스터', '카페 로고', '유튜브 썸네일', '운동회 안내 배너', '생일 파티 초대장', '독서 모임 포스터', '게임 대회 홍보 배너', '봄 축제 포스터', '앱 아이콘', '가게 간판 디자인',
        '학교 행사 안내 포스터', '고양이 일러스트', '여행 사진 앨범 표지', '요가 클래스 전단지', '신제품 광고 이미지', 'a poster', 'a logo', 'a banner']
V_PRE = ['', '', '', '귀여운 ', '멋진 ', '간단한 ']
V_END = ['만들어 줘', '그려 줘', '디자인해 줘', '만들어 줘 부탁해', '하나 만들어 줘', '이미지로 뽑아 줘']
COLOR = ['파스텔톤 하늘색과 노란색 배색으로', '짙은 초록과 베이지 두 가지 색만 써서', '주황색과 흰색 배색으로', '어두운 파랑 배경에', '빨강과 검정 대비로', '연보라와 민트 톤으로', 'blue and white palette,', '따뜻한 갈색 톤으로']
LAYOUT = ['상단에 큰 글씨로 제목을 두고', '중앙에는 사람 일러스트를 배치하고', '하단에 일시와 장소를 넣고', '왼쪽에는 사진, 오른쪽에는 글씨를 두고', '가운데에 로고를 크게 배치하고', 'title at the top, image in the center,']
QUOTE = ['"함께해요"라는 문구를 넣고', '"가을 운동회" 문구를 넣고', '"프레임 속으로"라는 제목으로', '"Open Day" 문구를 넣고', '"충격 결말" 글씨를 노랗게 넣고', '"신입 모집" 문구로']
MOOD = ['산뜻하고 따뜻한 느낌으로', '영화 포스터 같은 분위기로', '활기찬 스타일로', '깔끔하고 모던한 스타일로', '손그림 같은 감성으로', 'clean modern style']

# 키워드를 언급만 하는 문장(신호 아님)
MENTION = [
    '토론이란 무엇인지 사전적 의미를 알려 줘', '토론 수업에서 쓰는 평가표 양식이 있을까?', '학교 토론 대회 일정이 언제인지 달력에 적어 줘', '토론 규칙을 한 문단으로 설명해 줘', '토론 동아리를 만드는 방법을 알려 줘',
    '전문가가 되려면 어떤 자격증이 필요해?', '전문가 인터뷰를 정리하는 방법을 알려 줘', '해당 분야 전문가를 찾는 사이트를 알려 줘', '전문가 의견과 일반인 의견의 차이를 설명해 줘',
    '요즘 사람들이 많이 쓰는 앱 이름을 세 개 알려 줘', '사람들이 많이 가는 여행지를 알려 줘', '인기 있는 노래 순위를 알려 줘', '대부분의 포유류가 가진 특징을 알려 줘',
    '풀이집 PDF를 찾는 방법을 알려 줘', '해설집과 문제집의 차이를 알려 줘', '예시라는 단어의 영어 표현을 알려 줘', '예시 파일을 내려받는 방법을 알려 줘', '예제 폴더가 어디 있는지 알려 줘',
    '단계라는 단어의 뜻을 알려 줘', '이유라는 단어를 영어로 어떻게 써?', '생각이란 무엇인지 철학적으로 설명해 줘', '의견 수렴 절차를 알려 줘', '추천 시스템이 어떻게 동작하는지 알려 줘',
    '아이디어 노트 앱을 추천해 줘', '브레인스토밍 도구의 종류를 알려 줘', '반박 논리의 종류를 사전처럼 정리해 줘', '역할극 놀이 규칙을 알려 줘', '경력직 이직 절차를 알려 줘',
]
NEG_WRAP = [  # (부정 문구, 같이 쓸 본문 종류) -> 결과 신호 없음
    '토론하지 말고 ', '토론 없이 ', '토론은 빼고 ', '반박하지 말고 ', '두 명이 논쟁하지 말고 ', '전문가인 척하지 말고 ', '전문가 역할은 필요 없고 ', '역할극 말고 ',
    '풀이 과정은 필요 없고 ', '풀이 과정은 빼고 ', '단계별 설명은 빼고 ', '이유는 말하지 말고 ', '예시는 들지 말고 ', '예시 없이 ', '샘플은 필요 없고 ',
    '길게 설명하지 말고 ', '과정은 생략하고 ', "Don't debate, just ", 'Without explanation, ', 'No step-by-step; just ',
]
NEG_OP = ['내 의견은 무시하고 객관적으로만 평가해 줘', '내 생각은 신경 쓰지 말고 사실만 알려 줘', '내 의견은 빼고 중립적으로 평가해 줘', '제 생각은 잊고 있는 그대로 판단해 줘']


def unseen(i):
    return i % 4 == 3


def pick(seq):
    i = random.randrange(len(seq))
    return seq[i], unseen(i)


def tail():
    return random.choice(TAILS)


rows = []


def add(text, signals, kind, uns=False):
    rows.append({'text': text.strip(), 'signals': sorted(signals), 'kind': kind, 'split': 'val_unseen' if uns else 'train'})


def body():
    return random.choice(BODIES)


def sig_text(sig):
    """신호 하나가 들어간 문장 조각 만들기: (text, unseen) 반환. 본문 없는 문형은 text 전체."""
    if sig == 'debate':
        if random.random() < .6:
            p, u = pick(DEBATE_PRE)
            return p + body() + tail(), u
        po, u = pick(DEBATE_POST)
        return body() + '. ' + po, u
    if sig == 'persona':
        if random.random() < .65:
            p, u = pick(PERSONA_PRE)
            return p + body() + tail(), u
        po, u = pick(PERSONA_POST)
        return body() + '. ' + po, u
    if sig == 'cot':
        if random.random() < .6:
            p, u = pick(COT_PRE)
            return p + body() + tail(), u
        po, u = pick(COT_POST)
        return body() + '. ' + po, u
    if sig == 'majority':
        if random.random() < .1:
            t = random.choice(TOPICS_EN)
            return 'What do most people think about %s?' % t, False
        i = random.randrange(len(MAJ_T))
        t = random.choice(TOPICS)
        return MAJ_T[i].replace('{te}', random.choice(TOPICS_EN)).replace('{t}', t), unseen(i)
    if sig == 'opinion':
        i = random.randrange(len(OP_T))
        c = random.choice(CLAIMS)
        return OP_T[i].replace('{ce}', random.choice(CLAIMS_EN)).replace('{c}', c), unseen(i)
    if sig == 'brainstorm':
        i = random.randrange(len(BS_T))
        d = random.choice(DOMAINS)
        x = random.choice(THINGS)
        return BS_T[i].replace('{de}', random.choice(DOMAINS_EN)).replace('{d}', d).replace('{x}', x), unseen(i)
    if sig == 'fewshot':
        i = random.randrange(len(FS_FORMS))
        p, q = random.sample(PAIRS, 2)
        t = random.choice(FS_TASK).replace('{x}', random.choice(NEW_IN))
        return FS_FORMS[i](p, q, t), unseen(i)
    raise ValueError(sig)


def image(specific):
    subj = random.choice(SUBJ)
    if specific:
        k = random.choice([3, 3, 4])
        feats = random.sample([COLOR, LAYOUT, QUOTE, MOOD], k)
        parts = [random.choice(f) for f in feats]
        random.shuffle(parts)
        return '%s를 만들어 줘. ' % subj + ' '.join(parts) if not subj.startswith('a ') else 'Create %s: ' % subj + ' '.join(parts), 'specific'
    k = random.choice([0, 0, 0, 1])
    pre = random.choice(V_PRE)
    text = '%s%s %s' % (pre, subj, random.choice(V_END)) if not subj.startswith('a ') else 'Make me %s.' % subj
    if k == 1:
        text += ' ' + random.choice([random.choice(COLOR), random.choice(MOOD)]).replace('로', '', 0)
    return text, 'vague'


# ---------------------------------------------------------------- 생성 ----
SINGLE = ['debate', 'persona', 'majority', 'cot', 'opinion', 'brainstorm', 'fewshot']
N_SINGLE = 110   # 신호당
for s in SINGLE:
    for _ in range(N_SINGLE):
        t, u = sig_text(s)
        add(t, [s], 'pos', u)
for _ in range(110):
    t, s = image(True)
    add(t, [s], 'pos')
for _ in range(110):
    t, s = image(False)
    add(t, [s], 'pos')

# 여러 신호
COMBOS = [('persona', 'debate'), ('persona', 'cot'), ('opinion', 'cot'), ('majority', 'opinion'), ('majority', 'brainstorm'), ('persona', 'brainstorm'),
          ('debate', 'cot'), ('persona', 'fewshot'), ('opinion', 'brainstorm'), ('persona', 'debate', 'cot')]
for combo in COMBOS:
    for _ in range(18):
        # 본문 기반 신호(debate/persona/cot)는 한 본문에 접두를 겹쳐 쓰고, 문장형 신호는 이어 붙인다.
        parts, uns, sigs = [], False, set(combo)
        body_based = [c for c in combo if c in ('debate', 'persona', 'cot')]
        sent_based = [c for c in combo if c not in ('debate', 'persona', 'cot')]
        b = body()
        pres = ''
        posts = []
        for c in body_based:
            if c == 'debate':
                p, u = pick(DEBATE_PRE)
            elif c == 'persona':
                p, u = pick(PERSONA_PRE)
            else:
                p, u = pick(COT_PRE)
            pres += p
            uns = uns or u
        text = pres + b
        for c in sent_based:
            t, u = sig_text(c)
            text = text + '. ' + t
            uns = uns or u
        add(text, sigs, 'multi', uns)

# 신호 없음(일반 문장)
for _ in range(170):
    add(body() + tail(), [], 'neg')
# 부정 표현: 신호를 빼 달라고 한 문장 -> 신호 없음
for _ in range(110):
    w = random.choice(NEG_WRAP)
    add(w + body(), [], 'negation')
for t in NEG_OP:
    for _ in range(4):
        add(t, [], 'negation')
# 언급만 한 문장 -> 신호 없음
for t in MENTION:
    for _ in range(3):
        add(t + tail(), [], 'mention')
# 부정 + 실제 신호(앞은 빼고 뒤는 쓰라는 문장)
for _ in range(40):
    ng = random.choice(NEG_WRAP[:5])
    p, u = pick(DEBATE_PRE) if 'debate' else (None, None)
    add('%s대신 %s%s' % (ng, p, body()), ['debate'], 'negation_pos', u)

# ---------------------------------------------------------------- 정리 ----
# 같은 문장 제거, 평가용 라벨 문장 제거
seen, out = set(), []
eval_texts = set()
ep = os.path.join(os.path.dirname(__file__), '..', 'eval', 'labels.json')
if os.path.exists(ep):
    eval_texts = {x['text'].strip() for x in json.load(io.open(ep, encoding='utf-8'))}
for r in rows:
    if r['text'] in seen or r['text'] in eval_texts:
        continue
    seen.add(r['text'])
    out.append(r)
random.shuffle(out)
for i, r in enumerate(out):
    r['id'] = 'T%04d' % (i + 1)

dst = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(dst, exist_ok=True)
with io.open(os.path.join(dst, 'train.jsonl'), 'w', encoding='utf-8', newline='\n') as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

from collections import Counter
print('총 %d개' % len(out))
print('종류별:', dict(Counter(r['kind'] for r in out)))
print('분할:', dict(Counter(r['split'] for r in out)))
sc = Counter()
for r in out:
    for s in r['signals']:
        sc[s] += 1
print('신호별 정답 수:', dict(sc))
print('신호 없음:', sum(1 for r in out if not r['signals']))
