import { importFromSheets, fetchRawRows } from "../import-flow.mjs";

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

export function render(container, { supabase }) {
  const button = el("button", { type: "button", className: "publish-btn", textContent: "시트에서 가져오기" });
  const status = el("p", { className: "save-state" });
  const result = el("ul");
  container.append(
    el("h2", { textContent: "시트에서 가져오기" }),
    el("p", { className: "desc", textContent: "구글시트(마지막 동기화된 내용)로 관리 플랫폼 데이터를 모두 바꿉니다. 관리 화면에서 고친 내용과 사이트에서 받은 특강 신청은 사라집니다. 사이트 전환 전에만 쓰세요." }),
    button, status, result,
  );

  button.addEventListener("click", async () => {
    if (!confirm("관리 플랫폼 데이터를 모두 시트 내용으로 바꿀까요? 되돌릴 수 없습니다.")) return;
    button.disabled = true;
    status.classList.remove("err");
    status.textContent = "가져오는 중… (1분 정도 걸릴 수 있습니다)";
    result.replaceChildren();
    try {
      const { counts, warnings } = await importFromSheets({
        fetchRaw: () => fetchRawRows(window.COMSW_SUPABASE_CONFIG), supabase,
      });
      status.textContent = "가져왔습니다. 이제 '적용'을 눌러야 사이트에 반영됩니다.";
      result.append(
        ...Object.entries(counts).map(([t, n]) => el("li", { textContent: `${t}: ${n}` })),
        ...warnings.map(w => el("li", { className: "err", textContent: `확인 필요: ${w}` })),
      );
    } catch (err) {
      status.textContent = `가져오지 못했습니다: ${err.message}`;
      status.classList.add("err");
    } finally {
      button.disabled = false;
    }
  });
}
