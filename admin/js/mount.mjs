let generation = 0;

// 페이지마다 새 상자를 만들어 넘긴다. 늦게 끝난 이전 페이지는 떼어진 상자에 붙으므로 화면에 섞이지 않는다.
export async function mountPage(content, loadModule, ctx) {
  const mine = ++generation;
  const box = document.createElement("div");
  content.replaceChildren(box);
  const mod = await loadModule();
  if (mine !== generation) return;
  await mod.render(box, ctx);
}

export function clearApp(containers, texts) {
  generation++;
  for (const c of containers) c.replaceChildren();
  for (const t of texts) t.textContent = "";
}
