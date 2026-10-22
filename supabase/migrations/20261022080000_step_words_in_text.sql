-- 사용자 요청(2026-10-22): 강사 커리큘럼 내용 글 안의 'N주차'도 'N단계'로 바꾼다(프로그래밍학과 80줄).
-- 바꾸기 전 글은 저장소 밖 research 폴더에 백업했다.
update public.instructor_curricula
  set written = regexp_replace(written, '(\d+)\s*주차', '\1단계', 'g'),
      summary = regexp_replace(summary, '(\d+)\s*주차', '\1단계', 'g')
  where written ~ '\d\s*주차' or summary ~ '\d\s*주차';
