# 📱 App Store 제출 체크리스트 — 이유 (com.antigravity.iyu)

> 마지막 점검: 2026-05-24 · Capacitor iOS 8.x · 앱명 `이유`

---

## ✅ 이미 준비된 것

- [x] Capacitor iOS 프로젝트 (`ios/App`)
- [x] `capacitor.config.ts` — appId `com.antigravity.iyu`, appName `이유`, webDir `dist/public`
- [x] 앱 아이콘 1024px (`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`)
- [x] `WKAppBoundDomains` — `이유.com` + 펀니코드 `xn--910b5b83d7ya.com`
- [x] **계정 삭제(회원탈퇴)** — `withdrawUser` (비식별화 + 30일 후 완전삭제) → 애플 5.1.1(v) 충족
- [x] 세로 모드 고정, 스플래시 화면(`#6D28D9`, 2초)
- [x] 프로덕션 빌드 정상 (`npm run build` → `dist/public` 생성)
- [x] Apple Developer Program 계정 보유
- [x] 마케팅 버전 `1.0` / 빌드 `1`

---

## 🚫 제출 전 필수 (블로커)

### 1. Sign in with Apple (가이드 4.8) — **✅ 코드 구현 완료, Apple 콘솔 설정만 남음**
구글·카카오·네이버 소셜 로그인이 있으면 애플이 'Sign in with Apple' 제공을 **의무화**.
- [x] 서버 유틸 `server/utils/apple-oauth.ts` (client_secret JWT 서명 + id_token JWKS 검증, `jose`)
- [x] 라우트 `GET /api/auth/apple` + `POST /api/auth/apple/callback` (form_post)
- [x] 스키마 `users.apple_id` + 유니크 인덱스 (런타임 ALTER로 DB 반영 완료)
- [x] 클라이언트 `AppleLoginButton` (검정 버튼, auth 페이지에 노출)
- [ ] **(본인) Apple Developer → Services ID 생성** (`com.antigravity.iyu.service`)
- [ ] **(본인) Sign in with Apple 키(.p8) 발급** → Key ID·Team ID 확보
- [ ] **(본인) Return URL 등록**: `https://이유.com/api/auth/apple/callback`
- [ ] **(본인) 서버 환경변수 5개 설정** (아래 "환경변수" 참고) → Render 재배포
- [ ] **(본인) Xcode**: App 타겟에 'Sign in with Apple' Capability 추가

### 2. 웹 로딩 방식 (가이드 4.2) — **✅ 결정: A안(server.url 유지)**
`server.url: https://이유.com` 유지 → 모든 로그인·세션이 그대로 동작. 번들링 보류(v1.1).
- [ ] **(권장) 4.2 방어용 네이티브 기능 1개 추가** — 예: 푸시알림(`@capacitor/push-notifications`) 또는 공유(`@capacitor/share`)
- [ ] 심사 노트에 "공공데이터(선관위·국회) 기반 + 커뮤니티·평가·AI분석 등 네이티브 경험" 강조

### 3. 개인정보처리방침 / 이용약관 URL
- [x] `server/legal-pages.ts` 존재 (확인됨) — 공개 URL 접근 가능한지 검증 필요
- [ ] App Store Connect 개인정보 URL 입력
- [ ] 개인정보 영양성분표(Privacy Nutrition Labels) 작성 — 수집 항목: 이메일/전화/이름/기기

### 4. 정치·선거 콘텐츠 심사 대응
- [ ] 한국 선거 정보 앱 — 공직선거법 준수 문구, 출처 표기(선관위/국회 공공데이터)
- [ ] 중립성 고지(앱 내 이미 일부 존재)

---

## 🔧 코드로 할 일 (Claude 가능)

- [x] Sign in with Apple 서버/클라이언트 구현
- [ ] (선택) 4.2 방어용 네이티브 플러그인 1개 통합
- [ ] 개인정보처리방침 공개 라우트 점검

## 🚨 DB 경고 — 반드시 확인

`npm run db:push` 실행 시 **이 앱과 무관한 테이블 7개 삭제**를 시도함:
`briefings, timetables, teachers, filter_tabs, schools, navigation_menus, allowed_student_ids` (학교 시간표 앱 테이블로 보임).

- ⚠️ **`npm run db:push` 쓰지 말 것** — 위 테이블 데이터가 삭제됨. 이 프로젝트는 `server/db.ts`의 런타임 `ALTER TABLE ... IF NOT EXISTS` 패턴으로 스키마를 반영함(apple_id도 이 방식으로 처리됨).
- [ ] **`DATABASE_URL`이 의도한 DB가 맞는지 확인** — 다른 앱과 DB를 공유 중일 수 있음. 출시 전 분리 권장.

---

## 👤 본인이 직접 (Xcode / Apple, 자동화 불가)

1. **Xcode 서명**: `ios/App/App.xcworkspace` 열기 → Signing & Capabilities → Team 선택, Automatically manage signing
2. **Capabilities 추가**: Sign in with Apple, Push(선택)
3. **App Store Connect 앱 생성**: 번들ID `com.antigravity.iyu`, 앱명, 카테고리(News/Reference)
4. **스크린샷**: 6.7"(1290×2796) + 6.5" + iPad(필요시) — 시뮬레이터로 캡처
5. **메타데이터**: 설명, 키워드, 지원 URL, 마케팅 URL, 연령등급(정치 콘텐츠 17+ 가능성)
6. **개인정보 영양성분표** 입력
7. **아카이브 & 업로드**: Xcode → Product → Archive → Distribute App → App Store Connect
8. **심사 제출**: TestFlight 내부 테스트 후 Submit for Review

---

## ⚠️ 번들링 영향 (server.url 제거 시)

프론트엔드를 앱에 번들하면 웹뷰 origin이 `capacitor://localhost`로 바뀌어:

| 항목 | 영향 | 대응 |
|------|------|------|
| API 호출 108곳 | 상대경로 `/api` 깨짐 | fetch 인터셉터로 절대주소 보정 |
| 세션 쿠키 | `SameSite=lax`라 교차출처 전송 안 됨 | `SameSite=None; Secure` + CORS |
| **소셜 로그인** | 서버 리다이렉트 방식이 웹뷰에서 동작 안 함 | **네이티브 OAuth 전면 재설계** (시스템 브라우저 + 딥링크) |

> 대안: `server.url` 유지(모든 인증 그대로 동작) + 푸시알림 등 **네이티브 기능 추가**로 4.2 대응.

---

## 📦 빌드 → 동기화 명령

```bash
npm run build          # dist/public 생성
npx cap sync ios       # 네이티브로 동기화 (cap:ios:sync)
npx cap open ios       # Xcode 열기 (cap:ios:open)
```

---

## 🔑 필요한 환경변수 (프로덕션/네이티브)

```
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_SERVICE_ID=com.antigravity.iyu.service
APPLE_PRIVATE_KEY=        # .p8 내용
APPLE_REDIRECT_URI=https://이유.com/api/auth/apple/callback
ALLOWED_ORIGIN=https://이유.com,capacitor://localhost   # 번들링 시
```
