const SEOUL = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatSeoul(iso) {
  const p = Object.fromEntries(SEOUL.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function formatPublished(row) {
  return row ? `${formatSeoul(row.created_at)} 적용` : "아직 적용한 적 없음";
}

export function deleteSeminarMessage(title, applicantCount) {
  return applicantCount
    ? `'${title}' 특강을 삭제하면 신청자 ${applicantCount}명의 명단도 함께 삭제됩니다. 삭제할까요?`
    : `'${title}' 특강을 삭제할까요?`;
}
