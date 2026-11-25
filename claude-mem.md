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
- 주황 색은 그대로 둔다. V3 화면을 바꾸면 매뉴얼(`manual/v3-head.html`, `v3-teacher.html`)도 고친다. 운영 화면과 같이 쓰는 코드(`admin/js/pages/mine.mjs` 등)를 바꾸면 예전 매뉴얼(`manual/admin.html`, `teacher.html`)도 고친다.
- 보고할 때: 무엇이 **실제 저장**되고 무엇이 **화면/브라우저에만** 남는지, 브라우저에서 확인했는지, 배포했는지를 꼭 밝힌다.

## 지금 상태 (2026-11-11)

- V3 시험판 `admin-v3/` (로컬 `http://localhost:8787/admin-v3/`, 운영 DB 연결 · 배포본 `https://rladiddus.github.io/comsw/admin-v3/`).
- **2026-11-11 세 번째 배포**: 11-05 작업(승인 대기 한 화면 세 쪽, 과목 로드맵 문구, 준비물 작성·그룹 설정 등)을 main에 합쳐 올렸다. 테스트 352개·문법 검사 통과.
- 운영 SQL은 `20261105010000_subject_roadmap_summary.sql`까지 모두 사용자가 실행했다. 남은 SQL 없음.
- 11-11 네 번째 배포(`eedd15e`, 공개 사이트 반영 확인): 강사 관리 줄 공개 체크·공개 위 정렬·팝업 저장하면 목록 바로 갱신, 학과 관리 '다시 만들기 필요'는 AI생성하면 사라짐, 로드맵 [저장]·'−' 늘 보이기. 테스트 353개 통과. 브라우저 확인은 아직.
- 메뉴별 상태는 `record_v3.md` 5번.

## 답을 기다리는 질문 (다음 대화에서 먼저 확인)

1. **요청사항 묶음 배포**: 6e79644·e422a46·a5fc2e5·d0a915b·단계별 커리큘럼 만들기(redesign만, SQL 없음). "배포해" 뒤 실제 화면에서 임시 저장·이미지 업로드(AI웹툰 2개월 2~4주차) 확인.
1. **AI웹툰 등 사이트 단계 없는 과목**: 학과 관리 [단계별 커리큘럼 만들기](2026-11-19 배포함)로 만들면 학과 전체 커리큘럼 '상세 없음'도 해결 — 배포 뒤 사용자가 만들고 '사이트 반영'.
1. **자격증학과 과목 확인**: 학과 전체 커리큘럼 과목 = 학과 관리 과목(`39b8685`, 11-18 배포). 자격증학과는 로드맵 묶음 대신 학과 과목 5개로 바뀜 — 사용자 확인 필요.
1. **학과 설정 실제 확인**: `2c0ffbf` 11-18 배포, 운영 SQL `20261118030000` 사용자 실행. 학과명 바꾼 뒤 '사이트에 반영'·강사 커리큘럼 학과 탭 확인 필요(사용자). 쌤톡 학과 목록은 쌤톡에서 따로(컴수원은 옛 이름도 알아봄).
- (11-18 배포 `478fd08`: 안내 문구 속 사이트 메뉴 이름 따라가기. 메모: 학과별 자료 메뉴는 사용자가 꺼 둠, 공개본 F=false)
1. **강사별 커리큘럼 실제 확인**: `4e43f21` 11-18 배포, 운영 SQL `20261118020000` 사용자 실행. '사이트에 반영' 뒤 하단 메뉴에 '강사별 커리큘럼'이 나오고 강사 소개로 가는지 사용자 확인 필요.
1. **메뉴 이름 고치기 실제 확인**: `c497560` 11-18 배포, 운영 DB `menus.label` 있음. 알약 글자 고치고 [저장] → '사이트에 반영' 뒤 공개 메뉴 이름 확인 필요(사용자).
1. **학과 탭 두 줄 실제 확인**: 11-17 `ffa376e` 배포, 운영 SQL `20261117010000` 사용자 실행함. 학과 탭 편집 [저장] → '사이트에 반영' 뒤 공개 학과 커리큘럼에서 윗줄 개수 확인 필요.
1. **스크롤 유지 실제 확인**: `admin/js/keep-scroll.mjs`(f1e65d5)는 11-12 배포함. 실제 관리 화면(로그인 필요)에서는 아직 못 봄 — 사용자 확인 결과 기다림.
- (11-12 운영 SQL `20261112010000` 사용자 실행 → `8942efa` 배포: 메인 학과 여러 개. Codex 검토는 제안만 하고 사용자가 고르지 않음)
1. **오은비 메인 학과 정하기(사용자 할 일, 이제 체크로 여러 개 가능)**: 2번 방식으로 배포함(`dae3f4a`) — 관리자·학과장이 내 프로필 › 수업 설정 › □ 타 강사 수업 설정 → 오은비 → 위쪽 메인 학과(추천: 모션그래픽학과) [저장] → '사이트에 반영'. AI학과에도 과목(AI크리에이터 유튜브·영상편집)이 있어 AI학과 강사소개에서는 빠짐. 전휘재는 이미 CG학과만.
- (11-12 배포 `8f6e5c5`: 강사 커리큘럼 5단계 이상 3단계씩 넘겨 보기)
- (11-12 결정: 태블릿 메인 고정 이미지(`index_tablet.html`)는 일단 그대로 두기)
- (11-12 배포 `1b062b7`: 공개 커리큘럼 단계 이미지 = 학과 관리 대표 이미지 우선, 빈 단계만 무작위. 실제 페이지에서 세 번 읽어 같은 이미지 확인)

- (11-11 다섯 번째 배포 `0bfb65f`: 과목 관리 [과목 삭제] 탭·학과 관리 [제외]만·과목 생성 '전체 학과', 공개 사이트 반영 확인)
- (11-11 여섯 번째 배포: 로그인·첫 화면 빨리 열기, Codex 검토 ②③ 고침·①은 그대로 두기로. 실제 로그인 속도는 사용자 확인 필요)
- (11-12 배포 `eefd16c`: 매뉴얼 글 폭 넓히기, 공개 사이트 manual.css 반영 확인)
- (11-11 열한 번째 배포 `40d0fcc`: 매뉴얼 정리·사용 매뉴얼 버튼·강사 숫자 카드 삭제)
- (11-11 열 번째 배포 `4680618`: 메뉴 끌어서 순서·AI 한도 문구 삭제)
- (11-11 아홉 번째 배포 `9491f30`: 메뉴 '승인 관리')
- **운영 SQL 실행함(2026-11-11, 사용자)**: `20261111010000_material_categories.sql`(선생님 준비물 교재·AI 도구 칸, 제출·승인 함수). 이제 교재·AI 도구(링크) 고르기가 열림. 남은 운영 SQL 없음.
- (11-11 여덟 번째 배포: Codex ①③⑤⑥ 고침, ②④ 보류)
- (11-11 일곱 번째 배포 `2a54f70`: 준비물 분류·[준비물 작성] 팝업·준비물 검토/대시보드 삭제, 공개 사이트 반영 확인)
2. 다른 메뉴(학과 관리·로드맵·커리큘럼 관리 등)의 학과 드롭다운에도 '전체'를 넣을지: 사용자 말 "모든 학과 드롭다운 메뉴에서 전체를 추가"를 과목 관리 안 두 곳으로 해석했다. 다른 화면은 한 학과씩 보는 화면이라 넣지 않았다 — 확인 필요.
- (정리됨 11-11) 로드맵 [저장] 만듦. 스텝 삭제 팝업 버튼 순서는 바꾸지 않기로.

## 사용자가 정한 것 (시간 순 요약)

- 10-29~30: 로드맵 한 단계에 과목 여러 개(8A 변경). "재료"→"준비물", 4분류 "준비물"→"물품". 승인 대기에서 바로 승인. **정책 7**: 과목 하나를 모든 학과가 공용, 과목 아래는 강사별 커리큘럼, 학과마다 다른 것은 과목 목록·순서뿐. 방특은 기수마다 새 과목 ID(6B). 로드맵 문구는 과목마다 하나. 메뉴마다 고른 것 따로 기억. 강사 커리큘럼·과목 통합에서 방특 삭제(방특은 방학 특강·승인 대기에서).
- 10-30: 특강·세미나를 운영 메뉴로, 공개 체크. 강사 관리 새 화면. "학과 관리"·"학과별 과목 순서" 메뉴 삭제(옛 것). 각 화면 아래 "기존 화면" 칸은 요청이 오는 대로 지운다.
- 11-02: 첫 배포, V3 매뉴얼 두 개.
- 11-03: "과목 통합 커리큘럼"→**"학과 관리"**(과목 순서 DB 저장), "강사 커리큘럼"→**"커리큘럼 관리"**. 과목 관리 탭 [과목 생성][과목 정리][그룹 만들기]. **과목 그룹은 이름만 있는 묶음**(대표 과목 방식 버림). 타 강사 수업 설정. 두 번째 배포.
- 11-05: 내 커리큘럼 과목 탭은 수업 설정에서 고른 과목만(본인·타강사). 승인 대기 **한 화면 세 쪽**(제출 커리큘럼 → 과목별 커리큘럼 → 로드맵 문구 → [적용]). AI는 세 쪽 모두 스위치(처음 꺼짐). 학과장이 [준비물 작성]으로 대신 작성, 준비물이 있으면 그룹 필수. 수업별 준비물은 그룹 이름으로 묶음.
- 11-11: [준비물 작성] 없앰. 학과장·부원장이 ② 과목별 커리큘럼의 프로그램·준비물 칸을 고치거나 '없음' 체크하면 검토 끝. [적용] 버튼 주황.
- 11-11: 준비물 검토 메뉴 삭제. 준비물은 선생님이 [분류 ▾ 물품·교재·AI 도구][내용][링크(AI 도구)][추가]로 낸다(내 커리큘럼). 승인 대기는 **[준비물 작성] 팝업 방식**(사용자 선택): 교재·물품·사용 프로그램 칸 + AI 도구 이름·링크 추가, 제목 오른쪽 '준비물 없음'. ② 준비물 칸은 보기만. 대시보드 삭제.
- 11-11: 메뉴 '승인 대기' → **'승인 관리'**, 운영 메뉴 '기본 설정 등' 바로 아래로('업무' 묶음 없어짐). 커리큘럼 상태 표시 '승인 대기'는 그대로.
- 11-11: 11-05 작업 배포. **이후 모든 작업마다 `record_v3.md`·`claude-mem.md`도 용도에 맞게 갱신**.
- 11-11: 강사 줄 끝 공개 체크, 전체 탭 공개 위·비공개 아래, 팝업 고치면 새로고침 없이 갱신. AI생성하면 '다시 만들기 필요' 없앰. 로드맵 [저장] 만들기, [과목 삭제] 버튼 없애고 '−' 늘 보이기, 스텝 삭제 팝업 버튼 순서는 그대로.
- 11-11: 과목 삭제는 과목 관리에서만. 학과 관리에는 [제외]만. 과목 관리에 [과목 삭제] 탭(과목 생성 바로 오른쪽): 학과 드롭다운(전체 학과)·과목명 검색, 과목/강사/체크, 여러 개 한 번에 삭제. 과목 생성 드롭다운에도 '전체 학과'.
- 11-11: '전체 학과'는 학과 드롭다운 맨 위·처음 값으로(과목 생성도 그렇게 바꿈. 과목 삭제·강사 관리는 이미 그랬음).
- 11-11: 로그인·페이지가 느리다 → A(새로고침 때 권한 다시 계산을 뒤에서) + B(미리 연결·모듈 미리 받기)로 하기로. 파일 묶기(빌드 도구)는 빌드 없는 방식이 바뀌어 안 하기로.
  - 사용자가 '트랙' 질문을 이해 못 했다 → 공개 사이트 로드맵을 확인하니 학과마다 한 줄뿐이라 묻지 않고 '여러 줄이면 저장 막기'로 처리. 설명할 때 '트랙' 같은 DB 말 대신 '로드맵 줄'이라고 쓴다.

## 기술 메모 (다음 작업 때 필요한 것)

- 테스트: `node --test --test-concurrency=1 "admin/test/*.test.mjs" "tools/test/*.test.mjs"`(352개, 약 7분). 따옴표 친 glob을 써야 한다. 동시에 돌리면 메모리가 부족하다.
  - V3 화면 테스트는 `admin/test/v3.dom.test.mjs`(jsdom과 `fake-supabase.mjs`). SQL 테스트는 `tools/test/*.test.mjs`(pglite, `pg.mjs`의 `freshDb(before)`·`runMigration`).
  - 문법 검사는 `node scripts/check-syntax.js`. `admin/` 파일을 고치면 `node scripts/stamp-admin.mjs`를 돌린다.
- 주의: bash heredoc 안의 python 문자열에 `\n`을 쓰면 실제 줄바꿈으로 바뀌어 JS가 깨진다. Edit 도구나 scratchpad의 python 파일을 쓴다. 테스트 파일은 줄 끝이 CRLF다.
- 메뉴 정의: `admin-v3/js/app.mjs`의 `GROUPS`(묶음: 운영 메뉴 / 선생님 / 업무 / 사이트 운영). 선생님은 `TEACHER` 목록만.
- 공통 기능: `admin-v3/js/v3.mjs` — `state`, `usePage`, `contextBar(depts, onChange, extra, cohorts)`, `deptSubjects`(정규는 DB 순서만, 브라우저 순서는 방특만), `cohortSubjects`, `cohortsOf`, `addableSubjects`, `sortable`, `splitGrid`, `modal`, `deleteSubject`, `saveLocal`, `audit`.
- 과목 그룹 팝업: `admin-v3/js/pages/subjects.mjs`의 `groupPicker`·`joinPicker`·`groupChooser`(승인 대기도 같이 씀).
- 브라우저 저장(localStorage): `v3.navOrder`(묶음별 메뉴 순서), `v3.orders`(방특 기수 과목 순서), `v3.picks`(학과 관리 강사 명단), `v3.made`(마지막 AI생성 때 강사 명단, '다시 만들기 필요' 판단), `v3.navFolded`(접은 메뉴 묶음).
- `card-list.mjs`의 `onSaved(row)`: 카드 저장(사용 체크·수정)마다 불림. V3 강사 관리가 뒤 목록 갱신에 씀(운영 화면은 안 씀).
- 테스트 가짜 DB `fake-supabase.mjs`: `insert().select()`는 넣은 줄 배열, `.select().single()`은 첫 줄. delete의 cascade는 흉내 안 냄.
- `admin/js/pages/prep.mjs`는 운영 화면과 같이 쓴다. 옵션 `prepCategory`, `prepLabel`, `prepSubjects`, `prepGroupOf`. "software" 탭은 `subjects.tools`를 다루는 `toolsDb` 연결부다. `seminars.mjs`(`seminarCard`·`drawRoster`), `teacher-workspace.mjs`(`teacherPicker`)도 공용.
- 승인 대기 [적용]의 프로그램·준비물 미리 채우기는 승인 함수 `merge_items`와 같은 규칙.
- AI: `getServices().summarize(kind, text)`이고 kind는 week, department, roadmap이다. 서버 지시는 `supabase/functions/comsw-tools/policy.mjs`.
- 빨리 열기: `currentRole()`은 토큰 `comsw_role`이 있으면 바로 돌려주고 `recheckRole`을 뒤에서 돈다(바뀌면 `location.reload()`, 새 토큰도 같으면 되풀이 안 함). V3 `index.html` modulepreload 목록은 `admin/test/v3-preload.test.mjs`가 검사 — 시작·첫 화면(legacy→site, profile→admin 내 프로필) import나 첫 메뉴를 바꾸면 목록도 고친다.
- 방특 판단: `instructor_curricula.vacation`은 믿지 않고 **기수 그룹(`curriculum_sets.is_vacation`)**으로 판단한다.
- 사용자용 업데이트 기록 txt: `E:/바이브코딩/컴수원-관리플랫폼/컴수원_업데이트기록.txt`(최근 날짜 위, [관리자 사이트]/[학생용 사이트], ~함·~했음 말투).
- V4: 설계 `docs/v4-설계.md`, 브랜치 `v4`, 폴더 `admin-v4/`(V3 화면 코드 import 금지, admin/js 바탕 모듈만). 인수 자료 `../V4/claude-code-handoff/`.
- V4 결정: 준비물 = 기준 과목(끝 숫자 뺀 이름) 단위, 그룹 개념 없음, 옛 '웹툰' → 삭제된 과목, 6단계 과목은 표시만.
- V4 구조: `admin-v4/js/{main,app,menus,data,ui,rules}.mjs` + `pages/`(instructors·courses·roadmap·vacation·prep·seminars·site·mine·profile). data.mjs는 app이 `useDb(supabase)`로 연결(테스트는 fakeSupabase, `range()` 추가함). 캐드1 전용 준비물 없음(기준 과목에서만).
- V4 확정 규칙: 모든 V4 공개 함수는 `comsw_private.v4_guard()`(권한·잠금·미반영 변경 검사) → 저장 → `comsw_private.v4_publish()`. 공개 묶음 최상위 래퍼 = v4(삭제·relink_needed 과목 숨김). 화면은 `data.call(rpc)`·`ui.busy`·`ui.publishBanner`.
- V4 확정: 강사 커리큘럼은 `comsw_v4_confirm_curriculum`(기존 comsw_approve_curriculum 쓰지 않음: 공통 준비물 자동 추가 때문). 학과 탭(set)은 department_id 또는 학과와 같은 이름으로 찾는다. 강사 [저장] = v4_teacher_drafts.
- V4 공개 순서: 전체수업 행 인덱스 25 = {학과명-'학과': 순서} JSON, 공개 페이지 `_deptOrd`/`_sortByDeptOrd`. 공개 로드맵(roadmap_tracks)은 아직 학과 구성과 연결 안 함(결정 필요).
- V4 로드맵: 학과 구성 순서 + [+] 묶음 → `comsw_v4_save_roadmap`. 이름 규칙은 SQL `v4_roadmap_label`과 JS `rules.roadmapLabel` 같게.
- V4 5단계: 사이트 편집 저장 `comsw_v4_save_site(tab, p)`, 특강 `comsw_v4_save_seminar`, 방학 특강 `comsw_v4_save_vacation`. 업로드는 이미지만(영상은 주소).
- V4 배포 주소: https://rladiddus.github.io/comsw/admin-v4/ (2026-11-19). 작업 브랜치 v4 → redesign → main ff.
- V4 방학 특강 공통: `v4_vacation_steps`, 확정 `comsw_v4_confirm_vacation_common`, commonEditor(..., { set }) 공용.
- admin-v4 또는 admin/js 파일을 바꾸면 커밋 전에 `node scripts/stamp-v4.mjs`(그리고 admin은 stamp-admin.mjs). 안 하면 테스트 실패·브라우저가 예전 파일을 씀.
- V4 저장 방식: 화면은 `changes.track`으로 편집기 등록, 떠 있는 창이 임시 저장·되돌리기·사이트 적용. 새 편집 화면도 이 방식으로.
- V4는 고치면 테스트 통과 뒤 바로 배포(사용자 지시 2026-11-19). SQL은 사용자가 실행.
- V4 팝업 머리 버튼은 modal(title, body, { actions: [버튼] }), 편집기 하나만 반영은 changes.applyTracked(trackId).
- V4 작은 팝업 높이는 fit-content(auto 쓰면 dialog가 세로로 꽉 참).
- V4가 '반영하지 않은 다른 변경'으로 막히면: 위쪽 [같이 반영]. 원인은 보통 V3 승인(comsw_approve_curriculum이 학과 연결)·수업 설정처럼 공개 없이 바뀐 것.
- V4 track 기준값(baseline)은 공개 중 상태를 빠짐없이 담아야 함(빠지면 열자마자 '바뀐 설정'이 뜸).
- V4 로드맵 [+]는 .rm-plus(aria-pressed=true면 초록), 과목 상자는 .rm-chain 안 .rm-subject.
- AI 요약 종류: week(강사 단계), common(V4 과목 공통), department, roadmap. 서버 지시문 바꾸면 사용자가 npx supabase functions deploy comsw-tools --project-ref bpdxbqsvkvvybrtgvrnf 실행. site_settings ai_prompt_<종류>가 있으면 그게 우선.
- comsw-tools 배포는 반드시 comsw 폴더 안에서: cd E:\바이브코딩\컴수원-관리플랫폼\comsw 후 npx supabase functions deploy comsw-tools --project-ref bpdxbqsvkvvybrtgvrnf (상위 폴더면 'Missing required field in config: project_id').
- comsw-tools 최신 배포 2026-11-20(common 포함).
- V4 과목 공통 팝업 처음 체크 = V4 반영 기록의 강사, 없으면 전원(사용자: 매번 다 체크는 일이 많음).
- 새 AI 종류를 넣을 때는 policy·handler·ai-settings뿐 아니라 comsw_ai_jobs.kind 체크 제약도 바꿔야 함.
- V4: 클릭·입력 없이 상태를 바꾸는 비동기 작업은 busy()로 감싸면 끝날 때 떠 있는 창이 다시 비교됨.
- V4 준비물 편집은 prepEditor 하나(메뉴·팝업 공용). 팝업 닫기 확인은 unsaved(그 trackId)로.
- V4 스크롤 튐은 ui.mjs 전역 스크롤 지키기가 처리. 화면마다 따로 고치지 말 것.
- V4 떠 있는 창 비교 시점: input·change·click·drop·dragend·keyup, busy() 끝, 업로드 끝 check(), track 불러오기 뒤. 새 입력 방식을 만들면 여기에 걸리는지 확인.
- V4 '적용 중' 막은 data.call 한 곳(반영 함수 이름 규칙: comsw_publish, comsw_v4_* 중 unpublished 제외). 새 반영 함수도 이름만 맞으면 자동.
- V4 로드맵 순서: 기본 학과·과목 순서, 따로 바꾸면 roadmap_tracks.custom_order=true(save_roadmap p_custom). 학과 순서와 같게 저장하면 다시 false.
- 운영 SQL 확인법: assets/js/supabase-config.js 공개 키로 RPC 호출 → 42501(권한 거부)=함수 있음, PGRST202=없음.
- V4 끌어 놓기 경계 표시는 붉은 점선(.drop-before/.drop-after).
- V4 로드맵 문구는 학과별 저장. 타학과 동기화 체크 시에만 같은 과목 묶음 단계에 복사(계속 연결 아님).
- 기준 과목 이름 규칙은 화면 rules.baseName과 SQL comsw_private.v4_base 두 곳 — 바꿀 때 둘 다.
- V4 이미지 올리기 칸은 input type=file 하나가 든 칸이면 끌어다 놓기가 자동으로 됨(ui.mjs 전역).
- V4 강사 커리큘럼: 검수(pending)는 confirm_curriculum, 검수 완료 수정은 edit_curriculum. 이미지는 없는 단계만 올리기.
- 2026-11-20 기준 V4 운영 SQL 20261120020000~050000 실행 확인.
- V4 이미지 바꾸기 팝업은 ui.pickImage 재사용.
- 학생용 정비 모드: index.html MAINTENANCE 상수. 미리보기는 index2.html. 정비 끝나면 false로 바꾸고 배포.
- 커리큘럼 이미지 썸네일 = 주소 뒤 #crop=x,y,w,h(원본 대비). 고르기 창 admin/js/image-crop.mjs, 공개 쪽 assets/js/media-crop.js.
- V4 학과 구성 표 = 공개 학과 커리큘럼 칸(subjects.duration·dept_curriculum·program(tools)·level). 과목 정보는 모든 학과 공유.
- V4 원칙: 반영은 오른쪽 아래 창. 팝업에는 [수정]만(사이트 적용 버튼 두지 않음).
- V4 강사 팝업 머리 버튼: [닫기][AI 문장 다듬기(수정 중)][수정].
- V4 과목 종류: 일반(학과·과목에서 생성) / 방학 특강(방학 특강에서 생성, is_vacation). 이름은 종류 안에서만 유일. V3 이름 기준 함수(create_month_subject 등)는 같은 이름 다른 종류가 있으면 헷갈릴 수 있음.
- 2026-11-20 기준 V4 운영 SQL 070000까지 실행 확인.
- V4 켜기·끄기는 체크박스 대신 toggleSwitch 선호(사용자).
- V4 이름 바꾸기·새로 만들기는 작은 팝업으로 바로 반영(학과·방학 특강 같은 방식).
- V4 목록 화면은 강사 페이지처럼 표 + 줄 누르면 팝업 방식 선호(사용자).
- V4 목록 거르기는 ui.filterBar 재사용.
- V4 사이트 편집은 보기 + [수정] 팝업, 이미지 주소는 숨김(pickImage kind image).
- V4 끌어 놓기 표시는 경계의 곧은 붉은 점선(가상 요소).
- V4 떠 있는 창: 고친 뒤 [취소][임시 저장][사이트 적용], 임시 저장 뒤 [되돌리기][사이트 적용].
- V4 거르기 줄 있는 목록: 강사, 준비물, 학과·과목 전체 과목.
- V4 방학 특강 과목 생성 시 특강 선택하면 바로 그 특강에 넣음.
- 강사 준비물: 화면은 줄 목록, 저장은 instructor_subject_materials 분류별 칸. 재사용 목록 = teacher_drafts(curriculum, prep-library).
- V4 이미지 올리기 칸 공통: 이미지 누르면 pickImage, 카드엔 숨은 file input으로 끌어다 놓기.
- V4 입력 묶음은 .form-field(label을 .step으로 쓰면 테두리 깨짐).
- 내 커리큘럼 고르기 = 수업 구분·학과/특강·과목 드롭다운 한 줄.
- V4 임시 저장 비교는 불러온 뒤 화면 read() 기준. 고르기(학과·과목 선택)는 확인 없이 stashAll 후 이동.
- 내 커리큘럼: 고르기 줄 / 아래 왼쪽 4단계 · 오른쪽 준비물.
- V4 메뉴 묶음 제목 = 연두 바탕 굵은 글자(.navlabel).
- V4 사용방법 = admin-v4/help.html. 기능 바꾸면 같이 고친다.
- V4 사용방법 편 나눔은 localStorage comsw_v4_help_role(보안 아님).
- V4: 학과 순서·공개, 과목명, 메뉴 켜기, 강사 직접 추가·수정 가능(20261123010000).
- 2026-11-23 기준 V4 운영 SQL 20261123010000까지 실행 확인.
- V4 CSS: 입력칸 규칙은 체크박스 제외(.form-field input:not([type=checkbox])).
- V4 여러 개 고르기 = 고른 것 알약 + [검색] 팝업(filterBar + 표).
- V4 떠 있는 창은 끌어서 옮김(위치 기억, 제목 더블클릭 = 원위치).
- V4 강사 커리큘럼 수정: 원래 문구 고침·4단계 초과 단계 삭제(20261123020000).
- 2026-11-23 기준 V4 운영 SQL 20261123020000까지 실행.
- V4 강사 커리큘럼은 이번 제출·검수 완료 모두 학과장이 원래 문구·단계 추가·삭제 가능(20261123030000).
- 2026-11-23 기준 V4 운영 SQL 20261123030000까지 실행.
- V4 미리보기: 드라이브 링크는 썸네일 이미지로(iframe 아님).
- V4 AI 끝말은 지시문 + rules.trimEnding 두 겹(사람이 쓴 글에는 안 씀). site_settings ai_prompt_*가 있으면 기본 지시문보다 우선.
- V4 과정내용 AI는 공통 4단계를 n묶음으로 나눠 n줄(줄 수는 화면에서만, 저장 안 함).
- V4 과정내용 AI 재료 = 공통 단계(몇 단계든) 먼저, 없으면 적힌 글.
- V4 강사 프로필 검수 사진 탭: 홈페이지 = instructors.photo_url, 강사업로드 = source_asset(비공개), AI 수정 = draft.photo_url. 확정은 draft.photo_url이 있을 때만 사진을 바꿈.
- V4 팝업은 모두 <dialog>라 뒤 화면 스크롤 잠금은 CSS 한 줄(html:has(dialog[open])). AI 예산 한도 3,000원은 SQL comsw_reserve_ai/comsw_ai_budget에 고정, AI 사진 1장 예약 2,800원(policy 아닌 handler profile).
- AI 한도는 comsw_private.ai_limit(20261124010000, 실행 대기), 바꾸기·빼기는 관리자만. AI 사진 예약 500원(comsw-tools 재배포 대기).
- V4 AI 프롬프트 보기·수정은 [AI 사용량] 종류 팝업(site_settings ai_prompt_*). 20261124010000 운영 실행 완료.
- V4 프로필 확정 사진은 학과장이 [이 사진으로 공개]로 고른 것만(p_photo_url, SQL 20261124020000 운영 실행 확인).
- V4 강사 팝업은 다시 불러와도 하나만(shownPop).
- V4 팝업 [수정] ↔ [돌아가기](예전 이름 [수정 끝]): 고칠 수 있는 상태 켜기·끄기일 뿐 저장·적용 아님.
- V4 공통 4단계 초안은 저장이 아니라 열 때 계산(공통이 빈 과목만). 작성 순서는 instructor_curricula에 만든 날이 없어 updated_at 기준.
- V4 과정내용 [AI 정리] 재료 순서: 적용한 공통 단계 → 강사 자료 초안 → 과정내용 글(materialOf).
- 담당 과목(instructor_subjects) = 학생 사이트 강사 소개 과목 버튼·크게 보기, V4 커리큘럼 탭 위쪽. 빼도 instructor_curricula는 지우지 않음("담당 아님"). 방학 특강은 담당과 상관없음.
- 학생 사이트 강사 소개 과목 버튼 = 담당 과목 ∩ 보고 있는 학과의 과목(학과 구성). 어느 학과에도 없는 과목은 강사 소개에 안 나옴.
- 홈페이지 챗봇: comsw-chat(로그인 없음, 공개 스냅샷만 읽음). 요금은 comsw_private.chat_calls로 comsw_ai_jobs와 따로. 접속 주소는 저장하지 않고 날마다 바뀌는 익명 번호만.
- 학생 사이트에 새 페이지를 만들면 supabase-config.js 다음 줄에 chat-widget.js도 넣기(테스트가 14개 페이지를 셈).
- 챗봇 AI는 OpenAI API 유지(ChatGPT 구독 로그인은 이미지 미지원·계정 공유 금지로 제외, 2026-11-25). 지시문은 comsw-chat/handler.mjs PROMPT, 고치면 함수 재배포 필요.
- 챗봇에서 뺄 과목은 comsw-chat/handler.mjs HIDE. AI크리에이터 아트웍은 2026-11-25 현재 홈페이지(학과 커리큘럼 아트웍학과·로드맵)에는 보이지만 사용자 요청으로 챗봇에서 뺌.
- chat-widget.js를 고치면 14개 페이지의 ?v= 번호도 올리기.
- AI 문구·챗봇 모델은 gpt-6-luna(2026-11-25, 생각하기 끔). 되돌릴 때는 gpt-4.1-mini로(2027-01-14까지만) 바꾸고 policy TEXT_RATE 0.6/2.4, chatCost 0.4/0.1/1.6도 같이.
- 생각하기(reasoning.effort): 챗봇 low, 문구 생성 none(2026-11-25 사용자 결정). low 이상이면 MAX_OUTPUT에 생각하는 양까지 들어감.
- 챗봇 말투는 "추천해요"처럼 친근하게(사용자가 좋다고 함), 경력은 적힌 그대로, 문의는 멘토님으로만.
- 챗봇을 실제로 시험할 때 같은 주소에서 1분 8번 넘게 물으면 막힘(질문 사이 8초 이상).
- V4 과목 고르기 팝업은 admin-v4/js/subject-picker.mjs(강사 담당 과목·학과 구성 [과목 추가] 공용).
