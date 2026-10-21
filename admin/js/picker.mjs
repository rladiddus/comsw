// 목록 위의 선택 상자 하나. 처음 값으로 바로 onChange를 부른다.
export function mountPicker(container, { label, options, onChange }) {
  const select = document.createElement("select");
  select.append(...options.map(o => Object.assign(document.createElement("option"), { value: o.value, textContent: o.label })));
  const wrap = document.createElement("div");
  wrap.className = "picker";
  wrap.append(Object.assign(document.createElement("label"), { textContent: label }), select);
  container.append(wrap);
  select.addEventListener("change", () => onChange(select.value));
  if (options.length) onChange(select.value);
  return { value: () => select.value };
}
