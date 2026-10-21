export function render(container, { label, id }) {
  const h2 = document.createElement("h2");
  h2.textContent = label;
  const p = document.createElement("p");
  p.className = "desc";
  p.textContent = id === "mine" ? "3-3단계에서 열립니다." : "이 화면은 다음 단계에서 열립니다.";
  container.replaceChildren(h2, p);
}
