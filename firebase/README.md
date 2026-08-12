# Firebase 운영 연결 경계

현재 UI는 외부 키 없이 검증할 수 있는 체험 모드다. 운영 연결 시 다음 작업은 Cloud Functions 2세대에서만 수행한다.

- Kakao authorization code 교환, 사용자 회원번호 HMAC, Firebase Custom Token 발급
- 신고 입력 서버 검증, 잠복시간 계산, `dedupeKeys`와 `reports`의 원자적 트랜잭션
- 사용자별·IP별 rate limit, App Check 강제 검증
- 음식점 원본 정보 매칭과 canonical restaurant 병합
- 클러스터 계산, 재식별 방지 관문, `publicSignals` 생성
- 관리자 custom claim 확인, 모든 관리자 변경의 `adminAuditLogs` 기록

클라이언트는 `reports`, `restaurants`, `clusters`, `dedupeKeys`, `authIdentities`, `adminAuditLogs`에 직접 쓰지 않는다. 공개 지도 역시 Firestore 원본을 직접 읽지 않고 App Check가 적용된 aggregate API만 호출한다.
