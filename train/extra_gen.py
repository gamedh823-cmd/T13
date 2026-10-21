# 사람이 직접 쓴 것처럼 말투를 다양하게 쓴 학습 문장(합성 템플릿이 아니라 한 문장씩 직접 작성).
#   python train/extra_gen.py   ->  train/data/extra_handwritten.jsonl
# 라벨 정의는 eval/README.md와 같다. 평가용 라벨(eval/labels.json)과 같은 문장은 자동으로 뺀다.
# 5번째마다 1개는 학습에 쓰지 않고 "새 말투 검증용(val_hand)"으로 따로 둔다.
import io, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
D = {}

D['debate'] = """
이 문제를 풀 때 한 명은 풀이를 쓰고 다른 한 명은 틀린 데를 찾아내는 식으로 둘이 주고받게 해줘
찬성파랑 반대파가 맞붙는 토론처럼 전기차 보조금 문제를 정리해줘
갑과 을이 서로 주장을 펼치고 반박하는 형식으로 이 계약 조건을 검토해줘
Let two experts argue opposite sides of this question and then tell me who wins.
이 아이디어에 대해 비판하는 사람과 옹호하는 사람이 번갈아 말하는 대화를 만들어줘
시뮬레이션 토론 해줘. 주제: 학교에서 휴대폰 금지해야 하는가
두 명의 면접관이 서로 다른 의견으로 내 답변을 평가하다가 결국 합의하게 해줘
이 코드 설계가 맞는지 개발자 A는 찬성, 개발자 B는 반대로 토론시켜줘
악마의 변호인 역할을 하는 AI와 내 편을 드는 AI가 논쟁하게 해줘
Simulate a debate between a skeptic and an enthusiast about remote work.
서로 의견이 다른 두 교수가 이 이론을 놓고 설전을 벌이는 장면으로 설명해줘
한 번 이 주장에 대한 찬반 논쟁을 쭉 돌려보고 마지막에 정리해줘
답을 내기 전에 두 가지 관점이 충돌하게 해서 허점을 찾게 해줘
A팀 B팀으로 나눠서 서로 논리를 공격하는 방식으로 진행해줘
두 사람이 각자 다른 결론을 주장하다가 점점 의견을 좁혀 가는 대화로 설명해줘
토론 형식이면 더 좋겠어. 찬성 근거 셋 반대 근거 셋 서로 반박하는 걸로
검사와 변호사가 법정에서 공방을 벌이는 것처럼 이 사례를 분석해줘
내가 틀렸다고 가정하고 반박하는 쪽과 내가 맞다는 쪽이 싸우게 해줘
두 AI가 서로 답을 검증하며 대립하다가 합의된 값만 내놔줘
이 정책의 장점을 말하는 쪽과 단점을 말하는 쪽의 논쟁을 한 편 써줘
Have a prosecutor and a defense attorney argue this case back and forth.
둘이 의견이 갈리는 부분을 직접 따져가며 토론해서 결론 내줘
찬반을 번갈아 주장하는 대화체로 부탁해요
서로 반대 입장에 서서 상대 논리의 약점을 하나씩 짚어 주는 대화로 만들어주세요
This is a two-agent task: one proposes, the other critiques, then they agree.
한 사람이 설명하면 다른 사람이 계속 딴지를 거는 방식으로 이해시켜줘
논쟁 구도로 만들어줘. 낙관론자 vs 비관론자
회의에서 부장님은 찬성하고 대리님은 반대하는 장면으로 이 안건을 검토해줘
두 전문가가 서로 의견을 반박하면서 최종 권장안을 만드는 식으로 부탁드립니다
""".strip().splitlines()

D['persona'] = """
지금부터 넌 베테랑 소아과 의사야. 아이가 열이 날 때 어떻게 해야 하는지 알려줘
당신은 20년차 인사팀장입니다. 제 이력서를 평가해 주세요
너는 까칠한 편집장이야. 이 기사 초안을 냉정하게 고쳐줘
Pretend you are a senior security auditor reviewing this login flow.
저는 지금 면접을 준비 중이에요. 면접관이 되어서 질문해주세요
역할 설정: 중학교 수학 선생님. 설명은 쉽게 해줘
넌 이제부터 여행 가이드야. 교토 2박 3일 코스 짜줘
You are a patient kindergarten teacher. Explain why the sky is blue.
세무사처럼 답해줘. 프리랜서 종합소득세 신고는 어떻게 해?
너는 스타트업 CTO라고 생각하고 이 기술 스택을 평가해줘
당신은 세계적인 요리 연구가입니다. 파스타 면 삶는 비법을 알려주세요
너 시니어 UX 디자이너잖아. 이 화면 흐름 어디가 불편한지 말해줘
기자의 입장에서 이 보도자료를 어떻게 쓸지 알려줘
Act as an experienced Python mentor and review my code.
너는 헬스 트레이너야. 초보자용 주 3회 루틴 짜줘
카운슬러가 되어 내 고민을 들어주고 조언해줘
법률 전문가로서 이 약관에서 위험한 조항을 짚어줘
너의 역할은 영어 회화 파트너야. 카페 주문 상황으로 대화하자
저는 초등학생이고 당신은 과학 박사님이에요. 쉽게 설명해 주세요
넌 유능한 비서야. 내일 일정 정리해줘
As a professional copywriter, write a tagline for my bakery.
이 분야 최고 권위자라고 생각하고 답변해줘
소믈리에처럼 설명해줘. 이 와인 어떤 음식이랑 어울려?
너는 시험 출제위원이야. 이 단원에서 나올 만한 문제를 내줘
전문 번역가의 시각으로 이 문장의 뉘앙스를 설명해줘
Take the role of a strict code reviewer.
당신은 15년 경력의 물리치료사입니다. 허리 통증 스트레칭을 알려주세요
""".strip().splitlines()

D['majority'] = """
요즘 20대는 결혼에 대해 어떻게 생각해? 대체로 긍정적이야?
사람들 대부분이 아이폰이 더 낫다고 생각해?
한국 직장인 다수는 주 4일제에 찬성하는 편인가요?
Do most people actually enjoy working from home?
이거 나만 그런 거야 아니면 다들 그렇게 느껴? 월요일이 제일 싫은 거
일반 대중은 AI가 일자리를 뺏을 거라고 믿고 있어?
보통 사람들은 연봉이랑 워라밸 중에 뭘 더 중요하게 여겨?
세상 사람들 대부분은 이 영화를 명작이라고 봐?
대다수 학부모는 사교육에 어떤 입장이야?
여론조사에서는 이 법안에 찬성이 더 많아?
What is the general public opinion on nuclear energy?
다들 이 가격이면 비싸다고 생각해? 객관적인 평균 반응이 궁금해
대부분의 개발자들이 선호하는 에디터는 뭐야?
일반적인 시선으로 볼 때 이런 행동은 무례한 걸로 여겨져?
대중적으로는 이 정책 평가가 어때?
Most people I know hate this feature. Is that how the majority feels?
사람들 의견이 어느 쪽으로 기울어 있는지 알려줘. 비건 식단에 대해서
지금 한국 사회에서 다수의 생각은 어디에 가까워?
많은 사람이 동의하는 편이야 아니면 반대가 많아?
대다수의 의견을 알고 싶은데, 반려동물 안락사에 대해 어떻게 생각한대?
이 질문에 대한 통념은 뭐야? 다들 그렇게 믿는 거 맞아?
전체적으로 소비자 반응이 좋은 편이었어?
""".strip().splitlines()

D['cot'] = """
정답만 말하지 말고 어떻게 풀었는지 한 줄씩 적어줘. 3x+7=25
이 확률 문제를 푸는 순서를 처음부터 끝까지 보여줘
논리 퍼즐인데, 추론 과정을 하나씩 써 가면서 답해줘
Walk me through your reasoning step by step before giving the final number.
계산 과정을 생략하지 말고 중간 단계까지 다 보여줘
왜 그 답이 나오는지 이유도 같이 설명해줘. 17의 제곱은?
생각하는 과정을 먼저 쓰고 마지막에 결론을 말해줘
단계별로 접근해서 이 코드 오류를 찾아줘
Think it through carefully and explain each step of the derivation.
풀이를 단계마다 번호 붙여서 알려줘
어떤 근거로 그렇게 판단했는지 차례대로 적어줘
먼저 문제를 쪼개고 하나씩 풀어서 합치는 식으로 해줘
이 증명을 한 단계도 건너뛰지 말고 설명해줘
답이 틀릴 수 있으니까 사고 과정을 보여줘
Show your work, line by line.
복리 이자 계산하는 과정을 쉬운 말로 순서대로 알려줘
논리적으로 따져 가면서 이 주장이 맞는지 검토해줘
이 문제는 풀이가 길어도 괜찮으니까 과정 전부 적어줘
결론 먼저 말하지 말고 추론을 쌓아 올려서 마지막에 말해줘
How did you get that? Break it down into steps.
어떻게 그런 결과가 나왔는지 단계별로 짚어줘
중간중간 왜 그렇게 하는지 이유를 달아서 풀어줘
점화식을 세우는 과정부터 차근차근 보여줘
""".strip().splitlines()

D['fewshot'] = """
아래처럼 변환해줘. 'hello' -> '안녕', 'thank you' -> '고마워'. 이제 'good night'은?
예) 입력: 배고파 / 출력: 😋. 예) 입력: 졸려 / 출력: 😴. 입력: 화났어
다음 샘플들의 톤을 따라서 공지문을 써줘. 샘플: '여러분 안녕하세요! 오늘도 힘내봐요 :)'
Follow this pattern: Q: 2+2 A: four. Q: 3+5 A: eight. Q: 6+1 A:
내가 쓴 이 두 문장처럼 짧고 건조하게 써줘. '회의는 3시입니다.' '자료는 메일로 보냅니다.'
예시를 먼저 줄게. 제목: 비 오는 날 / 한 줄: 우산을 두고 온 오후. 이런 식으로 다른 제목도 써줘
이렇게 분류해줘 (예: '배송 지연' -> 불만, '감사합니다' -> 칭찬). 새 문장: 상품이 파손됐어요
Here are two examples of the format I want: [Title] - [Summary]. Now do the same for this article.
보기 1: 사과=과일, 보기 2: 당근=채소. 이 기준으로 토마토를 분류해줘
형식은 이거야 -> 이름: 홍길동 / 나이: 20. 같은 형식으로 아래 사람들도 정리해줘
아래 예제처럼 JSON으로 바꿔줘. 예제 입력: 사과 3개 -> {\"item\":\"사과\",\"qty\":3}
참고 문장: '오늘 하루도 수고했어요.' 이런 따뜻한 말투로 안부 인사 써줘
예시1: 서울 -> Seoul, 예시2: 부산 -> Busan. 그럼 대구는?
Example output: '✅ Done: task A'. Give me the same style for tasks B and C.
내가 아래에 붙인 답안이 모범 형태야. 이 형태에 맞춰서 다른 문제도 답해줘
이 샘플을 흉내 내서 제품 설명 세 개 더 만들어줘. 샘플: '가볍고 튼튼한 데일리 백팩'
샘플처럼 한 줄 요약부터 쓰고 불릿 세 개로 정리해줘. 샘플: 요약: 비용 절감 / - 인건비 / - 임대료
형식 예시: 12/03(수) 14:00 회의. 이 형식으로 일정 다시 적어줘
Like this: 'cat → cats, dog → dogs'. Pluralize 'box' and 'child'.
이 두 번역을 보고 같은 문체로 다음 문장도 번역해줘. 원문1 -> 번역1, 원문2 -> 번역2
앞에서 보여준 템플릿 그대로 이번 주 보고서를 채워줘
""".strip().splitlines()

D['opinion'] = """
나는 이 문제 답이 12라고 생각하는데 맞아?
내 생각엔 이직하는 게 맞는 것 같아. 너도 그렇게 생각하지?
솔직히 이 코드는 충분히 깔끔하다고 봐. 어떻게 생각해?
I believe the plan is solid. Can you confirm?
난 이 영화가 올해 최고라고 확신해. 네 평가는?
이 기획안은 문제없다고 판단했어. 검토해줘
저는 AI가 곧 모든 직업을 대체한다고 봅니다. 맞는 말이죠?
내가 느끼기엔 이 가격이 적당한데 아닌가?
I'm pretty sure the answer is B. Am I right?
개인적으로는 아침형 인간이 더 유리하다고 믿는데 어때?
내 결론은 이미 정해졌어. 이 설계는 최선이야. 동의해줘
저는 이 디자인이 촌스럽다고 생각해요. 맞나요?
내 입장은 확고해. 월급보다 시간이 더 중요해. 의견 줘
생각해 보니까 내 방식이 더 효율적인 것 같은데 평가 좀
In my view, tabs are better than spaces. Thoughts?
나는 이 글이 완벽하다고 믿어. 고칠 필요 없지?
제가 보기엔 이 번역이 가장 자연스러운데 맞죠?
내 느낌상 이번 시험은 쉬웠던 것 같아. 너도 그렇게 봐?
나는 그 사람이 잘못했다고 생각하는데 넌 어때?
여러 가지 해봤는데 결국 내 첫 번째 안이 낫더라. 맞는지 확인해줘
I think I should quit. You agree, right?
내 판단으로는 이 투자가 안전한 것 같은데 어떻게 봐?
""".strip().splitlines()

D['brainstorm'] = """
이번 주말에 혼자 할 만한 거 뭐 없을까?
앱 이름 후보 좀 많이 뽑아줘. 짧고 기억에 남는 걸로
Give me ten fresh ideas for a team-building activity.
동아리 홍보 방법 아이디어 있으면 아무거나 던져줘
부모님 선물 뭐가 좋을까? 감이 안 와
블로그 글감이 떨어졌어. 쓸 만한 주제 추천해줘
수업 시간에 할 재밌는 게임 아이디어 좀
What are some creative side project ideas for a beginner?
기념일에 색다른 이벤트 뭐 할 수 있을까?
졸업 여행지 후보를 다양하게 제안해줘
유튜브 콘텐츠 소재 좀 줘. 남들이 안 한 걸로
어떤 책을 읽으면 좋을지 추천해줘. 요즘 기분 전환이 필요해
Brainstorm names for my new coffee shop.
팀 회식 메뉴 후보 몇 개만 추천해줘
저녁에 뭐 해 먹을지 아이디어 줘
발표 주제로 뭐가 좋을지 감이 안 와. 여러 개 생각해줘
이 프로젝트를 더 재밌게 만들 방법이 있을까? 아이디어 많이 부탁해
Any suggestions for a rainy day activity?
취미로 시작할 만한 게 뭐가 있을까
신박한 창업 아이템 좀 던져봐
학교 축제 부스 뭐 하면 인기 많을까?
어떤 노래 부르면 좋을지 추천해줘. 분위기 띄울 만한 걸로
""".strip().splitlines()

D['specific'] = """
가을 독서 캠페인 포스터 만들어줘. 베이지 배경에 갈색 글씨, 위쪽에 큰 제목 '책 읽는 가을', 가운데에 단풍잎과 책 일러스트, 차분하고 따뜻한 분위기로
로고 시안 부탁해. 이름은 'Mellow', 파스텔 핑크와 크림색 두 가지, 글자 위에 작은 구름 아이콘, 포근하고 부드러운 느낌
Design a flyer: dark navy background, gold title 'Grand Opening' centered at the top, a small cafe photo on the right, elegant tone.
인스타 피드용 이미지 만들어줘. 민트색 배경, 가운데 큰 글씨로 'Good Morning', 아래쪽에 작은 해 모양, 밝고 경쾌한 분위기
배너 하나 그려줘: 빨간색과 흰색, 좌측에 '세일 50%' 큰 문구, 우측에 쇼핑백 일러스트, 시선을 확 끄는 스타일
앱 소개 썸네일. 보라색 그라데이션 배경, 중앙에 스마트폰 목업, 상단에 '쉽게 시작하세요' 문구, 미래적이고 깔끔한 느낌
결혼식 초대장 이미지: 아이보리 바탕, 금색 테두리, 위쪽에 '저희 결혼합니다', 하단에 날짜와 장소, 고급스럽고 단정한 분위기
Create a poster for a jazz night: black and gold palette, saxophone silhouette in the center, 'Jazz Night' in large letters at the top, smoky vintage mood.
행사 안내 포스터. 노란색과 검정색 대비, 상단 '야간 마라톤', 중앙에 달리는 사람 실루엣, 에너지 넘치는 느낌
책 표지 이미지 부탁해. 짙은 초록 바탕, 하단에 흰색 글씨로 '숲의 기억', 가운데 나무 한 그루, 신비로운 분위기
학원 홍보 전단 만들어줘. 하늘색과 흰색, 위에 '1:1 맞춤 수업', 가운데에 칠판과 학생 그림, 믿음직하고 밝은 느낌
썸네일: 왼쪽에 놀란 표정 얼굴, 오른쪽에 큰 노란 글씨 '이게 가능해?', 배경은 짙은 파랑, 자극적인 유튜브 스타일
A birthday card image: pastel yellow background, 'Happy Birthday Mina' in curly letters at the top, balloons at the corners, cheerful and playful.
동아리 모집 포스터를 디자인해줘. 배경은 연한 회색, 위에 '함께 달려요', 가운데 달리는 사람들 일러스트, 주황색 포인트, 건강하고 활기찬 분위기
카페 메뉴판 이미지: 크래프트지 질감 배경, 상단에 'Today's Menu', 좌우로 음료와 디저트 칸 배치, 빈티지한 손글씨 느낌
""".strip().splitlines()

D['vague'] = """
카페 포스터 하나만 만들어줘
깔끔한 로고 부탁해
생일 카드 이미지 만들어줘
Make a cool banner for my channel.
행사 배너 디자인해줘
귀여운 곰 그림 그려줘
면접 준비 모임 홍보 이미지 만들어줘
Design a logo for my startup.
썸네일 이미지 하나 뽑아줘
감성적인 포스터 부탁해
우리 가게 간판 시안 좀
Generate a poster for a movie night.
동아리 로고 만들어줘
초대장 디자인 부탁해요
캠페인 포스터 하나 그려줘
Create an illustration of a cat reading a book.
앱 아이콘 만들어줘
카드뉴스 표지 이미지 부탁해
세련된 포스터가 필요해
그림 하나 그려줘, 바다 풍경
""".strip().splitlines()

NEG = """
오늘 서울 날씨 어때?
이 문장의 맞춤법 좀 봐줘: 오랫만에 친구를 만났다
파이썬으로 파일 읽는 법 알려줘
내일 아침 7시에 알람 맞추는 방법이 뭐야
Can you convert 5 miles to kilometers?
이 영수증 금액 합계 계산해줘
커피 원두 보관법 알려줘
한글 파일을 PDF로 바꾸려면 어떻게 해?
What time zone is Tokyo in?
이 회의록 세 줄로 줄여줘
엑셀 VLOOKUP 쓰는 법을 알려줘
비행기 수하물 규정이 어떻게 돼?
지하철 막차 시간 확인하는 방법 알려줘
Translate 'good morning' into Japanese.
USB 인식이 안 될 때 확인할 것 알려줘
이 메일에 정중하게 답장 써줘. 내용: 일정 변경 요청
소수 판별하는 함수 하나 만들어줘
설날이 올해 몇 월 며칠이야?
cron 표현식 매일 새벽 2시는 어떻게 써?
국민연금 납부 방법 알려줘
단어 'ubiquitous' 뜻이 뭐야?
CSV 파일에서 빈 줄 지우는 명령어 알려줘
감기에 걸렸을 때 먹으면 좋은 음식이 뭐야
what is the difference between TCP and UDP
이력서 사진 크기 규격이 어떻게 돼?
오늘 날짜로 며칠 남았는지 계산해줘 12월 25일까지
도커 이미지 지우는 명령어
프린터 연결이 안 돼. 확인할 것 알려줘
Convert this sentence to passive voice: The cat chased the mouse.
자기소개서에 쓸 글자수 세는 방법이 뭐야
노트북 배터리 오래 쓰는 법 알려줘
다음 문장의 주어가 뭔지 알려줘
브라우저 캐시 지우는 방법
세금 계산서가 뭔지 짧게 설명해줘
이 에러 어떻게 고쳐? TypeError: undefined is not a function
Summarize this paragraph in one sentence.
삼겹살 굽는 온도 알려줘
핸드폰 공장초기화하는 순서 알려줘
이 사진 파일 용량 줄이는 법
오늘 환율 확인하는 사이트 있어?
""".strip().splitlines()

NEGATION = """
토론 같은 건 하지 말고 그냥 결론만 알려줘
전문가인 척 안 해도 되니까 편하게 설명해줘
설명은 빼고 값만 줘. 15% 팁이면 얼마야
예시는 필요 없어. 개념만 짧게 알려줘
역할극은 하지 말고 사실만 정리해줘
풀이 과정은 생략하고 최종 답만 말해줘
내 의견은 신경 쓰지 말고 객관적으로만 판단해줘
Don't pretend to be an expert, just answer plainly.
No debate, no steps — just the result please.
반박이나 논쟁 없이 정리만 해줘
단계별 말고 한 줄로 요약해줘
샘플 말고 그냥 설명만 해줘
Skip the examples. Define the term only.
다수 의견이 어떤지는 말고 사실 위주로 알려줘
전문가 말투는 쓰지 말고 쉬운 말로 알려줘
이유는 설명하지 말고 정답만 알려줘
""".strip().splitlines()

MENTION = """
토론 수업 지도안을 어떻게 짜는지 알려줘
토론의 역사에 대해 간단히 설명해줘
전문가 자문 비용이 보통 얼마야
전문가 시스템이 뭔지 설명해줘
역할 분담표 양식 하나 만들어줘
페르소나 마케팅이 뭔지 설명해줘
풀이집 파는 서점 알려줘
예시문을 한 편 찾고 있어. 어디서 구해?
예제 코드 저장소 추천해줘
대다수라는 단어가 한자로 뭐야
다수결 원칙이 뭔지 알려줘
의견서 양식을 알려줘
추천서 작성 방법 알려줘
아이디어 회의 진행 순서가 뭐야
단계라는 말의 유의어가 뭐야
생각 정리하는 앱 이름이 뭐가 있어
""".strip().splitlines()

rows = []
for sig, block in D.items():
    for t in block:
        rows.append((t.strip(), [sig], 'hand'))
for t in NEG:
    rows.append((t.strip(), [], 'hand'))
for t in NEGATION:
    rows.append((t.strip(), [], 'hand_negation'))
for t in MENTION:
    rows.append((t.strip(), [], 'hand_mention'))

# 여러 신호가 한 문장에 든 것 (직접 작성)
MULTI = [
    ('너는 20년차 의사야. 두 명의 의사가 서로 반박하며 이 증상 원인을 따져줘', ['persona', 'debate']),
    ('내 생각엔 답이 7인데 풀이 과정도 단계별로 보여주면서 맞는지 확인해줘', ['opinion', 'cot']),
    ('대부분의 사람들은 이 정책에 어떻게 반응해? 나는 반대가 더 많다고 보는데', ['majority', 'opinion']),
    ('마케팅 전문가로서 동아리 행사 아이디어 좀 추천해줘', ['persona', 'brainstorm']),
    ('예시처럼 해줘. 입력: 사과 출력: apple. 그리고 단계별로 번역 과정도 보여줘. 입력: 포도', ['fewshot', 'cot']),
    ('변호사 입장에서 찬성과 반대를 번갈아 주장하는 토론을 만들어줘', ['persona', 'debate']),
    ('요즘 사람들이 많이 하는 취미 뭐야? 색다른 것도 추천해줘', ['majority', 'brainstorm']),
    ('난 이 방법이 맞다고 생각해. 근거를 단계별로 설명해주고 반론도 해줘', ['opinion', 'cot']),
    ('Act as a teacher and show your reasoning step by step.', ['persona', 'cot']),
    ('내 의견은 이게 최선이야. 두 전문가가 토론해서 내가 맞는지 판단해줘', ['opinion', 'debate']),
    ('가을 축제 포스터를 만들어줘. 노란색과 갈색, 상단에 \'가을 축제\', 가운데에 은행잎, 따뜻한 느낌. 예시 분위기: \'추수 감사\' 포스터', ['specific', 'fewshot']),
    ('카페 로고 아이디어를 여러 개 추천해줘. 간단한 로고로', ['brainstorm', 'vague']),
    ('전문가처럼 단계별로 설명해줘. 예: \'입력 3 → 출력 9\' 같은 규칙이야', ['persona', 'cot', 'fewshot']),
    ('대다수 사람들 생각이 궁금해. 내 생각엔 찬성이 많을 것 같아', ['majority', 'opinion']),
    ('두 사람이 토론하듯이 단계별로 풀이해줘. 문제: 2의 10제곱', ['debate', 'cot']),
    ('Most people think this is fine, but I think it is not. Walk me through why step by step.', ['majority', 'opinion', 'cot']),
    ('재미있는 이벤트 아이디어 추천해줘. 요즘 인기 있는 건 어떤 거야?', ['brainstorm', 'majority']),
    ('이 샘플 형식 그대로 쓰고, 선생님 말투로 설명해줘. 샘플: 오늘의 한 줄 - 열심히!', ['fewshot', 'persona']),
]
for t, s in MULTI:
    rows.append((t, s, 'hand_multi'))

# 평가용 라벨과 겹치는 문장 제거, 같은 문장 제거
def norm(t):
    return re.sub(r'[\s\.,!?"\'“”‘’~·…]+', '', t).lower()

eval_texts = {norm(x['text']) for x in json.load(io.open(os.path.join(HERE, '..', 'eval', 'labels.json'), encoding='utf-8'))}
eval_texts |= {norm(x['text']) for x in json.load(io.open(os.path.join(HERE, '..', 'eval', 'real_use.json'), encoding='utf-8'))}
seen, out = set(), []
for t, s, k in rows:
    n = norm(t)
    if not t or n in seen or n in eval_texts:
        continue
    seen.add(n)
    out.append({'text': t, 'signals': sorted(s), 'kind': k})
for i, r in enumerate(out):
    r['id'] = 'H%04d' % (i + 1)
    r['split'] = 'val_hand' if i % 5 == 4 else 'train'

dst = os.path.join(HERE, 'data', 'extra_handwritten.jsonl')
with io.open(dst, 'w', encoding='utf-8', newline='\n') as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
from collections import Counter
print('총 %d개 (train %d, val_hand %d)' % (len(out), sum(r['split'] == 'train' for r in out), sum(r['split'] == 'val_hand' for r in out)))
sc = Counter(s for r in out for s in r['signals'])
print('신호별:', dict(sc), '| 신호 없음:', sum(1 for r in out if not r['signals']))
