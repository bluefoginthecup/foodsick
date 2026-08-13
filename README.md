# 아파요 지도

음식점 이름과 정확한 위치를 공개하지 않고, 지역별 위장관 증상 신고 증가를 살펴보는 모바일 우선 PWA MVP다. 특정 업소의 식중독 발생을 판정하거나 안전도를 평가하지 않는다.

## 현재 구현 범위

- 비식별 행정구역 지도와 최근 1년 날짜·음식 유형 필터
- 선택 지역 기준 시청·구청·보건소 연락처 및 대학병원·응급실·내과 검색
- 카카오 로그인 연동 경계와 외부 키 없는 체험 로그인
- 식사, 증상, 동행자, 의료정보 다단계 신고 설문
- 잠복시간 계산, 음식점 내부 장소 ID 매칭
- 동일 사용자·음식점·식사일 중복 방지와 기존 신고 수정
- 독립 신고와 동행 증상자 분리 집계
- 규칙 기반 클러스터와 동→구→시 재식별 방지 관문
- 관리자 신고·클러스터·감사기록 화면
- Firebase Security Rules 초안과 PWA 민감 경로 캐시 차단
- App Check 기반 Cloud Functions 신고 생성·수정 API
- Firestore 원자적 중복 방지, 사용자별 요청 제한, 관리자 감사기록
- Firebase 웹 클라이언트와 서울 리전 Callable Functions 연결 어댑터

Firebase 프로젝트 `foodsick-signal-map-kr`와 웹 클라이언트 설정은 연결되어 있다. 화면의 인증과 신고 저장은 Kakao OAuth와 App Check 키가 준비되기 전까지 브라우저 세션 체험 모드로 동작한다. 운영 전에는 두 설정을 완료하고 `NEXT_PUBLIC_AUTH_MODE=firebase`로 전환해야 한다.

## 실행과 검증

Node.js 22.13 이상이 필요하다.

```bash
npm install
npm run dev
npm test
npm run lint
npm run functions:build
npm run functions:test
```

환경변수는 `.env.example`을 참고한다. 실제 비밀키는 저장소에 커밋하지 않는다.

## 공개 금지 경계

공개 데이터에는 음식점 상호·주소·정확 좌표·내부 음식점 ID·신고 ID·사용자 ID를 포함하지 않는다. 원본 신고와 공개 집계는 별도 컬렉션 및 별도 API 경계로 운영한다.
