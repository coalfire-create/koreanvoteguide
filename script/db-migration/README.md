# DB 분리 마이그레이션 — 이유 앱 전용 DB로 이관

현재 Supabase DB는 학교 시간표 앱·예약 앱 등 **여러 앱이 한 데이터베이스를 공유**하고 있습니다.
이 디렉토리의 도구로 **이유 앱 테이블만** 새 전용 DB로 옮깁니다.

## 왜 분리하나
- `db:push` 한 번에 타 앱 테이블이 삭제될 위험 제거
- 키 유출 시 신뢰 반경(blast radius) 축소 — 정치 데이터 ↔ 미성년 학생 데이터 격리
- 개인정보처리방침/위탁 고지 정합성

## 이관 대상 (35개 테이블)
`app-tables.txt` 참조. `shared/schema.ts`의 Drizzle 테이블 + 런타임 생성분(`bill_opinion_votes`, `user_blocks`, `device_tokens`) + `session`(connect-pg-simple).
**제외**(타 앱 소유, 이 앱 미참조): `members`, `phone_verifications`, `sms_subscriptions`, `briefings`, `timetables`, `teachers`, `schools`, `filter_tabs`, `navigation_menus`, `allowed_student_ids`, `banners`, `notices`, `popups`, `reservations`, `reviews`, `summary_timetables`, `teacher_*`, `summer_images`, `level_test_registrations`, `briefing_events`, `notice_images`.

## 사전 준비
1. **새 Supabase 프로젝트 생성** (같은 리전 `ap-northeast-2` 권장).
2. 새 프로젝트의 **다이렉트 연결 문자열**(포트 5432) 확보. (이관은 풀러 말고 다이렉트 권장.)
3. **Postgres 클라이언트 설치** — `pg_dump`/`psql` major 버전이 서버 이상이어야 함.
   ```bash
   brew install libpq && brew link --force libpq    # macOS
   pg_dump --version                                 # 서버(보통 15~17) 이상인지 확인
   ```

## 실행
```bash
export SOURCE_DATABASE_URL='postgresql://...(현재 공유 DB, 다이렉트 5432)'
export TARGET_DATABASE_URL='postgresql://...(새 전용 DB, 다이렉트 5432)'

# 1) 덤프 + 복원
bash script/db-migration/migrate.sh

# 2) 행 수 대조 검증
tsx script/db-migration/verify.ts
```

검증이 통과하면:
3. 앱의 `DATABASE_URL`(.env / Render 환경변수)을 **새 전용 DB**로 교체 후 재배포.
4. Supabase Storage도 새 프로젝트 버킷으로 옮길 거면 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`도 교체.
5. 정상 동작 확인 후, **구 공유 DB의 이유 앱 테이블은 그대로 두거나**(다른 앱과 무관) 별도 백업 후 정리.

## 주의
- 데이터는 **추가만** 합니다(TARGET은 빈 새 DB 권장).
- FK가 타 앱 테이블을 참조하지 않으므로(검증됨) 35개 테이블은 자체 완결적으로 복원됩니다.
- 실패 시 `ON_ERROR_STOP=1`로 즉시 중단되어 부분 복원을 막습니다. 로그 확인 후 TARGET을 비우고 재시도.
- **롤백**: `DATABASE_URL`을 다시 구 DB로 되돌리면 됩니다(구 DB는 건드리지 않음).
