// '+ 개월 추가': 여러 달 과정은 과목을 달마다 따로 둔다(웹툰1, 웹툰2 …, 각 과목 안에 단계).
// 다음 달 이름 = 끝 숫자를 뺀 이름 + (이미 쓰는 번호 중 가장 큰 번호 + 1, 최소 2). 띄어쓰기 모양(예: 'C언어 1')은 따른다.
export function nextMonthName(name, names) {
  const m = name.match(/^(.*?)(\s*)(\d+)$/);
  const base = m ? m[1] : name;
  const sep = m ? m[2] : "";
  const numberOf = (n) => {
    const x = n.match(/^(.*?)\s*(\d+)$/);
    return x && x[1] === base ? Number(x[2]) : 0;
  };
  return `${base}${sep}${Math.max(1, ...names.map(numberOf)) + 1}`;
}
