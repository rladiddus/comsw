# Claude 대화 이어가기 메모 (V3 작업)

> **새 대화를 시작하면 Claude는 이 파일과 `record_v3.md`를 먼저 읽고 이어서 작업한다.**
> 비밀 키·개인정보는 적지 않는다. 마지막 갱신: 2026-11-11.
> 용도: **다음 대화의 Claude가 바로 이어 일할 수 있게** 하는 메모(일하는 방식·지금 상태·답을 기다리는 질문·기술 메모). V3 화면의 자세한 상태는 `record_v3.md`, 작업 일지는 `record.md`.

## 사용자와 일하는 방식 (꼭 지킬 것)

- **모든 글은 한국어로 쓴다.** 작업 중간에 보내는 메시지도 한국어로 쓴다. 사용자는 영어를 모른다. 쉬운 말과 익숙한 메뉴 이름을 쓴다.
- **브랜치 `redesign`에서 작업한다.** main 합치기·push(=배포)는 **사용자가 "배포해"라고 할 때만** 한다. 배포는 테스트 전부 통과 → `main`에 fast-forward → `git push origin main redesign` → 공개 사이트 확인 순서.
- **작업이 하나 끝날 때마다 기록 세 곳을 갱신하고 커밋한다**(사용자 지시 2026-11-11):
  - `record.md`: 맨 아래 목록에 그 작업 한 줄(무엇을·왜·SQL·매뉴얼).
  - `record_v3.md`: 바뀐 메뉴의 "5. 메뉴별 지금 상태", 정책이 바뀌면 3, SQL은 6, 남은 일은 7, 배포하면 2와 맨 위 줄.
  - `claude-mem.md`(이 파일): "지금 상태", "답을 기다리는 질문", 새로 정한 것, 다음에 필요한 기술 메모.
- 커밋 메시지 끝에는 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.
- **DB 구조 변경과 운영 SQL은 사용자가 직접 실행한다.** SQL 파일과 pglite 테스트만 만든다. 운영 DB를 읽는 SQL은 자동 권한에서 막혀 있다. SQL 실행 전에도 화면이 열리게(그 기능만 잠김) 만든다.
- 사용자가 "코딩은 말고 의견만"이라고 하면 코드를 고치지 말고 설명만 한다.
- Codex 검토는 DB·권한·핵심 기능을 바꿨을 때 **제안만** 한다. 실행 전에 승인을 받고, read-only로 돌리며, 명령 끝에 `< /dev/null`을 붙인다. 단순 UI 수정에는 제안하지 않는다.
- 주황 색은 그대로 둔다. V3 화면을 바꾸면 매뉴얼(`manual/v3-head.html`, `v3-teacher.html`)도 고친다.
- 보고할 때: 무엇이 **실제 저장**되고 무엇이 **화면/브라우저에만** 남는지, 브라우저에서 확인했는지, 배포했는지를 꼭 밝힌다.

## 지금 상태 (2026-11-11)

- V3 시험판 `admin-v3/` (로컬 `http://localhost:8787/admin-v3/`, 운영 DB 연결 · 배포본 `https://rladiddus.github.io/comsw/admin-v3/`).
- **2026-11-11 세 번째 배포**: 11-05 작업(승인 대기 한 화면 세 쪽, 과목 로드맵 문구, 준비물 작성·그룹 설정 등)을 main에 합쳐 올렸다. 테스트 352개·문법 검사 통과.
- 운영 SQL은 `20261105010000_subject_roadmap_summary.sql`까지 모두 사용자가 실행했다. 남은 SQL 없음.
- 11-11 네 번째 배포(`eedd15e`, 공개 사이트 반영 확인): 강사 관리 줄 공개 체크·공개 위 정렬·팝업 저장하면 목록 바로 갱신, 학과 관리 '다시 만들기 필요'는 AI생성하면 사라짐, 로드맵 [저장]·'−' 늘 보이기. 테스트 353개 통과. 브라우저 확인은 아직.
- 메뉴별 상태는 `record_v3.md` 5번.

## 답을 기다리는 질문 (다음 대화에서 먼저 확인)

- (11-11 다섯 번째 배포 `0bfb65f`: 과목 관리 [과목 삭제] 탭·학과 관리 [제외]만·과목 생성 '전체 학과', 공개 사이트 반영 확인)
1. 다른 메뉴(학과 관리·로드맵·커리큘럼 관리 등)의 학과 드롭다운에도 '전체'를 넣을지: 사용자 말 "모든 학과 드롭다운 메뉴에서 전체를 추가"를 과목 관리 안 두 곳으로 해석했다. 다른 화면은 한 학과씩 보는 화면이라 넣지 않았다 — 확인 필요.
- (정리됨 11-11) 로드맵 [저장] 만듦. 스텝 삭제 팝업 버튼 순서는 바꾸지 않기로.

## 사용자가 정한 것 (시간 순 요약)

- 10-29~30: 로드맵 한 단계에 과목 여러 개(8A 변경). "재료"→"준비물", 4분류 "준비물"→"물품". 승인 대기에서 바로 승인. **정책 7**: 과목 하나를 모든 학과가 공용, 과목 아래는 강사별 커리큘럼, 학과마다 다른 것은 과목 목록·순서뿐. 방특은 기수마다 새 과목 ID(6B). 로드맵 문구는 과목마다 하나. 메뉴마다 고른 것 따로 기억. 강사 커리큘럼·과목 통합에서 방특 삭제(방특은 방학 특강·승인 대기에서).
- 10-30: 특강·세미나를 운영 메뉴로, 공개 체크. 강사 관리 새 화면. "학과 관리"·"학과별 과목 순서" 메뉴 삭제(옛 것). 각 화면 아래 "기존 화면" 칸은 요청이 오는 대로 지운다.
- 11-02: 첫 배포, V3 매뉴얼 두 개.
- 11-03: "과목 통합 커리큘럼"→**"학과 관리"**(과목 순서 DB 저장), "강사 커리큘럼"→**"커리큘럼 관리"**. 과목 관리 탭 [과목 생성][과목 정리][그룹 만들기]. **과목 그룹은 이름만 있는 묶음**(대표 과목 방식 버림). 타 강사 수업 설정. 두 번째 배포.
- 11-05: 내 커리큘럼 과목 탭은 수업 설정에서 고른 과목만(본인·타강사). 승인 대기 **한 화면 세 쪽**(제출 커리큘럼 → 과목별 커리큘럼 → 로드맵 문구 → [적용]). AI는 세 쪽 모두 스위치(처음 꺼짐). 학과장이 [준비물 작성]으로 대신 작성, 준비물이 있으면 그룹 필수. 수업별 준비물은 그룹 이름으로 묶음.
- 11-11: 11-05 작업 배포. **이후 모든 작업마다 `record_v3.md`·`claude-mem.md`도 용도에 맞게 갱신**.
- 11-11: 강사 줄 끝 공개 체크, 전체 탭 공개 위·비공개 아래, 팝업 고치면 새로고침 없이 갱신. AI생성하면 '다시 만들기 필요' 없앰. 로드맵 [저장] 만들기, [과목 삭제] 버튼 없애고 '−' 늘 보이기, 스텝 삭제 팝업 버튼 순서는 그대로.
- 11-11: 과목 삭제는 과목 관리에서만. 학과 관리에는 [제외]만. 과목 관리에 [과목 삭제] 탭(과목 생성 바로 오른쪽): 학과 드롭다운(전체 학과)·과목명 검색, 과목/강사/체크, 여러 개 한 번에 삭제. 과목 생성 드롭다운에도 '전체 학과'.
  - 사용자가 '트랙' 질문을 이해 못 했다 → 공개 사이트 로드맵을 확인하니 학과마다 한 줄뿐이라 묻지 않고 '여러 줄이면 저장 막기'로 처리. 설명할 때 '트랙' 같은 DB 말 대신 '로드맵 줄'이라고 쓴다.

## 기술 메모 (다음 작업 때 필요한 것)

- 테스트: `node --test --test-concurrency=1 "admin/test/*.test.mjs" "tools/test/*.test.mjs"`(352개, 약 7분). 따옴표 친 glob을 써야 한다. 동시에 돌리면 메모리가 부족하다.
  - V3 화면 테스트는 `admin/test/v3.dom.test.mjs`(jsdom과 `fake-supabase.mjs`). SQL 테스트는 `tools/test/*.test.mjs`(pglite, `pg.mjs`의 `freshDb(before)`·`runMigration`).
  - 문법 검사는 `node scripts/check-syntax.js`. `admin/` 파일을 고치면 `node scripts/stamp-admin.mjs`를 돌린다.
- 주의: bash heredoc 안의 python 문자열에 `\n`을 쓰면 실제 줄바꿈으로 바뀌어 JS가 깨진다. Edit 도구나 scratchpad의 python 파일을 쓴다. 테스트 파일은 줄 끝이 CRLF다.
- 메뉴 정의: `admin-v3/js/app.mjs`의 `GROUPS`(묶음: 운영 메뉴 / 선생님 / 업무 / 사이트 운영). 선생님은 `TEACHER` 목록만.
- 공통 기능: `admin-v3/js/v3.mjs` — `state`, `usePage`, `contextBar(depts, onChange, extra, cohorts)`, `deptSubjects`(정규는 DB 순서만, 브라우저 순서는 방특만), `cohortSubjects`, `cohortsOf`, `addableSubjects`, `sortable`, `splitGrid`, `modal`, `deleteSubject`, `saveLocal`, `audit`.
- 과목 그룹 팝업: `admin-v3/js/pages/subjects.mjs`의 `groupPicker`·`joinPicker`·`groupChooser`(승인 대기도 같이 씀).
- 브라우저 저장(localStorage): `v3.orders`(방특 기수 과목 순서), `v3.picks`(학과 관리 강사 명단), `v3.made`(마지막 AI생성 때 강사 명단, '다시 만들기 필요' 판단), `v3.navFolded`(접은 메뉴 묶음).
- `card-list.mjs`의 `onSaved(row)`: 카드 저장(사용 체크·수정)마다 불림. V3 강사 관리가 뒤 목록 갱신에 씀(운영 화면은 안 씀).
- 테스트 가짜 DB `fake-supabase.mjs`: `insert().select()`는 넣은 줄 배열, `.select().single()`은 첫 줄. delete의 cascade는 흉내 안 냄.
- `admin/js/pages/prep.mjs`는 운영 화면과 같이 쓴다. 옵션 `prepCategory`, `prepLabel`, `prepSubjects`, `prepGroupOf`. "software" 탭은 `subjects.tools`를 다루는 `toolsDb` 연결부다. `seminars.mjs`(`seminarCard`·`drawRoster`), `teacher-workspace.mjs`(`teacherPicker`)도 공용.
- 승인 대기 [적용]의 프로그램·준비물 미리 채우기는 승인 함수 `merge_items`와 같은 규칙.
- AI: `getServices().summarize(kind, text)`이고 kind는 week, department, roadmap이다. 서버 지시는 `supabase/functions/comsw-tools/policy.mjs`.
- 방특 판단: `instructor_curricula.vacation`은 믿지 않고 **기수 그룹(`curriculum_sets.is_vacation`)**으로 판단한다.
