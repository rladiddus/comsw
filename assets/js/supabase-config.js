(function() {
  window.COMSW_SUPABASE_CONFIG = {
    url: 'https://bpdxbqsvkvvybrtgvrnf.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZHhicXN2a3Z2eWJydGd2cm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzYxOTgsImV4cCI6MjA5NjY1MjE5OH0.AL1W970ZqrkVMAg8ij1XJMrT91Y1AntsI7phmcSYHzg',
    rawTable: 'raw_sheet_rows',
    // Apps Script Web App 발행 URL (.../exec).
    // seminar.html이 doPost 경유로 신청 데이터를 시트에 추가할 때 사용.
    appsScriptApplyUrl: 'https://script.google.com/macros/s/AKfycbzqjt_Fo7Tii8Eimyz_x30L7PzaA4NGMukk47vDEqtjGSGqUH3E1taPZj1OCTJNs2tH/exec',
    sources: {
      main: 'main',
      recruitment: 'recruitment',
      instructorCurriculum: 'instructor_curriculum'
    },
    sheets: {
      curriculum: '컴수원_전체수업',
      roadmap: '로드맵',
      main: '메인 페이지',
      instructor: '강사페이지',
      coursePrep: [
        '수업별 준비물(AI/교재 등)',
        '수업별 준비몰(AI/교재 등)'
      ]
    },
    externalSheetsTodo: {
      recruitmentSpreadsheetId: '1nADj2xWBQDOXS0vxd-1RWIG4LaselTP2EXImrIns6D0',
      instructorCurriculumSpreadsheetId: '1iHwbOB4Uyx7jbr2VnS7-pojy3UHd20hUIcuKisFR8xM'
    }
  };
})();
