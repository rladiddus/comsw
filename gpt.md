# GPT 작업 기록

## 작업 규칙

- 코딩 작업 시작 전 반드시 이 `gpt.md` 파일을 먼저 확인한다.
- 코딩 작업 완료 후 변경 내용과 확인 사항을 이 파일에 기록한다.
- 기록은 날짜별, 파일별, 기능별로 간단히 남긴다.

## 2026-05-28

### 인코딩 정리

- 대상: `Code.js` 및 모든 `.html` 파일
- 내용: PowerShell 기본 읽기에서 일부 한글 주석이 깨져 보이는 문제를 확인했다.
- 조치: 앱 코드와 화면 동작 로직은 바꾸지 않고, 대상 파일을 UTF-8 BOM 포함 형식으로 다시 저장했다.
- 추가: 작업 기록용 `gpt.md` 파일을 생성했다.

### `Curriculum_onepage.html` 과목 상세 팝업 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 과목명 컬럼에 마우스를 올리면 같은 행 전체 글자가 굵게 강조되도록 했다.
- 과목명 셀에 클릭 동작을 추가했다.
- 과목명 클릭 시 기존 서버 함수 `getCurriculumByDept(deptName)`를 호출해 현재 학과의 상세 커리큘럼 데이터를 가져오고, 클릭한 과목만 골라 팝업으로 보여주도록 했다.
- 과목 상세 팝업은 `Curriculum_full`의 커리큘럼 슬라이드 디자인을 기준으로 1920x1080 슬라이드를 내부에서 스케일링해 표시하도록 구성했다.
- 과목 주차가 4개 이하이면 한 장, 5개 이상이면 3개씩 나누어 여러 장의 슬라이드로 표시하도록 했다.
- 팝업 하단에 페이지 인디케이터를 추가하고, 마우스 휠 및 키보드 방향키로 슬라이드를 넘길 수 있게 했다.
- 팝업은 바깥 영역 클릭, 우하단 닫기 버튼, `Escape` 키로 닫을 수 있게 했다.
- 썸네일 hover 효과를 기존 `Curriculum_full`과 같은 방식으로 적용했다.
- 썸네일 클릭 시 전체 화면 라이트박스를 띄우고, 기존과 동일하게 배경 클릭 또는 `Escape` 키로 닫고 방향키/좌우 버튼으로 이전/다음 주차를 이동할 수 있게 했다.
- 확인: `Curriculum_onepage.html`의 삽입 구간과 함수/태그 흐름을 직접 검토했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 기반 JS 문법 검사는 수행하지 못했다.

### `Curriculum_onepage.html` 과목 상세 팝업 크기 및 행 클릭 영역 조정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 과목 상세 팝업 패널 크기를 기존 `1440x810` 기준에서 약 5% 키운 `1512x851` 기준으로 조정했다.
- 팝업의 최대 화면 점유 비율을 `90vw`, `86vh`로 넓혀 화면 중앙에서 더 크게 보이도록 했다.
- 팝업 내부 슬라이드 영역 여백을 상하좌우 5%로 조정해 슬라이드가 팝업창의 약 90%를 차지하도록 했다.
- 팝업 닫기 버튼과 페이지 인디케이터 위치를 새 여백 비율에 맞춰 조정했다.
- 과목명 셀뿐 아니라 같은 행의 모든 셀에 hover, pointer cursor, click 이벤트가 적용되도록 변경했다.
- 확인: 변경된 CSS 수치와 `bindSubjectRows()` 이벤트 바인딩 범위를 직접 확인했다.

### `Curriculum_onepage.html` 과목명 hover 밑줄 위치 조정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 과목명 hover 시 생기는 주황 밑줄을 셀 하단 기준이 아니라 과목명 텍스트 기준으로 표시하도록 변경했다.
- 과목명 텍스트를 `.subject-name-text`로 감싸고, 밑줄 pseudo-element를 이 요소에 붙였다.
- 밑줄 위치를 텍스트 아래 `2px` 간격으로 조정해 두 줄 과목명도 마지막 줄 바로 아래에 밑줄이 생기도록 했다.
- 확인: 관련 CSS와 과목명 렌더링 HTML 변경 구간을 직접 확인했다.

### `Curriculum_onepage.html` 과목명 hover 밑줄 너비 동적 조정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- hover 밑줄의 고정 너비 `48px`를 제거하고 CSS 변수 `--underline-width`를 사용하도록 변경했다.
- `updateSubjectUnderlineWidths()`를 추가해 각 과목명의 실제 렌더링 라인 폭을 `Range.getClientRects()`로 계산하도록 했다.
- 두 줄 과목명은 마지막 줄의 rect 폭을 기준으로 밑줄 너비를 설정하도록 했다.
- 커리큘럼 표 렌더링 직후와 브라우저 리사이즈 시 밑줄 너비를 다시 계산하도록 했다.
- 확인: CSS 변수 적용부와 폭 계산 함수, 리사이즈 이벤트 연결을 직접 확인했다.

### `seminar.html` 특강·세미나 페이지 신규 구현

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 120:70) 기준으로 `seminar.html`을 슬라이드 형식(1920×1080 + `transform: scale`)으로 전체 재작성했다.
- 화면 구성: 좌측 회색 그림자 박스 + 포스터 이미지(515×751), 우측 특강명(94px) / 주황 구분선 / 소주제(42px) / 일시·장소·강사명·신청인원 / 이름·연락처 입력란 / 주황 신청 버튼.
- 슬라이드 네비게이션: 페이지 인디케이터(주황 점) + 좌우 방향키(←/→/↑/↓) + 마우스 휠 + 우측 호버 시 등장하는 ↑/↓ 버튼. 다른 페이지와 동일 패턴.
- 좌하단 호버 영역에 메인으로 돌아가는 < 버튼 추가. ESC 키로도 메인 이동.
- 입력 필드 안에서는 방향키/휠 슬라이드 이동이 동작하지 않도록 분기 처리. 입력 필드에서 Enter 키로도 신청 가능.
- 신청 결과 알림용 토스트(`#toast`) 추가. 성공/실패에 따라 색상 변경.
- `Code.js`에 두 함수 추가:
  - `getSeminarList()` — 시트 ID `1424gRmy...`의 `"특강 및 세미나"` 탭에서 2행부터 A~H열을 읽어 `{img, title, subtitle, datetime, instructor, place, totalCapacity, applied}` 배열로 반환. 특강명(B열)이 비어있는 행은 스킵. 포스터 이미지는 `convertDriveUrl`로 thumbnail URL 변환.
  - `applySeminar(seminarTitle, name, phone)` — 입력 검증 후 같은 스프레드시트의 `"특강 신청"` 탭에 `[특강명, 이름, 연락처]`를 `appendRow`로 추가. 그 다음 `"특강 및 세미나"` 시트에서 B열 특강명 매칭되는 행을 찾아 H열 값을 +1 증가. `{ok, applied}` 반환.
- 프론트엔드의 신청 흐름: 이름/연락처 빈 칸 검증 → `applySeminar` 호출 → 응답의 `applied` 값으로 "(N명 신청 중)" 표시 즉시 갱신 → 입력 초기화 + 성공 토스트. 중복 클릭 방지를 위해 `isApplying` 플래그 사용.
- 확인: 피그마 좌표와 폰트 weight/size 1:1 매핑, `Code.js`의 두 함수 시그니처, 시트 ID/탭명 직접 검토.

### `seminar.html` 입력 제한, 지난 특강 숨김, 포스터 확대 보기

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getSeminarList()`에 지난 특강 필터를 추가했다. D열 일시 값에서 날짜를 파싱하고, 오늘보다 이전인 특강은 목록에 포함하지 않도록 했다.
- 날짜 파싱 보조 함수 `isPastSeminarDate()`와 `getSeminarComparableDate()`를 추가했다. Date 객체, `YYYY.MM.DD`, `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY년 M월 D일`, `M월 D일` 형식을 처리한다.
- `applySeminar()` 서버 검증에 이름 한글 여부와 연락처 `000-0000-0000` 형식 검증을 추가했다.
- `seminar.html` 연락처 입력에 숫자만 허용하는 input 핸들러를 추가했다. 숫자가 아닌 값은 제거하고 `숫자만 입력해주세요` 토스트를 짧게 띄운다.
- 연락처는 입력 중 자동으로 `000-0000-0000` 형식이 되도록 했다. 3자리 입력 후 첫 하이픈, 7자리 입력 후 두 번째 하이픈이 붙는다.
- 이름 입력에 한글만 허용하는 input 핸들러를 추가했다. 한글 외 값은 제거하고 `한글만 입력해주세요` 토스트를 짧게 띄운다.
- 특강 포스터 클릭 시 `#poster-lightbox`를 열어 포스터를 화면 가로폭 80%로 확대 표시하도록 했다.
- 확대 포스터는 세로로 긴 경우 오버레이에서 스크롤해 전체를 볼 수 있게 했다.
- 확대 포스터 바깥 영역을 클릭하거나 `Escape` 키를 누르면 창이 닫히도록 했다. 포스터 이미지 자체를 클릭할 때는 닫히지 않는다.
- 확인: `seminar.html`의 입력 핸들러, 포스터 라이트박스 이벤트, `Code.js`의 날짜 필터 및 서버 검증 구간을 직접 확인했다.

### `seminar.html` 지난 특강 표시 및 신청 차단 방식 변경

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getSeminarList()`에서 지난 특강을 제외하던 필터를 제거하고, `isPast` 값을 함께 내려주도록 변경했다.
- 특강 목록은 현재 신청 가능한 특강이 먼저 나오고, 지난 특강은 뒤쪽 페이지에 나오도록 정렬했다.
- 일시 표시를 `2026년 8월 19일(수) 17:00-19:00`처럼 날짜 뒤에 요일이 들어가도록 포맷팅했다.
- 강사명은 `선생님`을 자동으로 붙이고, 장소는 `SBS아카데미컴퓨터아트학원 수원점`을 자동으로 앞에 붙이도록 했다. 이미 붙어있는 경우에는 중복되지 않게 처리했다.
- 지난 특강 슬라이드에는 검은색 50% 오버레이와 `특강 신청일이 지났습니다` 문구를 표시하도록 했다.
- 지난 특강의 이름/연락처 입력란과 신청 버튼을 비활성화하고, 프론트엔드 `handleApply()`에서도 지난 특강 신청을 막도록 했다.
- 서버 함수 `applySeminar()`에서도 신청 기록을 남기기 전에 해당 특강 날짜가 지났는지 다시 검사해 지난 특강 신청을 거절하도록 했다.
- 특강/세미나 페이지 이동 감도를 높이기 위해 마우스 휠 이동 기준값을 낮추고 디바운스 시간을 줄였다.
- 키보드 이동에 `PageUp`, `PageDown`, `Home`, `End`, `Space` 키를 추가했다.
- 확인: `Code.js`의 표시 포맷/정렬/서버 차단 구간과 `seminar.html`의 오버레이/비활성화/네비게이션 구간을 직접 확인했다.

### `seminar.html` 포스터 hover 확대 및 초기 키보드 이동 개선

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 특강 포스터에 hover 시 `scale(1.035)`로 살짝 커지고, 마우스가 벗어나면 원래 크기로 돌아오도록 transition을 추가했다.
- 포스터 hover 시 자연스럽게 보이도록 약한 그림자 효과를 함께 적용했다.
- 페이지 진입 직후 키보드 방향키가 바로 동작하도록 `body`를 포커스 가능한 대상으로 만들고, 로드 직후와 슬라이드 생성 직후 `focusSlideKeyboardTarget()`을 호출하도록 했다.
- 키보드 이벤트 수신 대상을 `document`에서 `window`로 변경해 초기 키 입력 수신 안정성을 높였다.
- 입력 필드에 포커스가 있을 때는 기존처럼 방향키가 슬라이드 이동으로 처리되지 않도록 유지했다.
- 확인: `seminar.html`의 포스터 hover CSS, 초기 포커스 함수, 키보드 이벤트 연결 구간을 직접 확인했다.

### `seminar.html` 포스터 확대창 스크롤과 슬라이드 전환 분리

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 포스터 확대창(`#poster-lightbox`)이 열린 상태에서는 문서의 마우스 휠 슬라이드 전환 핸들러가 동작하지 않도록 분기 처리했다.
- 확대창 자체의 `wheel` 이벤트 전파를 중단해, 포스터 아래쪽을 보기 위해 스크롤해도 배경 특강 슬라이드가 다음 페이지로 넘어가지 않도록 했다.
- 확인: `seminar.html`의 포스터 라이트박스 wheel 이벤트와 문서 wheel 네비게이션 조건을 직접 확인했다.

### `Code.js` 특강 신청 인원 계산 방식 변경

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `applySeminar()`에서 `"특강 및 세미나"` 시트 H열 신청 인원을 직접 `+1` 하던 `setValue()` 처리를 제거했다.
- 신청 버튼을 누르면 `"특강 신청"` 시트에만 `[특강명, 이름, 연락처]`가 추가되도록 유지했다.
- 신청 행 추가 후 `SpreadsheetApp.flush()`를 호출해 시트 함수 계산을 반영한 뒤, `"특강 및 세미나"` 시트의 해당 특강 H열 값을 읽어 `applied`로 반환하도록 했다.
- 지난 특강 신청 차단을 위해 `"특강 및 세미나"` 시트에서 해당 특강 행과 D열 날짜를 확인하는 로직은 유지했다.
- 확인: `Code.js`에서 `hCell.setValue`, `current + 1`, `H열 값 +1` 패턴이 남아있지 않은 것을 검색으로 확인했다.

### `seminar.html`, `Code.js` 특강 신청 성공 안내 및 중복 신청 방지

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `applySeminar()`에서 `"특강 신청"` 시트의 기존 신청 내역을 확인해 같은 특강명, 이름, 연락처 조합이 이미 있으면 새 행을 추가하지 않고 `이미 신청되었습니다`를 반환하도록 했다.
- 중복 신청 검사는 `"특강 신청"` 시트에 `appendRow()`를 실행하기 전에 수행되도록 했다.
- 특강 신청 성공 알림 문구를 `신청을 완료했습니다. 특강 전 안내문자를 발송하겠습니다.`로 변경했다.
- 신청 성공 시에만 `launchEmojiFireworks()`를 호출해 화면 양쪽 아래에서 이모지가 폭죽처럼 위로 터졌다가 천천히 떨어지고, 약 5초 동안 희미해지며 사라지도록 했다.
- 이모지 폭죽 레이어는 애니메이션 종료 후 DOM에서 제거되도록 했다.
- 중복 신청 응답에서는 성공 축하 효과가 실행되지 않고, `이미 신청되었습니다` 알림만 뜨도록 기존 성공 분기와 분리했다.
- 확인: `Code.js`의 중복 신청 검사/appendRow 순서와 `seminar.html`의 성공 문구, 폭죽 CSS/JS 호출 구간을 직접 확인했다.

### `seminar.html` 신청 성공 이모지 포물선 애니메이션 개선

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 CSS keyframe 기반 이모지 폭죽을 제거하고 `requestAnimationFrame`으로 매 프레임 위치를 계산하는 방식으로 변경했다.
- 각 이모지는 `x = 시작점 + 수평속도 * 시간`, `y = 시작점 + 초기상승속도 * 시간 + 0.5 * 중력 * 시간^2` 형태의 포물선 궤적으로 움직이도록 했다.
- 왼쪽 아래에서 11개, 오른쪽 아래에서 13개가 동시에 발사되도록 개수를 고정했다.
- 이모지 종류, 크기, 시작 위치, 수평 속도, 초기 상승 속도, 중력, 회전, 흔들림 값을 입자마다 다르게 설정했다.
- 올라갈 때는 빠르게 시작해 꼭대기에서 느려지고, 이후 중력 값에 따라 점점 가속하며 떨어지도록 했다.
- 전체 애니메이션 시간은 5초로 유지하고, 후반부에 서서히 희미해진 뒤 레이어가 제거되도록 했다.
- 확인: `seminar.html`의 `launchEmojiFireworks()`, `emojiFireworkFrame`, 포물선 계산식, 좌우 이모지 개수 설정을 직접 확인했다.

### `seminar.html` 이모지 폭죽 높이 및 개수 조정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 신청 성공 이모지 폭죽의 초기 상승 속도 범위를 `940~1380`에서 `565~830`으로 낮춰, 기존보다 약 40% 낮게 올라가도록 조정했다.
- 이모지 개수를 왼쪽 29개, 오른쪽 21개로 변경했다.
- 확인: `seminar.html`의 `createEmojiParticles(29, 'left')`, `createEmojiParticles(21, 'right')`, `vy` 범위를 직접 확인했다.

## 2026-05-29

### `roadmap.html` 학과 로드맵 페이지 신규 구현

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 135:115, 캔버스 1920×1792 "전체학과-로드맵") 구조를 메타데이터로 분석한 뒤 `roadmap.html`을 전면 재작성했다.
- 페이지 형식: 가로 1920px 캔버스를 viewport 너비에 맞춰 `transform: scale`로 fit하고, 세로는 학과 수에 따라 가변(스크롤 가능)으로 두었다.
- 헤더: 좌측 `CURRICULUM ROAD MAP` 큰 타이틀, 우측에 `실무 맞춤형 교육 과정` / `기초부터 취업까지` 두 줄 배지와 `SBS ACADEMY` 로고.
- 학과 행: 각 행 높이 130px + 행간 간격 11px(피그마 행 간격 약 141px). 좌측 학과명 박스(검정 배경, 흰 글씨, 136×40) + 가로 막대(연회색, 22px 두께, 라운드).
- 과목 박스 배치 규칙: 박스가 막대 위에서 좌→우 균등 분포. 첫 박스 left = 막대 시작, 마지막 박스 right = 막대 끝. 사이 박스 간격은 동일. 박스가 너무 좁아지면 최소 너비(80px) 확보 후 간격 자동 축소.
- 다이아몬드 마일스톤 점(주황, 19×19, `rotate(45deg)`)을 각 과목 박스의 가로 중앙 위쪽 막대 위에 배치.
- 과목 박스 내부: 과목명(22px Bold) → 과목 요약(14px Medium, 회색).
- 다중 과목명 처리: 콤마/슬래시/줄바꿈/2칸 이상 공백으로 split → 각 이름을 `.name-part`로 감싸고 `display: flex; flex-wrap: wrap; justify-content: center;`로 박스 안에서 좌우 나란히, 박스 폭을 넘치면 자동으로 위아래로 줄바꿈.
- 행 묶음 규칙: 연속된 두 학과 모두 과목 5개 이하 → 한 행에 좌우 나란히(중간 50px 간격), 한쪽이라도 6개 이상이면 단독 행.
- 좌하단 호버 시 등장하는 메인으로 < 버튼, `Escape` 키로도 메인 이동.
- `Code.js`에 `getRoadmapList()` 함수 추가:
  - 시트 ID `1424gRmy...`의 "로드맵" 탭에서 A열 병합 영역(또는 단일 셀)을 학과 영역으로 추출.
  - 각 학과의 시작 행(학과명 행)의 B열~lastCol을 가로로 스캔해 과목명 추출, 시작 행 + 2 행에서 같은 열 위치의 과목 요약 추출(B3 학과 설명 행은 무시).
  - 중간 빈 열은 스킵하고 값이 있는 열만 과목으로 인정(중복 선택 시 모두 가져옴).
  - 반환: `[{ deptName, subjects: [{ name, summary }] }, ...]`.
  - 보이지 않는 문자(zero-width, NBSP 등)는 `String.fromCharCode` 기반 normalize로 제거.
- 확인: 피그마 좌표(헤더/행 간격/박스/막대)와 `getRoadmapList()`의 시트 구조 매칭, `roadmap.html`의 행 묶음·균등 분포·다중 과목명 split 로직을 직접 검토.

### 메인 페이지 "전체 수업" → `roadmap.html` 연결 확인 (코드 수정 없음)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 메인 페이지의 "전체 수업" 버튼이 `roadmap.html`로 이동하는지 확인 요청.
- 확인 결과: `index.html`의 `onMenuClick`에 `pageMap['전체 수업'] = 'roadmap'`이 이미 매핑되어 있고, `Code.js`의 `doGet` 허용 페이지에 `roadmap`이 포함되어 있어 정상 작동함. 별도 코드 수정 없음.
- 단, "메인 페이지" 시트 메뉴 이름이 정확히 "전체 수업"이어야 매핑이 작동함을 사용자에게 안내.

## 2026-06-02

### 학과별 채용정보 카테고리 페이지 신규 구현 (`category_recruitment.html` + `Code.js` + `Curriculum_full.html`)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 183:643, 1920×1080 "채용정보") 구조를 분석한 뒤 학과별 채용정보 카테고리 페이지를 신규 추가했다. 기존엔 `category_generic.html`의 "콘텐츠 준비 중" placeholder로만 보이던 카테고리였다.
- 신규 파일 `category_recruitment.html` 생성:
  - 슬라이드 형식 (1920×1080 기준, 부모 `#scale-container`에서 자동 스케일됨).
  - 좌측 상단: 주황 원형(137×137) + 학과명 짧은 형식(80px Bold, `학과` 접미사 제거) + "채용정보"(80px Bold).
  - 헤더 우측: `RECRUITMENT` 고정 타이틀.
  - 5컬럼 표 (헤더 행 + 주황 구분선 + 데이터 행 누적):
    - 컬럼 좌표는 피그마 1:1 매핑. `.col-company / .col-worktype / .col-qualification / .col-workform / .col-salary` 클래스로 left/width 지정.
    - 헤더: 32px Bold, top 308. 주황 구분선: 3px, top 354. 데이터 셀: 24px Regular, 첫 행 top 386, 행 간격 50px.
  - 한 페이지 최대 10행. 데이터가 많으면 페이지 분할 → 인디케이터 / 좌우 키 / 마우스 휠로 전환되도록 `Curriculum_full`의 기존 슬라이드 인디케이터를 그대로 사용. 좌측 타이틀 아래 (`.recruitment-page-badge`, top 479)에 `1 / N` 형식의 페이지 번호 표시.
  - 데이터 없음 시 "등록된 채용정보가 없습니다." 메시지 표시.
- `Code.js`에 `getRecruitmentList(deptName)` 추가:
  - 시트 ID `1nADj2xWBQDOXS0vxd-1RWIG4LaselTP2EXImrIns6D0`.
  - 학과명과 같은 이름의 탭을 찾음 (정확 매칭 → 실패 시 trim 매칭).
  - 3행부터 A/D/E/F/G 열 수집: A=회사명, D=근무형태, E=자격요건, F=업무내용, G=급여.
  - 회사명(A열) 빈 행은 스킵. 그 외 빈 셀은 빈 문자열로 유지 (행은 표시됨).
  - 보이지 않는 문자(zero-width, NBSP 등) 정규화 처리.
  - 반환: `[{ company, workType, qualification, workForm, salary }]`.
- `Curriculum_full.html` 수정:
  - `<?!= include('category_recruitment'); ?>`를 `category_generic` include 위에 추가.
  - `buildAllSlides()`의 카테고리 분기에 `else if (catName === '채용정보')` 추가 → `createRecruitmentPages(deptName, engHeader)` 호출 후 반환 슬라이드 배열을 `container.appendChild` + `slides.push`.
- 페이지 빌드 흐름: 시트 데이터가 비동기 로드라서 처음엔 1장만 만들고, 데이터 도착 후 페이지 수 계산 → 첫 페이지 재생성 + 추가 페이지들 삽입 → `buildIndicator / updateIndicator / updateNavButtons`로 네비게이션 재구성. (`category_instructor.html`의 페이지 분할 로직과 동일 패턴)
- 확인: 피그마 좌표(헤더/구분선/컬럼 위치/폰트)와 `Code.js`의 시트 열 매핑(A/D/E/F/G), `Curriculum_full.html`의 분기 추가 위치를 직접 검토.

### 채용정보 페이지 행 hover 효과 + 클릭 시 상세 팝업 (`category_recruitment.html`)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 192:725, "채용정보 팝업")을 기반으로 행 hover 효과와 클릭 시 상세 팝업을 추가했다.
- 행 wrapper 도입(`.recruitment-row`, 1920×50): 기존엔 5개 셀이 각각 absolute로 배치되어 같은 행으로 묶기 어려웠는데, 행 전체를 한 wrapper로 묶고 그 안에서 셀들을 `top:50%; translateY(-50%)`로 세로 중앙 배치. wrapper에 `cursor: pointer`와 hover 전이 적용.
- Hover 효과: 행 wrapper에 마우스 오버 시 배경이 옅은 주황 톤(`rgba(250, 73, 29, 0.05)`)으로 바뀌고, 자식 `.recruitment-cell`의 `font-weight`가 `700`으로 두꺼워지도록 함. `transition: font-weight 0.15s`로 부드럽게.
- 팝업 마크업(`.recruitment-popup-overlay` + `.recruitment-popup-box`)을 슬라이드의 `.main-body` 안에 미리 포함시켜 두고, 행 클릭 시 그 슬라이드의 팝업에 값을 채우고 `.visible` 클래스로 표시. 슬라이드별 팝업 1개씩 가지므로 페이지 전환과 무관하게 안정적으로 동작.
- 팝업 좌표(피그마 1:1):
  - 흰 박스: `left 441 / top 419 / 1326×542 / border-radius 47 / box-shadow`.
  - 라벨 박스(주황, `198×66`, radius 16) 5개: top `465 / 556 / 647 / 738 / 829` (간격 91px).
  - 값 텍스트(검정, 40px Regular, `left 715`, 우측 480px 안쪽까지) 5개: 같은 top.
- 열림/닫힘 트랜지션: overlay opacity + box `transform: scale(0.96 → 1.0)`로 자연스럽게.
- 닫기 방법 3가지:
  - 우상단 × 버튼 클릭.
  - 박스 바깥(오버레이 영역) 클릭.
  - `Escape` 키 (capture 단계로 등록해서 `Curriculum_full`의 다른 ESC 핸들러보다 우선 처리되도록 `stopImmediatePropagation`).
- 이벤트 위임: 팝업 닫기 핸들러(document click / window keydown)는 `_recruitmentPopupHandlersInit` 플래그로 한 번만 등록되어 다중 슬라이드에서도 중복 등록되지 않음.
- 현재 활성 팝업 추적: `window._activeRecruitmentPopup`에 마지막으로 연 팝업 참조 저장 → ESC 처리 시 그 팝업만 닫음.
- 확인: 피그마 좌표(흰 박스/라벨/값/간격)와 행 wrapper 구조, 팝업 닫기 3가지 경로(× 버튼/바깥 클릭/ESC)와 ESC capture 우선순위 처리, `_activeRecruitmentPopup` 추적 로직을 직접 검토.

### 학과 공통 - 취업 프로세스 카테고리 페이지 신규 구현 (`category_employment.html` + `Curriculum_full.html`)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인 5개(node-id 184:684 / 194:870 / 194:901 / 194:937 / 194:978)를 모두 분석해 공통 구조를 파악한 뒤, 학과 공통으로 사용할 `category_employment.html`을 신규 추가했다. 기존엔 `category_generic.html`의 placeholder로 보였던 카테고리.
- 페이지 형식: 슬라이드 한 장 (1920×1080, 다른 카테고리와 동일하게 `#scale-container`에서 자동 스케일).
- 좌측 상단: 주황 원형(`137×137, 65/294`) + "취업 프로세스" 한 줄(80px Bold). 학과명은 들어가지 않음 (피그마 그대로).
- 상단 헤더: 좌 `VISUAL EDITING`(학과 영문 헤더 동적) / 우 `RECRUITMENT PROCESS`.
- 중앙 상단 STEP 네비게이션:
  - 가로 라인(`left 967, top 327.5, w 447, h 3, #bebebe`).
  - 5개 `.step-nav-item` (라벨 + 점). 활성: 라벨 `30px Bold 검정` + 점 `29×29 주황`. 비활성: 라벨 `24px Bold #bebebe` + 점 `15×15 #bebebe`.
  - STEP 라벨 가운데 X: `975 / 1082.5 / 1191 / 1301 / 1411.5` (108px 균등 간격, 피그마 그대로).
  - 호버 / 클릭 → `setActiveEmploymentStep(slide, idx)` 호출.
- 5개 STEP 카드 (피그마 텍스트 1:1 하드코딩, `EMPLOYMENT_STEPS` 배열):
  1. 취업 희망기업 서칭 및 목표수립 — 5줄
  2. 이력서, 자소서 특강 및 작성 — 5줄
  3. 취업 이벤트 — 4줄
  4. 최종 점검 — 2줄
  5. 사후 관리 — 3줄
- 카드 디자인: 상단 주황 헤더(74px, 28px Black 흰글씨, radius 12 top) + 하단 흰색 본문(371px, 24px Regular, radius 12 bottom, 줄간격 14px).
- 캐러셀 구조:
  - `.employment-cards-wrapper`(1920×540, overflow hidden) 안에 `.employment-cards-track`이 들어있고, 5개 카드를 `data-step="0..4"` left 0/448/896/1344/1792 (간격 30px, 카드 너비 418)로 가로 배치.
  - 활성 STEP에 따라 `track.style.transform = translateX(751 - idx * 448)px`로 슬라이드 → 활성 카드가 화면 X=960 부근 가운데로 이동.
  - 활성 카드(`.employment-card.active`)는 `scale(1.06) translateY(-18px)` + 그림자 + 선명. 비활성 카드는 `filter: blur(2.5px) saturate(0.85); opacity: 0.72`로 흐림/어둠 처리. 트랜지션 0.5s cubic-bezier.
- `Curriculum_full.html` 수정:
  - `<?!= include('category_employment'); ?>` 추가.
  - `buildAllSlides()` 카테고리 분기에 추가: `(catName || '').replace(/\s+/g, '') === '취업프로세스'` → `createEmploymentPage()` 호출. 공백 유무("취업 프로세스" / "취업프로세스")를 모두 안전 매칭.
- 데이터: 학과 무관 공통 내용이라 시트 호출 없이 하드코딩. 학과 영문 헤더(`engHeader`)만 동적으로 슬라이드 헤더에 표시.
- 확인: 피그마 5개 STEP 카드 텍스트와 좌표(헤더/STEP 네비/점·라벨/카드 헤더·본문), `Curriculum_full.html`의 카테고리 분기 매칭 로직(공백 정규화), 트랙 translate 수식(`751 - idx * 448`)을 직접 검토.

### 취업 프로세스 페이지 좌표 main-body 내부로 끌어올림 + 카드 겹침 배치

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 실제 렌더링 시 카드/STEP 네비가 슬라이드의 `.main-body` 영역 아래로 빠져 잘려 보이던 문제를 해결하기 위해, `category_employment.html`의 모든 좌표를 슬라이드 전체 좌표에서 main-body 좌상단 기준 좌표로 변환했다.
  - `.employment-bg-circle`: `left 65, top 294` → `left 0, top 0`
  - `.employment-title`: `left 118, top 295` → `left 53, top 1` (다른 카테고리 `category_recruitment.html`과 동일 패턴)
  - `.step-nav-item`: `top 287` → `top 41`
  - `.step-nav-line`: `top 327.5` → `top 81.5`
  - `.employment-cards-wrapper`: `top 410` → `top 140`
  - x 좌표(975~1411.5, 카드 트랙 width 1920)는 그대로 유지.
- 카드 캐러셀에서 카드끼리 좌우로 약 80px 겹치도록 변경 (현재 활성 카드만 보이는 디자인에 맞게):
  - 카드 너비 418 그대로, 시작 간격을 `448`에서 `338`로 단축 (=겹침 80px).
  - 5개 카드 `data-step` left를 `0/338/676/1014/1352`로 재배치.
  - 트랙 translate 수식을 `751 - idx * 338`로 변경. 활성 카드는 항상 화면 X≈960에 가운데 정렬.
  - 활성 카드는 `z-index: 10 + scale(1.06) translateY(-18px)` + 그림자, 비활성 카드는 `filter: blur(2.5px) opacity 0.72`라 겹침에도 활성 카드가 위로 깨끗하게 떠있음.
- 확인: main-body 안으로 들어온 모든 좌표(원/타이틀/STEP 네비/카드 wrapper), 카드 left 재배치(0/338/676/1014/1352), 트랙 translate 새 수식(`751 - idx * 338`)을 직접 검토.

### 취업 프로세스 STEP 라벨 활성 상태 떠오름 폭 확대

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `.step-nav-item.active .step-nav-label`의 `transform: translateY(-4px)` → `translateY(-15px)`로 변경.
- 활성 상태(마우스 오버되어 두꺼워진 STEP) 라벨이 더 명확하게 떠오르도록 조정.
- 확인: `category_employment.html`의 단일 CSS 변경 위치를 직접 검토.

### 취업 프로세스 활성 카드 윗부분 잘림 해결

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 활성 카드가 `transform: scale(1.06) translateY(-18px)`로 위로 떠오를 때, `.employment-cards-wrapper`의 `overflow: hidden` 때문에 카드 윗부분이 잘려보이던 문제 해결.
- `overflow: hidden` → `overflow: visible`로 변경 + `clip-path: inset(-40px 0 -40px 0)` 추가.
- 효과: 위/아래로는 카드가 자유롭게 떠오를 수 있고, 좌/우는 슬라이드 페이지 자체의 overflow가 잘라줘서 좌우 카드 슬라이드는 그대로 안전.
- 확인: `category_employment.html`의 `.employment-cards-wrapper` 단일 위치 수정 직접 검토.

### 취업 프로세스 비활성 카드 - 투명도/채도 제거, blur만 유지

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 비활성 카드의 효과에서 `opacity: 0.72`와 `filter: saturate(0.85)` 제거. `filter: blur(2.5px)`만 유지.
- 활성 카드의 `opacity: 1` 선언도 더 이상 필요 없어 제거 (모든 카드가 불투명).
- transition 목록에서도 `opacity` 제거.
- 효과: 비활성 카드들이 원래 색감 그대로 흐릿하게만 처리되어, 겹친 부분도 자연스럽게 표시됨.
- 확인: `category_employment.html`의 `.employment-card` / `.employment-card.active` 두 위치 직접 검토.

### 취업 프로세스 비활성 카드 헤더 색 - 주황 → 회색

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `.employment-card-header` 기본 배경을 `var(--accent-orange)`(`#fa491d`) → `#BEBEBE`로 변경.
- 활성 카드만 헤더가 주황으로 보이도록 `.employment-card.active .employment-card-header { background: var(--accent-orange); }` 추가.
- 색상 전환을 위해 `transition: background 0.4s ease` 추가.
- 효과: STEP 활성 변경 시 회색 → 주황으로 헤더가 부드럽게 강조됨. 비활성 STEP들의 헤더는 회색으로 차분.
- 확인: `category_employment.html`의 `.employment-card-header` / `.employment-card.active .employment-card-header` 두 위치 직접 검토.

### Curriculum_full 학과 호버 시 이미지(P열) + 설명(R열) 함께 표시

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 210:1024)을 참고해 학과 호버 시 우측에 학과 이미지(blur 처리) + 설명 텍스트(흰글씨 + 그림자)를 함께 표시하도록 변경.
- 백엔드(`Code.js > getDepartmentList`)는 이미 P열을 `imageUrl`로 반환 중이라 변경 불필요.
- `Curriculum_full.html` 수정 사항:
  - `#dept-description` 마크업을 wrapper로 변경 → 내부에 `<img id="dept-description-image">` + `<div id="dept-description-text">` 두 자식.
  - CSS:
    - `#dept-description`: `position: fixed`, 피그마 1920×1080 좌표 → `left: 59.87vw / top: 49.26vh / aspect-ratio: 769/510`로 환산. `width: 40.05vw, max-width: 900px`.
    - `#dept-description-image`: `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(8.6px); transform: scale(1.04);`(가장자리 비침 방지) + `border-radius: 8px`. src 비어있으면 `display: none`.
    - `#dept-description-text`: 이미지 우측 하단(`right: 1%; bottom: 6%; width: 96%`), 우측 정렬, 700 Bold, `font-size: clamp(1.1rem, 1.875vw, 2.25rem)`, 흰색 + 검정 그림자(`text-shadow: -4px 0 5.5px rgba(0,0,0,0.59), 0 2px 6px rgba(0,0,0,0.45)`).
  - JS `showDescription(dept)`로 시그니처 변경 (이전엔 `showDescription(text)`). `dept.imageUrl`을 `<img>`에, `dept.description`을 텍스트로 채움. 이미지 로드 실패 시 `img.onerror`로 이미지만 숨기고 텍스트는 유지.
  - `mouseenter` 핸들러에서 `showDescription(dept.description)` → `showDescription(dept)`로 변경.
- 효과: 학과 호버 시 우측에 이미지가 살짝 흐릿하게 표시되고 그 위에 설명 텍스트가 또렷이 떠 있는 피그마 디자인 그대로 보임.
- 확인: `Curriculum_full.html`의 마크업·CSS·JS 변경 위치(`#dept-description` 관련 5개 블록) 직접 검토.

### `roadmap.html` 로드맵 디자인 색상 및 도형 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `CURRICULUM ROAD MAP` 타이틀 색상을 `#3D67B7`로 변경했다.
- `실무 맞춤형 교육 과정` 배지는 배경 `#3D67B7`, 글자 `#FFFFFF`로 변경했다.
- `기초부터 취업까지` 배지는 배경 `#FFE684`, 글자 `#2A2A2A`로 변경했다.
- 우측 상단 `SBS ACADEMY` 텍스트는 추후 이미지 삽입을 위한 `LOGO IMAGE` 플레이스홀더 영역으로 교체했다.
- 학과명 알약은 배경 `#FFFFFF`, 글자/외곽선 `#3D67B7`, 외곽선 두께 `2px`, 라운드 최대값(`999px`)으로 변경했다.
- 과목 로드맵 긴 막대는 왼쪽 `#FFE684`에서 오른쪽 `#3D67B7`로 이어지는 가로 그라데이션으로 변경했다.
- 기존 주황 마름모 마일스톤은 막대 안에 들어가는 오른쪽 방향 흰색 삼각형으로 변경했다.
- 과목명 글자 크기를 `22px`에서 `15px`로 줄였다.
- 과목 설명 글자색을 `#929292`로 변경했다.
- 확인: `roadmap.html`의 CSS 변수, 헤더 배지, 로고 자리, 학과명 알약, 막대 그라데이션, 삼각형 마일스톤, 과목명/설명 스타일을 직접 확인했다.

### `roadmap.html` 학과 알약, 과목명 축약, 내부 스크롤 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 학과명 알약 내부 글자색을 `#000000`으로 변경했다.
- 학과명 알약 너비를 `136px`에서 `176px`로 넓히고, 막대와의 간격을 음수로 조정해 알약이 과목 막대를 살짝 덮도록 했다.
- 과목명이 2개 이상이면 가로 배치하지 않고 `.name-part`가 세로로 줄바꿈되어 표시되도록 `subject-name`을 column 레이아웃으로 변경했다.
- `웹1 웹2`, `애프터 이펙트1 애프터 이펙트2`처럼 같은 과목명에 숫자만 다른 항목은 `웹1~2`, `애프터 이펙트1~2`처럼 `~`로 축약하도록 `splitNumberedSequence()`와 `mergeNumberedSubjectNames()`를 추가했다.
- 페이지 전체 스크롤 대신 `#dept-rows` 학과 리스트 영역만 내부 스크롤되도록 하고, 상단 `CURRICULUM ROAD MAP` 헤더 영역은 고정된 상태로 남도록 스케일/높이 계산을 변경했다.
- 확인: `roadmap.html`의 학과 알약 변수, 막대 시작 위치, 과목명 분리/축약 함수, 내부 스크롤 높이 계산을 직접 확인했다.

### `roadmap.html` 헤더 정렬, 학과 커리큘럼 팝업, 로고 이미지 자리 적용

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 상단에서 `CURRICULUM ROAD MAP`, `실무 맞춤형 교육 과정` 배지, 로고 영역까지의 top 위치를 모두 `32px`로 맞췄다.
- 두 번째 배지 `기초부터 취업까지`는 첫 번째 배지 아래에 위치하도록 `74px`로 조정했다.
- 학과명 알약 hover 시 배경이 `#3D67B7`, 글자색이 `#FFFFFF`로 바뀌고, 마우스가 벗어나면 원래 흰 배경/검정 글자로 돌아오도록 했다.
- 학과명 알약 클릭 시 `getCurriculumSimpleByDept(deptName)`을 호출해 해당 학과의 `Curriculum_onepage` 기준 커리큘럼 표를 팝업으로 표시하도록 했다.
- 커리큘럼 팝업은 바깥 영역 클릭, 닫기 버튼, `Escape` 키로 닫히도록 했다.
- 우측 상단 로고 영역에는 `sbs_logo.png`를 표시하는 `img` 태그를 넣었다. 현재 작업 폴더에 해당 PNG 파일이 없으면 `LOGO IMAGE` 대체 표시가 나오도록 했다.
- 확인: `roadmap.html`의 헤더 top 값, 학과명 hover 스타일, 클릭 이벤트, 커리큘럼 팝업 렌더링 함수, 로고 이미지 태그를 직접 확인했다.

### `roadmap.html`, `Code.js` 로드맵 팝업 헤더 고정 및 J2 로고 연동

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`에 `getRoadmapLogoUrl()`을 추가해 `"메인 페이지"` 시트 J2의 이미지 링크를 읽고 `convertDriveUrl()`로 표시 가능한 URL을 반환하도록 했다.
- `roadmap.html` 로고 이미지는 기존 정적 `sbs_logo.png` 대신 `getRoadmapLogoUrl()` 응답으로 `#roadmap-logo-img`의 `src`를 설정하도록 변경했다.
- 로고 링크가 없거나 로딩에 실패하면 기존처럼 `LOGO IMAGE` 대체 표시가 나오도록 유지했다.
- 학과명 클릭 팝업에서 학과명 타이틀 아래의 표 헤더(`과목명`, `기간`, `과정내용`, `프로그램`, `학습수준`)가 고정되고, 표 내용 행만 스크롤되도록 구조를 분리했다.
- `프로그램` 헤더는 `프로그램`과 `(준비물)`이 줄바꿈되어 표시되도록 `header-small` 스타일을 추가했다.
- 확인: `Code.js`의 J2 로고 함수, `roadmap.html`의 로고 로딩 함수, 팝업 헤더 테이블/스크롤 본문 분리, 프로그램 헤더 줄바꿈을 직접 확인했다.

## 2026-06-01

### `roadmap.html`, `Code.js` 로드맵 팝업 영문 제목 및 표 정렬 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `getRoadmapList()`가 `컴수원_전체수업` 시트의 O열 학과명과 U열 영문명을 읽어 각 학과 데이터에 `engName`을 함께 반환하도록 했다.
- `roadmap.html`에서 학과명 알약 클릭 시 `dept.engName`을 `openCurriculumPopup()`에 전달해, 팝업이 열리는 즉시 `ART WORK CURRICULUM`처럼 영문 제목이 표시되도록 했다.
- 팝업 커리큘럼 표를 고정 헤더 영역과 스크롤 본문 영역으로 분리해 학과명 제목과 표 헤더가 함께 고정되도록 했다.
- 팝업 본문 스크롤바가 열 너비를 차지해 헤더와 본문 선이 어긋나지 않도록 스크롤바를 숨김 처리했다.
- 팝업의 `과정내용` 셀을 `Curriculum_onepage`처럼 중앙 정렬되도록 변경했다.
- `"메인 페이지"` 시트 J2의 로고 이미지 링크를 `getRoadmapLogoUrl()`로 읽어 로드맵 우측 상단 로고 영역에 표시하도록 유지/확인했다.
- 확인: `Code.js`의 `normalize()`, `deptEngMap`, `engName` 반환 위치와 `roadmap.html`의 영문 제목 전달, 고정 헤더, 숨김 스크롤, 과정내용 중앙 정렬 CSS를 직접 확인했다.

### `roadmap.html` 상단 배지 위치 조정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `실무 맞춤형 교육 과정` 알약의 `top` 값을 `32px`에서 `37px`로 변경했다.
- `기초부터 취업까지` 알약의 `top` 값을 `74px`에서 `79px`로 변경해 두 알약이 함께 약 5px 아래로 내려오도록 했다.
- 확인: `roadmap.html`의 `.roadmap-badge.b1`, `.roadmap-badge.b2` 위치값을 직접 확인했다.

### 공통 로딩 화면 진행률 및 종료 조건 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `index.html`, `Curriculum_full.html`, `Curriculum_onepage.html`의 진입 로딩 화면이 실제 초기 데이터/화면 준비 단계가 끝난 뒤에만 사라지도록 준비 상태 체크를 추가했다.
- 기존 wipe 애니메이션을 고정 시간 애니메이션 대신 `--loading-progress` CSS 변수 기반으로 변경해, 실제 로딩 단계가 완료된 만큼 흰색 wipe 영역이 진행되도록 했다.
- `index.html`은 DOM, 로딩 문구, 메뉴, 미디어 데이터, 첫 미디어 표시 가능 상태, 웹앱 URL 준비를 단계별 진행률로 반영하도록 했다.
- `Curriculum_full.html`, `Curriculum_onepage.html`은 DOM, 로딩 문구, 초기 커리큘럼/학과 데이터, 웹앱 URL 준비를 단계별 진행률로 반영하도록 했다.
- `roadmap.html`, `seminar.html`의 메인 이동용 로딩 오버레이도 같은 `--loading-progress` 기반 wipe 방식으로 맞췄다.
- `roadmap.html`의 `CURRICULUM ROAD MAP` 타이틀을 `top: 32px`에서 `22px`로 10px 올리고, 글자 크기를 `80px`에서 `96px`로 키웠다.
- 확인: 각 HTML의 `setLoadingProgress()`, `markLoadingStep()`, `isInitialPageReady()` 적용 위치와 `roadmap.html` 타이틀 위치/크기 값을 직접 확인했다.

### `Curriculum_full.html` 강사 커리큘럼 팝업 높이 및 중앙 정렬 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Curriculum_full.html`에 include되는 `category_instructor.html`에서 강사 상세페이지의 강사 커리큘럼 팝업 박스 스타일을 수정했다.
- `.instructor-curriculum-box`를 기존 고정 좌표(`left: 2.14vw`, `top: 16.57vh`) 대신 `left: 50%`, `top: 50%`, `transform: translate(-50%, -50%)`로 배치해 좌우/상하 중앙 정렬되도록 했다.
- 팝업 높이를 `72.31vh`에서 `calc(72.31vh + 40px)`로 변경해 위/아래로 각 20px씩 더 넓어지도록 했다.
- 화면이 낮은 경우 넘치지 않도록 `max-height: calc(100vh - 80px)`를 추가했다.
- 확인: `category_instructor.html`의 `.instructor-curriculum-box` 위치, transform, height, max-height 값을 직접 확인했다.

### `Curriculum_full.html` 강사 커리큘럼 팝업 위치 및 썸네일 확대 속도 개선

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `category_instructor.html`의 `.instructor-curriculum-box` transform을 `translate(calc(-50% - 100px), -50%)`로 변경해 현재 중앙 정렬 기준에서 왼쪽으로 100px 이동하도록 했다.
- 강사 상세 커리큘럼 팝업이 렌더링된 직후 `loadInstructorFlatWeeks(dept, instructorName)`를 호출해, 썸네일 클릭 전에 강사의 전체 과목/주차 데이터를 백그라운드에서 미리 가져오도록 했다.
- `window.instructorFlatWeeksPending`을 추가해 같은 강사의 전체 커리큘럼 데이터 요청이 중복 호출되지 않도록 하고, 요청 중 클릭이 들어오면 완료 후 바로 열리도록 콜백을 묶었다.
- 전체 주차 데이터가 캐시에 저장될 때 각 주차 이미지를 `Image()`로 미리 로드해 썸네일 클릭 후 전체 이미지 표시 반응이 빨라지도록 했다.
- 확인: `category_instructor.html`의 transform 위치값, `loadInstructorFlatWeeks()`, `preloadInstructorWeekImages()`, `instructorFlatWeeksPending`, 팝업 렌더 직후 프리패치 호출 위치를 직접 확인했다.

## 2026-06-04

### `Curriculum_full.html` 학과 호버 이미지 blur 방향 및 설명 위치 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `#dept-description`의 학과 이미지를 원본 레이어와 blur 레이어 2장 구조로 변경했다.
- 새 `#dept-description-image-blur` 이미지를 추가하고, blur 레이어에 `filter: blur(8.6px)`와 좌→우 그라데이션 `mask-image`를 적용해 왼쪽은 또렷하고 오른쪽으로 갈수록 흐려지도록 했다.
- `showDescription(dept)`에서 원본 이미지와 blur 이미지에 같은 학과 이미지 URL을 함께 세팅하고, 이미지 로딩 실패 시 두 레이어를 모두 숨기도록 했다.
- 학과 설명 텍스트를 기존 이미지 우측 하단 정렬에서 `left: 38%`, `top: 66%`, `width: 105%`, `text-align: left` 기준으로 변경해 이미지 중심보다 살짝 왼쪽에서 시작하고 이미지 오른쪽 밖으로 자연스럽게 확장되도록 했다.
- 확인: `Curriculum_full.html`의 `dept-description-image-layer`, `#dept-description-image-blur`, `mask-image`, `#dept-description-text`, `showDescription()` 적용 위치를 직접 확인했다.

### `Curriculum_full.html` 학과 호버 이미지 blur 제거 및 설명 텍스트 축소

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 학과 호버 이미지의 blur 효과를 제거하기 위해 `#dept-description-image-blur`를 `display: none !important`로 숨기고 원본 이미지 레이어만 보이도록 했다.
- 학과 설명 텍스트의 굵기를 `700`에서 `400`으로 낮춰 더 얇게 표시되도록 했다.
- 학과 설명 텍스트 크기를 기존 `clamp(1.1rem, 1.875vw, 2.25rem)`에서 `clamp(0.77rem, 1.3125vw, 1.575rem)`로 줄여 약 70% 크기로 표시되도록 했다.
- 학과 설명 텍스트 위치를 기존 `top: 66%`에서 `top: calc(66% + 200px)`로 변경해 현재 위치보다 약 200px 아래로 내려오도록 했다.
- 확인: `Curriculum_full.html`의 `#dept-description-image-blur`, `#dept-description-text`의 top/font-weight/font-size 값을 직접 확인했다.

### `Curriculum_full.html` 학과 설명 텍스트 이미지 하단 정렬

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 학과 설명 텍스트가 이미지 아래로 벗어나지 않도록 `#dept-description-text`의 세로 기준을 `top: calc(66% + 200px)`와 `transform: translateY(-50%)`에서 `bottom: 0`과 `transform: none`으로 변경했다.
- 설명 텍스트의 마지막 줄이 이미지 하단 경계에 맞닿도록 하되, 기존 `left: 38%`, `width: 105%`, 글자 굵기/크기 축소 설정은 유지했다.
- 확인: `Curriculum_full.html`의 `#dept-description-text`에서 `bottom: 0`, `transform: none` 적용을 직접 확인했다.

### 향후 `이미지 다운기능` 구현 메모

- 사용자가 앞으로 "이미지 다운기능"이라고 부르면, 해당 페이지에 현재 화면 또는 지정 영역을 이미지로 저장/다운로드하는 기능을 구현한다.
- 버튼은 사용자가 첨부한 다운로드 아이콘 형태(아래 화살표와 받침)를 기준으로 만들고, 마우스가 화면 오른쪽 위로 이동했을 때 나타나게 한다.
- 스크롤되는 페이지나 내부 스크롤 영역도 보이는 부분만 잘리지 않게, 가능한 경우 숨겨진 내용 전체를 하나의 이미지로 저장하도록 구현한다.
- 구현 전 대상 페이지의 DOM 구조, 캡처 대상 영역, `overflow`, `transform/scale`, 외부 이미지 CORS, 긴 페이지 캡처 시 메모리 사용량을 확인한다.
- 후보 방식은 `html2canvas` 계열 캡처 또는 캡처 직전에 스크롤 컨테이너의 높이/overflow를 임시 조정해 전체 내용을 렌더링한 뒤 저장하는 방식이다.

### `roadmap.html` 로드맵 상세 설명 줄바꿈 보존

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getRoadmapList()`가 "로드맵" 시트의 과목 요약 행(`dept.startRow + 2`)을 `summary`로 가져오며, `normalize()`는 줄바꿈을 제거하지 않고 앞뒤 공백만 정리하는 것을 확인했다.
- 웹 화면에서 줄바꿈이 한 줄처럼 보이던 원인은 `.subject-summary`에 줄바꿈 보존 스타일이 없어서 HTML 기본 공백 처리로 렌더링되기 때문이었다.
- `roadmap.html`의 `.subject-summary`에 `white-space: pre-line`을 추가해 시트 셀 안의 줄바꿈이 화면에서도 그대로 줄바꿈되어 보이도록 했다.
- 확인: `roadmap.html`의 `.subject-summary` 스타일과 `sumDiv.textContent = subj.summary` 렌더링 위치를 직접 확인했다.

### `roadmap.html` 학과 클릭 팝업 데이터 기준 변경

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getCurriculumSimpleByDept(deptName)`를 수정해, 로드맵 팝업의 과목 상세 데이터를 "로드맵" 시트 요약 행이 아니라 "컴수원_전체수업" 시트에서 가져오도록 변경했다.
- 팝업 호출 시 먼저 "로드맵" 시트 A열 병합/단일 학과 영역에서 선택된 학과의 시작 행을 찾고, 해당 행의 B열 이후 과목 목록을 읽는다.
- 로드맵 과목 셀은 쉼표, 줄바꿈, 공백이 있는 `/` 구분자를 기준으로 나누되, 과목명 내부의 `/`는 보존되도록 했다.
- "컴수원_전체수업" 시트 C열의 병합 범위와 단일 과목 셀을 인덱싱하고, 로드맵에서 선택된 과목명과 정확히 일치하는 C열 과목 범위를 찾는다.
- 찾은 과목 범위의 각 행에서 기간 G열, 과정내용 J열, 프로그램 K열, 학습수준 L열을 가져와 팝업 표의 `subjects` 배열로 반환한다.
- 확인: `Code.js`의 `getCurriculumSimpleByDept()`, "로드맵" 시트 학과 시작 행 탐색, C열 병합 범위 인덱싱, G/J/K/L열 매핑을 직접 확인했다.

### 과목 커리큘럼 옆 "준비물 아이콘" + 팝업 (교재명/준비물/AI툴) 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 시트 "수업별 준비몰(AI/교재 등)"의 A~F열을 읽는 `getCoursePreparations()` 함수를 `Code.js`에 추가했다.
  - A열은 forward-fill로 병합 처리. B열을 `textbook(교재명)/supply(준비물)/ai(AI 툴)` 키로 표준화. 한 과목당 카테고리별 최대 1개 항목.
  - 반환: `{ 과목명: { textbook: {text, link, image, pill}, supply: {...}, ai: {...} } }`. 이미지 URL은 `convertDriveUrl`로 변환.
- `Curriculum_full.html`의 `window.onload`에서 `getCoursePreparations()`를 호출해 `window.coursePreparations`에 캐싱. 데이터가 슬라이드 빌드보다 늦게 도착하면 `injectMissingPrepIcons()`로 이미 빌드된 슬라이드에 아이콘을 보강.
- `category_curriculum.html` 변경:
  - `makeCurriculumSlide()`의 `.subject-sub` 글자("커리큘럼") 옆에 외부링크 SVG 아이콘 출력. 해당 과목 데이터가 `window.coursePreparations`에 존재할 때만 표시.
  - `.subject-sub`를 `<span class="subject-sub-wrap">`로 감싸 `display: inline-flex; gap: 14px`로 "커리큘럼" + 아이콘 가로 정렬.
  - 아이콘 클릭 → `openCoursePrepPopup(subjectName)` 호출. 팝업 박스 한 개에 교재명/준비물/AI툴 섹션을 카테고리가 있는 것만 세로로 나열.
  - 팝업 디자인 (피그마 2:4 / 216:1105 / 216:1142):
    - 흰색 박스 `border-radius: 50px` + 그림자.
    - 각 섹션: 큰 타이틀("{과목명} {카테고리}") + 주황 구분선 + 본문.
    - 교재명: 이미지(D열 링크 `target="_blank"`) + C열 텍스트 + F열을 큰 알약(주황 배경).
    - 준비물: C열 텍스트만 큼지막하게(괄호/줄바꿈 단위로 줄 분리).
    - AI 툴: 이미지(D열 링크 `target="_blank"`) + 작은 알약(F열).
  - 팝업 닫기: 우상단 × 버튼 / 박스 바깥 클릭 / ESC 키. ESC 핸들러는 capture 단계 + `stopImmediatePropagation`으로 다른 ESC 핸들러와의 충돌 방지.
  - 팝업 오버레이는 `<body>` 직속에 한 번만 생성(싱글톤). 슬라이드 캐시 변경과 무관하게 동작.
- 확인: `Code.js`의 카테고리 키 표준화, `category_curriculum.html`의 아이콘 HTML 빌더와 섹션별 팝업 HTML, `Curriculum_full.html`의 데이터 로드 및 `injectMissingPrepIcons` 호출을 직접 검토.

### `Curriculum_full.html` 준비물/교재 팝업 미노출 원인 조사

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `category_curriculum.html`에는 `.course-prep-icon`, `injectMissingPrepIcons()`, `openCoursePrepPopup()` 등 아이콘/팝업 코드가 존재하는 것을 확인했다.
- `Curriculum_full.html`의 `window.onload`에서도 `google.script.run.getCoursePreparations()`를 호출해 `window.coursePreparations`에 캐싱하고, 성공 시 `injectMissingPrepIcons()`를 호출하는 흐름이 존재한다.
- 아이콘은 `window.coursePreparations[subject.subjectName]`가 있을 때만 생성되므로, 아이콘이 전혀 보이지 않는 현재 증상은 `getCoursePreparations()` 결과가 빈 객체이거나 과목명 키가 커리큘럼 과목명과 매칭되지 않는 경우에 발생한다.
- 사용자가 시트명 오타는 없다고 확인했으므로, 시트명 문제로 단정하지 않는다.
- 추가 조사 결과, 더 유력한 코드상 취약점은 준비물 시트 A열 과목명과 `getCurriculumByDept()`가 반환하는 `subject.subjectName`을 정규화/별칭 없이 정확한 문자열 키로만 매칭하는 구조다.
- `getCoursePreparations()` 실패 핸들러도 조용히 `{}`로 처리되어, 데이터 호출 실패/권한 문제/키 불일치가 있어도 화면상 아이콘만 사라진 것처럼 보인다.

### `Curriculum_full.html` 준비물/교재 아이콘 생성 조건 보강

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 정의한 조건에 맞춰, `컴수원_전체수업` C열에서 온 커리큘럼 과목명과 `수업별 준비몰(AI/교재 등)` A열 과목명이 매칭될 때 아이콘이 생성되도록 클라이언트 매칭 로직을 보강했다.
- `category_curriculum.html`에 `normalizeCoursePrepSubjectName()`, `getCoursePrepIndex()`, `getCoursePrepForSubject()`를 추가했다.
- 기존 `window.coursePreparations[subject.subjectName]` 직접 조회 대신, 보이지 않는 문자 제거/물결표 통일/공백 정리 후 만든 정규화 키로 준비물 데이터를 찾도록 변경했다.
- `makeCurriculumSlide()`, `injectMissingPrepIcons()`, `openCoursePrepPopup()` 모두 같은 `getCoursePrepForSubject(subjectName)` 경로를 사용하도록 통일했다.
- `Curriculum_full.html`의 `getCoursePreparations()` 성공/실패 핸들러에서 준비물 인덱스 캐시(`window._coursePreparationsIndex`)를 초기화하도록 했고, 실패 시 콘솔 경고를 남기도록 했다.
- 확인: `category_curriculum.html`의 아이콘 생성 조건, 사후 아이콘 주입 조건, 팝업 데이터 조회 조건과 `Curriculum_full.html`의 준비물 데이터 로드 핸들러를 직접 확인했다.

### `Curriculum_full.html` 준비물/교재 아이콘 미노출 추가 보강

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 실행 후에도 아이콘이 보이지 않는다는 피드백을 받고, 아이콘 DOM/CSS보다는 `window.coursePreparations`가 비어 있거나 과목명 키 매칭이 실패하는 쪽이 원인 가능성이 높다고 재확인했다.
- `Code.js`의 `getCoursePreparations()`에서 준비물 시트를 찾을 때 기존 `COURSE_PREP_SHEET_NAME` 정확 매칭뿐 아니라 `준비몰`/`준비물` 대체명과 trim 매칭도 시도하도록 보강했다.
- `category_curriculum.html`의 `normalizeCoursePrepSubjectName()`을 더 관대하게 바꿔 과목명 비교 시 보이지 않는 문자 제거, 물결표 통일, 모든 공백 제거, 소문자화를 적용하도록 했다.
- 이로써 `컴수원_전체수업` C열 과목명과 준비물 시트 A열 과목명이 공백 표기 차이만 있는 경우에도 아이콘이 생성될 수 있게 했다.
- 확인: `Code.js`의 준비물 시트 조회 fallback과 `category_curriculum.html`의 과목명 정규화/아이콘 생성/팝업 조회 경로를 직접 확인했다.

### `Curriculum_full.html` 준비물/교재 팝업 다중 행 및 AI툴 표시 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getCoursePreparations()`에서 A열뿐 아니라 B열 카테고리도 forward-fill 하도록 변경해, A열/B열이 병합된 범위의 모든 행을 같은 과목/카테고리 데이터로 읽도록 했다.
- 같은 과목/카테고리에 여러 행이 있을 수 있으므로 `result[과목명][카테고리]`를 단일 객체가 아니라 배열로 누적하도록 변경했다.
- `category_curriculum.html`의 팝업 렌더링에 `coursePrepItems()`를 추가해 기존 단일 객체와 새 배열 구조를 모두 처리할 수 있게 했다.
- 팝업 제목은 과목명이 길수록 `prepTitleHTML()`에서 글자 크기를 단계적으로 줄여 표시하도록 했다.
- AI툴 섹션은 각 행을 이미지 + 알약 형태로만 표시하고, 기존 하단 설명 텍스트(`prep-text-small`)는 출력하지 않도록 변경했다. 알약 문구는 F열을 우선 사용하고, F열이 비어 있으면 C열 텍스트를 사용한다.
- 교재명/준비물도 여러 행을 모두 반영하도록 변경했다. 교재명은 항목별 이미지/텍스트/금액을 나열하고, 준비물은 여러 행의 C열 텍스트를 합쳐 줄 단위로 표시한다.
- 확인: `Code.js`의 B열 forward-fill 및 배열 누적, `category_curriculum.html`의 제목 축소/다중 항목/AI툴 표시 경로를 직접 확인했다.

### `Curriculum_full.html` AI툴 팝업 스크롤 및 정렬 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `category_curriculum.html`의 AI툴 섹션에서 제목(`과목명 AI 툴`)과 주황 구분선 아래에 `.ai-scroll` 래퍼를 추가해, 제목/구분선은 고정되고 AI툴 목록만 내부 스크롤되도록 구조를 분리했다.
- `.course-prep-box`와 `.section-ai .ai-scroll`의 스크롤바를 숨기기 위해 `scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar { width: 0; height: 0; }`를 적용했다.
- AI툴 섹션은 `max-height`와 `overflow: hidden`을 적용하고, `.ai-scroll`만 `overflow-y: auto`가 되도록 했다.
- AI툴 각 행은 grid 2열(`1fr auto`)로 바꿔 이미지 링크는 왼쪽 영역 안에서 중앙 정렬, 알약은 오른쪽 정렬되도록 했다.
- 확인: `category_curriculum.html`의 `.ai-scroll`, `.section-ai`, `.ai-row`, `.ai-link`, `.prep-pill-small` 스타일 적용을 직접 확인했다.

### `Curriculum_full.html` 준비물 팝업 아이콘 색상 및 하단 정렬

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `category_curriculum.html`의 `.course-prep-icon` 색상을 `#FA491D`로 변경해 SVG 아이콘이 주황색으로 표시되도록 했다.
- `.subject-sub-wrap`의 정렬을 `align-items: flex-end`로 바꿔 "커리큘럼" 글자와 아이콘의 아래쪽이 맞도록 조정했다.
- 아이콘 SVG 크기를 `36px`에서 `42px`로 키워 버튼 영역과 시각적으로 맞도록 했다.
- 확인: `category_curriculum.html`의 `.subject-sub-wrap`, `.course-prep-icon`, `.course-prep-icon svg` 스타일을 직접 확인했다.

### 수업별 준비물 신규 페이지 `item.html` 추가 (탭 형식)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 피그마 디자인(node-id 222:1181 / 222:1239 / 222:1265)을 기반으로 "수업별 준비물" 신규 페이지를 만들었다. 교재 / 준비물 / AI툴 3개 탭으로 전환.
- `Code.js` 변경:
  - `doGet()`의 `allowedPages`에 `'item': 'item'` 추가.
  - 신규 `getAllCoursePrepItems()` 추가. "수업별 준비몰(AI/교재 등)" 시트의 모든 행을 A열(과목명)·B열(카테고리) forward-fill하여 `{ subject, category, content, link, image, pill }` 평탄화 배열로 반환. 카테고리 표준화: `교재명→textbook / 준비물→supply / AI툴→ai`. 보이지 않는 문자 정규화 포함.
- `index.html` 메뉴 매핑에 `'수업별 준비물': 'item'` 추가.
- `item.html` 신규 생성:
  - 슬라이드 형식 (1920×1080 + `transform: scale`로 viewport fit, `Curriculum_onepage`와 동일한 슬라이드 컨테이너 패턴).
  - 상단 탭 3개 (`교재 / 준비물 / AI툴`): 흰 박스 위쪽에 매달려 있는 디자인. 활성 탭은 주황 배경(`#fa491d`) + 흰글씨 + 50px Bold + `translateY(-4px)`로 살짝 솟음. 비활성은 회색(`#cecdcd`) + 회색 글씨(`#7c7c7c`) + 38px Bold. 클릭/방향키(↑↓←→)로 탭 전환.
  - 메인 흰 박스 (`1475×775, radius 29`) 안에 표:
    - **상단 고정 영역** = 헤더 셀(44px Bold) + 셀별 주황 구분선.
    - **하단 스크롤 영역** = 데이터 행 목록. `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`로 스크롤바 숨김.
  - 탭별 렌더링 (`renderTab`):
    - **교재**: 3컬럼(과목명/교재명/정가). 교재명 셀에 호버 시 `#item-image-tooltip`을 마우스 따라다니는 형태(`mousemove`)로 흰 박스에 E열 이미지 표시. 클릭 시 D열 링크를 `window.open(link, '_blank')`로 새 창.
    - **준비물**: 2컬럼(과목명/준비물). 텍스트만.
    - **AI툴**: 2컬럼(과목명/AI툴). C열을 콤마(`,` / `，`) 기준으로 split해서 각 도구 이름이 `.ai-tool-token`이 됨. 호버 시 `#item-text-tooltip`(주황 알약)이 F열 텍스트(예: "무료")로 마우스 따라다님. 클릭 시 D열 링크 새 창. 같은 행의 D/F는 그 행의 모든 도구가 공유.
  - 좌하단 호버 시 등장하는 메인으로 `<` 버튼, `Escape` 키로도 메인 이동.
  - 빈 카테고리는 "등록된 ~가 없습니다." 메시지 표시.
- 확인: `Code.js`의 `getAllCoursePrepItems` 카테고리 표준화 / forward-fill, `item.html`의 탭 전환·표 헤더 고정+본문 스크롤·이미지 툴팁·텍스트 툴팁·키보드 단축키 구현을 직접 검토.

### `item.html` 데이터 미로드 원인 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `item.html`은 `google.script.run.getAllCoursePrepItems()`를 정상 호출하고, `textbook / supply / ai` 카테고리 필터도 맞게 구성되어 있음을 확인했다.
- 데이터가 비어 보일 수 있는 원인은 item 페이지용 신규 서버 함수 `getAllCoursePrepItems()`가 준비물 시트를 정확한 시트명으로만 찾고 있었기 때문으로 확인했다.
- 기존 팝업용 `getCoursePreparations()`에는 `준비몰`/`준비물` 대체명 및 trim 매칭 fallback이 있었지만, `getAllCoursePrepItems()`에는 같은 fallback이 빠져 있어 동일 데이터 시트를 못 찾으면 빈 배열을 반환할 수 있었다.
- `Code.js`에 공통 helper `getCoursePrepSheet_(ss)`를 추가하고, `getCoursePreparations()`와 `getAllCoursePrepItems()`가 모두 이 helper로 시트를 찾도록 통일했다.
- `getAllCoursePrepItems()`의 A열/B열 forward-fill, 카테고리 표준화(`교재명→textbook`, `준비물→supply`, `AI 툴→ai`), 이미지 링크 변환 경로를 다시 확인했다.

### `item.html` 표 간격, 교재 열폭, AI툴 묶음 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 주황 구분선과 첫 번째 데이터 행 사이가 길어 보이지 않도록 `.item-body-scroll`의 시작 위치를 `156px`에서 `132px`로 올리고, 상단 padding을 `20px`에서 `2px`로 줄였다.
- 표 내용이 패널 안에서 좌우 중앙으로 모이도록 헤더와 데이터 행의 좌우 여백을 같은 기준(`70px`)으로 맞췄다.
- 교재 탭에서 과목명/정가 열은 좁게, 교재명 열은 넓게 쓰도록 `textbook-layout` 전용 flex 비율을 추가했다.
- 긴 교재명은 한 줄로 유지되도록 `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`를 적용했다.
- AI툴 탭은 같은 과목명을 한 번만 보여주고, 같은 과목의 툴들을 콤마로 이어 한 줄/여러 줄에 묶어 렌더링하도록 변경했다.
- AI툴 각 글자의 hover 툴팁(F열)과 클릭 링크(D열)는 개별 토큰에 그대로 유지했고, hover 밑줄은 제거했다.

### `item.html` 준비물 탭 열폭 및 줄바꿈 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 준비물 탭 전용 `supply-layout`을 추가해 과목명 열은 약 `260px` 기준으로 좁히고, 준비물 내용 열이 남은 폭을 유동적으로 사용하도록 했다.
- 준비물 내용 셀에 `supply-content` 클래스를 추가하고 줄간격을 조정해 두 줄 표시 시에도 표 안에서 안정적으로 보이도록 했다.
- `formatSupplyContent()`를 추가해 준비물 내용이 35자를 넘으면 쉼표/공백/구분자 근처를 우선으로 찾아 한 번 줄바꿈(`<br>`)하도록 했다.
- 준비물 렌더링에서 기존 `escapeHtml(it.content)` 대신 `formatSupplyContent(it.content)`를 사용하도록 변경했다.

### `item.html` 준비물 과목명 한 줄 유지 및 탭 레이어 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 준비물 탭에서 과목명이 두 줄로 떨어지지 않도록 `supply-layout`의 과목명 열을 `360px` 고정 폭으로 넓히고 `white-space: nowrap`을 적용했다.
- 준비물 내용 열은 남은 폭을 모두 사용하도록 유지해, 표의 왼쪽 시작 여백과 오른쪽 끝 여백이 같은 기준으로 정렬되도록 했다.
- 상단 탭 컨테이너의 `z-index`를 `3`에서 `1`로 낮추고, 표상자(`.item-panel`)는 `z-index: 2`로 유지해 탭들이 표상자보다 뒤 레이어에 오도록 조정했다.

### `item.html` 상단 탭 위치 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 교재/준비물/AI툴 3개 탭을 오른쪽으로 20px 이동하기 위해 `.item-tabs`의 `left` 값을 `230px`에서 `250px`로 변경했다.

### `vacation.html` 방학 특강 페이지 신규 생성

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 메인 메뉴 `방학 특강` 클릭 시 새 페이지로 이동하도록 `index.html`의 `pageMap`에 `'방학 특강': 'vacation'` 항목을 추가했다.
- `Code.js`의 `doGet()` `allowedPages` 목록에 `'vacation'`을 추가해 페이지 라우팅이 가능하도록 했다.
- `Code.js`에 `getVacationSeminarSubjects()` 서버 함수를 신규 추가했다.
  - 1단계: 메인 페이지 시트(`1424gRmyDWq...`)의 `메인 페이지` 탭에서 E열 값이 `방학 특강`인 행을 찾아 같은 행의 I열 값(예: `2026년 여름방학특강`)을 시트 탭 이름으로 읽어왔다.
  - 2단계: 방학특강 데이터 시트(`1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM`)에서 그 이름의 탭을 열어 B열을 읽고, 병합 셀은 forward-fill, 항목 끝의 숫자(`포토샵1`→`포토샵`)는 정규식 `\s*\d+$`로 제거, 중복 제거 후 과목명 배열을 반환하도록 했다.
  - 시트 이름(I열 값) 자체도 함께 반환(`{ title, subjects }`)해 페이지 상단 타이틀로 사용했다.
  - 모든 텍스트는 zero-width / NBSP 등 보이지 않는 문자를 제거하는 `normalize()` 함수를 거치도록 했다.
- `vacation.html`을 신규 생성했다.
  - 1920×1080 슬라이드 형식(`.slide-view` + `#scale-container` + `applyScale()`)으로 다른 페이지들과 동일한 스케일 처리를 적용했다.
  - 상단 가운데에 시트 이름(`title`)을 `font-size: 94px`, `font-weight: 700`으로 배치했다.
  - 과목명들은 `vacation-pills` 컨테이너에 `flex-wrap` + `gap: 8px` + 가운데 정렬로 배치하고, 각 알약은 배경 `#595959`, 흰색 텍스트 `39px`, 높이 `71px`, `border-radius: 77px`로 스타일링했다.
  - 알약에 마우스가 올라가면 활성 알약은 `scale(1.2)` 확대 + 배경 `#FA491D` + `font-weight: 700`이 되도록 `vacation-pill-pop` keyframes를 적용했다.
  - 주변 알약은 활성 알약의 확대된 박스 가장자리에서 `PUSH_GAP(20px)` 거리를 유지하도록 JS에서 `--push-x`, `--push-y` CSS 변수를 계산해 부여했다.
  - 밀려나는 동작은 스프링처럼 보이도록 `vacation-pill-spring` keyframes(`0% → 35% 오버슈트 → 55% 되돌림 → 75% 다시 살짝 → 100% 수렴`)를 1초 동안 재생되게 했다.
  - 활성 알약은 mouseenter 이벤트로 즉시 교체하고, 이전 활성 알약은 `active` 클래스 제거 + 모든 `pushed` 알약을 정리해 마우스를 옮길 때마다 바로 새 위치로 반응하도록 했다.
  - `vacation-pills-wrapper`에서 `mouseleave` 시 모든 알약이 원위치로 부드럽게 돌아오도록 처리했다.
  - 페이지 로드 시 `getLoadingContent()`로 로딩 이미지 캐시, `getWebAppUrl()`로 메인 URL을 백그라운드에서 받아두고, 좌하단 호버 영역에서 `<` 버튼을 보여주거나 `ESC` 키를 누르면 메인으로 이동(로딩 오버레이 + Great Vibes wipe 효과)하도록 다른 페이지와 동일한 패턴을 적용했다.
  - 하단 좌측에 `SBS ACADEMY COMPUTER ART SUWON` 푸터를 배치했다.

### `vacation.html` 알약 hover 연쇄 밀림 반응 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 hover 반응은 활성 알약의 확대 박스와 직접 겹치는 알약만 한 번 밀어내는 구조라, 밀려난 알약이 다시 다음 줄/다음 알약을 미는 2차/3차 반응이 생기지 않았다.
- `PUSH_ITERATIONS = 8` 상수를 추가해 충돌 해소 계산을 여러 번 반복하도록 했다.
- 기존 `setActivePill()` 뒤에 새 `setActivePill()` 정의를 추가해 브라우저가 마지막 정의를 사용하도록 했다.
- 새 로직은 모든 알약을 노드로 만들고, 활성 알약은 고정한 상태에서 각 알약의 현재 이동량(`dx`, `dy`)을 포함해 서로의 겹침을 반복적으로 해소한다.
- 이 과정에서 1차로 밀린 알약이 다시 주변 알약과 겹치면 다음 반복에서 그 주변 알약도 밀려나도록 연쇄 반응이 생긴다.
- 기존 `.pushed` 애니메이션과 `--push-x`, `--push-y` CSS 변수 적용 방식은 유지했다.
- 확인: `vacation.html`에서 `PUSH_ITERATIONS`, 새 `setActivePill()`, 반복 충돌 계산과 `.pushed` 적용 위치를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 연쇄 밀림 간격 기준 분리

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 연쇄 충돌 계산에서 모든 알약 노드 크기에 `PUSH_GAP * 2`를 더하고 있어, 호버 알약과 직접 인접하지 않은 2차/3차 알약들까지 20px 간격처럼 벌어지는 문제를 확인했다.
- `CHAIN_GAP = 8` 상수를 추가해 2차/3차로 밀린 알약끼리는 기존 flex gap과 같은 8px 간격을 유지하도록 했다.
- 노드의 `w`, `h`는 실제 크기와 활성 알약 scale만 반영하도록 되돌리고, 충돌 계산 시 `pairGap = (활성 알약 포함 쌍 ? PUSH_GAP : CHAIN_GAP)`으로 쌍마다 다른 간격을 적용했다.
- 이로써 호버된 알약과 직접 인접한 알약은 20px 떨어지고, 연쇄로 밀리는 알약끼리는 8px 기준으로만 정리되도록 했다.
- 확인: `vacation.html`의 `CHAIN_GAP`, `pairGap`, 노드 폭/높이 계산 변경을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 배경 이미지 + 알약 화면 중앙 + 줄당 3~4개 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `Code.js`의 `getVacationSeminarSubjects()`에서 메인 페이지 시트(`1424gRmyDWq...`) 읽기 범위를 기존 `E~I` 5개 열에서 `E~J` 6개 열로 확장해 J열 값을 함께 읽도록 했다.
- E열이 `방학 특강`인 행을 찾을 때 같은 행의 J열 값을 `bgImageUrl`로 저장하고, Drive 공유 링크인 경우 기존 `convertDriveUrl()` 헬퍼로 표시 가능한 thumbnail URL로 변환하도록 했다.
- `getVacationSeminarSubjects()`의 모든 반환 경로(정상/시트 없음/데이터 시트 없음/빈 시트/예외)에서 `imageUrl` 필드를 함께 반환하도록 수정했다.
- `vacation.html`의 `#scale-container` 안에 `<img class="vacation-bg">`와 `<div class="vacation-bg-overlay">` 두 개의 레이어를 새로 추가했다.
- `.vacation-bg`는 `1920×1080`을 가득 채우면서 `object-fit: cover`로 비율을 유지하고, `z-index: 0`으로 가장 뒤에 배치했다.
- `.vacation-bg-overlay`는 동일 크기로 깔리는 `background: #ffffff; opacity: 0.5; z-index: 1` 레이어로, 이미지 톤을 50% 흰색으로 눌러주는 역할을 한다.
- 타이틀(`.vacation-title`), 알약 영역(`.vacation-pills-wrapper`), 푸터(`.vacation-footer`)에 `z-index: 2`를 부여해 배경/오버레이 위에 항상 떠 있도록 했다.
- `renderPills(data)`에서 `data.imageUrl`이 있을 때만 `vacation-bg`의 `src`를 설정해 보여주고, 없으면 이미지와 오버레이를 `display: none`으로 숨겨 기본 회색 배경(`#f6f6f6`)이 그대로 보이도록 했다.
- 알약들이 화면 상단에 몰리던 문제를 고치기 위해 `.vacation-pills-wrapper`의 `top: 290px`/`bottom: 120px`를 `top: 200px`/`bottom: 100px`로 늘리고, `align-items: flex-start`를 `align-items: center`로 바꿔 알약 묶음이 슬라이드 세로 중앙에 떠 있도록 했다.
- 한 줄에 알약이 너무 많이 들어가던 문제를 위해 `.vacation-pills`의 `max-width`를 `1300px`에서 `900px`로 좁혀, 평균 폭의 알약이 줄당 3~4개만 들어가고 자연스럽게 wrap되도록 했다.
- 확인: `Code.js`의 `getRange(2, 5, ..., 6)` 변경, `bgImageUrl` 추출 및 `convertDriveUrl()` 호출, 모든 반환 경로의 `imageUrl` 필드를 직접 확인했고, `vacation.html`의 `.vacation-bg`/`.vacation-bg-overlay` 스타일과 마크업, `renderPills()`의 이미지 적용 로직, `.vacation-pills-wrapper`/`.vacation-pills`의 새 위치와 max-width 값을 모두 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 타이틀, 배경 폭, 알약 배열 및 hover 영역 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `2026년 여름방학특강` 타이틀을 기존 `94px`에서 약 60% 수준인 `56px`로 줄였다.
- 타이틀 색상을 `#0056B8`로 변경하고, 두께를 기존 `700`에서 살짝 얇은 `600`으로 낮췄다.
- 배경 이미지와 흰색 오버레이가 1920px 슬라이드 안에만 머무르지 않고 실제 브라우저 화면 양옆까지 차도록 `--viewport-left/top/width/height` CSS 변수를 추가했다.
- `applyScale()`에서 viewport를 슬라이드 좌표계로 환산해 위 CSS 변수들을 갱신하도록 했다.
- 알약 배열을 flex-wrap 자동 줄바꿈에서 행 단위 렌더링으로 변경하고, `chunkSubjects()`를 추가해 과목을 `3개 / 4개 / 4개 / 3개 / 2개` 패턴으로 배치하도록 했다.
- `.vacation-pills`는 세로 column 컨테이너로, 각 행은 `.vacation-pill-row` flex row로 렌더링되도록 CSS를 추가했다.
- hover로 변형되는 영역이 알약 자체 영역으로 한정되도록 각 `.vacation-pill`에 `mouseleave` 이벤트를 추가해, 마우스가 알약 밖으로 나가면 즉시 `clearActivePill()`이 실행되도록 했다.
- 확인: `vacation.html`의 타이틀 스타일, 배경 viewport 변수, `applyScale()` 변수 갱신, `chunkSubjects()` 렌더링, 알약별 `mouseleave` 이벤트를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 알약 밀림 애니메이션 겹침 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- hover 시 알약들이 한 번 튕겨나갔다가 갑자기 안쪽으로 모이며 겹쳐 보이는 원인을 `.vacation-pill-spring` keyframes에서 확인했다.
- 기존 keyframes는 `35%`에서 목표 이동량의 `1.15`까지 튕긴 뒤, `55%`에서 `0.88`까지 과하게 되돌아와 목표 위치보다 안쪽으로 들어오는 구간이 있었다.
- 이 안쪽 되돌림 구간을 없애고 `1.04 → 1.015 → 1.005 → 1.001 → 1`처럼 목표 위치 바깥에서 아주 작게 수렴하도록 변경했다.
- 밀림 애니메이션 시간을 `1s`에서 `0.48s`로 줄여 덜컥거림 없이 빠르게 안정되도록 했다.
- 확인: `vacation.html`의 `vacation-pill-spring` 배율과 `.vacation-pill.pushed` 애니메이션 시간을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 알약 hover overshoot 완전 제거

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 여전히 알약이 커지며 튕겼다가 덜컥 겹친다는 피드백을 받고, 남아 있던 실제 원인을 추가 확인했다.
- 밀려나는 알약뿐 아니라 hover된 활성 알약 자체도 `vacation-pill-pop`에서 `scale(1.28)`까지 커졌다가 `1.2`로 줄어들고 있어, 충돌 계산 기준(`ACTIVE_SCALE = 1.2`)보다 순간 크기가 더 커지는 문제가 있었다.
- `.vacation-pill`의 transform transition을 overshoot가 있는 `cubic-bezier(0.34, 1.56, 0.64, 1)`에서 안정적인 `cubic-bezier(0.22, 0.61, 0.36, 1)`로 변경했다.
- `.vacation-pill.pushed`는 keyframe animation을 쓰지 않고 `transform: translate(var(--push-x), var(--push-y)) scale(1)`로 바로 최종 위치에 transition되도록 바꿨다.
- `.vacation-pill.active`도 animation 없이 `transform: scale(1.2)`만 적용되도록 변경했다.
- 남아 있던 `vacation-pill-pop` keyframes의 `scale(1.28)`, `scale(1.17)`도 모두 `scale(1.2)`로 정리해 추후 재연결되어도 overshoot가 생기지 않게 했다.
- 확인: `vacation.html`에서 `scale(1.28)`/`scale(1.17)` 검색 결과가 사라진 것과, active/pushed가 `animation: none`으로 동작하는 것을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 알약 연쇄 스프링 효과 재설계

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 원하는 효과를 `호버 알약 확대/색상/두께 변화 + 주변 알약 연쇄 밀림 + 안전한 스프링 수렴`으로 정리하고 다시 구현했다.
- `.vacation-pill.pushed`에 `vacation-pill-spring` 애니메이션을 다시 연결하되, 이전처럼 목표 위치 안쪽으로 들어오는 구간은 넣지 않았다.
- pushed 알약은 `0 → 1.16 → 1.04 → 1.08 → 1.015 → 1`처럼 목표 위치 바깥쪽에서만 출렁이며 최종 위치로 수렴하도록 했다.
- `.vacation-pill.active`는 계산 기준보다 커지지 않게 `animation: none; transform: scale(1.2)`를 유지했다.
- `setActivePill()`의 연쇄 충돌 계산으로 1차/2차/3차 알약의 최종 위치를 먼저 안전하게 계산한 뒤, 각 pushed 알약에 `--push-x`, `--push-y`를 부여하도록 유지했다.
- 활성 알약과의 거리 기반 `--spring-delay`를 추가해 가까운 알약은 먼저, 먼 알약은 최대 110ms 늦게 반응하도록 하여 연쇄 전파 느낌을 만들었다.
- reset 시 `--spring-delay`도 함께 제거하도록 정리했다.
- 확인: `vacation.html`에서 `vacation-pill-spring`, `--spring-delay`, `distanceFromActive`, active/pushed 적용 경로를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 알약 hover 레이아웃 기반 스프링으로 전환

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 제안한 대로 transform으로 주변 알약을 강제로 미는 구조 대신, hover된 알약의 실제 padding/height/margin/font-size가 변하면서 flex 레이아웃이 주변 알약을 자연스럽게 밀도록 변경했다.
- `.vacation-pill`의 기본 transform scale 중심 transition을 줄이고, active 상태에서 `vacation-pill-expand` keyframes가 실제 박스 크기를 `height/padding/margin/font-size` 기준으로 출렁이게 했다.
- active 알약은 `71px → 90px → 82px → 86px → 84px`, 좌우 padding은 `36px → 64px → 52px → 58px → 54px`, margin은 `0 → 13px → 7px → 10px → 9px`으로 수렴한다.
- 마지막 `setActivePill()` 정의를 단순화해 더 이상 `pushed` transform 계산을 실행하지 않고, active 클래스만 붙이도록 했다.
- 마지막 `clearActivePill()`도 active 제거와 motion 변수 정리만 수행하도록 덮어썼다.
- 이로써 색상/두께/크기 변화와 주변 밀림이 같은 레이아웃 흐름에서 동시에 시작되며, 마지막에 transform 정리 때문에 알약들이 덜컥 가까워지는 움직임을 없앴다.
- 확인: `vacation.html`의 `vacation-pill-expand`, 마지막 `setActivePill()`, 마지막 `clearActivePill()`, `resetPillMotionState()` 정의를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 타이틀 박스 및 알약 투명도 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 알약 도형의 opacity를 80%로 보이게 하기 위해 `.vacation-pill` 배경을 `rgba(89, 89, 89, 0.8)`로 변경했다.
- active 알약도 동일한 80% 느낌을 유지하도록 배경을 `rgba(250, 73, 29, 0.8)`로 변경했다.
- 타이틀 위치를 기존 `top: 82px`에서 `top: 182px`로 바꿔 약 100px 아래로 내렸다.
- 타이틀 텍스트를 `.vacation-title-box` span으로 감싸고, 상하좌우 `30px` padding을 적용했다.
- 타이틀 박스 배경은 `rgba(255, 255, 255, 0.65)`로 설정해 흰색 65% opacity 박스로 보이도록 했다.
- 확인: `vacation.html`의 `.vacation-title`, `.vacation-title-box`, `.vacation-pill`, `.vacation-pill.active`와 타이틀 마크업 변경을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `vacation.html` 타이틀 박스 모서리 라운드 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `2026년 여름방학특강`을 감싸는 `.vacation-title-box` 흰 박스에 `border-radius: 20px`를 추가해 네 모서리를 둥글게 처리했다.

### `vacation.html` 알약 클릭 시 커리큘럼 팝업 신규

- 작업 전 이 `gpt.md` 파일을 확인했다.
- Figma 디자인(`Z2UxoCdtb12ZrbrTH8jJBz` 파일의 `225:1289` 노드, "방특 커리큘럼")을 Figma MCP `get_design_context`로 가져와 좌표/폰트 크기를 1:1 매칭했다.
- `Code.js`에 `getVacationSubjectDetail(baseName)`을 신규 추가했다.
  - 메인 페이지 시트의 E열 `방학 특강` 행에서 I열 값을 읽어 데이터 시트 탭 이름을 알아낸 뒤, 해당 탭의 A~I 9개 열을 한 번에 읽는다.
  - A/B/F/I 4개 열은 각각 forward-fill해 병합 셀의 상위 값을 모든 하위 행에 복사한다. G/H는 행 단위 값을 그대로 사용한다.
  - B열에서 연속된 동일 값을 하나의 "블록(variant)"으로 묶고, 블록의 시작 행에서 A(강사) / I(시간) / F(준비물) 값을, 블록 내 각 행에서 G(커리큘럼) / H(이미지)를 step으로 추출한다.
  - 끝 숫자(`\s*\d+$`)를 제거한 base name이 입력값과 공백 무시 매칭으로 같은 블록만 필터링해, 호버 알약과 같은 base name(예: `포토샵`, `애프터 이펙트`, `캐드`)의 모든 변형을 시트 행 순서대로 반환한다.
  - 결과 구조: `{ baseName, variants: [{ subjectFull, teacher, time, supplies, steps: [{ image, curriculum }, ...] }, ...] }`. H열의 Drive 공유 링크는 `convertDriveUrl()`로 thumbnail URL로 변환한다.
  - 캐드처럼 강사가 2명인 과목은 시트 행 순서에 따라 `강사A의 캐드1 → 캐드2 → 강사B의 캐드1 → 캐드2` 순으로 자연스럽게 정렬된다.
- `vacation.html`에 커리큘럼 팝업을 신규 추가했다.
  - 마크업: `<div class="curriculum-popup">` 안에 `slide-view` + `#curriculum-popup-scale`을 두어 본문 페이지와 동일한 1920×1080 슬라이드 스케일 패턴을 사용했다.
  - 제목 (`.popup-title`): 좌측 `129px`, `top: 82px`, `Pretendard Bold 94px`. 과목명 span(`#popup-title-subject`) 뒤에 "방학특강" 라벨을 고정 텍스트로 붙였다.
  - 주황 선 (`.popup-orange-line`): 좌측 `129px`, `top: 194px`, `height: 3px`, 배경 `#fa491d`. `updateOrangeLineWidth()`에서 정보 행의 실제 너비(`scrollWidth`)에 맞춰 가로 길이를 매번 갱신한다.
  - 정보 행 (`.popup-info-row`): 좌측 `129px`, `top: 211px`, `Pretendard ExtraLight 39px`, `gap: 80px`. 강사명 + " 선생님", 시간, 준비물 순서로 한 줄에 배치.
  - 카드 그리드 (`.popup-cards`): `top: 332px`, 좌우 `129px` 여백, `gap: 38px`, 가운데 정렬 flex row. 각 카드는 `387×375 radius:22px` 이미지 박스 + 그 아래 `margin-top: 22px`의 커리큘럼 텍스트(`24px / line-height: 1.4 / word-break: keep-all`).
  - 빈 이미지/커리큘럼은 placeholder(`.empty` 클래스)로 표시해 빈 행도 동일 폭으로 자리를 차지한다.
  - 좌우 네비 버튼 (`.popup-nav-btn.prev`, `.next`), 우상단 닫기 버튼 (`.popup-close-btn`), 슬라이드 하단 가운데 `1 / N` 카운터 (`.popup-counter`)를 추가했다.
- 알약 클릭 → 팝업 흐름:
  - `bindPillEvents()`에 알약 `click` 핸들러를 추가해 `data-name`을 `openCurriculumPopup()`에 넘기도록 했다.
  - 호버 효과(`mouseenter` 기반 알약 확장)와 클릭이 서로 독립적이라 충돌하지 않는다.
  - `openCurriculumPopup(baseName)`은 팝업을 먼저 "불러오는 중" 상태로 열어 응답성을 확보한 뒤 `google.script.run.getVacationSubjectDetail()`을 호출하고, 결과가 오면 `renderVariant()`로 첫 변형을 렌더한다.
- 네비게이션:
  - `ArrowLeft` / `ArrowRight` 키, 좌우 네비 버튼 클릭, 마우스 휠(수직/수평 모두 인식, 350ms 디바운스)로 같은 알약의 다음/이전 변형으로 즉시 이동한다.
  - 양쪽 끝에서는 해당 네비 버튼이 `disabled` 상태로 흐려지고 더 이상 진행하지 않는다.
  - 기존 `ESC` 핸들러를 수정해, 팝업이 열려 있으면 `closeCurriculumPopup()`만 호출하고 메인 페이지로 이동하지 않게 했다.
- 리사이즈 시 `applyPopupScale()`을 다시 호출해 팝업도 viewport 비율에 맞춰 1920×1080 → 화면으로 동일하게 스케일된다.
- 확인: `Code.js`의 `getVacationSubjectDetail()` 정의, A/B/F/I forward-fill 및 블록 분리 로직, base name 매칭, `convertDriveUrl()` 호출을 직접 확인했고, `vacation.html`의 팝업 CSS(`popup-title`, `popup-orange-line`, `popup-info-row`, `popup-cards`, `popup-card`, 네비/닫기 버튼), 마크업, 알약 click 바인딩, `openCurriculumPopup`/`renderVariant`/`updateOrangeLineWidth`/`nextVariant`/`prevVariant`, 키보드/휠 핸들러, ESC 우선순위 변경을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### 로딩 페이지 문구에 Paperlogy ExtraBold(800) 폰트 적용

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 `fonts/Paperlogy-1Thin.ttf ~ Paperlogy-9Black.ttf` 9개 굵기를 폴더에 추가했고, 그중 ExtraBold(800)만 로딩 페이지(`.wipe-text`) 문구에 적용하기로 결정했다.
- GAS(Google Apps Script)는 `.html`/`.gs`/`.json`만 클래스프(`clasp`)로 푸시되고 `.ttf`/`.woff2` 같은 정적 바이너리는 직접 서빙할 수 없으므로, 폰트를 base64로 인코딩해 `@font-face`의 `src: url(data:font/woff2;base64,...)`에 인라인 임베드하는 방식을 선택했다.
- `pip install --user fonttools brotli`로 fontTools를 설치하고, `python -c "from fontTools.ttLib import TTFont; f=TTFont('Paperlogy-8ExtraBold.ttf'); f.flavor='woff2'; f.save('Paperlogy-8ExtraBold.woff2')"`로 TTF(673,912 bytes)를 woff2(158,696 bytes)로 변환했다. 약 77% 용량 감소.
- `python` 한 줄 스크립트로 woff2를 base64(211,596 chars)로 인코딩해 `fonts.html`을 신규 생성했다. `fonts.html`은 단일 `<style>` 블록 안에 `@font-face { font-family:'Paperlogy'; font-weight:800; font-display:swap; src:url(data:font/woff2;base64,...) format('woff2'); }`만 담은 공용 include 파일이다. 파일 크기 211,855 bytes.
- 폰트가 필요한 7개 HTML 파일(`vacation.html`, `index.html`, `item.html`, `Curriculum_full.html`, `Curriculum_onepage.html`, `roadmap.html`, `seminar.html`)의 `<head>` 안 Great Vibes 링크 직후에 `<?!= include('fonts'); ?>`를 추가했다. `Code.js`에 이미 정의되어 있던 `include(filename)` 함수가 templated HTML에서 동작한다.
- 같은 7개 파일의 `.wipe-text` CSS 규칙에서 `font-family: 'Great Vibes', cursive;`를 `font-family: 'Paperlogy', 'Great Vibes', cursive;`로 바꾸고 바로 다음 줄에 `font-weight: 800;`을 추가했다. Paperlogy가 한글/영문 모두 처리하고, 시스템에 폰트가 없을 때를 위해 Great Vibes/cursive를 폴백으로 유지했다.
- `fonts/Paperlogy-8ExtraBold.b64.txt`는 인코딩 중간 산출물로 fonts 폴더에 남겨두었다(다음에 재생성 시 활용). `fonts/` 폴더 자체는 GAS로 업로드되지 않지만 로컬 작업 자료로 유지한다.
- `index.html`의 `.red-highlight`(line 81)도 Great Vibes를 쓰지만 사용자가 로딩 페이지 문구에만 적용을 원해 손대지 않았다.
- 확인: `fonts.html` 생성 결과(크기 211,855 bytes), 7개 HTML 파일의 `<?!= include('fonts'); ?>` 위치와 `.wipe-text`의 `font-family` / `font-weight: 800` 변경을 모두 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### "로딩 중" 시트의 D/E/F열 폰트 설정을 로딩 문구에 행 단위로 적용

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 `getLoadingContent()`는 `로딩 중` 시트 A~C열(이미지/문구/체크박스)만 읽었는데, 사용자가 D열(폰트명), E열(폰트크기), F열(두께)을 행마다 다르게 적용할 수 있도록 요청했다.
- 적용 범위는 로딩 페이지(`.wipe-text` 엘리먼트)에 한정한다. 다른 페이지의 기본 폰트 Pretendard는 그대로 유지.
- 사용자 명시: 두께(F열)가 비면 폰트의 기본 두께(400) 적용.
- `Code.js`의 `getLoadingContent()`에서 `getRange(2, 1, lastRow - 1, 3)`를 `getRange(2, 1, lastRow - 1, 6)`로 확장하고, 반환 객체에 `fontFamily`(D), `fontSize`(E), `fontWeight`(F) 필드를 추가했다. 빈 셀은 빈 문자열로 정규화한다.
- `fonts.html` 끝부분에 공통 헬퍼 `window.applyLoadingFont(el, picked)`를 정의한 `<script>` 블록을 추가했다.
  - `picked === null` 또는 `picked` 미존재 시: 인라인 `fontFamily`/`fontSize`/`fontWeight` 스타일을 모두 제거해 CSS `.wipe-text` 규칙으로 복귀한다.
  - `picked.fontFamily`가 있으면 `el.style.fontFamily`에 그대로 적용, 없으면 인라인 제거(→ CSS Paperlogy 폴백).
  - `picked.fontSize`가 숫자만으로 구성된 문자열이면 `px` 단위를 자동 부여하고, `rem`/`em`/`px`/`%` 같은 단위가 들어 있으면 그대로 사용한다.
  - `picked.fontWeight`가 비어 있으면 `'400'`을 명시적으로 지정해 CSS의 `font-weight: 800` 위에 인라인 400이 덮어지도록 했다.
- 로딩 텍스트를 실제로 그리는 9개 지점에 `applyLoadingFont(textEl, ...)` 호출을 추가했다.
  - `vacation.html` / `item.html` / `seminar.html` / `roadmap.html`: 각 `showLoadingAndNavigate()`의 `if (picked) {} else {}` 양쪽 끝에 추가(총 4파일 × 2호출).
  - `Curriculum_onepage.html` / `Curriculum_full.html`: `displayLoadingContent(item)`과 `showLoadingAndNavigate()` 두 곳 모두에 추가(총 2파일 × 3호출).
  - `index.html`: `displayLoadingContent(item)`에 추가(1호출).
  - 헬퍼가 미정의된 경우에 대비해 `if (typeof applyLoadingFont === 'function')` 가드를 모두 두었다.
- 호출 위치는 항상 `textEl.setAttribute('data-text', ...)` 직후로 통일했고, wipe 애니메이션을 다시 트리거하는 `classList.remove('animate'); void textEl.offsetWidth; classList.add('animate')` 직전이라 폰트 적용 후 정상적으로 wipe 효과가 재생된다.
- 동작 흐름: 페이지 로드 시 `getLoadingContent()` 결과가 `localStorage`(`loading_list_cache_v1`)에 캐시되고, 메인으로 이동할 때 그중 하나를 랜덤 선택해 이미지/문구/폰트 세 가지를 모두 적용한다.
- 사용 가능한 폰트: 현재 `fonts.html`은 Paperlogy 800만 로드. 그 외 D열 값으로는 페이지에 이미 로드된 Pretendard Variable(100~900) / Great Vibes(영문 손글씨)를 쓸 수 있고, 다른 폰트는 시스템에 없으면 폴백된다는 점을 사용자에게 공지했다.
- 확인: `Code.js`의 `getLoadingContent()` 반환 필드 3개 추가, `fonts.html`의 `<script>` 블록과 `applyLoadingFont` 정의, 7개 HTML 파일의 9개 호출 지점 모두를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### 로딩 페이지의 이미지/문구/폰트 행 정합성 보정 (id 안정화 + clamp 자동 래핑)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 로딩 페이지에서 이미지/문구/폰트가 서로 다른 행 값으로 섞여 보이는 현상을 사용자가 보고했다. C열로 체크된 행이 선택되면 그 행의 A~F열 값이 한 묶음으로 표시되어야 한다.
- 원인 분석:
  1. `getLoadingContent()`의 `id`를 `'loading_' + i`(행 인덱스) 기반으로 만들고 있어, 시트 행 순서가 바뀌면 이미지 base64 캐시(`localStorage` `loading_image_cache_v1`)가 동일 id에 다른 URL을 가리키게 되어 **옛 이미지에 새 문구**가 따라붙는 어긋남이 발생했다.
  2. E열에 `1.25rem, 3.5vw, 3rem`과 같이 콤마로 구분된 clamp 인자를 그대로 적으면, 기존 `applyLoadingFont()`가 그 문자열을 `el.style.fontSize`에 그대로 대입하다가 브라우저가 invalid로 거부, **이전 행의 인라인 fontSize가 남아** 다음 행 텍스트에 다른 행 크기가 적용되는 현상이 생겼다.
- `Code.js`의 `getLoadingContent()`에서 `id`를 행 인덱스 기반에서 **URL MD5 해시 기반**(`'loading_' + hex(MD5(convertedUrl)).slice(0,16)`)으로 변경했다.
  - 변환된 imageUrl을 입력으로 사용해, 같은 Drive 파일은 항상 같은 id로 안정화된다.
  - 시트 행 순서가 바뀌어도 URL이 같으면 같은 id, URL이 다르면 다른 id가 되므로 기존 이미지 캐시가 잘못 매칭되지 않는다.
  - `Utilities.computeDigest()`가 실패하는 예외 케이스를 위해 길이/첫 글자 기반 fallback id도 두었다.
  - 동시에 `convertDriveUrl()` 호출 결과를 한 번만 계산해 변수에 담아 id 해시와 imageUrl 모두에 동일한 값을 사용하도록 정리했다.
- `fonts.html`의 `applyLoadingFont()`를 다음과 같이 보강했다.
  1. 함수 시작 시 `fontFamily`/`fontSize`/`fontWeight` 인라인 스타일을 **항상 먼저 초기화**해, invalid 값을 줘서 브라우저가 무시한 직전 인라인 스타일이 다음 호출까지 남는 현상을 차단했다.
  2. `fontSize` 처리 규칙을 확장했다.
     - 순수 숫자 (`/^-?\d+(\.\d+)?$/`) → `px` 자동 부여
     - 콤마 포함 + 괄호 없음 → `clamp(<원본>)` 으로 자동 래핑 (예: `1.25rem, 3.5vw, 3rem` → `clamp(1.25rem, 3.5vw, 3rem)`)
     - 그 외(`48px`, `2rem`, `clamp(...)`, `min(...)`) → 그대로 적용
  3. `fontWeight`는 종전대로 빈값이면 `'400'` 명시 적용 (CSS `.wipe-text`의 `font-weight: 800`을 인라인으로 덮어쓰기 위해).
- 이로써 한 행이 선택되면 A~F열 값 모두 그 행 기준으로 일관되게 표시된다. 예: 사용자 예시의 9행(`A9` Drive URL, `B9` "SBS아카데미컴퓨터아트학원 수원점", `D9` Paperlogy, `E9` `1.25rem, 3.5vw, 3rem`, `F9` 800)을 적으면 이미지/문구/폰트 모두 9행 값으로 같이 적용된다.
- 기존 캐시 호환성: 새 id 포맷은 옛 행번호 id(`loading_0` 등)와 다른 문자열이라, 옛날에 캐시된 이미지 항목은 자연스럽게 매칭되지 않고 무시되며(불필요한 stale 항목은 localStorage 용량을 일부 차지하지만 동작에는 영향 없음) 시간이 지나면 정리된다.
- 확인: `Code.js`의 `urlBasedId()` 도입과 `id` 사용처, `convertDriveUrl()` 호출 정리, `fonts.html`의 `applyLoadingFont()` 초기화 로직과 fontSize 분기(숫자/콤마/그 외)를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 `node --check` 문법 검사는 수행하지 못했다.

### `category_instructor.html` 강사 경력 텍스트 크기/두께 축소

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: Curriculum_full의 강사 소개 패널(`category_instructor.html`)에서 강사 경력 본문 글자 크기를 "10이면 5 정도"(약 절반)로 줄이고, 두께도 지금보다 얇게.
- 대상 규칙은 `.instructor-detail-career` 한 곳이며, 강사명(`.instructor-detail-name`), 주황 구분선(`.instructor-detail-divider`), 우측 과목 버튼은 별도 규칙이라 영향받지 않는다.
- `font-size`를 기존 `4.72cqh`(1080 기준 ≈ 51px)에서 절반인 `2.36cqh`(≈ 25.5px)로 낮췄다. `cqh` 단위라 라이트박스 크기에 비례해 함께 줄어든다.
- `font-weight`를 기존 `600`(SemiBold)에서 `300`(Light)으로 낮춰 시각적으로 확실히 얇아 보이도록 했다. Pretendard Variable이 100~900 전 굵기 로드되어 있어 300이 정확히 표시된다.
- 확인: `category_instructor.html`의 `.instructor-detail-career` 블록과 주변 규칙(`.instructor-detail-name`, `.instructor-detail-divider`)이 그대로 유지된 것을 직접 확인했다.

### `item.html` 행 hover 하이라이트 (교재/준비물/AI툴 공통)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: `item.html`의 표에서 행 구분이 잘 보이도록, 행에 마우스가 올라가면 전체 행에 `#F9DACB` 배경 박스가 들어가게 한다. 교재 / 준비물 / AI툴 세 탭 모두 적용.
- 세 탭이 모두 데이터 행에 같은 클래스(`.item-row` + `textbook-layout` / `supply-layout`)를 쓰고, AI툴도 동일한 `.item-row` 컨테이너로 렌더링되므로 `.item-row` 한 규칙에만 hover 스타일을 추가하면 세 탭 모두에 자동 적용된다.
- `.item-row`에 `border-radius: 18px`와 `transition: background-color 0.15s ease`를 추가하고, 새 규칙 `.item-row:hover { background-color: #F9DACB; }`를 작성했다.
- 행의 폭은 기존 `width: calc(100% - 140px); margin: 0 auto`로 표상자 내부에 좌우 70px 여백을 두고 가운데 정렬되어 있어, hover 박스도 자연스럽게 행 전체(과목명/교재명·내용·툴/정가)에 박스 형태로 표시된다.
- 교재 탭의 `.item-cell.textbook-title:hover`(주황색 글씨 + 이미지 툴팁) 효과는 그대로 유지되어, 교재명 셀에 마우스를 올리면 분홍 배경 + 주황 글씨 + 툴팁이 같이 적용된다.
- 확인: `item.html`의 `.item-row` 블록과 새 `.item-row:hover` 규칙을 직접 확인했고, 세 탭 모두 같은 컨테이너 클래스를 사용하는 것도 grep으로 확인했다.

### `item.html` 첫 행 hover 박스 상단 잘림 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 행 hover 하이라이트(F9DACB)를 적용한 뒤 첫 행에서만 둥근 상단 모서리가 잘려 보이는 현상을 사용자가 보고했다.
- 원인: `.item-body-scroll`의 `padding: 2px 0 40px`로 상단 여백이 2px밖에 안 돼서, `.item-row`의 `border-radius: 18px`가 그려질 충분한 공간 없이 첫 행이 헤더(`.item-header-row`)의 주황 구분선 바로 아래에 붙어 있었다.
- `.item-body-scroll`의 padding을 `2px 0 40px` → `20px 0 40px`로 변경했다. 첫 행을 헤더 아래로 18px 더 내려, 둥근 hover 박스가 잘리지 않고 자연스럽게 보이도록 했다.
- 두 번째 행부터는 `.item-row`의 자체 `padding: 14px 0` 위/아래 여백 덕에 hover 박스 사이 간격이 이미 충분하므로 추가 조정 불필요.
- 확인: `item.html`의 `.item-body-scroll` 블록과 주변 `.item-row` 규칙을 직접 확인했다.

### `Curriculum_full` 강사소개 2번째 페이지 백지 원인 검토

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: `Curriculum_full`의 강사소개에서 아트웍학과 강사 4명이 2명씩 2페이지로 나뉘어야 하는데, 1/2은 보이고 2/2은 백지로 나오는 원인을 파악. 코드 수정은 하지 않음.
- 관련 파일 확인: `Curriculum_full.html`, `category_instructor.html`, `Code.js`.
- 데이터 소스 흐름: `Curriculum_full.html`에서 `학과 강사소개` 카테고리일 때 `createInstructorPages(deptName, engHeader, catName)`를 호출하고, `category_instructor.html`의 이 함수가 `google.script.run.getInstructorList(deptName)`로 서버 데이터를 비동기 로드한다. 서버의 `Code.js#getInstructorList()`는 `1424gRmy...` 스프레드시트의 `강사페이지` 시트 A~F열에서 강사명/학과/경력/한마디/사진을 읽고, 과목 목록은 `1iHwb...` 커리큘럼 시트의 학과 탭에서 강사명(A열) 기준으로 B열 과목을 매핑한다.
- 페이지 분할 로직 자체는 4명일 때 비어 있는 두 번째 페이지를 만들지 않는다. 현재 `handleInstructorDataLoaded()`는 `totalPages = Math.ceil(instructors.length / 3)`로 페이지 수를 정하고, 4명인 경우 `pageSizes`가 `[2, 2]`가 되어 `pageSlices[1]`에도 강사 2명이 들어가야 한다.
- 더 가능성이 높은 원인: 강사소개는 처음에 임시 슬라이드 1장만 반환하고, 데이터가 도착한 뒤 첫 페이지를 `replaceChild`로 갈아끼우고 추가 페이지를 `slides.splice()`/`insertBefore()`로 중간 삽입한다. 이 비동기 후처리에는 현재 열린 학과와 콜백의 학과가 같은지 확인하는 guard가 없고, 이미 추가된 기존 강사 페이지를 정리하는 로직도 없다. 따라서 학과 전환/재호출/응답 순서가 꼬이면 `slides` 배열과 실제 DOM의 강사 페이지가 어긋나 백지 슬라이드처럼 보일 수 있다.
- 보조 확인: `renderInstructorCards()`는 `pageInstructors.map(...)`으로 바로 카드 HTML을 채우므로, 정상적으로 `pageSlices[1].list`가 전달되었다면 두 번째 페이지가 완전히 비어 있을 가능성은 낮다.
- 아직 수정하지 않았고, 사용자에게 원인 설명만 전달 예정.

### `Curriculum_full` 강사소개 2번째 페이지 백지 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 앞서 파악한 강사소개 2/2 백지 문제를 수정.
- 수정 파일: `category_instructor.html`.
- `makeInstructorPageShell()`에서 생성되는 강사소개 슬라이드에 `slide.dataset.dept = deptName`을 추가했다. 이제 각 강사 페이지가 어느 학과의 페이지인지 DOM/`slides` 배열 양쪽에서 식별 가능하다.
- `handleInstructorDataLoaded()` 초입에 현재 열린 학과(`activeDeptName`)와 응답의 `deptName`이 다르면 즉시 return하는 guard를 추가했다. 늦게 도착한 이전 학과의 비동기 응답이 현재 슬라이드 DOM을 덮어쓰는 문제를 막는다.
- 강사 0명 처리에서도 첫 페이지 조회 조건을 `data-instructor-page="0"`뿐 아니라 `data-dept`까지 함께 보도록 바꿨다.
- 페이지 분할 기준을 사용자 설명에 맞춰 명확히 했다. 강사가 3명 이하이면 한 페이지에 최대 3명, 4명 이상이면 `instructorsPerPage = 2`로 2명씩 분할한다. 따라서 아트웍학과 4명은 `[2, 2]`로 1/2, 2/2 페이지에 각각 2명씩 들어간다.
- 추가 페이지를 만들기 전에 같은 학과의 기존 추가 강사 페이지(`data-instructor-page !== "0"`)를 뒤에서부터 제거하고 `slides.splice()`도 같이 수행하도록 했다. 비동기 재호출/재렌더 상황에서 DOM과 `slides` 배열이 어긋나 백지 페이지처럼 보이는 상황을 줄인다.
- 확인: `category_instructor.html`에서 `dataset.dept`, `activeDeptName` guard, `instructorsPerPage`, 기존 추가 페이지 제거 루프가 들어간 위치를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했다.

### `Curriculum_full` 강사소개 백지 문제 2차 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: 이전 보정 후에도 아트웍학과 강사소개 2/2 페이지가 정상 표시되지 않음.
- 1차 보정은 첫 페이지 교체 + 추가 페이지 삽입 구조를 유지한 상태에서 guard와 기존 추가 페이지 제거만 더한 방식이었다. 이 구조 자체가 여전히 비동기 렌더링 시 DOM/`slides` 배열/active 상태가 어긋날 여지가 있어 더 방어적으로 변경했다.
- `handleInstructorDataLoaded()`를 재구성했다.
  - 현재 학과가 아닌 늦은 응답은 그대로 무시한다.
  - 응답 학과의 기존 강사소개 슬라이드를 `slides` 배열과 DOM에서 전부 제거한다.
  - 강사 수 기준으로 새 강사소개 슬라이드 배열(`newInstructorSlides`)을 다시 만든다.
  - 3명 이하는 한 페이지, 4명 이상은 2명씩 페이지 분할한다.
  - 각 새 페이지를 만들자마자 `renderInstructorCards(pageSlide, deptName, pageList, start)`로 카드 HTML과 이벤트를 즉시 렌더링한다.
  - 새 슬라이드 묶음을 원래 첫 강사소개 페이지 위치에 다시 삽입하고, `slides.splice(insertAtIdx, 0, ...newInstructorSlides)`로 배열도 같은 순서로 맞춘다.
  - 기존 active 슬라이드가 강사소개 페이지였으면 같은 page index를 가능한 한 유지하고, 아니면 기존 active 슬라이드를 다시 찾아 `currentSlideIndex`를 보정한다.
  - 마지막에 모든 슬라이드의 `.active` 클래스를 현재 index 기준으로 재정렬한다.
- 이 방식은 “첫 장만 교체하고 나머지를 끼워 넣는” 방식보다 더 확실하게 강사소개 페이지 구간을 원자적으로 재생성하므로, 2/2 페이지 껍데기만 있고 카드가 비는 문제를 줄인다.
- 확인: `category_instructor.html`의 `oldInstructorSlides`, `newInstructorSlides`, `instructorsPerPage`, `slides.splice`, active 재정렬 로직 위치를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했다.

### `Code.js` `getVacationSubjectDetail()` 열 매핑 변경 (E열 커리큘럼 / G열 준비물)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 방학특강 시트의 열 매핑을 다음과 같이 변경.
  - 커리큘럼: 기존 G열 → **E열** (행 단위, 스텝마다 다름)
  - 준비물: 기존 F열 → **G열** (블록 단위, forward-fill)
  - 이미지 링크: H열 (변경 없음)
  - 수업 시간: I열 (변경 없음)
- `Code.js` `getVacationSubjectDetail()`에서:
  - `forwardFillCol(5)` (F열) → `forwardFillCol(6)` (G열)로 변경하고 변수명 `fFilled` → `gFilled`로 바꿔 의도를 명확히 했다.
  - 행 단위 커리큘럼 추출을 `rows[r][6]` (G열) → `rows[r][4]` (E열)로 바꿨다.
  - 반환 객체의 `supplies` 필드 출처를 `fFilled[...]` → `gFilled[...]`로 갱신했다.
  - 주변 주석(`A/B/F/I는 그룹 단위, G/H는 행 단위`)을 `A/B/G/I는 그룹 단위, E/H는 행 단위`로 수정해 주석/코드 동기화를 유지했다.
- 최종 매핑(방학특강 데이터 시트 각 탭 기준):

  | 열 | 인덱스 | 용도 | 병합 처리 |
  |----|--------|------|----------|
  | A | 0 | 강사명 | forward-fill |
  | B | 1 | 과목명 (예: 포토샵1) | forward-fill |
  | E | 4 | 커리큘럼 | **행 단위** |
  | G | 6 | 준비물 | forward-fill |
  | H | 7 | 이미지 링크 | 행 단위 |
  | I | 8 | 수업 시간 | forward-fill |
- 호출부(`vacation.html` 팝업 렌더링)는 반환 객체 필드명(`steps`, `supplies`, `time`, `teacher`, `subjectFull`)이 동일하게 유지되어 추가 수정 불필요.
- 확인: `Code.js`의 `getVacationSubjectDetail()` 함수에서 `forwardFillCol` 호출 인자, `gFilled` 변수 사용, step 추출 인덱스(`rows[r][4]`, `rows[r][7]`), 반환 객체 `supplies: gFilled[blk.startIdx]`를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했다.

### `Code.js` `getVacationSubjectDetail()` 열 매핑 재변경 (F열 이미지 / H열 준비물)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 직전 변경 위에 다시 한 번 매핑 교체.
  - 이미지 링크: 기존 H열 → **F열** (행 단위, 스텝마다 다름)
  - 준비물: 기존 G열 → **H열** (블록 단위, forward-fill)
  - 커리큘럼: E열 (변경 없음, 행 단위)
  - 수업 시간: I열 (변경 없음, forward-fill)
- `Code.js` `getVacationSubjectDetail()`에서:
  - `forwardFillCol(6)` (G열) → `forwardFillCol(7)` (H열)로 바꾸고 변수명 `gFilled` → `hFilled`로 변경.
  - 행 단위 이미지 추출을 `rows[r][7]` (H열) → `rows[r][5]` (F열)로 바꿨다.
  - 반환 객체의 `supplies` 필드 출처를 `gFilled[...]` → `hFilled[...]`로 갱신했다.
  - 주변 주석을 `A/B/G/I는 그룹 단위, E/H는 행 단위` → `A/B/H/I는 그룹 단위, E/F는 행 단위`로 정정.
- 최종 매핑(방학특강 데이터 시트 각 탭 기준):

  | 열 | 인덱스 | 용도 | 병합 처리 |
  |----|--------|------|----------|
  | A | 0 | 강사명 | forward-fill |
  | B | 1 | 과목명 (예: 포토샵1) | forward-fill |
  | E | 4 | 커리큘럼 | **행 단위** |
  | F | 5 | 이미지 링크 | **행 단위** |
  | H | 7 | 준비물 | forward-fill |
  | I | 8 | 수업 시간 | forward-fill |
- 호출부(`vacation.html` 팝업 렌더링)는 반환 객체 필드명 동일 유지로 추가 수정 불필요.
- 확인: `Code.js`의 `forwardFillCol(7)` 호출, `hFilled` 변수, step 추출 인덱스(`rows[r][4]`, `rows[r][5]`), 반환 객체 `supplies: hFilled[blk.startIdx]`를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했다.

### `Curriculum_full` 강사소개 4명 → 1페이지(2명)만 표시되는 문제 3차 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 아트웍학과(강사 4명)에서 1/2 페이지에 2명만 보이고 2/2 페이지가 아예 나타나지 않음. 직전 두 번의 보정(`handleInstructorDataLoaded` 재구성)에도 여전히 재현됨.
- 추적 결과: 클라이언트 `handleInstructorDataLoaded()`는 `instructors.length > 3 ? 2 : 3` 로직이 정상이라, **4명이 들어오면 반드시 2페이지를 만든다.** 따라서 1페이지만 만들어진 건 서버가 실제로 4명이 아니라 2명만 반환했기 때문으로 결론. 클라이언트는 받은 만큼만 페이지를 만들었으므로 문제 없음.
- 1차 원인: 서버 `getInstructorList()`의 학과 매칭 로직.
  - 기존 코드는 `String(depts || '').split(',').map(s => s.trim()).filter(s => s)` 후 `.includes(deptName)`로 비교했다.
  - zero-width 문자(`​`/`‌`/`‍`/`﻿`)나 NBSP(` `)가 한 글자라도 섞이면 `.includes()`가 false가 되어 그 강사 행 전체가 누락된다.
  - 시트에서 행을 복사·붙여넣기 하다 보면 보이지 않는 차이가 끼는 일이 흔하다. 동일한 매칭 패턴이 다른 함수(`getInstructorSubjectsMap`, `getInstructorCurriculum` 등)에서는 normalize 기반으로 이미 견고하게 처리되어 있었는데, 유독 `getInstructorList`만 단순 `.trim()`만 쓰고 있어서 4번째 강사 하나만 매칭에 실패해도 2명만 반환되는 상황이 충분히 발생할 수 있었다.
- `Code.js`의 `getInstructorList()`를 다음과 같이 보강했다.
  - 다른 시트 함수들과 동일한 `normalize()` 헬퍼(보이지 않는 문자 제거 + `trim`)를 함수 안에 추가.
  - 학과 매칭은 `deptKey(s) = normalize(s).replace(/\s+/g, '')`로 만들어 공백 차이까지 흡수해 비교.
  - B열 분리 구분자를 콤마뿐 아니라 `,`/`;`/`/`/`\n`/`\r` 어느 쪽이든 받도록 정규식 `/[,;\/\n\r]+/`로 확장. 시트에서 줄바꿈으로 학과를 나열한 케이스도 자동 처리.
  - 강사명(A열)도 `trim()` 대신 `normalize()`로 일관 처리.
  - 마지막에 `Logger.log('getInstructorList("...") → N명')`을 한 줄 추가해 향후 디버깅이 즉시 가능하도록 했다.
- 2차 보강: 클라이언트 `category_instructor.html`의 `handleInstructorDataLoaded()`에서 placeholder(`data-instructor-page="0"`)가 이미 다른 응답에 의해 제거되었지만 같은 학과의 다른 강사 페이지가 남아 있는 케이스에 대비해, 첫 placeholder를 못 찾으면 같은 학과의 어느 강사 페이지든 첫 위치를 fallback으로 잡도록 검색을 2단계로 만들었다. 이전 응답이 페이지를 부분적으로 교체해 둔 상태에서도 새 응답이 안전하게 다시 페이지를 재생성할 수 있다.
- 확인: `Code.js` `getInstructorList()`의 새 `normalize`/`deptKey`/`/[,;\/\n\r]+/` 분리/로그 출력, `category_instructor.html` `handleInstructorDataLoaded()`의 2단계 firstSlideIdx 탐색 분기를 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했다.
- 추후 검증 방법: Apps Script 편집기에서 `getInstructorList('아트웍학과')` 직접 실행 → Logger에 `→ 4명` 으로 찍히는지 확인. 만약 여전히 `→ 2명`이 나오면 시트의 B열 값 자체에 학과 표기가 누락된 행이 있는 것이라 시트 데이터 보정이 필요하다.

### `Curriculum_full` 강사소개 2번째 페이지 백지 — 진짜 원인 발견 및 4차 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자의 DevTools 스크린샷에서 결정적 증거를 확보했다.
  - 화면을 좁혀 보니 강사소개 두 번째 페이지의 콘텐츠(`ART WORK` 헤더, 학과명 박스 `아트웍학과 강사 소개 2/2`, 강사 카드 김명준/나혜민, 가로선, 오렌지 원)가 모두 정상적으로 렌더링되어 있되, **scale-container의 정상 표시 영역 바로 아래**에 그려지고 있었다.
  - 같은 증상이 인테리어학과 강사소개 2/3 페이지에서도 동일하게 재현됨 → 학과별 데이터 매칭 문제(이전 3차 보정)와는 별개의, **모든 학과 2번째 이후 강사소개 페이지에 공통으로 발생하는 레이아웃 버그**.
- 진짜 원인: `category_instructor.html`의 `.instructor-page` CSS에 `position: relative;`가 들어 있어, 모든 슬라이드 공통 규칙인 `Curriculum_full.html`의 `.slide-page { position: absolute; top: 0; left: 0; }`를 같은 specificity로 후순위 정의가 덮어쓰고 있었다.
  - 다른 카테고리 슬라이드는 `position: absolute`라서 같은 (0,0) 자리에 겹쳐 쌓이고 `.active` 토글로만 보였다 사라졌다 한다.
  - 강사소개 슬라이드는 `position: relative` 때문에 문서 흐름(flow)에 따라 자리를 차지한다. 페이지가 1개일 때는 문제가 안 보이지만, **2개 이상이면 두 번째 페이지가 첫 페이지 바로 아래(scale-container 내부 y=1080)에 그려진다.** active를 토글해 opacity가 1이 되어도 위치 자체가 viewport 바깥이라 사용자에겐 거의 빈 화면처럼 보였다.
- 데이터/렌더링 로직(서버 `getInstructorList`, 클라이언트 `handleInstructorDataLoaded`, `renderInstructorCards`)은 모두 정상이었음. 이전 1~3차 보정에서 매칭 견고화, 페이지 분할, 안전성 강화 등은 의미가 있었지만 이 버그의 직접 원인은 아니었다.
- 수정: `category_instructor.html`의 `.instructor-page` 규칙에서 `position: relative;` 한 줄만 제거. `overflow: hidden;`은 유지. 인접 규칙인 `.instructor-page .main-body { position: relative; ... }`는 그대로 둠 — 그건 내부 absolute 자식(주황 원, 학과명, 가로선, 강사 카드)의 좌표 기준점 역할이라 필요.
  ```css
  /* before */
  .instructor-page { position: relative; overflow: hidden; }
  /* after */
  .instructor-page { overflow: hidden; }
  ```
- 같은 위치 주석에 향후 회귀를 막기 위한 설명을 추가했다.
- 효과: 모든 학과의 강사소개 2번째 페이지 이후가 다른 카테고리와 동일하게 같은 자리(top:0)에 겹쳐 쌓이고, `.active` 토글로 정상 표시된다. 1~3명 학과는 영향 없음(어차피 페이지가 1개라 차이 없음).
- 확인: `category_instructor.html`의 `.instructor-page` 규칙에서 `position: relative` 한 줄이 제거되었고, `.instructor-page .main-body`의 `position: relative`는 그대로인 것을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했지만 CSS 한 줄 삭제라 영향 범위가 매우 좁다.

### `Code.js` 끝부분에 H열 랜덤 이미지 자동 채우기 블록 동기화 (웹에서 추가한 코드 → 로컬 반영)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 웹 Apps Script 편집기에서 `Code.gs`에 새 블록을 직접 추가했다고 알려와, 로컬 `Code.js` 파일에도 동일하게 끝부분에 이어붙였다. 두 파일의 일치 유지를 위함.
- 추가된 블록의 역할:
  - 활성 시트의 **AA열(과목명)** + **D열(주차)** 을 키로 하여, 외부 커리큘럼 시트(`1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM`)의 **모든 학과 탭** 중 동일 키(B열 과목명 + C열 주차)에 해당하는 **F열(이미지 URL)** 후보들을 모은 뒤, **랜덤 1개**를 골라 활성 시트의 **H열**에 일괄 기록한다. 후보가 1개면 그대로, 여러 개면 랜덤 선택.
- 추가된 식별자:
  - 상수: `RANDOM_IMG_SOURCE_ID` = `'1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM'`
  - 제외 시트 화이트리스트: `RANDOM_IMG_EXCLUDE_SHEETS` = `['전체학과별 과목', '강사페이지', '특강 신청', '특강 및 세미나']` — 학과 데이터 탭만 스캔하기 위함.
  - 함수: `onOpen`(스프레드시트 열릴 때 메뉴 `🎲 자동화` 등록 — 기존 `Code.js`에 `onOpen` 없었으므로 신규 정의), `fillHColumnRandomImages`(메뉴 실행용 다이얼로그 포함), `fillHColumnRandomImagesSilent`(트리거/타 함수에서 호출용 무다이얼로그), `fillHColumnCore`(핵심 로직), `buildRandomImageLookupMap`(외부 시트 전체를 한 번에 읽어 `과목명|주차` 키 기반 O(1) 조회 맵 생성), `scheduledRandomImageRefresh`(시간 트리거용 stub — `YOUR_SHEET_NAME_HERE` 자리에 실제 시트명을 적어 사용).
- 기존 함수와의 충돌 점검 결과: `onOpen` / `fillHColumn*` / `RANDOM_IMG_*` 모두 기존 `Code.js`에 없었음. grep으로 확인. 따라서 단순 추가만 함.
- 동작 순서(메모리 캐싱 패턴): 외부 시트 N개 탭을 한 번씩만 `getRange().getValues()`로 읽어 메모리 맵을 만들고, 활성 시트의 행마다 O(1)로 조회 → 일괄 `setValues()`로 H열에 기록 + `SpreadsheetApp.flush()`. 외부 시트 호출 횟수를 최소화한 구조.
- 정규화는 기존 다른 함수와 동일한 `__ZW` (zero-width + NBSP) 제거 + `trim` 방식을 사용해 매칭이 깨지지 않도록 했다.
- 위치: `Code.js`의 마지막 함수(`getVacationSubjectDetail`) 바로 뒤에 이어붙임. 파일 줄 수가 2174 → 약 2360+ 줄로 증가.
- 확인: `Code.js` 끝부분에 `RANDOM_IMG_SOURCE_ID`, `onOpen`, `fillHColumnRandomImages`, `fillHColumnRandomImagesSilent`, `fillHColumnCore`, `buildRandomImageLookupMap`, `scheduledRandomImageRefresh`가 차례로 정의된 것과, 코드 본문이 사용자가 보낸 원문과 동일한 것을 직접 확인했다. 이 환경에는 `node`가 설치되어 있지 않아 JS 문법 검사는 수행하지 못했지만, 단순 함수 추가라 기존 코드 동작에는 영향이 없다.

### GitHub Pages 정적 리소스 분리 1단계

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 현재 파일들을 GitHub에 올려 페이지 로딩속도를 개선할 수 있는지, 하나씩 진행.
- 파일 크기 점검 결과 `fonts.html`이 약 213KB로 가장 크고, 그 대부분이 Paperlogy woff2를 base64 data URL로 inline한 부분이다. 이 파일이 GitHub Pages 분리 1순위라고 판단했다.
- 현재 작업 폴더 자체는 Git 저장소가 아니었다(`.git` 없음). 따라서 전체 Apps Script 프로젝트를 바로 push하는 대신, GitHub Pages에 올릴 정적 리소스 전용 폴더를 별도로 준비했다.
- 신규 폴더/파일:
  - `github-pages/.nojekyll`
  - `github-pages/README.md`
  - `github-pages/assets/fonts/Paperlogy-8ExtraBold.woff2`
  - `github-pages/assets/fonts/paperlogy.css`
- `fonts/Paperlogy-8ExtraBold.woff2`를 `github-pages/assets/fonts/Paperlogy-8ExtraBold.woff2`로 복사했다.
- `paperlogy.css`에는 상대 경로 기반 `@font-face`를 작성했다.
  - `font-family: 'Paperlogy'`
  - `font-weight: 800`
  - `font-display: swap`
  - `src: url('./Paperlogy-8ExtraBold.woff2') format('woff2')`
- `github-pages` 폴더 안에서 `git init`, 브랜치명 `main` 변경, `git add .`까지 완료했다. 아직 commit/push는 하지 않았다.
- Git 전역 `user.name` / `user.email`이 설정되어 있지 않아 커밋 전 사용자에게 GitHub 저장소 URL 및 커밋 작성자 정보가 필요하다.
- 다음 단계: 사용자가 GitHub 저장소 URL을 주면 `github-pages` 저장소에 remote를 연결하고 커밋/푸시한 뒤, GitHub Pages URL이 생기면 Apps Script `fonts.html`의 base64 `@font-face`를 외부 CSS 또는 외부 woff2 URL 방식으로 경량화한다.

### GitHub Pages/CDN 정적 리소스 분리 2단계 - comsw 저장소 푸시 및 `fonts.html` 경량화

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 제공 저장소: `https://github.com/rladiddus/comsw.git`.
- `github-pages` 로컬 저장소 설정:
  - local git user.name: `rladiddus`
  - local git user.email: `rladiddus@users.noreply.github.com`
  - remote origin: `https://github.com/rladiddus/comsw.git`
- 커밋 생성:
  - commit: `5dc42b8 Add static font assets for GitHub Pages`
  - 포함 파일: `.nojekyll`, `README.md`, `assets/fonts/Paperlogy-8ExtraBold.woff2`, `assets/fonts/paperlogy.css`
- 첫 push는 네트워크 제한으로 실패했고, 승인 후 재시도에서 Git `dubious ownership` 보호에 걸렸다. `git config --global --add safe.directory .../github-pages`로 해당 폴더를 safe directory에 등록한 뒤 다시 push했다.
- 최종 push 성공: `main -> origin/main`, upstream `origin/main` 설정 완료.
- GitHub Pages 설정이 아직 별도로 필요할 수 있으나, 즉시 사용 가능한 jsDelivr CDN 경로를 선택했다.
  - CSS: `https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/assets/fonts/paperlogy.css`
  - woff2는 CSS의 상대 경로 `./Paperlogy-8ExtraBold.woff2`로 로드된다.
- CDN 접근 확인: `Invoke-WebRequest -Method Head`로 `paperlogy.css`가 `StatusCode 200`, `Content-Type text/css; charset=utf-8` 응답을 반환하는 것을 확인했다.
- `fonts.html`을 경량화했다.
  - 기존 약 213KB base64 `@font-face` inline 블록을 제거.
  - 상단을 다음 외부 리소스 로드로 교체:
    - `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>`
    - `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/assets/fonts/paperlogy.css">`
  - 기존 `window.applyLoadingFont` 스크립트는 그대로 유지.
  - 파일 크기: `fonts.html` 약 213KB → 약 2KB.
- 다음 단계: 변경된 `fonts.html`을 Apps Script 프로젝트에 반영/배포하면 HTML 전송량이 줄고, Paperlogy 폰트는 CDN/브라우저 캐시를 활용할 수 있다.

### Supabase raw 동기화 기반 1단계 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: Google Sheets 원본과 기존 Apps Script 페이지를 손상시키지 않으면서, 버튼으로 Supabase에 추가/삭제/수정 사항을 반영하고 keep-alive 트리거까지 단계별로 준비.
- 수정 파일: `Code.js`.
- 신규 파일:
  - `supabase_raw_sheet_rows.sql`
  - `supabase_setup.md`
- 기존 `Code.js`에는 이미 `onOpen()`이 있었으므로 새 `onOpen`을 만들지 않고 기존 `🎲 자동화` 메뉴에 Supabase 메뉴를 추가했다.
  - `Supabase 기본 설정 저장` → `setSupabaseConfig`
  - `Supabase 설정 확인` → `checkSupabaseConfig`
  - `Supabase로 현재 시트 동기화` → `syncCurrentSheetToSupabase`
  - `Supabase로 전체 시트 동기화` → `syncAllSheetsToSupabase`
  - `Supabase Keep Alive 실행` → `keepSupabaseAlive`
- `setSupabaseConfig()`는 Script Properties에 기본값을 저장한다.
  - `SUPABASE_URL=https://bpdxbqsvkvvybrtgvrnf.supabase.co`
  - `SUPABASE_RAW_TABLE=raw_sheet_rows`
  - `SUPABASE_KEY=YOUR_SUPABASE_KEY_HERE`
  - 처음엔 `props.setProperties(..., true)`로 작성했으나 다른 스크립트 속성을 지울 수 있어 위험하므로 `true` 인자를 제거했다.
- 동기화 함수는 Google Sheets 원본을 읽기만 한다. `sheet.clear()`, `deleteRow()`, `setValue()` 같은 시트 수정 코드는 넣지 않았다.
- 동기화 흐름:
  1. 대상 시트의 기존 Supabase 복사본을 `sheet_name` 기준으로 delete
  2. 현재 Google Sheet 데이터를 읽음
  3. 병합 셀 값을 메모리 배열 안에서 forward-fill
  4. 헤더/행 값을 `{ headers, values, row }` 형태의 JSON으로 구성
  5. `raw_sheet_rows`에 500행 단위로 batch insert
- `raw_sheet_rows` 기준 저장 컬럼:
  - `sheet_name`
  - `row_number`
  - `data` jsonb
  - `synced_at`
- 날짜 값은 ISO 문자열로 변환하고, 문자열은 zero-width/NBSP 제거 후 trim한다.
- `keepSupabaseAlive()`는 `raw_sheet_rows?select=id&limit=1`로 가벼운 GET 요청을 보내도록 했다.
- `installDailySupabaseKeepAliveTrigger()`는 하루 1회 오전 9시 `keepSupabaseAlive`를 실행하는 시간 트리거를 생성한다.
- `supabase_raw_sheet_rows.sql`에는 `raw_sheet_rows` 테이블, 인덱스, unique index, RLS enable, 공개 read policy를 작성했다. insert/delete는 Apps Script 서버 쪽 키로 수행하는 전제라 공개 쓰기 policy는 만들지 않았다.
- `supabase_setup.md`에는 Supabase SQL 실행, Apps Script Script Properties 설정, 수동 동기화 메뉴, keep-alive 트리거 설치 순서를 적었다. 콘솔 인코딩 문제를 피하려고 메뉴명 설명은 ASCII 위주로 정리했다.
- 주의: Apps Script에서 sync/delete/insert를 수행하려면 Script Properties의 `SUPABASE_KEY`에 서버 측에서만 쓰는 키가 필요하다. 이 키는 GitHub Pages 프론트엔드에 절대 넣으면 안 된다. 프론트엔드는 anon/public key와 read-only RLS 정책만 사용해야 한다.
- 확인: `Code.js`의 Supabase 메뉴/설정/동기화/keep-alive 함수, `supabase_raw_sheet_rows.sql`, `supabase_setup.md`를 직접 확인했다. 이 환경에는 `node`가 없어 JS 문법 검사는 수행하지 못했다.

### Supabase 동기화 권한 오류 확인

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 Apps Script 동기화 실행 중 다음 오류를 전달했다.
  - `Supabase insert 실패: HTTP 401 / {"code":"42501","message":"new row violates row-level security policy for table \"raw_sheet_rows\""}`
- 현재 `supabase_raw_sheet_rows.sql`에는 공개 `select` 정책만 있고, `insert/delete` 정책은 만들지 않았다.
- 이 오류는 Apps Script 요청이 `service_role` 권한으로 처리되지 않고, RLS가 적용되는 anon/publishable 계열 권한으로 처리되고 있다는 뜻이다.
- 해결 방향:
  - Apps Script Script Properties의 `SUPABASE_KEY`에는 새 UI의 `sb_secret_...` 키나 publishable/anon key가 아니라, `Legacy anon, service_role API keys` 탭의 `service_role` JWT 키를 넣어야 한다.
  - `service_role` 키는 GitHub/HTML/브라우저 JS에 절대 넣지 않고 Apps Script Script Properties에만 보관한다.
  - 현재 테이블 정책은 그대로 두고, 서버 측 동기화만 `service_role`로 insert/delete를 수행하는 구조가 맞다.

### Supabase 현재 시트 동기화 성공 확인

- 사용자가 Apps Script 메뉴에서 Supabase 동기화를 다시 실행했고 성공 메시지를 확인했다.
- 결과:
  - 시트: 1개
  - 전송 행: 19개
  - 삭제 처리 시트: 1개
  - 삽입 배치: 1개
  - 처리 시간: 1899ms
- 이 결과로 `SUPABASE_KEY` 권한과 `raw_sheet_rows` RLS 설정이 현재 동기화 흐름에서는 정상 작동하는 것을 확인했다.

### `item_supabase_test.html` 테스트 페이지 생성

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 기존 Apps Script 운영 페이지를 건드리지 않고, Supabase 읽기 방식 테스트를 단계별로 진행해달라고 요청했다.
- 기존 `item.html`은 그대로 두고 새 파일 `item_supabase_test.html`을 생성했다.
- `item_supabase_test.html` 변경 내용:
  - Apps Script 전용 템플릿 문법 `<?!= include('fonts'); ?>` 제거.
  - GitHub/jsDelivr의 Paperlogy CSS를 직접 로드하도록 변경.
  - `google.script.run.getLoadingContent()`, `getWebAppUrl()`, `getAllCoursePrepItems()` 호출 제거.
  - Supabase REST API로 `raw_sheet_rows`에서 `수업별 준비물(AI/교재 등)` 또는 오타 대응용 `수업별 준비몰(AI/교재 등)` 시트를 읽는 테스트 로직 추가.
  - `data.values`의 A~F열을 기존 `item.html` 렌더링 형식 `{ subject, category, content, link, image, pill }`로 변환하도록 추가.
  - A/B열 병합 데이터는 Supabase 동기화 시 이미 채워지지만, 테스트 페이지에서도 안전하게 forward-fill을 유지했다.
  - Drive 이미지 링크를 썸네일 URL로 변환하는 `convertDriveUrl()`을 브라우저 쪽에 추가했다.
  - 브라우저용 파일이므로 `SUPABASE_ANON_KEY`에는 service_role이 아니라 Publishable key 또는 Legacy anon key를 넣도록 주석과 placeholder를 남겼다.
- 확인:
  - `item_supabase_test.html`에서 `google.script`와 Apps Script 템플릿 문법 검색 결과가 남아 있지 않은 것을 확인했다.
  - 이 환경에는 `node`가 없어 JS 문법 실행 검사는 수행하지 못했다.
- 다음 단계:
  - 사용자가 Supabase Dashboard의 Publishable key 또는 Legacy anon key를 `item_supabase_test.html`의 `SUPABASE_ANON_KEY`에 입력한다.
  - 브라우저에서 `item_supabase_test.html`을 열어 교재/준비물/AI툴 탭 데이터 표시를 확인한다.

### `item_supabase_test.html` GitHub 배포 테스트

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 로컬 테스트 성공 후 GitHub에 올려 외부 URL로 확인하는 1번 단계를 요청했다.
- `item_supabase_test.html`에 입력된 Supabase 키를 값 공개 없이 검사했고 JWT payload role이 `anon`임을 확인했다. 브라우저 공개용 테스트 키로 적합하다.
- `github-pages/item_supabase_test.html`로 파일을 복사했다.
- `github-pages` 저장소에서 커밋 생성:
  - commit: `e67d341 Add Supabase item test page`
- 첫 `git push`는 네트워크 제한으로 실패했고, 승인 후 재시도하여 `main -> origin/main` 푸시에 성공했다.
- 배포 확인:
  - GitHub Pages 예상 주소 `https://rladiddus.github.io/comsw/item_supabase_test.html`는 현재 404를 반환했다. GitHub Pages 설정이 꺼져 있거나 아직 반영 전일 수 있다.
  - jsDelivr CDN 주소 `https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/item_supabase_test.html`는 HTTP 200을 반환했다.
- 다음 단계:
  - 사용자는 우선 jsDelivr 주소로 외부 테스트 가능.
  - GitHub Pages 주소를 쓰려면 GitHub 저장소 Settings > Pages에서 Source를 `Deploy from a branch`, Branch를 `main`, Folder를 `/root`로 설정해야 한다.

### `roadmap_supabase_test.html` 생성 및 GitHub 배포

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 `item_supabase_test.html` 성공 후 다음 단계로 `roadmap.html`의 Supabase 테스트 전환을 요청했다.
- 기존 `roadmap.html`은 그대로 두고 새 파일 `roadmap_supabase_test.html`을 생성했다.
- `roadmap_supabase_test.html` 변경 내용:
  - Apps Script 전용 템플릿 문법 `<?!= include('fonts'); ?>` 제거.
  - GitHub/jsDelivr Paperlogy CSS 직접 로드로 교체.
  - `google.script.run.getRoadmapList()`, `getCurriculumSimpleByDept()`, `getRoadmapLogoUrl()`, `getLoadingContent()`, `getWebAppUrl()` 의존 제거.
  - Supabase `raw_sheet_rows`에서 다음 시트를 직접 읽도록 추가:
    - `로드맵`
    - `컴수원_전체수업`
    - `메인 페이지`
  - 로드맵 목록은 `로드맵` 시트의 A열 학과 그룹과 B열 이후 과목 데이터를 사용해 생성.
  - 학과 영문명은 `컴수원_전체수업`의 O열 학과명, U열 영문명으로 매핑.
  - 로고는 `메인 페이지` 시트 2행 J열을 사용하고 Drive 링크를 썸네일 URL로 변환.
  - 학과 클릭 팝업은 `로드맵`에서 선택 과목을 찾고, `컴수원_전체수업`의 C열 과목명 기준으로 G/J/K/L열의 기간/과정내용/프로그램/학습수준을 읽도록 구현.
  - 병합 셀은 Supabase 동기화 시 이미 채워져 있으므로, 브라우저 쪽에서는 연속된 A열 학과명 그룹을 기준으로 단순 처리.
- 확인:
  - `roadmap_supabase_test.html`에서 `google.script`와 Apps Script 템플릿 문법이 남아 있지 않은 것을 확인했다.
  - Supabase 키 JWT role이 `anon`임을 확인했다.
  - 이 환경에는 `node`가 없어 JS 문법 실행 검사는 수행하지 못했다.
- `github-pages/roadmap_supabase_test.html`로 복사 후 커밋 생성:
  - commit: `746685e Add Supabase roadmap test page`
- 첫 `git push`는 네트워크 제한으로 실패했고, 승인 후 재시도하여 `main -> origin/main` 푸시에 성공했다.
- 배포 확인:
  - `https://rladiddus.github.io/comsw/roadmap_supabase_test.html` HTTP 200 확인.
  - `https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/roadmap_supabase_test.html` HTTP 200 확인.

### `Curriculum_full_supabase_test.html` 생성 및 GitHub 배포

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 Supabase 전환 테스트를 계속 진행해달라고 요청했다.
- 기존 `Curriculum_full.html`은 그대로 두고 새 파일 `Curriculum_full_supabase_test.html`을 생성했다.
- `Curriculum_full.html`은 Apps Script `include()`로 `category_curriculum`, `category_instructor`, `category_recruitment`, `category_employment`, `category_generic`를 합치는 구조라서, 정적 GitHub 테스트용 파일에는 해당 조각 HTML 내용을 실제로 펼쳐 넣었다.
- 변경 내용:
  - Apps Script 전용 `<?!= include(...) ?>` 문법 제거.
  - GitHub/jsDelivr Paperlogy CSS 직접 로드로 교체.
  - `google.script.run.getDepartmentList()`, `getCoursePreparations()`, `getCurriculumByDept()`, `getCategoryList()`, `getInstructorList()`, `getInstructorCurriculum()`, `getAllInstructorCurriculum()`, `getRecruitmentList()`, `getWebAppUrl()`, `getLoadingContent()` 의존 제거.
  - Supabase `raw_sheet_rows`에서 `컴수원_전체수업`, `수업별 준비물(AI/교재 등)`/오타 대응 `수업별 준비몰(AI/교재 등)`, `강사페이지`, 그리고 존재할 경우 학과명 시트를 직접 읽는 헬퍼를 추가했다.
  - 학과 목록: `컴수원_전체수업` O/P/Q/R열 기준.
  - 커리큘럼: `컴수원_전체수업` B/C/D/F/H열과 O/U열 기준.
  - 카테고리: `컴수원_전체수업` W/X열 기준.
  - 준비물/교재/AI툴 팝업: `수업별 준비물(AI/교재 등)` A~F열 기준.
  - 강사 목록: `강사페이지` A~F열 기준. 정적 테스트에서는 강사별 과목을 C열에서 split해 사용한다.
  - 강사별 상세 커리큘럼과 채용정보는 Supabase에 해당 학과명 시트가 존재하면 읽도록 만들었다. 현재 업로드 범위에 외부 강사 커리큘럼/채용 스프레드시트가 없다면 해당 영역은 비어 보일 수 있다.
- 확인:
  - `Curriculum_full_supabase_test.html`에서 `google.script`와 Apps Script include 문법이 남아 있지 않은 것을 확인했다.
  - Supabase 키 JWT role이 `anon`임을 확인했다.
  - 이 환경에는 `node`가 없어 JS 문법 실행 검사는 수행하지 못했다.
- `github-pages/Curriculum_full_supabase_test.html`로 복사 후 커밋 생성:
  - commit: `3b6ba38 Add Supabase curriculum full test page`
- 첫 `git push`는 네트워크 제한으로 실패했고, 승인 후 재시도하여 `main -> origin/main` 푸시에 성공했다.
- 배포 확인:
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html` HTTP 200 확인.
  - `https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/Curriculum_full_supabase_test.html` HTTP 200 확인.

### Supabase 공통 설정/클라이언트 분리

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 Supabase 테스트 페이지들이 정상 동작한다고 확인했고, 다음 단계로 공통 설정/함수 분리를 요청했다.
- 신규 로컬 파일:
  - `assets/js/supabase-config.js`
  - `assets/js/supabase-client.js`
- 신규 GitHub Pages 파일:
  - `github-pages/assets/js/supabase-config.js`
  - `github-pages/assets/js/supabase-client.js`
- `supabase-config.js`에는 브라우저 공개용 Supabase 설정만 둔다.
  - `url`
  - `anonKey`
  - `rawTable`
  - 주요 시트 이름
  - 이후 업로드해야 할 외부 스프레드시트 ID 메모
- `supabase-client.js`에는 공통 유틸을 분리했다.
  - `normalizeText`
  - `truthyCell`
  - `convertDriveUrl`
  - `getRawValues`
  - `fetchSheetRows`
  - `splitMultiValue`
  - `coursePrepCategoryKey`
- 세 테스트 페이지에 공통 스크립트 로드를 추가했다.
  - `item_supabase_test.html`
  - `roadmap_supabase_test.html`
  - `Curriculum_full_supabase_test.html`
- 세 테스트 페이지의 Supabase URL/key/table 설정은 `window.COMSW_SUPABASE_CONFIG`를 참조하도록 변경했다.
- 세 테스트 페이지의 `fetchSupabaseRowsForSheet()`는 `window.ComswSupabase.fetchSheetRows()`를 우선 사용하도록 변경했다. 기존 로컬 fallback 코드는 유지해 위험을 줄였다.
- `github-pages` 커밋 생성:
  - commit: `f68231f Extract shared Supabase client`
- 첫 `git push`는 네트워크 제한으로 실패했고, 승인 후 재시도하여 `main -> origin/main` 푸시에 성공했다.
- 배포 확인:
  - `https://rladiddus.github.io/comsw/assets/js/supabase-client.js` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/item_supabase_test.html` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/roadmap_supabase_test.html` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html` HTTP 200 확인.

### 다음 Supabase 업로드/연동 TODO

- 사용자가 다음 두 외부 Google Sheets도 Supabase로 올리고 기존 페이지들과 연동해야 한다고 요청했다.
- 채용정보 스프레드시트:
  - `https://docs.google.com/spreadsheets/d/1nADj2xWBQDOXS0vxd-1RWIG4LaselTP2EXImrIns6D0/edit?gid=0#gid=0`
  - 기존 `Curriculum_full`의 채용정보/팝업 연동에 필요.
- 강사별 커리큘럼 스프레드시트:
  - `https://docs.google.com/spreadsheets/d/1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM/edit?gid=291299533#gid=291299533`
  - 기존 강사 소개 상세/강사별 과목 커리큘럼 연동에 필요.
- 다음 작업 방향:
  - Apps Script 동기화 함수가 현재 활성 스프레드시트의 모든 시트를 `raw_sheet_rows`에 올리는 구조이므로, 외부 두 스프레드시트에서도 같은 Supabase 동기화 코드를 적용하거나, 기존 Code.js에 외부 spreadsheetId를 받아 동기화하는 함수를 추가한다.
  - 업로드 후 `Curriculum_full_supabase_test.html`의 강사 상세/채용정보에서 해당 학과명 시트를 읽는 흐름을 실제 데이터 기준으로 보정한다.
### GitHub Pages index 적용 및 Supabase 다중 원본 구조 준비

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 기존에 만든 `index.html`을 버리는 것이 아니라, GitHub Pages의 첫 화면으로 먼저 전환하고 그 다음 외부 Google Sheets를 Supabase로 옮기자고 요청했다.
- 기존 Apps Script용 `index.html`은 그대로 두고, `index_supabase_test.html`을 만들어 GitHub Pages용으로 변환했다.
  - Apps Script `include('fonts')` 제거.
  - GitHub/jsDelivr Paperlogy CSS와 `assets/js/supabase-config.js`, `assets/js/supabase-client.js` 로드 추가.
  - `google.script.run` 기반 메인 이미지/메뉴/로딩 데이터 호출을 Supabase `raw_sheet_rows` 조회로 교체.
  - 메뉴 이동은 GitHub Pages 내 정적 테스트 파일로 연결:
    - `roadmap_supabase_test.html`
    - `Curriculum_full_supabase_test.html`
    - `item_supabase_test.html`
  - `특강/세미나`, `방학 특강`은 아직 Supabase/GitHub용 별도 전환이 남아 있다.
- `github-pages/index.html`로 반영 후 커밋/푸시했다.
  - commit: `73b882f Add GitHub Pages index`
  - `https://rladiddus.github.io/comsw/` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/index.html` HTTP 200 확인.
- 외부 두 스프레드시트를 Supabase에 올릴 때 학과명 시트가 서로 덮어써지는 문제를 막기 위해 `source_id` 구조를 준비했다.
  - `main`: 기존 메인 스프레드시트 `1424gRmyDWq-p69ft7ZjF9ORZtmW6g2KUMvsz4AWzLHY`
  - `recruitment`: 채용정보 스프레드시트 `1nADj2xWBQDOXS0vxd-1RWIG4LaselTP2EXImrIns6D0`
  - `instructor_curriculum`: 강사별 커리큘럼 스프레드시트 `1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM`
- 신규 SQL migration 파일:
  - `supabase_raw_sheet_rows_source_migration.sql`
  - `raw_sheet_rows`에 `source_id`, `spreadsheet_id` 컬럼 추가.
  - 기존 데이터는 `source_id='main'`으로 유지.
  - 유니크 기준을 `(source_id, sheet_name, row_number)`로 변경.
- `supabase_raw_sheet_rows.sql`도 새 설치 기준에 맞춰 `source_id`, `spreadsheet_id` 포함 구조로 갱신했다.
- `Code.js` Supabase 동기화 로직 변경:
  - 현재/전체 시트 동기화는 `source_id='main'`으로 저장.
  - 메뉴 추가:
    - `Supabase로 채용정보 시트 동기화` → `syncRecruitmentSheetsToSupabase`
    - `Supabase로 강사별 커리큘럼 시트 동기화` → `syncInstructorCurriculumSheetsToSupabase`
  - 외부 스프레드시트는 `SpreadsheetApp.openById()`로 열고 읽기만 한 뒤 Supabase에 저장한다.
  - 삭제/재삽입 기준을 `source_id + sheet_name`으로 변경해 원본별 데이터 충돌을 막았다.
- 공통 브라우저 클라이언트 변경:
  - `assets/js/supabase-config.js`에 `sources` 추가.
  - `assets/js/supabase-client.js`의 `fetchSheetRows(sheetName, sourceId)`가 `source_id` 필터를 사용하도록 변경.
- 테스트 페이지 변경:
  - `item_supabase_test.html`, `roadmap_supabase_test.html`은 기본 `main` 원본 사용.
  - `Curriculum_full_supabase_test.html`은 강사별 커리큘럼을 `instructor_curriculum`, 채용정보를 `recruitment` 원본에서 읽도록 변경.
- GitHub Pages 반영:
  - commit: `09119c6 Support multiple Supabase sheet sources`
  - `git push` 성공.
  - `https://rladiddus.github.io/comsw/` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/assets/js/supabase-client.js` HTTP 200 확인.
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html` HTTP 200 확인.

### 외부 Google Sheets Supabase 동기화 완료 확인

- 사용자가 Supabase SQL Editor에서 `supabase_raw_sheet_rows_source_migration.sql` 실행을 완료했다.
- 사용자가 Apps Script 메뉴에서 두 외부 시트 동기화를 완료했다고 알려왔다.
  - `source_id="recruitment"`: 채용정보 스프레드시트 `(컴수원)채용공고 정리`
  - `source_id="instructor_curriculum"`: 강사별 커리큘럼 스프레드시트
- 다음 확인 대상:
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html`
  - 학과별 `채용정보` 페이지가 `source_id="recruitment"` 데이터를 읽는지 확인.
  - `학과 강사소개`에서 강사 과목/커리큘럼 팝업이 `source_id="instructor_curriculum"` 데이터를 읽는지 확인.

### 강사별 커리큘럼 일부 누락 보정

- 사용자가 `Curriculum_full_supabase_test.html` 테스트 결과를 알려왔다.
  - 정상: 학과별 채용 공고, 행 클릭 팝업, 강사목록, 강사 클릭 후 과목 버튼.
  - 문제: 일부 강사의 일부 수업 과목 커리큘럼 이미지와 내용 누락.
- 원인으로 본 지점:
  - Apps Script 원본은 강사별 커리큘럼 외부 시트에서 A열 강사명/B열 과목명의 병합 또는 빈칸 상속 구조를 고려한다.
  - GitHub Pages 테스트 파일은 Supabase row의 A열 강사명/B열 과목명이 각 행에 정확히 있을 때만 매칭해서, 일부 주차가 누락될 수 있었다.
  - 강사 과목 버튼도 `강사페이지` C열만 사용하고 있어 외부 커리큘럼 시트의 실제 과목명과 차이가 있으면 일부 버튼/조회가 어긋날 수 있었다.
- 수정:
  - `Curriculum_full_supabase_test.html`에 `buildInstructorCurriculumRecords()` 추가.
  - Supabase에서 읽은 외부 커리큘럼 행을 A열 강사명, B열 과목명 forward-fill 방식으로 해석하도록 보정.
  - `getInstructorCurriculumFromSupabase()`와 `getAllInstructorCurriculumFromSupabase()`가 이 보정된 record를 기준으로 필터링하도록 변경.
  - 강사 목록의 과목 버튼은 기존 `강사페이지` C열 과목에 외부 커리큘럼 시트에서 실제 발견된 과목을 병합하도록 변경.
  - 비교 키는 공백과 `~ / ～` 차이를 흡수하는 `curriculumMatchKey()`를 사용.
- GitHub Pages 반영:
  - commit: `cd94b6f Make instructor curriculum Supabase parsing robust`
  - `git push` 성공.
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html` HTTP 200 확인.

### 조해리 AI프롬프트 과목 미표시 원인 확인 및 버튼 범위 보정

- 사용자가 조해리 강사의 `AI프롬프트 엔지니어링 1`, `AI프롬프트 엔지니어링 2` 과목 커리큘럼이 나오지 않는 이유 확인을 요청했다.
- Supabase raw row를 직접 조회했다.
  - `source_id="main"`, `sheet_name="강사페이지"`의 조해리 행에는 `AI프롬프트 엔지니어링 1`, `AI프롬프트 엔지니어링 2`가 과목명에 들어 있었다.
  - `source_id="instructor_curriculum"`, `sheet_name="AI학과"`에는 조해리의 두 과목 커리큘럼 1~4주차 데이터와 이미지 URL이 정상으로 들어 있었다.
- 원인:
  - 조해리 강사는 `웹학과, AI학과, 시각편집학과, 자격증학과`에 노출된다.
  - 기존 Supabase 테스트 페이지는 강사페이지 C열의 전체 과목 버튼을 모든 학과 화면에 보여주고 있었다.
  - 따라서 웹학과/시각편집학과/자격증학과 화면에서 `AI프롬프트 엔지니어링 1/2` 버튼을 누르면, 현재 학과 탭에서 해당 과목을 찾다가 빈 결과가 나왔다.
  - Apps Script 원본은 현재 학과의 외부 커리큘럼 탭에서 강사별 과목을 가져오는 구조라, 학과별로 실제 존재하는 과목 버튼만 노출하는 것이 맞다.
- 수정:
  - `getInstructorListFromSupabase()`에서 현재 학과의 외부 커리큘럼 탭에서 찾은 과목이 있으면 그 과목 목록을 우선 사용.
  - 외부 커리큘럼 과목이 없을 때만 강사페이지 C열 과목을 fallback으로 사용.
  - 결과적으로 `AI프롬프트 엔지니어링 1/2`는 `AI학과`에서 조해리 강사를 열 때 표시/조회되고, 다른 학과 화면에서는 빈 버튼으로 노출되지 않게 된다.
- GitHub Pages 반영:
  - commit: `9aef509 Limit instructor subject buttons to active department`
  - `git push` 성공.
  - `https://rladiddus.github.io/comsw/Curriculum_full_supabase_test.html` HTTP 200 확인.

### GitHub Pages `index.html` 배경 영상 검은 화면 수정 (Drive URL 라우팅)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: `https://rladiddus.github.io/comsw/index.html` 배경 영상이 재생되지 않고 검은 화면이 나옴.
- 원인 추적:
  1. `github-pages/assets/js/supabase-client.js`의 `convertDriveUrl()`은 Drive 링크를 **모두** `https://drive.google.com/thumbnail?id=...&sz=w1000`으로 변환한다. 영상에 적용하면 정지 프레임 한 장(또는 비디오는 빈 응답) → 검은 화면.
  2. `github-pages/index.html`의 `detectMediaTypeForIndex()`는 `.mp4`/`.webm`/`.mov`처럼 확장자가 명시된 URL만 `'video'`로 판정했다. Drive thumbnail URL은 확장자가 없으니 `'image'`로 떨어지고, 결국 비디오가 `<img>`로 렌더링되어 검은 화면 표시.
  3. 원본 Apps Script (`Code.js:detectMediaType`)는 `DriveApp.getFileById().getMimeType()`로 MIME 검사를 해 `gdrive-video` / `gdrive-image` / `gdrive`를 정확히 구분했지만, 브라우저에서는 DriveApp을 못 쓰므로 같은 방식이 불가능했다.
- 수정 위치: `github-pages/index.html`만 손댐. 공통 `supabase-client.js`의 `convertDriveUrl()`은 다른 페이지(item/roadmap/curriculum_full 등) 이미지 표시에 그대로 필요하므로 그대로 두었다.
- `detectMediaTypeForIndex()`를 확장:
  - `vimeo.com` URL → `'vimeo'` 추가.
  - 영상 확장자 검출에 `ogg` 추가.
  - 이미지 확장자 검출(`jpg/jpeg/png/gif/webp/bmp/svg/avif`) 추가.
  - **`drive.google.com`** 포함 URL은 `'gdrive-video'`로 분류(메인 페이지 배경은 영상이 일반적이므로 영상으로 가정). 추후 이미지 배경이 필요하면 시트에 hint 컬럼을 추가해 분기하는 식으로 확장 가능.
- `getCheckedMediaFromSupabase()`에서 URL이 `drive.google.com`을 포함하면 `convertDriveUrl()`을 **건너뛰고 raw URL을 그대로** `renderMedia`로 넘긴다. `renderMedia`의 `gdrive-video` case는 raw URL에서 `extractDriveId()`로 ID를 다시 뽑아 `https://drive.google.com/uc?export=download&id=ID`를 `<video>` `src`로 사용한다 (Apps Script 원본과 동일한 패턴).
- 라우팅만 고치면 끝나는 구조라 `renderMedia()` 본체는 손대지 않았다. 'gdrive-video' / 'gdrive-image' / 'gdrive' / 'vimeo' / 'youtube' case들은 이미 정상적으로 정의되어 있었다.
- GitHub Pages 반영:
  - commit: `b25bc07 Fix black-screen background on index: route Drive URLs to gdrive-video`
  - `git push origin main` 성공.
  - 배포 직후 `curl -s https://rladiddus.github.io/comsw/index.html`로 `vimeo.com`, `gdrive-video`, `isDrive` 패턴이 응답에 포함된 것을 확인 → 새 코드가 라이브.
- 알려진 한계 / 후속 작업 후보:
  - Drive `uc?export=download&id=...` endpoint는 큰 파일(약 25MB+)에 대해 virus warning 페이지로 리다이렉트되어 `<video>` 태그에서 재생 실패할 수 있다. 그 경우 video `onerror` 시 iframe `/preview`로 fallback하는 로직 추가가 필요할 수 있다.
  - 만약 사용자가 Drive에 영상이 아닌 이미지를 메인 배경으로 쓰고 싶다면 현재 로직(`'gdrive-video'`로 분류)으로는 `<video>` 태그가 빈 화면이 된다. 이 케이스가 생기면 시트에 hint 컬럼(예: D열 'video'/'image')을 추가하는 식으로 분기할 수 있다.

### GitHub Pages `index.html` — CORS 콘솔 노이즈 + 큰 Drive 영상 검은 화면 후속 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고 (직전 패치 배포 이후 두 가지 새 증상):
  1. 콘솔에 `Access to fetch at 'https://drive.google.com/thumbnail?id=...&sz=w1000' from origin 'https://rladiddus.github.io' has been blocked by CORS policy` 에러가 다수 반복. 출처는 `cacheImageAsBase64` (로딩 오버레이 이미지 base64 캐시 시도).
  2. 메인 배경 영상이 여전히 검은 화면. 중앙 글씨와 하단 메뉴는 정상 동작.
- 원인 (두 갈래로 분리해서 파악):
  - **(A) 콘솔 CORS 에러**는 시각적 동작과 무관. Drive thumbnail endpoint가 GitHub Pages origin에 대해 `Access-Control-Allow-Origin` 헤더를 안 보내서 `fetch()` 호출만 차단된다. `<img src="...">` 직접 렌더링은 CORS 영향이 없어서 이미지 자체는 정상 표시된다. `cacheImageAsBase64`는 단순 fast-path 캐시 시도일 뿐이라, GitHub Pages 환경에서는 실패가 보장된다.
  - **(B) 검은 배경 영상**의 진짜 원인은 Drive의 `https://drive.google.com/uc?export=download&id=...` 엔드포인트가 일정 크기(약 25MB+) 이상 파일에 대해 virus warning HTML 페이지로 redirect 한다는 점. `<video>` 태그는 HTML을 영상으로 디코드 못해서 검은 박스가 된다. Apps Script 환경에서 같은 패턴이 동작했던 건 사용자 영상이 작은 케이스로 직접 스트리밍 됐기 때문이고, GitHub Pages에서도 같은 한계가 그대로 적용된다.
- (A) 수정: `github-pages/index.html`의 `cacheImageAsBase64`를 **silent no-op**로 변경. fetch 시도 자체를 안 함. 호출부(`displayLoadingContent`, `window.onload`의 background prefetch loop)는 그대로 두되 실제 작업은 안 일어남. 코멘트로 Apps Script 환경으로 돌아가거나 외부 CDN으로 이미지를 옮기면 fetch 기반으로 되돌리라는 가이드 추가.
- (B) 수정: `gdrive-video` case에 **iframe fallback** 추가.
  - `renderMedia`의 `gdrive-video` case가 `<video>` 태그를 만들 때 `data-driveid` 속성을 함께 박는다.
  - `container.innerHTML` 설정 직후, `container.querySelectorAll('video[data-driveid]')`를 돌면서 각 video에 대해:
    - `canplay` 이벤트가 오면 `resolved = true`로 표시하고 fallback 타이머를 clear한다.
    - `error` 이벤트가 오거나, **4초 안에 canplay가 안 오면** `doFallback()` 호출.
    - `doFallback()`은 video의 부모(=`#media-container`) `innerHTML`을 통째로 `<iframe src="https://drive.google.com/file/d/{driveId}/preview" allow="autoplay" allowfullscreen>`로 교체. Drive embed 표준이라 큰 파일도 잘 재생된다. 기존 `.iframe-wrapper` 스타일과 사이즈 계산(`getCoverSize()`)을 재사용해 viewport에 맞게 표시.
    - 첫 미디어인 경우 `firstMediaPlayable`도 같이 set해 로딩 오버레이가 막히지 않게 한다.
  - 모든 인덱스(슬라이드쇼 포함)에 대해 작동하도록 기존 `if (index === 0)` 블록 바깥에 fallback 셋업을 둠.
- GitHub Pages 반영:
  - commit: `f780b4a Silence CORS noise and fall back to Drive iframe preview for large videos`
  - `git push origin main` 성공.
  - `curl -s https://rladiddus.github.io/comsw/index.html`로 `no-op`, `doFallback`, `data-driveid` 패턴이 응답에 포함된 것을 확인 → 새 코드가 라이브.
- 알려진 한계 / 후속:
  - iframe preview는 Drive embed라 영상 컨트롤이 잠깐 보일 수 있다(자동 hide). 더 깔끔한 배경을 원하면 영상을 작은 파일(<25MB)로 압축하거나 GitHub Pages에 직접 올려 `<video>`로 재생하는 방향이 좋다.
  - 4초 타임아웃은 실용적인 값이지만 느린 네트워크에서는 정상 영상도 fallback될 수 있다. 사용자 환경에서 너무 자주 fallback 한다면 타임아웃을 6~8초로 늘릴 수 있다.

### GitHub Pages `index.html` — Pexels/Pixabay/Coverr URL 영상 인식 누락 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자가 콘솔에서 `console.log` 진단을 돌려 `#media-container` 내용을 보고했다:
  ```html
  <img src="https://www.pexels.com/ko-kr/download/video/37275421/" alt="media">
  ```
- 즉 검은 화면의 진짜 원인은 Drive 영상이 아니라 **Pexels의 동영상 다운로드 URL을 `<img>`로 렌더링**한 것이었다. 이전 두 차례 Drive 라우팅/iframe fallback 패치는 Drive URL용이라 이 케이스를 못 잡았다.
- 원인: `github-pages/index.html`의 `detectMediaTypeForIndex()`가 Pexels/Pixabay/Coverr 같은 **확장자 없는 video 호스팅** URL을 인식 못해서 `'image'`로 fallback. 결과적으로 video URL이 `<img src="...">` 태그로 들어가고, `<img>`는 video 스트림을 디코드 못해서 검은 박스.
- 비교: Apps Script 원본 `Code.js`의 `detectMediaType()` ([Code.js:287-323](Code.js#L287-L323))은 동일 위치에 다음 분기를 이미 가지고 있었다.
  ```js
  if (lower.includes('pexels.com') && lower.includes('/download/video/')) return 'video';
  if (lower.includes('pixabay.com') && lower.includes('/videos/')) return 'video';
  if (lower.includes('coverr.co')) return 'video';
  ```
  GitHub Pages용 `index.html`을 만들 때 이 세 줄이 누락되어 있었음. 단순 동기화 누락 케이스.
- 수정: `detectMediaTypeForIndex()`의 영상 확장자 체크 직후, 이미지 확장자 체크 직전 위치에 위 세 줄을 그대로 추가. `renderMedia`의 `'video'` case는 이미 `<video src="..." autoplay muted playsinline loop>`로 렌더링하므로 라우팅만 고치면 끝났다.
- 코드 경로 정리 (영상 호스팅별):
  - YouTube/Vimeo → `'youtube'`/`'vimeo'` → iframe embed
  - `.mp4`/`.webm`/`.mov`/`.ogg` 확장자 명시 → `'video'` → `<video src>`
  - **Pexels download/video, Pixabay videos, Coverr** → `'video'` → `<video src>` ← 이번 추가
  - Drive URL → `'gdrive-video'` → `<video src=".../uc?...">` + 4초 fallback iframe `/preview`
  - 이미지 확장자 → `'image'` → `<img>`
  - 그 외 → `'image'` (마지막 fallback)
- GitHub Pages 반영:
  - commit: `e17b8e0 Detect pexels/pixabay/coverr video URLs in detectMediaTypeForIndex`
  - `git push origin main` 성공.
  - `until curl ... grep pexels.com` 폴링으로 GitHub Pages 배포 반영 확인 → 새 코드가 라이브.
- 이 패치로 사용자의 메인 페이지 배경 영상(Pexels)이 정상 자동재생된다. 직전에 추가한 Drive iframe fallback 로직은 Pexels에는 영향 없고, 이후 사용자가 Drive 영상으로 교체해도 그대로 동작한다.

### GitHub Pages `index.html` 메뉴 매핑 오류 + 누락 페이지 placeholder 3종

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: `https://rladiddus.github.io/comsw/seminar.html`이 404. 그리고 메인에서 "학과 커리큘럼" 메뉴를 누르면 "학과별 자료"와 같은 페이지로 이동.
- 추적 결과: `github-pages/index.html`의 `pageMap`에서
  ```js
  '학과별 자료':   'Curriculum_full_supabase_test.html',
  '학과 커리큘럼': 'Curriculum_full_supabase_test.html',  // ← 잘못된 복붙
  '특강/세미나':   'seminar.html',                        // ← 파일 없음
  '방학 특강':     'vacation.html'                         // ← 파일 없음
  ```
  로 매핑되어 있었다. 또 `github-pages/` 폴더에 `Curriculum_onepage*.html`, `seminar.html`, `vacation.html` 세 파일이 아직 없었음. 매핑만 고쳐도 파일이 없어 404가 또 났을 거다.
- 처치 방향: 정식 Supabase 변환본을 한 번에 다 만들기엔 페이지마다 의존성이 크므로(특강 신청 기능은 service_role 키가 클라이언트에 들어가면 안 됨, Curriculum_onepage는 강사 상세/팝업 등 데이터 흐름이 많음), 우선 **매핑은 정확히 고치고 누락 페이지에는 placeholder를 깔아 404를 해소**하는 방향을 선택. 정식 변환은 각 페이지마다 별도 작업으로 이어가기로 한다.
- `pageMap`에서 `'학과 커리큘럼' → 'Curriculum_onepage_supabase_test.html'`로 수정.
- 신규 placeholder 파일 3개 생성:
  - `github-pages/Curriculum_onepage_supabase_test.html` — 타이틀 "학과 커리큘럼"
  - `github-pages/seminar.html` — 타이틀 "특강 / 세미나"
  - `github-pages/vacation.html` — 타이틀 "방학 특강"
- 세 placeholder는 동일 디자인을 공유:
  - 검은 배경(`#000`) + Pretendard Variable + jsDelivr Paperlogy CSS 로드
  - 가운데 정렬 컬럼: `UNDER CONSTRUCTION` 라벨(주황) + 페이지 제목(Bold) + 안내 문구(연회색) + 주황 보더 알약 "← 메인으로 돌아가기" 버튼
  - 하단 hint `ESC: back to main`과 `Escape` 키로 메인 이동
  - 빈 favicon(`<link rel="icon" href="data:,">`)으로 콘솔 404 노이즈 차단
- GitHub Pages 반영:
  - commit: `304156d Fix curriculum menu mapping and add placeholders for missing pages`
  - `git push origin main` 성공.
  - 배포 폴링 후 `seminar.html`, `vacation.html`, `Curriculum_onepage_supabase_test.html` 모두 HTTP 200 확인.
  - `index.html`의 `'학과 커리큘럼': 'Curriculum_onepage_supabase_test.html'` 반영 확인.
- 후속 작업 (별도 step):
  - `Curriculum_onepage_supabase_test.html` 정식 변환: 메인 시트 + Supabase의 학과별 커리큘럼 데이터 + 강사 상세 팝업 흐름 재구성.
  - `seminar_supabase_test.html` 정식 변환: 표시는 Supabase 읽기로 가능하지만 **특강 신청 기능은 클라이언트 anon key로 쓸 수 없다**. 신청은 Apps Script `applySeminar` 같은 서버 경로를 따로 두거나 Supabase Edge Function이 필요. 우선 읽기 전용으로 먼저 만들 수도 있음.
  - `vacation_supabase_test.html` 정식 변환: 방학특강 데이터 + 알약 hover 스프링 + 팝업까지 그대로 옮김.

### GitHub Pages — placeholder 3종을 정식 Supabase 변환본으로 교체

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 직전에 만든 3개 placeholder를 원래 보여야 할 내용으로 교체.
- 공통 전략: 원본 Apps Script 페이지(`vacation.html`, `Curriculum_onepage.html`, `seminar.html`)를 `github-pages/`로 복사해 시각/애니메이션/이벤트 로직을 100% 그대로 유지하고, **Apps Script 의존부만 정밀 치환**(`include('fonts')` → jsDelivr Paperlogy CSS, `google.script.run.xxx()` → Supabase REST 헬퍼). Supabase 동기화 시 `fillMergedValues_()`가 이미 forward-fill을 수행하므로 클라이언트는 각 행을 그대로 신뢰해도 된다는 점을 활용해 클라이언트 로직을 단순화.

- **`github-pages/vacation.html`** (commit `2266abf`)
  - 신규 헬퍼: `getVacationSeminarSubjectsFromSupabase`, `getVacationSubjectDetailFromSupabase`. 메인 시트 `메인 페이지`에서 E열=`방학 특강` 행을 찾아 I열(데이터 시트 탭 이름)과 J열(배경 이미지)를 추출하고, `instructor_curriculum` 소스의 해당 탭에서 B열 forward-fill 결과를 그대로 사용.
  - `getVacationSubjectDetail`은 동일 탭의 B열 연속 동일값을 "블록(variant)"으로 묶고, 매 블록의 시작 행에서 A(강사)/I(시간)/H(준비물)를, 블록 내 각 행에서 E(커리큘럼)/F(이미지)를 step으로 추출. Drive 이미지 URL은 `ComswSupabase.convertDriveUrl`을 통과시킨다.
  - `getLoadingContent` / `getWebAppUrl` 호출은 제거. `goHome()`은 기존 로딩 오버레이 + wipe 애니메이션을 거쳐 `./index.html`로 이동.

- **`github-pages/Curriculum_onepage_supabase_test.html`** (commit `5a18601`)
  - 신규 헬퍼 3종:
    - `getDepartmentListSimpleFromSupabase` — `컴수원_전체수업` O열(학과명)/Q열(체크박스)/U열(영문명) 기반 학과 목록.
    - `getCurriculumSimpleByDeptFromSupabase` — `로드맵`에서 학과 행을 찾아 B열 이후 셀들에서 과목 이름들을 split(`/`, `,`, `\n` 등)으로 수집한 뒤, `컴수원_전체수업`의 C열(과목명) 매칭 행들에서 G(기간)/J(과정내용)/K(프로그램)/L(학습수준)을 누적. 시트 A열부터 저장되는 Supabase 인덱스 체계(`G=6 / J=9 / K=10 / L=11`)에 맞춰 인덱스 수정.
    - `getCurriculumByDeptFromSupabase` — `Curriculum_full_supabase_test`와 동일한 로직(O=학과 / U=영문명 / B=학과 키워드 / C=과목 / D=주차 / F=내용 / H=이미지). 학과 상세 팝업의 주차별 카드와 라이트박스 흐름을 그대로 살린다.
  - 로딩/웹앱URL 호출 제거: `loadingContentReady` / `webAppUrlReady`를 즉시 ready로 set해 wipe 진행률이 정상 흐름을 유지.

- **`github-pages/seminar.html`** (commit `582e74d`, 읽기 전용)
  - 신규 헬퍼: `getSeminarListFromSupabase` — `특강 및 세미나` 시트 A~H열을 1:1 매핑(`img/title/subtitle/datetime/instructor/place/capacity/applied`)으로 읽고, 원본 `applySeminar`와 동일한 후처리(장소에 `SBS아카데미컴퓨터아트학원 수원점` 접두어 자동 부착, 강사명에 `선생님` 자동 부착, 일시 포맷 `YYYY년 M월 D일(요일) HH:MM-HH:MM`)를 적용. `_semParseDate`가 ISO / `YYYY.MM.DD` / `YYYY-MM-DD` / `YYYY년 M월 D일` 형식을 다 처리하고, 지난 특강은 `isPast=true`로 표시해 슬라이드 정렬 시 뒤로 보낸다.
  - **`applySeminar`는 의도적으로 비활성화**. Apps Script의 `applySeminar`는 시트 `특강 신청`에 `appendRow()`를 수행해야 하는데 이는 `service_role` 권한이 필요하므로 클라이언트 anon key로는 불가. 신청 버튼은 그대로 두되 누르면 토스트만 띄움: `"현재 페이지에서는 신청이 불가합니다. 학원 내 키오스크에서 신청해 주세요."` (5초). 정식 신청 경로는 학원 내 키오스크의 Apps Script 페이지.
  - `getLoadingContent` / `getWebAppUrl` 호출 제거. `goHome()`은 `./index.html`로 직접 이동.

- 공통 head 변경 (3개 파일 동일):
  - `<?!= include('fonts'); ?>` 제거 → `https://cdn.jsdelivr.net/gh/rladiddus/comsw@main/assets/fonts/paperlogy.css` 직접 로드.
  - `assets/js/supabase-config.js`, `assets/js/supabase-client.js` 로드 추가.
  - `<link rel="icon" href="data:,">` 인라인 favicon으로 `/favicon.ico` 404 콘솔 노이즈 차단.

- GitHub Pages 반영:
  - commits: `2266abf` (vacation), `5a18601` (Curriculum_onepage), `582e74d` (seminar). 모두 push 성공.
  - 배포 폴링 후 3개 URL 모두 HTTP 200 확인:
    - `https://rladiddus.github.io/comsw/vacation.html`
    - `https://rladiddus.github.io/comsw/Curriculum_onepage_supabase_test.html`
    - `https://rladiddus.github.io/comsw/seminar.html`
  - `index.html`의 `pageMap`은 직전 작업에서 이미 정상 매핑된 상태이므로 별도 수정 불필요.

- 알려진 제약:
  - `seminar.html`의 신청 폼은 표시는 되지만 제출이 차단된다. RLS 정책 + Supabase Edge Function 또는 별도 backend를 두면 향후 GitHub Pages에서도 신청 처리가 가능하지만 본 작업 범위 밖.
  - Pretty url(예: `Curriculum_onepage.html`)이 아니라 `Curriculum_onepage_supabase_test.html`이 유지되는 이유는 사용자가 추후 정식 이름으로 rename할 때 명시적으로 변경 가능하도록 하기 위함이다.

### `seminar.html` 포스터 누락 진단 + 신청 기능 doPost 라우팅 도입

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  1. seminar 페이지의 특강 3개 중 마지막 1개만 포스터 이미지가 보임.
  2. 신청 시 `1424gRmyDWq...` 시트의 `특강 신청자 명단` 탭 첫 빈 행에 `[A=특강명, B=이름, C=연락처]`로 행 추가가 되고, 신청 인원은 같은 스프레드시트의 `특강 및 세미나` 탭에서 B열로 매칭된 행의 H열 값을 가져오면 좋겠다.
- 진단 (1): Supabase raw_sheet_rows에서 `특강 및 세미나` 시트를 직접 fetch해 보니 row 2/3/4 모두 A열에 정상 Drive `/file/d/.../view` URL이 들어있었다. 셋 다 `convertDriveUrl()`로 `https://drive.google.com/thumbnail?id=...&sz=w1000`로 변환되는데, `curl -IL`로 따라가 본 결과:
  - row 2 (1NNT7aJE...), row 3 (1z8kJIMb...): redirect 마지막 단계에서 `https://accounts.google.com/ServiceLogin?...`으로 가는 것 확인. **공유 권한이 "링크 있는 모든 사용자"가 아니라 비공개 상태.**
  - row 4 (1_Zljymu...): redirect 마지막 단계에서 `HTTP/1.1 200 OK` + `Content-Type: image/png` 응답.
  - 결론: 코드 문제 아님. **Drive 파일 공유 권한 문제**. 사용자가 처음 두 파일을 Drive에서 "링크 있는 모든 사용자: 뷰어"로 바꾸면 즉시 보임.
- 신청 인원수(applied)는 이미 현재 `getSeminarListFromSupabase`가 H열 인덱스 7을 읽고 있어 별도 변경 불필요.
- 신청 기능 구현 방향: GitHub Pages → Apps Script Web App `doPost`로 POST 호출.
  - 장점: Supabase 새 테이블/RLS 정책 없이 기존 Apps Script `applySeminar()`를 그대로 재사용. 시트가 단일 진실원으로 유지되고 응답으로 H열 카운트도 즉시 받아옴.
  - CORS preflight 우회: 클라이언트에서 `Content-Type: text/plain;charset=utf-8`로 전송 + body는 JSON.stringify. Apps Script는 `e.postData.contents`에서 JSON 문자열을 파싱.
- `Code.js` 변경:
  - `SEMINAR_APPLY_SHEET_NAME` = `'특강 신청'` → `'특강 신청자 명단'` 로 변경 (사용자 요청 시트명에 맞춤).
  - 파일 끝부분에 `doPost(e)` 추가. body에서 JSON 파싱 → `action: 'apply_seminar'`이면 `applySeminar(data.title, data.name, data.phone)`을 호출하고 결과를 `ContentService.createTextOutput(JSON.stringify(...))` + `MimeType.JSON`으로 반환. 알 수 없는 action / parse error / 예외는 모두 `{ ok: false, error: ... }`로 응답.
  - 공통 응답 헬퍼 `_doPostResponse_(obj)` 추가.
- `github-pages/assets/js/supabase-config.js` 변경:
  - 새 필드 `appsScriptApplyUrl: ''` 추가. 사용자가 Apps Script Web App을 발행한 뒤 그 `/exec` URL을 여기에 넣어야 한다. 비어 있으면 신청 버튼이 "endpoint 미설정" 토스트만 띄움 (no-op POST가 일어나지 않음).
- `github-pages/seminar.html` 변경:
  - 직전에 비활성화 토스트로 막아둔 `handleApply()`의 body를, `fetch(APPLY_ENDPOINT, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'apply_seminar', title, name, phone }) })` 호출로 교체.
  - 응답이 `{ ok:true, applied }`이면 화면의 `(N명 신청 중)` 갱신, 입력 초기화, 성공 토스트 + 이모지 폭죽 재생.
  - 응답이 `{ ok:false, error }`이면 에러 토스트.
  - `APPLY_ENDPOINT`가 비어 있으면 "신청 endpoint가 설정되지 않았습니다." 안내.
- GitHub Pages 반영:
  - commit: `d9fc833 Wire seminar apply button to Apps Script Web App doPost endpoint`
  - `git push origin main` 성공.
- 사용자 액션 필요 (순서):
  1. Drive에서 첫 두 포스터 파일의 공유 권한을 "링크 있는 모든 사용자: 뷰어"로 변경.
  2. Apps Script 편집기에서 사용자가 직접 추가한 `Code.gs`와 로컬 `Code.js`를 동기화. 즉 위 두 변경 (시트명 + `doPost`/`_doPostResponse_` 두 함수)을 웹 편집기에도 반영. 이미 사용자가 웹 편집기에서 직접 작업하고 있는 패턴이라 clasp이 아닌 수동 동기화일 가능성 있음.
  3. Apps Script "배포 → 새 배포" 또는 기존 배포의 "관리 → 새 버전 게시"로 Web App 재발행. 액세스는 "익명 접근 허용" 그대로 유지(이미 `appsscript.json`에 `ANYONE_ANONYMOUS`).
  4. 발행된 `/exec` URL을 복사해 `github-pages/assets/js/supabase-config.js`의 `appsScriptApplyUrl`에 붙여넣은 뒤 commit/push (또는 사용자가 URL만 알려주면 내가 반영).
- 알려진 한계:
  - `doPost`는 Web App 재발행 후에만 유효. `/dev` 환경에서는 이미 head 코드로 동작하지만, GitHub Pages가 직접 호출하는 URL은 `/exec` 발행 URL이라야 안정적.
  - Apps Script `doPost`는 응답 헤더에 CORS를 명시할 수 없지만, `text/plain` 본문이라 simple request라 응답을 fetch가 그대로 받음. JSON 파싱은 클라이언트가 수행.
  - 이중 신청 방지는 기존 `applySeminar()`의 중복 검사 로직(특강명+이름+연락처 조합)에 의해 그대로 동작.

### GitHub Pages — 모든 서브 페이지에 공통 하단 메뉴 바 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: index.html에 있는 하단 메뉴를 6개 서브 페이지(`vacation`, `seminar`, `roadmap_supabase_test`, `Curriculum_full_supabase_test`, `Curriculum_onepage_supabase_test`, `item_supabase_test`)에서도 보이게 하고, 현재 페이지에 해당하는 메뉴는 주황(`#fa491d`) 활성 상태(+클릭 무효화)로 표시.
- 사용자 결정(코딩 전 확인 단계에서): (1) 메뉴는 **항상 보이게** (index.html의 가운데 `+` 토글 버튼은 제거), (2) 활성 색상은 **옵션 B = 주황 배경 + 흰 글자**.
- 신규 파일 `github-pages/assets/js/footer-menu.js` 작성. IIFE로 캡슐화한 단일 모듈로, 페이지에서 `<script src="./assets/js/footer-menu.js"></script>` 한 줄만 추가하면 자동으로 메뉴가 떠 있게 했다. 의존성: 기존 `supabase-config.js` + `supabase-client.js` (이미 모든 서브 페이지에 로드되어 있음).
- 모듈 내부 동작:
  1. `PAGE_TO_MENU` 매핑으로 파일명 ↔ 메뉴명 변환. 현재 페이지는 `location.pathname`에서 추출한 파일명으로 자동 감지.
  2. 자체 scoped CSS를 `<style id="comsw-footer-menu-css">`로 head에 주입. 호스트 페이지의 CSS와 충돌 위험 0.
  3. `<div id="comsw-footer-menu">`를 body에 주입. `position: fixed; bottom: 4vh; left: 50%; z-index: 9000`로 항상 화면 하단 중앙에 고정.
  4. Supabase `메인 페이지` 시트에서 메뉴 fetch — E열(이름)/F열(체크박스, `truthyCell` 통과)/H열(순서)를 읽고 order 오름차순 정렬. 즉 home 페이지에서 안 보이는 메뉴는 서브 페이지에서도 안 보임.
  5. 각 메뉴 알약을 `.comsw-menu-item`으로 렌더. 흰 배경 + 검정 글자 + box-shadow + `border-radius: 24px`.
  6. **현재 페이지에 해당하는 메뉴**는 `.active` 클래스 추가 → 배경 `#fa491d`, 글자 흰색, `pointer-events: none`, hover 효과 차단. `aria-current="page"`도 같이 부여.
  7. 다른 메뉴 클릭 시 `location.href = './' + targetPage`. 매핑에 없는 메뉴는 `./index.html`로 폴백.
- index.html은 자체 `+` 토글 + 좌우 펼침 애니메이션이 있는 별개 모듈을 그대로 유지(이 페이지에는 새 footer-menu 안 끼움). 6개 서브 페이지에만 신규 모듈 로드.
- 6개 페이지 모두 `</body>` 직전에 `<script src="./assets/js/footer-menu.js"></script>` 한 줄 추가.
- GitHub Pages 반영:
  - commit: `90fcbcc Add shared bottom menu bar to every sub-page` (신규 footer-menu.js 1개 + 6개 HTML 한 줄씩 추가)
  - `git push origin main` 성공.
  - 배포 폴링 → `https://rladiddus.github.io/comsw/assets/js/footer-menu.js` HTTP 200 확인.
- 좌하단 `< 메인으로` 호버 버튼은 z-index 500이라 메뉴(z-index 9000)와 시각 충돌 없음. 위치도 좌하단 vs 중앙 하단이라 겹치지 않음.
- 시트에 새 메뉴를 추가하거나 순서/체크 상태를 바꾸면 별도 코드 수정 없이 자동 반영(다음 페이지 로드 시).

### `Curriculum_onepage` / `roadmap` 학과 팝업 — 병합 셀 forward-fill로 인한 4회 중복 표시 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: roadmap의 학과 클릭 팝업과 Curriculum_onepage의 학과 표에서 같은 과목(`포토샵 / 1개월 / 강의내용 / Photoshop / ★★☆☆☆`)이 4번 반복되어 표시됨. Supabase가 병합 셀을 forward-fill하기 때문임을 사용자가 정확히 짚음.
- 진단: Supabase에 동기화된 `컴수원_전체수업` 시트의 한 과목(`포토샵`)이 row 3~6에 동일한 C(과목명)/G(기간)/J(과정내용)/K(프로그램)/L(학습수준) 값으로 들어 있음을 직접 fetch로 확인. 다음 과목도 4행씩 동일 값 반복.
- 원본 Apps Script가 4회 중복이 없었던 이유: 시트에서 C/G/J/K/L 다섯 열이 한 셀로 4행 병합되어 있고, `getValues()`는 좌상단 한 셀만 값을 주고 나머지 3개는 빈 셀로 반환한다. 그 후의 `if (!duration && !content && !program && !level) return;` 가드가 빈 행 3개를 자연스럽게 스킵하여 결과적으로 1번만 표시됐다.
- 그러나 Supabase 동기화 시 `fillMergedValues_()`가 병합 셀의 좌상단 값을 모든 하위 셀에 복사해서 저장한다. 그래서 GitHub Pages 클라이언트가 `raw_sheet_rows`를 받으면 4행 모두 같은 값이 들어 있고, 위 가드가 모두 false라 통과 → 4번 push되는 구조였다.
- 처치: 같은 (name, duration, content, program, level) 조합은 한 번만 `subjects` 배열에 push되도록 in-memory dedupe 추가. 의도된 다른 데이터 행이라면 키가 달라서 그대로 유지됨.
- 변경:
  - `github-pages/Curriculum_onepage_supabase_test.html`의 `getCurriculumSimpleByDeptFromSupabase()` 내부 누적 루프에 `seenKeys` 객체 추가.
  - `github-pages/roadmap_supabase_test.html`의 `loadCurriculumSimpleByDeptFromSupabase()` 내부 누적 루프에 동일한 dedupe.
- 다른 페이지/함수 영향 없음:
  - `Curriculum_full_supabase_test`의 `getCurriculumByDeptFromSupabase`는 D열(주차)을 키에 포함하여 자연 dedupe되어 영향 없음.
  - 기타 학과 목록/메뉴 fetch는 별도 컬럼/로직 사용.
- GitHub Pages 반영:
  - commit: `b42bb7a Dedupe forward-filled rows in Curriculum_onepage and roadmap popup`
  - `git push origin main` 성공.
  - 배포 폴링 후 두 페이지 모두 `seenKeys` 패턴이 응답에 포함된 것을 확인.
- 향후 같은 패턴(병합 셀 → Supabase forward-fill로 4회 중복)이 다른 페이지에서 발생하면 동일한 dedupe 4줄 패치로 해결 가능. 클라이언트 측 처리이므로 Supabase 동기화 로직은 그대로 두어 다른 흐름(`강사페이지`, `로드맵`, `방학특강`)에 영향 없음.

### `Curriculum_full_supabase_test.html` 강사 커리큘럼 카드 팝업 ESC 처리

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: 강사를 클릭해 들어간 상태에서 과목 버튼(예: `웹툰`)을 눌러 1·2·3·4개월 카드가 떠 있는 팝업이 켜진다. 이때 ESC를 누르면 의도와 달리 카드 팝업이 아니라 뒤의 강사 상세 라이트박스가 통째로 닫혀 강사 선택이 취소되는 문제.
- DOM 구조 (앞으로 올수록 위 레이어): 학과 슬라이드 → `#instructor-lightbox` (강사 상세) → `#instructor-curriculum-lightbox` (카드 팝업).
- 진단:
  - `Curriculum_full_supabase_test.html`의 ESC 핸들러는 3곳에 등록되어 있다.
    - line 1258: `window` capture, `course-prep-overlay` 처리, `stopImmediatePropagation` 사용.
    - line 3582: `window` capture, `recruitment-popup` 처리, `stopImmediatePropagation` 사용.
    - line 5445: `document` bubble, 강사 커리큘럼 라이트박스 → 강사 상세 라이트박스 → 일반 라이트박스 → `closePanel` 순으로 분기.
  - 5445 핸들러의 첫 분기는 `instructor-curriculum-lightbox.classList.contains('visible')`만으로 판단하는데, 이 값이 false로 평가되면 다음 분기로 떨어져 `closeInstructorLightbox(true)`가 실행 → 강사 라이트박스 자체가 닫힘 = 사용자가 본 증상.
  - 5445가 `document`의 bubble 단계라 `window` capture로 먼저 등록된 다른 ESC 핸들러보다 늦게 발동되고, 첫 분기가 처리되더라도 `stopImmediatePropagation`이 없어 다른 ESC 핸들러가 추가로 발동될 여지가 있었다.
- 수정(옵션 A 플래그 + 옵션 B capture/stop 둘 다 적용):
  1. `openInstructorCurriculum()` 안에서 `window._instructorCurriculumOpen = true`를 `lb.classList.add('visible')` 바로 다음 줄에 set. 명시적 boolean 플래그.
  2. `closeInstructorCurriculum()` 안에서 `window._instructorCurriculumOpen = false`로 해제.
  3. line 5445 ESC 핸들러의 첫 분기를 다음으로 강화:
     - 1순위 판정: `!!window._instructorCurriculumOpen`. 실패 시 fallback으로 visible 클래스 체크.
     - 첫 분기가 처리되면 `closeInstructorCurriculum()` 호출 후 `e.preventDefault()` + `e.stopPropagation()` + `e.stopImmediatePropagation()` + `return`.
  4. 핸들러 5445 자체를 `document.addEventListener('keydown', ..., true)`로 capture 단계 등록 변경. 이제 같은 ESC에 대해 `window` capture(1258, 3582)보다도 (DOM 트리 한 단계 위라) 먼저 발동되거나 동등하게 잡혀, 강사 커리큘럼 우선 처리 후 다른 핸들러 발동을 모두 차단할 수 있다.
- 두 보강을 합치면 visible 클래스 체크가 어떤 사유로 false가 되어도 플래그가 잡아주고, 플래그가 어떤 사유로 누락돼도 visible 클래스가 잡아준다. 동시에 다른 ESC 핸들러가 같은 keystroke에 끼어들 여지를 stopImmediatePropagation이 봉쇄.
- GitHub Pages 반영:
  - commit: `0d9294d Make ESC close only the instructor curriculum popup, not the lightbox`
  - `git push origin main` 성공.
  - 배포 폴링 후 `window._instructorCurriculumOpen` 패턴이 응답에 포함된 것을 확인.
- 영향 범위:
  - 다른 페이지(`vacation`, `roadmap`, `Curriculum_onepage`, `item`, `seminar`)의 ESC 동작은 무관(별도 핸들러 사용). 영향 없음.
  - 강사 상세 라이트박스(`instructor-lightbox`) 단독 상태에서의 ESC는 두 번째 분기에서 그대로 처리되어 기존과 동일하게 라이트박스 통째로 닫힘.

### `seminar.html` 푸터 크기 축소 + 페이지 인디케이터 위치 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: `SBS ACADEMY COMPUTER ART SUWON` 글자를 10에서 6 정도(약 60%)로 축소. 그리고 점으로 만들어진 페이지 네비게이션 도트들을 신청 버튼(`개인정보 수집 및 이용에 동의하며 신청합니다.`) 아래에 중앙 정렬로, 버튼과 80px 떨어뜨려 표시.
- 푸터 변경: `.seminar-footer`의 `font-size: 32px` → `19px`. weight/letter-spacing/위치는 그대로 유지해 시각 일관성 보존(약 60%).
- 인디케이터 변경:
  - 신청 버튼은 슬라이드 좌표계(1920×1080) 내부에 `top: 832px; height: 69px`로 위치 → 버튼 끝 y = 901px.
  - 사용자 요청 80px 간격 → 인디케이터 y = 981px.
  - 기존: `<div id="page-indicator">`가 `<body>` 직속이고 CSS는 `position: fixed; bottom: 30px;` → 화면 맨 아래 viewport 기준. 슬라이드의 신청 버튼 좌표와 무관해서 viewport 크기에 따라 거리가 들쭉날쭉했다.
  - 변경: 마크업을 `<div id="scale-container">` 안으로 이동, CSS를 `position: absolute; top: 981px; left: 50%; transform: translateX(-50%);`로 수정. 이렇게 두면 슬라이드와 같은 `transform: scale`이 적용되어 신청 버튼과 항상 같은 비율로 80px 거리를 유지한다.
  - `z-index: 300` / `pointer-events: none`은 유지.
- 코드 의존성 확인:
  - `buildPageIndicator()` / `updatePageIndicator()` 등 인디케이터 DOM에 dot을 채우는 JS는 여전히 `document.getElementById('page-indicator')`로 접근하므로 마크업 이동에 영향 없음.
  - 슬라이드 페이지(`.slide-page`)는 `position: absolute; top: 0; left: 0`로 scale-container 안에 stacked. 인디케이터는 scale-container의 동급 자식으로 z-index 300이라 항상 슬라이드 위에 떠 있다.
- GitHub Pages 반영:
  - commit: `2b5a7c3 seminar: shrink footer text and move page dots under apply button`
  - `git push origin main` 성공.
  - 배포 폴링 후 응답에 `top: 981px` 패턴이 포함된 것 확인.

### `seminar.html` 페이지 인디케이터 z-index 후속 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: 직전 변경(인디케이터를 `scale-container` 안으로 이동) 이후 화면에서 도트 네비게이션이 사라짐. 신청 버튼 아래에 빈 공간만 보이고 도트 없음.
- 원인: `.slide-page` 요소들이 `appendChild()`로 동적 추가되는데, `<div id="page-indicator">`가 HTML에 정적으로 먼저 들어가 있으므로 **DOM 순서상 slide-page들이 indicator 뒤에 위치**한다. 둘 다 z-index 명시가 없으면 painting order는 DOM 순서를 따라가서, slide-page의 불투명 배경(`#f6f6f6`)이 indicator를 위에서 덮어버린다.
- 처치:
  - `.slide-page`에 `z-index: 1` 명시. 동적 추가에도 항상 indicator보다 아래 stack.
  - `#page-indicator`의 `z-index: 300` → **`z-index: 1000`** 으로 상향. 명시적 비교로 항상 위에 그려지도록.
  - 둘 다 같은 stacking context(`scale-container`) 안에 있고, opacity:1 같이 stacking context를 만들 수 있는 속성도 있지만, 명시적 z-index가 painting 순서를 결정적으로 만든다.
- GitHub Pages 반영:
  - commit: `3bacf57 seminar: keep page dots above dynamically-added slide pages`
  - `git push origin main` 성공.
  - 배포 폴링 후 `z-index: 1000` 패턴이 응답에 포함된 것 확인.

### `Curriculum_full_supabase_test.html` 페이지 인디케이터를 footer 라인으로 이동

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고: 학과별 자료(커리큘럼 풀) 페이지에서 도트 네비게이션이 하단 알약 메뉴(`footer-menu`)와 겹친다. 그리고 도트가 약간 왼쪽으로 쏠려 있다.
- 사용자 요청:
  1. 도트 네비게이션 높이를 `SBS ACADEMY COMPUTER ART SUWON` 푸터 글자와 같은 라인으로 올릴 것.
  2. 좌우 빈 공간이 같도록 정중앙 정렬.
- 기존 상태:
  - 마크업: `<div id="page-indicator">`가 `#slide-panel` 직속 자식.
  - CSS: `position: absolute; bottom: 70px; left: 56.7%; transform: translateX(-50%); z-index: 200;` — slide-panel 기준 viewport 좌표라 슬라이드 footer 글자와 무관, 그리고 `56.7%`라서 슬라이드 영역 중앙이 아닌 약간 오른쪽.
- 슬라이드 footer 위치 계산:
  - `.slide-page`는 1920×1080, `padding: 60px 100px`, `grid-template-rows: auto 1fr auto`, 마지막 row가 `.slide-footer`.
  - `.slide-footer`: `font-size: 20px; padding-top: 24px; margin-top: 20px;` → 박스 height ≈ 48px, 박스 top y ≈ 1080 − 60 − 48 = 972, 텍스트 baseline ≈ 1012, 텍스트 center ≈ 1008.
  - 따라서 dot(직경 8px) 중심을 y=1008에 두려면 `top: 1003~1004px`.
- 변경:
  - 마크업: `<div id="page-indicator">`를 `#scale-container` 안으로 이동. 이렇게 두면 슬라이드와 동일한 `transform: scale`이 적용되어 어떤 viewport에서도 footer 글자와 같은 비율로 정렬된다.
  - CSS(`#page-indicator`): `bottom: 70px; left: 56.7%; z-index: 200;` → **`top: 1003px; left: 50%; z-index: 1000;`**. 슬라이드 1920×1080 좌표계의 정중앙 + footer 텍스트 라인.
  - CSS(`.slide-page`): `z-index: 1` 명시 추가. `scale-container` 안에서 indicator(z-index 1000)보다 항상 아래에 stack 되도록 (`seminar.html`에서 동일 패턴으로 검증된 처치).
- 코드 의존성 확인:
  - JS는 `document.getElementById('page-indicator')`로만 indicator를 참조 → 마크업 이동에 영향 없음.
  - 슬라이드 패널이 `fullscreen` 상태일 때도 `scale-container` 안에 있으니 자동으로 같은 비율로 따라간다.
- GitHub Pages 반영:
  - commit: `2af4f88 curriculum_full: align page dots with footer text, center horizontally`
  - `git push origin main` 성공.
  - 배포 폴링 후 `top: 1003px` 패턴이 응답에 포함된 것 확인.

### `Curriculum_full_supabase_test.html` / `seminar.html` 도트 인디케이터 삭제 버그 복구

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - `Curriculum_full_supabase_test.html`에서 내용이 화면 밖으로 벗어나고 도트 네비게이션이 보이지 않음.
  - `seminar.html`에서 화면이 비고 하단 공통 메뉴만 보임.
- 원인:
  - 직전 변경으로 `#page-indicator`를 `#scale-container` 내부에 넣었는데, 두 페이지 모두 슬라이드 재생성 시 `container.innerHTML = ''`를 실행한다.
  - 이때 `#page-indicator`도 함께 삭제되고, 이후 `document.getElementById('page-indicator').innerHTML = ''` 또는 `buildIndicator()`에서 null 참조가 발생해 JS 흐름이 중단된다.
  - 세미나 페이지가 하얗게 비는 현상은 이 JS 중단 때문에 슬라이드 렌더링이 끝까지 가지 못한 결과.
- 변경:
  - `github-pages/Curriculum_full_supabase_test.html`
    - `ensurePageIndicator()` 추가.
    - `loadCurriculum()`과 `buildAllSlides()`에서 `scale-container`를 비운 직후 인디케이터를 다시 생성/부착.
    - `buildIndicator()`가 직접 DOM을 잡지 않고 `ensurePageIndicator()`를 통해 안전하게 참조.
  - `github-pages/seminar.html`
    - 동일한 `ensurePageIndicator()` 추가.
    - `buildSlides()`에서 컨테이너 초기화 직후 인디케이터를 복구.
    - 빈 목록 처리와 `buildIndicator()`에서 null 참조 방지.
- 영향:
  - 기존 도트 위치(`top: 1003px`, `top: 981px`), z-index, 슬라이드 좌표계 정렬은 유지.
  - `Curriculum_onepage_supabase_test.html`은 도트가 `onepage-scale-container` 밖에 있어 같은 삭제 버그 대상이 아니므로 변경하지 않음.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - GitHub Pages 배포 응답 확인:
    - `seminar.html?v=213ed92-final`: HTTP 200, `footer-menu.js?v=image-popup-restore-1` 포함 확인.
    - `Curriculum_onepage.html?v=213ed92-final`: HTTP 200, `footer-menu.js?v=image-popup-restore-1` 포함 확인.
    - `assets/js/footer-menu.js?v=image-popup-restore-1-refresh`: HTTP 200, `horizontalPad`, `#curriculum-popup`, `item.crossorigin/srcset/src` 복원 순서 관련 코드 포함 확인.
- GitHub Pages 반영:
  - commit: `213ed92 Fix capture image restore and onepage popup`
  - `git push origin main` 성공.
  - GitHub Pages 배포 응답 확인:
    - `roadmap.html?v=f0c685a`: HTTP 200.
    - 응답에 `scrollbar-width: none` 포함 확인.
    - 응답에 `footer-menu.js?v=roadmap-logo-restore-1` 포함 확인.
    - `assets/js/footer-menu.js?v=roadmap-logo-restore-1`: HTTP 200.
    - 다운로드 스크립트에서 이미지 URL 수집 단계의 전역 `crossorigin` 부여 제거 확인.
- GitHub Pages 반영:
  - commit: `f0c685a Fix roadmap scrollbar and logo restore`
  - `git push origin main` 성공.

### seminar 포스터 및 Curriculum_onepage 팝업 캡처 복원 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - `seminar` 페이지 이미지 다운로드 후 포스터 이미지가 사라짐.
  - `Curriculum_onepage`에서 과목 팝업이 열린 상태로 다운로드하면 팝업 레이어가 캡처 이미지에 깨진 형태로 들어감.
  - 다운로드 후 팝업/본문 이미지가 다시 나타나지 않음.
  - `VISUAL EDITING CURRICULUM` 같은 학과 영문 타이틀이 PNG에서 끝부분이 잘림.
- 원인:
  - 이미지 캡처용 data URL 치환 후 원본 복원 시 `src`를 먼저 복원하고 `crossorigin`을 나중에 되돌려 외부/Drive 이미지가 anonymous 요청으로 다시 로드될 수 있었음.
  - `Curriculum_onepage` 팝업/라이트박스가 열린 상태에서 html2canvas 대상에 포함됨.
  - gradient text를 SVG 이미지로 바꾸는 캡처 보정에서 텍스트 폭 여유가 부족했음.
- 변경 파일:
  - `github-pages/assets/js/footer-menu.js`
  - `github-pages/seminar.html`
  - `github-pages/Curriculum_onepage.html`
  - `github-pages/Curriculum_onepage_supabase_test.html`
- 변경 내용:
  - 이미지 복원 순서를 `crossorigin/srcset/src` 순으로 변경해서 원본 이미지 재요청이 깨지지 않도록 수정.
  - `Curriculum_onepage` 캡처 직전 `#curriculum-popup.visible`, `#lightbox-overlay.visible`를 임시로 숨기고 캡처 후 복원.
  - gradient text SVG 변환 시 좌우 패딩 48px을 추가하고, 텍스트 시작 x좌표도 동일하게 밀어 잘림 방지.
  - `title-eng` clone overflow를 visible로 설정.
  - 관련 HTML의 `footer-menu.js` cache-bust query를 `?v=image-popup-restore-1`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - GitHub Pages 배포 응답 확인:
    - `roadmap.html?v=040f60f`: HTTP 200.
    - `Curriculum_full.html?v=040f60f`: HTTP 200.
    - `Curriculum_onepage.html?v=040f60f`: HTTP 200.
    - `item.html?v=040f60f`: HTTP 200.
    - `index.html?v=040f60f`: HTTP 200.
- GitHub Pages 반영:
  - commit: `040f60f Add clean production page filenames`
  - `git push origin main` 성공.

### roadmap 스크롤바 숨김 및 다운로드 후 로고 깨짐 방지

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - `roadmap` 페이지 오른쪽에 원래 없던 스크롤바가 보임.
  - 이미지 다운로드 후 우상단 로고가 깨진 이미지/대체 텍스트처럼 바뀜.
- 원인:
  - `.roadmap-rows` 내부 스크롤 영역의 스크롤바가 화면 오른쪽에 노출됨.
  - 다운로드 준비 과정에서 실제 페이지의 모든 `img`에 `crossorigin="anonymous"`를 붙여 Google Drive 로고 이미지가 재요청되며 깨질 수 있었음.
- 변경 파일:
  - `github-pages/roadmap.html`
  - `github-pages/roadmap_supabase_test.html`
  - `github-pages/assets/js/footer-menu.js`
- 변경 내용:
  - `.roadmap-rows`에 `scrollbar-width:none`, `-ms-overflow-style:none`, `::-webkit-scrollbar { width:0; height:0; }` 적용.
  - 이미지 캡처용 URL 수집 단계에서 실제 DOM 이미지에 `crossorigin`을 붙이지 않도록 변경.
  - 캡처용 data URL 치환이 있는 이미지에만 임시로 `crossorigin`을 부여하고, 기존 복원 로직이 되돌리도록 유지.
  - `roadmap` 두 파일의 `footer-menu.js` cache-bust query를 `?v=roadmap-logo-restore-1`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.

### supabase_test 운영 페이지 파일명 전환

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청:
  - `*_supabase_test.html` 이름의 페이지를 운영용 이름으로 전환.
  - 기존 `*_supabase_test.html` 파일은 삭제하지 않음.
- 변경 파일:
  - 새로 추가: `github-pages/roadmap.html`
  - 새로 추가: `github-pages/Curriculum_full.html`
  - 새로 추가: `github-pages/Curriculum_onepage.html`
  - 새로 추가: `github-pages/item.html`
  - 수정: `github-pages/index.html`
  - 수정: `github-pages/assets/js/footer-menu.js`
- 변경 내용:
  - 기존 `roadmap_supabase_test.html`, `Curriculum_full_supabase_test.html`, `Curriculum_onepage_supabase_test.html`, `item_supabase_test.html` 내용을 각각 운영용 파일명으로 복사.
  - 메인 페이지 메뉴 이동 경로를 새 운영용 파일명으로 변경.
  - 공통 하단 메뉴는 기존 test 파일명을 현재 페이지로 계속 인식하되, 메뉴 클릭 시 새 운영용 파일명으로 이동하도록 매핑 추가.
  - 기존 `*_supabase_test.html` 파일은 삭제하지 않고 그대로 보존.
- 검증:
  - `git -C github-pages diff --check` 통과.

### 이미지 다운로드 캡처 개선

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - 홈페이지에서는 보이는 이미지가 다운로드 PNG에서는 빠짐.
  - 생성 PNG에서는 하단 메뉴/버튼 그림자가 없는 편이 좋음.
  - `Curriculum_full`은 현재 보이는 슬라이드 한 장만 다운로드됨.
  - `roadmap`은 로고가 빠지고, 내부 스크롤 영역 전체가 캡처되지 않음.
  - `Curriculum_onepage`도 내부 스크롤되는 표 하단까지 세로로 긴 이미지가 필요함.
- 변경 파일: `github-pages/assets/js/footer-menu.js`
- 구현:
  - 캡처 전 대상 영역의 이미지들을 CORS fetch로 data URL 변환해 clone DOM에 주입하는 보강 추가.
  - 캡처 clone에 전용 CSS를 주입해 버튼/하단 메뉴 그림자와 필터를 제거.
  - `Curriculum_full*` 페이지는 `#scale-container .slide-page` 전체를 1920x1080 단위로 복제해 세로로 이어 붙인 별도 export DOM을 만들고 한 장의 긴 PNG로 캡처.
  - `roadmap*` 페이지는 `#dept-rows`의 `scrollHeight`를 기준으로 `#canvas`, `#viewport` 높이를 확장해서 로고와 내부 스크롤 하단까지 캡처되도록 처리.
  - `Curriculum_onepage*` 페이지는 `#table-body`의 내부 스크롤 높이를 기준으로 `#scale-wrapper`, `#viewport`, `.curriculum-table`을 확장해 표 하단까지 캡처.
  - 페이지 이름 매칭은 `_supabase_test`뿐 아니라 일반 `Curriculum_full.html`, `Curriculum_onepage.html`, `roadmap.html` 계열도 포함.
- 제한:
  - 외부 이미지 서버가 CORS를 막으면 브라우저 정책상 data URL 변환/캡처가 여전히 제한될 수 있음.
  - 그래도 같은 출처 이미지와 CORS 허용 이미지는 clone 주입으로 누락 가능성을 줄임.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `assets/js/footer-menu.js` 응답에서 `createCurriculumFullExport`, `buildImageReplacementMap`, `box-shadow: none`, `naturalHeight`, `/^roadmap/i` 포함 확인.
- GitHub Pages 반영:
  - commit: `f536458 Improve full page image capture`
  - `git push origin main` 성공.

### 이미지 다운로드 PNG에서 이미지 누락 보강

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - 스크롤 영역 캡처는 해결됐지만 PNG 안에서 이미지가 계속 빠짐.
- 원인 추정:
  - 페이지에서는 이미지가 표시되어도 html2canvas가 캡처 clone에서 외부 이미지를 다시 로드/디코딩하는 타이밍 또는 CORS 처리 때문에 빈 박스로 그릴 수 있음.
  - 실제 Supabase 데이터의 Google Drive 이미지 예시(`drive.google.com/file/d/1RTe...`)를 확인했고, `drive.google.com/thumbnail` 및 `lh3.googleusercontent.com/d/...=w1000` 응답은 `Access-Control-Allow-Origin: *`를 반환함.
- 변경 파일:
  - `github-pages/assets/js/footer-menu.js`
  - `github-pages/Curriculum_full_supabase_test.html`
  - `github-pages/Curriculum_onepage_supabase_test.html`
  - `github-pages/item_supabase_test.html`
  - `github-pages/roadmap_supabase_test.html`
  - `github-pages/seminar.html`
  - `github-pages/vacation.html`
- 구현:
  - `getDriveImageUrl()` 추가: Drive URL/thumbnail URL에서 파일 ID를 뽑아 `https://lh3.googleusercontent.com/d/{id}=w1200` 후보를 추가.
  - `imageToDataUrlWithFallbacks()`가 원본 URL → Googleusercontent URL → 이미지 프록시 순서로 data URL 변환을 시도.
  - 캡처 전에 대상 DOM의 `<img>`와 `background-image`를 실제로 data URL로 잠깐 치환.
  - 치환 후 이미지 로드를 다시 기다린 뒤 html2canvas 실행.
  - 캡처 완료/실패 후 원래 `src`, `srcset`, inline `backgroundImage`로 원복.
  - clone DOM에도 동일한 data URL 치환을 적용.
  - 6개 HTML의 `footer-menu.js` 로드 경로에 `?v=cf33b08`를 붙여 CDN/브라우저 캐시를 우회.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `assets/js/footer-menu.js?v=cf33b08` 응답에서 `applyImageMapToRoot`, `restoreImageMapChanges`, `getDriveImageUrl`, `imageRestore` 포함 확인.
  - 배포된 `Curriculum_full_supabase_test.html` 응답에서 `footer-menu.js?v=cf33b08` 포함 확인.
- GitHub Pages 반영:
  - commit: `cf33b08 Inline images before page capture`
  - commit: `285df6a Bust footer menu capture script cache`
  - `git push origin main` 성공.

### roadmap 상단 로고 placeholder 문구 겹침 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - `roadmap` 페이지 오른쪽 위 상단에서 로고와 `LOGO IMAGE` 안내 문구가 겹쳐 보임.
- 원인:
  - 로고 placeholder의 `missing-logo::after`가 `LOGO IMAGE` 문구를 출력하고 있었고, 로고 로딩 상태에 따라 실제 로고와 placeholder 문구가 같이 보일 수 있음.
- 변경 파일: `github-pages/roadmap_supabase_test.html`
- 변경 내용:
  - `.roadmap-logo.logo-placeholder.missing-logo`의 점선 테두리/텍스트 표시 제거.
  - `missing-logo::after`의 `content`를 빈 문자열로 변경.
  - 로고 URL이 있을 때 `logo-placeholder`, `missing-logo` 클래스를 함께 제거.
  - `logo.onload`에서 placeholder 상태를 다시 제거하고, `logo.onerror`에서만 missing 상태 처리.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `roadmap_supabase_test.html` 응답에서 `logo.onload`, `logo-placeholder', 'missing-logo` 포함 확인.
- GitHub Pages 반영:
  - commit: `7711a83 Hide roadmap logo placeholder text`
  - `git push origin main` 성공.

### roadmap 로고가 다운로드 후 사라지는 문제 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - 다운로드 이미지는 정상인데, `roadmap` 페이지 상단 로고가 사라짐.
  - 다운로드 후에도 페이지 로고가 사라지지 않아야 함.
- 원인:
  - 이미지 캡처용 data URL 치환 로직이 `<img>`의 `src/srcset`은 원복했지만, 캡처 중 변경한 inline `display`, `visibility`, `crossorigin`은 원복하지 않았다.
  - 로드맵 로고 로딩 실패/지연 시 placeholder 문구를 숨긴 이후 실제 로고도 같이 보이지 않을 수 있었다.
- 변경 파일:
  - `github-pages/assets/js/footer-menu.js`
  - `github-pages/roadmap_supabase_test.html`
  - footer-menu를 불러오는 6개 HTML의 cache-bust query 갱신.
- 변경 내용:
  - 캡처 전 이미지 치환 시 `display`, `visibility`, `crossorigin` 원래 값을 저장.
  - 캡처 완료/실패 후 위 값들을 원복하도록 `restoreImageMapChanges()` 보강.
  - `roadmap` 로고 fallback URL 추가:
    - `메인 페이지` 시트 J열의 기존 Drive 로고 URL.
  - Supabase 로고 조회 실패 또는 빈 값이면 fallback 로고를 사용.
  - 로고 로딩 시 `display:block`, `visibility:visible`을 명시.
  - 로고 `onerror`는 fallback 한 번만 시도하고 무한 반복하지 않도록 처리.
  - 6개 페이지의 `footer-menu.js` 버전을 `?v=logo-restore-1`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `roadmap_supabase_test.html` 응답에서 `ROADMAP_LOGO_FALLBACK_URL`, `footer-menu.js?v=logo-restore-1` 포함 확인.
- GitHub Pages 반영:
  - commit: `88452ef Keep roadmap logo visible after capture`
  - `git push origin main` 성공.

### Curriculum_onepage 다운로드 이미지 스타일 보정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - `Curriculum_onepage` 다운로드 PNG에서 영문 학과/제목 글자에만 들어가야 할 그라데이션이 라인 전체에 깔림.
  - 중간 과목 행 하나가 마우스 오버된 것처럼 굵게/밑줄 강조되어 캡처됨.
- 원인:
  - `.title-eng`가 `div` 블록이라 텍스트 배경 그라데이션의 페인트 영역이 줄 전체 폭으로 잡힘.
  - 표 과목 셀 hover 시 `.row-hover` 클래스가 붙고, 다운로드 버튼 클릭 시점에 그 상태가 clone 캡처에 남을 수 있음.
- 변경 파일:
  - `github-pages/Curriculum_onepage_supabase_test.html`
  - `github-pages/assets/js/footer-menu.js`
  - footer-menu를 불러오는 6개 HTML의 cache-bust query 갱신.
- 변경 내용:
  - `.title-eng { display: inline-block; }` 추가해 그라데이션 영역을 텍스트 폭으로 제한.
  - 캡처 clone에서 `.row-hover` 클래스를 전부 제거.
  - 캡처 clone CSS에서 `.subject-cell.row-hover` 굵기와 underline width를 무효화.
  - 캡처 clone에서 hover성 transform/box-shadow가 들어갈 수 있는 요소들을 `none` 처리.
  - 6개 페이지의 `footer-menu.js` 버전을 `?v=onepage-capture-1`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `Curriculum_onepage_supabase_test.html` 응답에서 `display: inline-block;`, `footer-menu.js?v=onepage-capture-1` 포함 확인.
  - 배포된 `assets/js/footer-menu.js?v=onepage-capture-1` 응답에서 `.row-hover`, `subject-name-text::after`, `title-eng` 포함 확인.
- GitHub Pages 반영:
  - commit: `8818f60 Fix onepage capture hover and title gradient`
  - `git push origin main` 성공.

### Curriculum_onepage 다운로드 제목 그라데이션/밑줄 재보강

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - 여전히 `Curriculum_onepage` 다운로드 PNG에서 제목 글자 뒤 사각형 그라데이션처럼 보임.
  - 선택/hover 상태처럼 보이는 과목 밑줄이 다운로드 이미지에 남음.
- 원인:
  - html2canvas가 `background-clip:text` + `-webkit-text-fill-color: transparent`를 브라우저 렌더링과 다르게 처리해, 텍스트 마스크가 아니라 배경 박스로 캡처될 수 있음.
  - pseudo-element underline은 `.row-hover` 제거만으로 완전히 사라지지 않는 경우가 있음.
- 변경 파일:
  - `github-pages/assets/js/footer-menu.js`
  - footer-menu를 불러오는 6개 HTML의 cache-bust query 갱신.
- 변경 내용:
  - 캡처 clone에서 `.title-eng` 텍스트를 SVG data image로 교체하는 `replaceGradientTextWithSvg()` 추가.
  - SVG 내부 `<linearGradient>`와 `<text fill="url(#g)">`로 실제 글자 마스크 형태를 만들어 html2canvas가 배경 박스로 오해하지 않도록 처리.
  - 캡처 clone CSS에서 `.subject-name-text::after`와 hover underline pseudo-element를 `content:none`, `display:none`으로 강하게 제거.
  - 6개 페이지의 `footer-menu.js` 버전을 `?v=onepage-capture-2`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `Curriculum_onepage_supabase_test.html` 응답에서 `footer-menu.js?v=onepage-capture-2` 포함 확인.
  - 배포된 `assets/js/footer-menu.js?v=onepage-capture-2` 응답에서 `replaceGradientTextWithSvg`, `data:image/svg+xml`, `subject-name-text::after` 포함 확인.
- GitHub Pages 반영:
  - commit: `36bdeca Render onepage capture title as SVG`
  - `git push origin main` 성공.

### Curriculum_onepage 다운로드 밑줄 잔상 제거 추가 보강

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 보고:
  - 다운로드 버튼을 눌러도 `Curriculum_onepage` PNG에 과목명 밑줄이 여전히 남음.
- 원인:
  - 다운로드 버튼 클릭 직전 마우스가 표 위에 있었던 경우 실제 DOM에 `.row-hover`와 `--underline-width`가 남아 있고, clone CSS만으로는 pseudo-element 밑줄 잔상이 완전히 제거되지 않을 수 있음.
- 변경 파일:
  - `github-pages/assets/js/footer-menu.js`
  - footer-menu를 불러오는 6개 HTML의 cache-bust query 갱신.
- 변경 내용:
  - `clearOnepageHoverState()` 추가:
    - 캡처 직전 실제 DOM에서 `.row-hover`를 제거.
    - `.subject-name-text`의 `--underline-width`를 `0px`로 변경.
    - `textDecoration`, `borderBottom`, `boxShadow`도 캡처 중 제거.
  - `restoreOnepageHoverState()` 추가:
    - 캡처 후 위 변경을 원래 상태로 복구.
  - hover 제거 후 `requestAnimationFrame` 2프레임을 기다린 뒤 html2canvas 실행.
  - clone CSS의 underline pseudo-element 제거를 더 강하게 변경:
    - `opacity:0`, `background:transparent`, `border:0`, `scaleX(0)` 등 추가.
  - 6개 페이지의 `footer-menu.js` 버전을 `?v=onepage-capture-3`로 갱신.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - 배포된 `Curriculum_onepage_supabase_test.html` 응답에서 `footer-menu.js?v=onepage-capture-3` 포함 확인.
  - 배포된 `assets/js/footer-menu.js?v=onepage-capture-3` 응답에서 `clearOnepageHoverState`, `restoreOnepageHoverState`, `scaleX(0)`, `hoverRestore` 포함 확인.
- GitHub Pages 반영:
  - commit: `8e1f2f4 Clear onepage hover state before capture`
  - `git push origin main` 성공.

### 공통 하단 메뉴에 전체 페이지 이미지 다운로드 버튼 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청:
  - 각 페이지별 고정 하단 메뉴의 가장 왼편에 다운로드 캡슐 버튼 추가.
  - 사용자가 제공한 SVG 다운로드 아이콘을 버튼 안에 사용.
  - 클릭 시 현재 페이지를 스크롤 영역까지 포함한 전체 페이지 이미지로 다운로드.
- 변경 파일: `github-pages/assets/js/footer-menu.js`
- 구현:
  - 하단 메뉴 렌더링 시 `renderMenus()`가 가장 먼저 `createDownloadButton()`을 추가하도록 변경.
  - 버튼 클래스: `.comsw-menu-item.comsw-download-item`
  - 사용자가 제공한 SVG path를 inline SVG로 삽입.
  - 버튼에는 접근성 라벨/타이틀 추가.
  - `html2canvas@1.4.1`을 클릭 시점에 CDN에서 동적 로드하도록 `loadHtml2Canvas()` 추가.
  - `document.body`를 대상으로 `documentElement/body`의 `scrollWidth/scrollHeight` 전체 크기를 계산해 PNG로 저장.
  - 폰트와 이미지 로딩을 최대 1.8초까지 기다린 뒤 캡처.
  - 다운로드 버튼 자체는 `data-html2canvas-ignore="true"`로 캡처 이미지에 포함하지 않음.
  - 캡처 중에는 `.is-busy` 상태로 중복 클릭 방지.
- 제한:
  - 외부 이미지/영상이 CORS를 허용하지 않으면 해당 리소스가 캡처에서 빠지거나 브라우저가 이미지 export를 제한할 수 있음.
  - 동영상 프레임 캡처는 브라우저/html2canvas 제약을 받을 수 있음.
- 검증:
  - `git -C github-pages diff --check` 통과.
  - GitHub Pages 배포 응답 확인:
    - `assets/js/footer-menu.js`: HTTP 200.
    - 응답에 `html2canvas@1.4.1`, `comsw-download-item`, 제공 SVG path(`M358.8,272.2`) 포함 확인.
  - CDN 확인:
    - `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js`: HTTP 200.
- GitHub Pages 반영:
  - commit: `b4cf7a7 Add full page image download button`
  - `git push origin main` 성공.
  - GitHub Pages 배포 응답 확인:
    - `Curriculum_full_supabase_test.html`: HTTP 200, 응답에 `ensurePageIndicator` 포함.
    - `seminar.html`: HTTP 200, 응답에 `ensurePageIndicator` 포함.
    - `Curriculum_onepage_supabase_test.html`: HTTP 200 확인.
- GitHub Pages 반영:
  - commit: `45924d3 Restore slide page indicators after rebuild`
  - `git push origin main` 성공.

### `Curriculum_full_supabase_test.html` 커리큘럼 헤더 문구 변경

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청: 커리큘럼 슬라이드 우상단에 표시되는 `CURRICULUM` 문구를 `학과 전체 과목 커리큘럼`으로 변경.
- 변경 파일: `github-pages/Curriculum_full_supabase_test.html`
- 변경 내용:
  - 일반 커리큘럼 슬라이드의 `.fixed-title` 문구 변경.
  - 커리큘럼 데이터 없음 슬라이드의 `.fixed-title` 문구 변경.
  - 강사 커리큘럼 슬라이드에서 쓰는 동일 라벨 변경.
  - `categoryEngMap`의 `커리큘럼` fallback 문구도 동일하게 변경.
- 검증:
  - `git -C github-pages diff --check` 통과.

### footer-menu 다운로드: 팝업 열린 상태에서는 팝업만 캡처 + roadmap 팝업 전체 스크롤 영역 캡처

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 사용자 요청:
  1. `Curriculum_onepage`에서 커리큘럼 팝업이 열려 있을 때 다운로드 버튼을 누르면 페이지가 아니라 **팝업 그 자체**를 이미지로 저장. (기존: 팝업이 visible 클래스 임시 제거되어 결과 이미지에 안 들어감.)
  2. `roadmap`에서 학과 커리큘럼 팝업이 열려 있을 때 다운로드 버튼을 누르면 viewport에 보이는 부분만 잘리지 않고 **스크롤되는 전체 영역**을 한 장 이미지로 저장.
- 기존 동작 (`github-pages/assets/js/footer-menu.js`):
  - 공용 다운로드 버튼 → `downloadFullPage()` → `getCaptureSetup()`에서 `target = document.body`로 페이지 전체를 html2canvas로 캡처.
  - 직전에 `clearOnepageHoverState()`가 `#curriculum-popup.visible`, `#lightbox-overlay.visible` 클래스를 제거 → 팝업이 결과 이미지에 보이지 않음 (이전 작업 `040f60f`에서 팝업 깨짐 방지 목적으로 도입).
  - `roadmap` 팝업의 `.roadmap-curriculum-scroll`이 `max-height: calc(84vh - 182px); overflow-y: auto;`라 viewport에 들어오는 만큼만 캡처되어 잘림.
- 변경 파일: `github-pages/assets/js/footer-menu.js`
- 변경 내용:
  - `getActivePopup()` 헬퍼 추가: `curriculumOnepage`/`roadmap`에서 `#curriculum-popup.visible` 또는 `#lightbox-overlay.visible` 감지. 어두운 overlay가 아니라 안쪽 `.curriculum-popup-panel`(또는 lightbox)을 target으로 골라 외곽 디밍 영역을 결과 이미지에서 자연스럽게 제외.
  - `preparePopupForCapture(info)` 헬퍼 추가: `roadmapPopup`일 때 panel/body/`.roadmap-curriculum-scroll`의 `max-height`/`overflow`를 실제 DOM에서 임시로 풀어 `scrollHeight`가 전체 콘텐츠 높이가 되도록 함. 호출자가 받는 함수로 캡처 후 복원.
  - `getCaptureSetup()`에 popup 분기 삽입: `curriculumFull` 다음, 일반 본문 분기 앞. popup이 열려 있으면 `target = panel`, `width = max(scrollWidth, rect.width)`, `height = max(scrollHeight, rect.height)`, `cleanup`에 prepare 복원 등록.
  - `downloadFullPage()` 수정: `setup.kind === 'curriculumOnepage'`일 때만 `clearOnepageHoverState`를 호출하여 popup 캡처 시에는 popup의 `visible` 클래스 제거 코드가 작동하지 않게 함. popup 캡처면 html2canvas의 `windowWidth/Height`를 `window.innerWidth/Height`로(viewport 그대로) 두어 panel 안의 viewport-relative 레이아웃(`min(1500px, 88vw)` 등)이 깨지지 않게 함.
  - `applyCaptureCloneStyles()`에 popup 캡처 케이스용 onclone 처리 추가: cloned `#curriculum-popup`/`#lightbox-overlay`에 `visible` + opacity/visibility 명시, cloned `.curriculum-popup-panel`의 `transform: none; position: relative;` 정리(html2canvas가 transform된 root element를 잘 못 잡는 이슈 대비). `roadmapPopup`이면 cloned panel/body/scroll의 `max-height/overflow`도 다시 풀어줌.
- 안전성 / 의존성:
  - popup이 닫혀 있으면 `getActivePopup() === null` → 기존 본문 캡처 동작 그대로 유지.
  - `buildImageReplacementMap(setup.target)` / `waitForPageAssets(setup.target)`가 root를 setup.target으로 받으므로 popup 캡처 시 panel 안의 `<img>`만 처리, 페이지 본문 이미지에는 영향 없음.
  - panel의 `box-shadow`는 element box 밖에 그려져 결과 이미지에는 포함되지 않음(필요해지면 추후 padding/wrapper로 처리).
- GitHub Pages 반영:
  - commit: `e6648f6 footer-menu: capture popup when open, expand roadmap popup scroll area`
  - `git push origin main` 성공.
  - 배포 폴링 후 `assets/js/footer-menu.js` 응답에 `getActivePopup` 함수 포함된 것 확인.

## 2026-06-25

### `gpt.md` 작업 기록 파일 GitHub(comsw) 저장소 업로드

- 진행 중 프로젝트(`rladiddus/comsw`) 전체 파일을 검토하기 위해 저장소를 clone해 18개 파일을 모두 읽었다.
- 작업 기록 `gpt.md`를 같은 `comsw` 저장소 루트에 업로드했다.
  - commit: `5d6e895 docs: add gpt.md 작업 기록 (development work log)`
  - `git push origin main` 성공.
- 이후로는 작업 전 읽기 / 작업 후 기록을 모두 이 GitHub 저장소의 `gpt.md` 기준으로 수행한다.

### test용 HTML 파일 `test/` 폴더로 정리

- 작업 전 이 `gpt.md` 파일을 확인했다.
- `*_supabase_test.html` 4개를 `git mv`로 `test/` 폴더로 이동(rename으로 git 이력 보존):
  - `roadmap_supabase_test.html`, `Curriculum_full_supabase_test.html`, `Curriculum_onepage_supabase_test.html`, `item_supabase_test.html`.
- 이동한 파일 내부의 루트 기준 상대경로를 한 단계 위로 보정: `./assets/...` → `../assets/...`, `./index.html` → `../index.html`.
- `test/README.md`를 추가해 보관용 사본임을 설명. footer-menu의 메뉴 이동은 루트 기준(`./`)이라 test 폴더 안에서의 메뉴 이동은 보장하지 않음(보관용)을 명시.
- 운영 영향 점검: 운영 페이지/메인 메뉴 네비게이션은 모두 루트 운영 파일명(`MENU_TO_PAGE`)만 사용하고, `footer-menu.js`의 test 파일명 매핑(`PAGE_TO_MENU`)은 현재 페이지 자기인식용 키일 뿐이라 이동 동작에 영향 없음.
- 반영:
  - commit: `6832627 chore: move supabase test pages into test/ folder`
  - `git push origin main` 성공.

### 배포 전 자동 문법 검사(GitHub Actions) 추가

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 로그에 반복되던 "node 미설치로 구문 검사 못 함" 한계를 해소하기 위해 CI 문법 검사를 추가했다.
- 현재 상태 전수 검증: node로 `assets/js/*.js` 3개 + 모든 `*.html`의 인라인 `<script>`를 검사 → 전부 통과.
- 신규 파일:
  - `scripts/check-syntax.js` — 의존성 없이 Node 내장 모듈만으로 독립 `.js`와 HTML 인라인 스크립트 구문 검사. 오류 시 종료코드 1. 로컬에서도 `node scripts/check-syntax.js`로 실행 가능.
  - `.github/workflows/syntax-check.yml` — `push`/`pull_request`(main) 시 자동 실행.
- 반영:
  - commit: `0245f43 ci: add pre-deploy syntax check (GitHub Actions)`
  - `git push origin main` 성공.

### 보안 점검 (세부는 별도 처리)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- Supabase 공개 접근 범위를 점검했다. 발견된 보안 관련 항목은 사용자와 별도로 다루기로 했고, 이 공개 로그에는 세부 내용을 남기지 않는다(사용자 결정으로 처리 보류).

### `Curriculum_onepage.html` 자격증학과 커리큘럼 미표시 수정 (로드맵 학과 매칭 폴백)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 학과 탭에서 `자격증학과`를 누르면 표가 비어 있음. 다른 학과는 정상.
- 원인: 학과 탭은 `컴수원_전체수업` O열로 만들지만, 탭 클릭 시 과목 목록은 `getCurriculumSimpleByDeptFromSupabase()`가 `로드맵` 시트 A열을 **완전 일치**로 찾는다. `로드맵`에는 `자격증학과` 행이 없고 분야별로 라벨이 나뉘어 있어(사무/디자인/건축·기계) 매칭 실패 → 과목 0개.
- 데이터 수정(사용자): `로드맵` A열의 자격증 분야 라벨에 `자격증`이 모두 포함되도록 정리(`사무자격증`,`디자인자격증`,`건축/기계자격증`)하고 Supabase 재동기화. 라이브 데이터로 반영 확인.
- 코드 수정: `getCurriculumSimpleByDeptFromSupabase()`의 로드맵 매칭을 보강.
  - 완전 일치를 우선 시도(기존 동작 유지, 정상 학과 영향 없음 — 1행만 채택).
  - 완전 일치 행이 없으면 `학과`를 뗀 키워드(예: `자격증`)로 부분 일치 폴백. A열이 키워드를 포함하거나 그 반대인 **모든 행**을 시트 순서대로 수집(여러 학과 라벨 합산). 1글자 키워드는 오매칭 방지로 폴백 제외.
- 검증: 라이브 데이터 시뮬레이션 결과 `자격증학과` → 17개 과목(컴퓨터기초·실무엑셀·ACP/GTQ자격증·라이노1·2 등) 정상 수집. `시각편집학과`(12)·`웹학과`(13)는 완전 일치라 기존과 동일. `node scripts/check-syntax.js` 통과.
- 반영:
  - commit: `46ec894 fix(onepage): roadmap dept match falls back to keyword (자격증학과)`
  - `git push origin main` 성공.
- 후속 후보: `roadmap.html`의 학과 클릭 팝업도 동일하게 로드맵 기반이라 같은 폴백이 필요할 수 있음(미적용 — 사용자가 roadmap은 기존대로 유지 결정).

### `Curriculum_onepage.html` 긴 과목명 자동 글자 크기 축소

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 과목명 첫 열(`grid-template-columns: 165px ...` 고정폭, `word-break: keep-all`, 기본 22px)에서 `전산응용건축제도기능사`처럼 긴 과목명이 열 너비를 넘어 옆 열 흰 배경/166px 세로 구분선에 가려 잘림.
- 수정: `fitSubjectNames()` 추가. `.subject-cell.col-subject` 각 셀의 `.subject-name-text` 자연 너비(`scrollWidth`)를 기준 폰트(22px)에서 측정하고, 셀 폭(`clientWidth - 10`)을 넘으면 `폰트 = floor(22 * 가용폭/자연폭)`로 비례 축소(하한 11px). 텍스트 너비는 폰트 크기에 비례하므로 1패스로 정확히 맞춤. `clientWidth/scrollWidth`는 CSS transform scale에 영향받지 않아 1920 좌표계에서 일관됨.
- 호출 위치: `bindSubjectRows()`(렌더 직후, `updateSubjectUnderlineWidths()` 앞), `document.fonts.ready`(웹폰트 Pretendard 로드 후 재보정), `resize`. 짧은 과목명은 22px 유지.
- 검증: `node scripts/check-syntax.js` 통과. 함수 배선(정의/호출 4지점) 확인.
- 반영:
  - commit: `8ca27ae feat(onepage): auto-shrink long subject names to fit column`
  - `git push origin main` 성공.

### `Curriculum_onepage.html` 학과 전환 시 과목내용 스크롤 맨 위로 리셋

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 과목내용을 스크롤한 상태에서 다른 학과 탭을 누르면 스크롤 위치가 유지되어, 다시 맨 위로 올려야 했음.
- 원인: `selectDept()`가 `#table-body`(스크롤 컨테이너, `.table-body { overflow-y:auto }`)에 로딩 메시지를 넣은 직후, 캐시된 데이터라 같은 태스크에서 곧바로 `renderCurriculum()`이 본문을 채운다. 두 innerHTML 사이에 레이아웃 reflow가 없어 이전 `scrollTop`이 0으로 클램프되지 못하고, 새 긴 콘텐츠에 그대로 유지됨.
- 수정: `renderCurriculum()`에서 표 본문 innerHTML을 채운 직후 `body.scrollTop = 0;` 추가. 학과 전환마다 항상 맨 위에서 시작.
- 검증: `node scripts/check-syntax.js` 통과.
- 반영:
  - commit: `bcc2031 fix(onepage): reset table scroll to top on dept switch`
  - `git push origin main` 성공.

### `roadmap.html` 학과 팝업 표의 긴 과목명 자동 글자 크기 축소

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: roadmap 학과 클릭 팝업(`#curriculum-popup`) 표에서 과목명 첫 열(`grid-template-columns: 145px ...` 고정폭, `.roadmap-curriculum-cell.subject` 16px/800)이 길면(`전산응용건축제도기능사` 등) 잘림. (onepage와 동일 패턴, 팝업 버전.)
- 수정: onepage의 `fitSubjectNames()`와 같은 방식 적용.
  - `renderCurriculumPopup()`에서 과목명을 `<span class="roadmap-subject-name">`(inline-block)로 감쌈.
  - `fitRoadmapSubjectNames()` 추가: `#curriculum-popup-body .roadmap-curriculum-cell.subject`의 span 자연 너비를 16px 기준으로 재고, `cell.clientWidth - 10`을 넘으면 `폰트 = floor(16 * 가용폭/자연폭)`(하한 11px)로 비례 축소.
  - 호출: 팝업 본문 렌더 직후 + `document.fonts.ready` 후 재보정. 팝업은 `openCurriculumPopup()`에서 `visible` 클래스가 렌더보다 먼저 붙어 측정 시 레이아웃이 잡혀 있음.
- 운영 영향: roadmap의 학과 매칭/팝업 데이터 로직은 변경 없음(사용자가 roadmap 데이터 로직은 기존 유지 결정). 표시(폰트 크기)만 보정.
- 검증: `node scripts/check-syntax.js` 통과. 배선(정의/호출/CSS/span) 확인.
- 반영:
  - commit: `d99bc5f feat(roadmap): auto-shrink long subject names in dept popup table`
  - `git push origin main` 성공.

## 2026-07-03

### 태블릿 페이지 신규 구현 (이전 세션에서 완료)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- Method B 방식으로 `_tablet.html` 접미사를 사용한 별도 파일 7개를 생성했다:
  `index_tablet.html`, `roadmap_tablet.html`, `Curriculum_full_tablet.html`,
  `Curriculum_onepage_tablet.html`, `seminar_tablet.html`, `item_tablet.html`, `vacation_tablet.html`
- 태블릿 5가지 요구사항 적용:
  1. 메인 페이지(`index_tablet.html`) 하단 메뉴 상시 노출 — 토글 없이 flat flex row.
  2. 서브 페이지 공통 하단 메뉴 — `footer-menu-tablet.js` 공통 스크립트로 주입. `PAGE_TO_MENU`를 `_tablet.html` URL로 설정, 폴백 `index_tablet.html`.
  3. `Curriculum_full_tablet.html` 슬라이드 클릭/탭으로 다음 슬라이드 이동.
  4. `Curriculum_full_tablet.html` 우측 ↑/↓ 버튼 상시 노출(불투명도 80%) — 위=이전, 아래=다음.
  5. `seminar_tablet.html` 우측 ↑/↓ 버튼 상시 노출(불투명도 80%) — 위=이전, 아래=다음.
- 각 파일의 `goHome()` → `./index_tablet.html` 링크, back-btn/slide-nav 상시 노출 CSS, 마우스 호버 감지 제거, `initHoverDetection()` noop 처리 완료.
- 반영: commit `d05fc48 feat: add tablet HTML pages (_tablet.html)`

### `Curriculum_full_tablet.html` 위 화살표(↑) 이전 페이지 이동 안되는 버그 수정

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 증상: 아래 화살표(↓)로 다음 슬라이드 이동은 잘 되나, 위 화살표(↑)로 이전 슬라이드 이동이 안 됨.
- 원인: 슬라이드 패널(`#slide-panel`)에 추가된 터치탭 이벤트 핸들러(`touchend`)가 버튼 탭 여부를 구분하지 않고 무조건 `goToSlide(currentSlideIndex + 1)`을 실행함. 터치 이벤트 순서는 `touchend` → `click`이므로, ↑ 버튼 탭 시 `touchend`가 먼저 +1, 이후 click이 -1 하여 결과가 0 (원위치). ↓ 버튼은 `touchend` +1, click도 +1로 둘 다 같은 방향이라 "동작한다"처럼 보임.
- 수정: `Curriculum_full_tablet.html`의 `touchend` 핸들러에 `SKIP` 셀렉터 체크 추가. `button`, `a`, `.img-box` 등을 탭한 경우 `goToSlide(+1)` 실행하지 않도록 함.
- 추가 정리: `#slide-nav` CSS를 `position: fixed` → `position: absolute`로 변경 (CSS 명세상 transform이 적용된 부모 안에서 fixed는 absolute와 동일하게 동작하므로 동작에 차이 없으나, 의미상 명확한 absolute로 수정).

### 태블릿 서브 페이지 하단 메뉴 드래그 가능 팝업으로 변경 (`footer-menu-tablet.js`)

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 하단 고정 알약 메뉴(`#comsw-footer-menu` fixed bottom center)를 드래그 가능한 팝업으로 전면 변경.
- DOM 구조:
  ```
  #comsw-footer-popup
  ├─ #comsw-footer-popup-handle  (드래그 핸들 영역)
  │   ├─ #comsw-footer-popup-drag-icon  (3선 아이콘, 드래그 힌트)
  │   ├─ #comsw-footer-popup-title  ("메뉴")
  │   └─ #comsw-footer-popup-toggle  (▲/▼ 접기/펼치기 버튼)
  └─ #comsw-footer-menu  (기존 알약 버튼들, 접히면 display:none)
  ```
- 초기 위치: 우측 하단(`bottom: 24px; right: 24px`).
- 드래그(`initDrag`): mousedown/touchstart → mousemove/touchmove → mouseup/touchend 패턴. 드래그 시작 시 `bottom/right`를 `top/left`로 변환해 절대 좌표로 이동. 뷰포트 경계 클램프 적용. 메뉴 아이템·토글 버튼 탭은 드래그 시작 제외.
- 토글(`initToggle`): ▲/▼ 버튼 클릭 시 `#comsw-footer-popup`에 `.collapsed` 클래스 토글. 접힌 상태에서 `#comsw-footer-menu`는 `display: none`. 핸들의 `border-radius`도 collapsed 시 사방 둥글게 변환.
- 반영:
  - commit: `0746501 fix(tablet): fix up-arrow nav bug and add draggable footer menu popup`
  - `git push origin main` 성공.

## 2026-07-06

### `index_tablet.html` 배경 영상 → Drive 폴더 이미지 교체

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 `index_tablet.html`은 Supabase "메인 페이지" 시트에서 미디어(주로 영상)를 불러와 배경에 표시했다.
- 태블릿용으로는 영상 대신 지정된 Google Drive 폴더 이미지 3장을 배경으로 고정 사용하도록 변경.
- Drive 폴더: `1zEHJHjbSFoo4qSN_jWGPDLVe5rw_VsMu`
  - pexels-diva-34787933.jpg → `1tEaMmqNSpCQEBau_K0QeHp4Emcp1RgyC`
  - pexels-diva-34787935.jpg → `1c8PeBprYCJUka6DWQ1SRF4tUY7UbxmI0`
  - pexels-steve-13659333.jpg → `1d3rV1XPZxZUENI4OkJ2cu1jAv_lcNPwD`
- 이미지 URL: `https://lh3.googleusercontent.com/d/FILE_ID=w1920` (공개 공유 파일 형식)
- 구현:
  - `getCheckedMediaFromSupabase()` 호출 제거, 대신 3장 이미지 배열을 `type: 'image'`로 `onMediaLoaded()`에 직접 전달.
  - 로드 시 `Math.random()`으로 순서 섞기 → 매번 다른 이미지부터 시작.
  - 기존 이미지 슬라이드쇼 로직(`renderMedia`, `scheduleNext`, `goNext`)은 그대로 재사용.
  - 터치 스와이프로 이미지 전환 유지.
- Supabase 메뉴 로드(`getMenuListFromSupabase`)는 그대로 유지 — 메뉴 항목은 여전히 시트에서 동적으로 가져옴.

### `index_tablet.html` 하단 메뉴 드래그 가능 팝업으로 변경

- 작업 전 이 `gpt.md` 파일을 확인했다.
- 기존 `#menu-area` (하단 고정 flat flex row)를 서브 페이지와 동일한 드래그 팝업 형태로 교체.
- DOM 구조 (`footer-menu-tablet.js`와 동일):
  ```
  #comsw-footer-popup
  ├─ #comsw-footer-popup-handle
  │   ├─ #comsw-footer-popup-drag-icon
  │   ├─ #comsw-footer-popup-title  ("메뉴")
  │   └─ #comsw-footer-popup-toggle  (▲/▼)
  └─ #comsw-footer-menu  (메뉴 아이템들)
  ```
- 팝업 내 항목:
  1. **이미지 저장 버튼** (`createDownloadMenuItem`) — 현재 배경 이미지를 `fetch` + blob으로 다운로드 시도. CORS 실패 시 새 탭에서 열기 폴백.
  2. Supabase에서 로드된 메뉴 항목들 (전체 수업, 학과별 자료, 방학 특강, 학과 커리큘럼, 특강/세미나, 수업별 준비물 등)
- 이미지 저장 버튼은 `window.onload` 직후 즉시 추가 (Supabase 로드 성공/실패 무관하게 항상 표시).
- `initDrag(popup)` / `initToggle(popup)` 함수 인라인 추가 (`footer-menu-tablet.js`와 동일 로직).
- 초기 위치: 우측 하단 (`bottom: 24px; right: 24px`).
- 반영:
  - commit: `(이번 세션)`
  - `git push origin main` 예정.
