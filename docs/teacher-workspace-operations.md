# 교사 작업 화면 운영 연결

현재 구성은 기존 GitHub Pages + Firebase `ssamtalk-sbs` + Supabase `bpdxbqsvkvvybrtgvrnf`를 유지한다. 공개 사이트의 코드·배치·스냅샷 열은 변경하지 않았다.

## 반영 순서

1. `npm test`, `node scripts/check-syntax.js` 및 Deno 검사 통과를 확인한다.
2. Supabase SQL Editor에서 `supabase/migrations/20261021081846_teacher_workspace.sql`을 한 트랜잭션으로 실행한다. 기존 데이터는 지우지 않는다. CLI `db push`는 쓰지 않는다(기존 마이그레이션은 SQL Editor에서 실행되어 원격 이력과 다를 수 있음).
3. Supabase Edge Function `comsw-tools`를 배포한다. `supabase/config.toml`의 `verify_jwt=false`는 함수 안에서 Firebase RS256 서명, issuer, audience, 만료, `comsw_role`을 직접 검사하기 위한 설정이다. 인증 없이 업무 작업을 실행하지 않는다.
4. 아래 비밀값을 Supabase Edge Functions > Secrets에서 넣는다. 채팅·저장소·브라우저 프런트 코드에 키나 토큰을 붙여넣지 않는다.
5. 테스트 계정에서 실제 커리큘럼 원문·크롭 이미지 제출 → 학과장 요약 → 승인 → 미리보기, 프로필 원본·사용 동의 제출 → 학과장 생성 → 승인 → 미리보기를 확인한다. 실제 공개는 기존 ‘적용’ 버튼으로 진행한다.
6. 사용자 확인 후 main에 반영한다. GitHub Pages에서 새 파일을 제공한 뒤 기존 로그인으로 확인한다.

## 서버 비밀값

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY` | 요약·프로필 API 전용 키 |
| `GOOGLE_CLIENT_ID` | 관리자 Drive OAuth 클라이언트 |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 비밀값 |
| `GOOGLE_REFRESH_TOKEN` | 관리자 개인 Drive 계정의 offline 갱신 토큰 |
| `GOOGLE_DRIVE_FOLDER_ID` | 기존 공개 자료 폴더 `1jiXHizCoG1ynl2mXOEZrWUeRjrUxZzdk` |
| `GOOGLE_DRIVE_PRIVATE_FOLDER_ID` | 소유자만 접근하는 별도의 본인 사진 원본 폴더. 공개 자료 폴더 안에 만들지 않는다. |
| `COMSW_USD_KRW` | 원화 예산 환율. 기본 2000. 실제 결제 환율보다 충분히 높게 유지 |
| `COMSW_ALLOWED_ORIGINS` | 허용 화면 origin 목록. 기본 GitHub Pages와 로컬 화면 확인 주소 |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 함수에 제공한다. 서비스 키는 서버 내부에서 자산 등록·비용 원장 처리에만 사용한다. 사용자 자료 조회는 사용자 Firebase 토큰을 사용하는 Supabase 클라이언트와 RLS를 통과한다.

관리자 Google 계정으로 [서버용 OAuth offline 동의](https://developers.google.com/identity/protocols/oauth2/web-server#offline)를 한 번 완료한다. Drive 파일 생성·공유에 필요한 범위를 사용하고, 토큰은 Secrets에 보관한다. 개인 Drive 폴더에 서비스 계정 업로드 방식은 사용하지 않는다. 원본 폴더와 원본 파일의 권한을 매번 확인하여 소유자 이외 권한이 있으면 업로드·다운로드를 거절한다.

공개용 이미지 업로드는 파일 생성과 `anyone/reader` 공유가 모두 성공해야 링크를 돌려준다. 원본 사진에는 공개 공유를 적용하지 않는다. 실패한 새 파일은 가능한 경우 Drive 휴지통으로 이동한다.

## AI 비용과 결과

- 요약 모델 `gpt-4.1-mini`, 출력 최대 512토큰, 원문 12,000자·지시문 4,000자 제한. 원문·지시문·모델 해시가 같은 요약은 계정별로 재사용한다.
- 프로필 모델 `gpt-image-2.5-flare`, medium, 1024×1536, transparent PNG. 원본 긴 변을 1024로 제한하고 생성본을 중앙 잘라 941×1672 PNG로 만든다. 원본과 생성본은 각각 보관한다.
- [OpenAI 이미지 API 문서](https://developers.openai.com/api/docs/guides/image-generation), [요금 문서](https://developers.openai.com/api/docs/pricing)를 기준으로 모델 지원·요금을 확인했다. 모델 변경 시 예약액/토큰 단가도 함께 검토해야 한다.
- 예산 원장은 한국 시간 월별로 모든 계정을 합산한다. DB 잠금 안에서 먼저 예약하여 동시 요청도 3,000원을 넘겨 예약하지 못한다. 요약은 UTF-8 바이트 수를 입력 토큰의 보수적인 상한으로 잡고 출력 512토큰을 포함한다. 프로필은 `1.4달러 × 설정 환율`을 예약한다. 예약액이 남은 예산보다 크면 실행하지 않는다.
- 사용량 응답에 입력 토큰당 5달러/백만(사진은 8달러), 출력 30달러/백만의 보수적 단가를 적용하여 원화로 정산한다. 이는 실제 청구액과 다른, 여유 있게 계산한 **앱 예산 사용액**이다. 요금·환율 변동 및 이 앱 밖의 API 사용액까지 제한하는 기능은 아니므로 OpenAI 프로젝트 예산도 보조로 설정한다.
- 응답이 불확실한 실패는 예약액을 자동 환불하지 않는다. 실제 OpenAI 사용 내역을 확인한 뒤 운영자가 원장을 조정해야 한다. 사용량이 예약 상한을 넘으면 실패로 남기며 추가 호출을 자제하고 단가·모델을 점검한다.
- AI 결과는 자동 공개되지 않는다. 교사 커리큘럼과 프로필은 승인 후 적용, 관리자 표의 요약은 확인 후 적용한다.
- AI 요약·프로필 생성은 학과장·관리자만 실행한다. 교사 화면은 원문·사진 제출만 제공하고 AI 실행 API도 역할을 검사한다. 커리큘럼 요약은 ‘강사 커리큘럼’의 대기 표에서 생성·확인하고, 프로필은 ‘강사 > 선생님 요청 확인’에서 전달받은 동의된 원본 사진으로 생성한다.
- 메인 화면의 ‘AI 설정·이번 달 사용량’에서 지시문과 연결 상태·사용/예약 합계를 확인한다. 교사 화면에서는 월 예산 안내를 표시하지 않는다. 서버 비용 한도는 유지한다.

## 커리큘럼 이미지 자르기

파일 선택·드롭 후 업로드 전에 정사각형 크롭 화면을 제공한다. 원본은 가로·세로 모두 1000px 이상이어야 하며, 가로형·세로형 등 비율 제한은 없다. 드래그 또는 가로/세로 위치 슬라이더와 크기 슬라이더로 영역을 선택한다. 선택 영역도 최소 1000px을 유지하고, 원본에서 바로 1000×1000 PNG를 만든다. 취소하면 Drive 요청을 하지 않는다. 서버는 해당 kind의 이미지가 실제 정사각형이고 최소 1000px인지 검사한다. 링크로 연결한 기존 자료·영상과 프로필 생성용 원본은 그대로 사용한다.

## 기존 데이터 정리

2026-10-21 운영 SQL 조회: 대상 raw 15행, 보존할 `seminar_applications` 9건, 신청자 외 raw 1,891행. 이 숫자는 조회 시점 값이며 삭제 직전에 다시 확인한다.

같은 날 `tools/protect-applicant-raw.sql`의 제한 정책을 운영 DB에 먼저 적용했다. 공개 anon API에서 두 신청자 raw 시트는 0행이며, 매일 깨우기용 비신청자 1행 읽기는 성공함을 확인했다. 실제 raw 삭제는 아직 하지 않았다.

1. 세 시트에 연결된 Apps Script의 트리거 목록을 확인한다. `tools/gas-stop-sheet-sync.gs`의 미리보기로 실제 핸들러 이름을 얻고, 시트→Supabase 복사 함수만 지정해 중지한다. **`keepSupabaseAlive`는 절대로 삭제하지 않는다.** 이 함수만 실행하는 매일 오전 9시 트리거가 남아 있는지 확인한다.
2. 기존 신청자 raw 복사본 정리 대상으로 `tools/cleanup-applicants.sql`의 조건을 확인한 뒤 실행한다. `source_id='main'`이고 시트명이 정확히 ‘특강 신청’ 또는 ‘특강 신청자 명단’인 행만 지운다. 새 신청 명단과 다른 raw 행은 유지한다.
3. 익명 읽기에서 해당 두 raw 시트가 0행인지 확인한다. SQL의 보존 대상은 매일 깨우기에서 1행 읽는 자료로 남는다.

원본 Google Sheet의 탭 삭제·전체 신청 기록 삭제는 이 SQL에 포함하지 않는다. 개인정보가 담긴 원본·백업을 공개 저장소에 추가하지 않는다.

## 로컬 화면 확인과 검사

`node scripts/preview-server.mjs` 실행 후 `http://127.0.0.1:8787/test/admin-preview.html`을 연다. 예시 데이터만 사용하며 실제 계정·Drive·AI에 연결되지 않는다. 선생님/학과장 선택으로 메뉴 구성을 확인한다.

```
npm test
node scripts/check-syntax.js
npx deno check --config supabase/functions/comsw-tools/deno.json supabase/functions/comsw-tools/index.ts
npx deno test --config supabase/functions/comsw-tools/deno.json tools/test/portrait.deno.ts
```

운영 배포·Secrets 설정·실제 Google OAuth/API 호출·원본 GAS 트리거 변경은 로컬 테스트 통과만으로 완료된 것이 아니다. 각 운영 반영 후 실제 요청 결과로 확인한다.
