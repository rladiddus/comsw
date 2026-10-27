const SEOUL = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatSeoul(iso) {
  const p = Object.fromEntries(SEOUL.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function formatPublished(row) {
  return row ? `${formatSeoul(row.created_at)} 사이트에 반영` : "아직 사이트에 반영한 적 없음";
}

export function deleteSeminarMessage(title, applicantCount) {
  return applicantCount
    ? `'${title}' 특강을 삭제하면 신청자 ${applicantCount}명의 명단도 함께 삭제됩니다. 삭제할까요?`
    : `'${title}' 특강을 삭제할까요?`;
}

export function cascadeMessage(kind, name, parts) {
  const listed = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${n}개`);
  return listed.length
    ? `'${name}' ${kind}을(를) 삭제하면 ${listed.join(", ")}도 함께 삭제됩니다. 삭제할까요?`
    : `'${name}' ${kind}을(를) 삭제할까요?`;
}
