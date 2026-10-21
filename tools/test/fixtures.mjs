// 실제 시트 모양을 흉내 낸 작은 가짜 행 (실데이터 아님).
export function r(source_id, sheet_name, row_number, values, headers) {
  return { source_id, sheet_name, row_number, data: headers ? { values, headers } : { values } };
}

const M = (n, v) => r("main", "컴수원_전체수업", n, v);
// 전체수업 한 행: 주차 칸(B~L)과 옆 표(O,P,Q,R,U,W,X)를 같은 행에 채운다.
function weekRow(n, week, side = {}) {
  const v = Array(24).fill("");
  if (week) [v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[9], v[10], v[11]] = week;
  if (side.O !== undefined) { v[14] = side.O; v[15] = side.P ?? ""; v[16] = side.Q ?? false; v[17] = side.R ?? ""; v[20] = side.U ?? ""; }
  if (side.W !== undefined) { v[22] = side.W; v[23] = side.X ?? false; }
  return M(n, v);
}

export const SAMPLE_ROWS = [
  weekRow(2, ["시각편집, 웹", "포토샵", "1주차", "작성1", "요약1", "1개월", "img1", "01 기초", "Photoshop", "★★"],
    { O: "시각편집학과", P: "p-sigak", Q: true, R: "시각 설명", U: "VISUAL EDITING", W: "커리큘럼", X: true }),
  weekRow(3, ["시각편집, 웹", "포토샵", "2주차", "작성2", "요약2", "1개월", "img2", "01 기초", "Photoshop", "★★"],
    { O: "웹학과", P: "p-web", Q: true, R: "웹 설명", U: "WEB", W: "수강후기", X: false }),
  weekRow(4, ["마야/CG", "마야", "1주차", "작성3", "요약3", "2개월", "img3", "01 모델링", "Maya", "★★★"],
    { O: "CG학과", Q: true, U: "CG" }),
  weekRow(5, null, { O: "0", Q: false }),

  r("main", "로드맵", 2, ["웹학과", "포토샵, 마야", "웹1"]),
  r("main", "로드맵", 3, ["웹학과", "원문1", "원문2"]),
  r("main", "로드맵", 4, ["웹학과", "요약1", "요약2"]),
  r("main", "로드맵", 5, ["사무 자격증", "컴퓨터 기초"]),
  r("main", "로드맵", 6, ["사무 자격증", "원문3"]),
  r("main", "로드맵", 7, ["사무 자격증", "요약3"]),

  r("main", "수업별 준비물(AI/교재 등)", 2, ["포토샵", "교재명", "멘토 포토샵", "https://book", "img-book", "28,000원"]),
  r("main", "수업별 준비물(AI/교재 등)", 3, ["", "", "멘토 포토샵 2", "", "", ""]),
  r("main", "수업별 준비물(AI/교재 등)", 4, ["캐드", "AI 툴", "ChatGPT, Claude", "", "", "설명"]),
  r("main", "수업별 준비물(AI/교재 등)", 5, ["캐드", "기타", "무시"]),

  r("main", "강사페이지", 2, ["김민주", "시각편집학과", "포토샵, 일러스트", "경력1", "한마디1", "photo1", "", "여자"]),
  r("main", "강사페이지", 3, ["김민주", "웹학과", "웹1", "경력2", "한마디2", "photo2", "", "여자"]),

  r("main", "특강 및 세미나", 2, ["poster", "AI 특강", "소주제", "2026년 8월 18일 14:00-16:00", "홍강사", "F강의장", "25", "2"]),
  r("main", "특강 신청", 2, ["AI 특강", "홍길동", "010-1111-2222"]),
  r("main", "특강 신청자 명단", 2, ["AI 특강", "홍길동", "010-1111-2222"]),
  r("main", "특강 신청자 명단", 3, ["AI 특강", "김철수", "010-3333-4444"]),

  r("main", "메인 페이지", 2, ["video.mp4", "캡션", true, "", "전체 수업", true, "왼쪽", 1, "", "logo-url"]),
  r("main", "메인 페이지", 3, ["", "", false, "", "학과별 자료", true, "", ""]),
  r("main", "메인 페이지", 4, ["", "", "", "", "방학 특강", true, "왼쪽", 3, "2026년 여름방학특강", "vac-bg"]),

  r("main", "로딩 중", 2, ["loading-img", "For Masterpieces", false, "Great Vibes", "1.25rem", ""]),

  r("instructor_curriculum", "전체학과별 과목", 2, ["fid-sigak", "fid-web"], ["시각편집학과", "웹학과"]),
  r("instructor_curriculum", "웹학과", 2, ["김민주", "웹1", "1주차", "작성w1", "정리w1", "media-w1"]),
  r("instructor_curriculum", "웹학과", 3, ["", "", "2주차", "작성w2", "정리w2", "media-w2"]),
  r("instructor_curriculum", "웹학과", 4, ["조해리", "웹1", "1주차", "작성j1", "정리j1", "media-j1"]),
  r("instructor_curriculum", "2026년 여름방학특강", 2, ["이혜민", "포토샵1", "1단계", "작성v", "정리v", "media-v", "교재", "멘토 포토샵", "2시간 X 10일"]),

  r("recruitment", "웹학과", 2, ["회사", "웹디자이너", "서울", "정규직", "HTML", "웹 디자인", "회사내규", "사람인", "25.3.14", "02-000", "경력 무관", "", "https://job", "25.03.14"]),
];

// 스냅샷에서 메뉴 행 순서: 방학 특강 행은 로고(1행 J)와 겹치지 않게 맨 뒤, 나머지는 순서(H) 순.
export const FIXTURE_MENU_NAMES_IN_ORDER = ["전체 수업", "학과별 자료", "방학 특강"];
