import { dbErrorMessage } from "./fields.mjs";

export const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
export function field(form, label, name, type = "text", value = "") {
  const input = type === "textarea"
    ? el("textarea", { name, value, rows: 5 })
    : el("input", { name, type, value });
  const wrap = el("label", { className: "form-field" }, [
    el("span", { textContent: label }),
    input,
  ]);
  form.append(wrap);
  return input;
}
export function stateLine(container) {
  const node = el("p", { className: "save-state" });
  node.setAttribute("role", "status");
  container.append(node);
  return (text, error = false) => {
    node.textContent = text;
    node.classList.toggle("err", error);
  };
}
export async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(dbErrorMessage(error));
  return data;
}
export async function rows(supabase, table, filter = (q) => q) {
  const { data, error } = await filter(supabase.from(table).select("*"));
  if (error) throw new Error(dbErrorMessage(error));
  return data || [];
}

// 같은 이름 강사 구분: "시각편집학과, AI학과 · 포토샵, 일러스트, 포토웍스 외 8개"
export function instructorHint({ departments = [], subjects = [] }) {
  const more = subjects.length > 3 ? ` 외 ${subjects.length - 3}개` : "";
  return [
    departments.join(", "),
    subjects.length ? subjects.slice(0, 3).join(", ") + more : "",
  ].filter(Boolean).join(" · ") || "학과·과목 정보 없음";
}

// 기존 강사 계정은 자동 연결하지 않는다. 후보는 이름과 공개 정보(학과·담당 과목)만 RPC로 조회한다.
export async function requireInstructor(
  container,
  { supabase, uid, displayName = "" },
  reload,
) {
  const own =
    (await rows(supabase, "instructors", (q) => q.eq("account_uid", uid)))[0];
  if (own) return own;
  // 관리자가 강사 정보에 이 계정의 쌤톡 이메일을 적어 두었으면 요청·승인 없이 바로 연결된다.
  try {
    if (await rpc(supabase, "comsw_claim_my_instructor")) {
      const claimed = (await rows(
        supabase,
        "instructors",
        (q) => q.eq("account_uid", uid),
      ))[0];
      if (claimed) return claimed;
    }
  } catch {
    // 자동 연결이 안 되면 아래의 연결 요청 화면을 그대로 쓴다.
  }
  const panel = el("section", { className: "workspace-card" });
  panel.append(
    el("h3", { textContent: "강사 정보 연결" }),
    el("p", {
      className: "desc",
      textContent:
        "처음 방문하셨네요. 이름으로 기존 강사 정보를 확인하거나 새 강사로 시작해주세요.",
    }),
  );
  const name = field(panel, "이름", "instructor_name", "text", displayName);
  name.maxLength = 80;
  const candidates = el("div", { className: "candidate-list" });
  const actions = el("div", { className: "form-actions" });
  const setState = stateLine(panel);
  const check = el("button", {
    type: "button",
    className: "ghost-btn",
    textContent: "기존 강사 찾기",
  });
  const create = el("button", {
    type: "button",
    className: "publish-btn",
    textContent: "새 강사로 시작",
  });
  const requests = await rows(
    supabase,
    "instructor_link_requests",
    (q) => q.eq("account_uid", uid),
  );
  if (requests.length) {
    setState(
      "계정 연결을 요청했습니다. 관리자·학과장 확인 후 이 화면을 새로 열어주세요.",
    );
    const cancel = el("button", {
      type: "button",
      className: "ghost-btn",
      textContent: "연결 요청 취소",
    });
    cancel.addEventListener("click", async () => {
      cancel.disabled = true;
      try {
        const { error } = await supabase.from("instructor_link_requests")
          .delete().eq("account_uid", uid);
        if (error) throw new Error(dbErrorMessage(error));
        await reload();
      } catch (e) {
        setState(e.message, true);
        cancel.disabled = false;
      }
    });
    panel.append(cancel);
    container.append(panel);
    return null;
  }
  async function run(button, fn) {
    button.disabled = true;
    try {
      if (!name.value.trim()) throw new Error("이름을 입력해주세요");
      await fn();
    } catch (e) {
      setState(e.message, true);
    } finally {
      button.disabled = false;
    }
  }
  check.addEventListener("click", () =>
    run(check, async () => {
      const result = await rpc(supabase, "comsw_instructor_candidates", {
        p_name: name.value.trim(),
      });
      candidates.replaceChildren(...result.map((i) => {
        const b = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: `${i.name} · ${instructorHint(i)} · 연결 요청`,
        });
        b.addEventListener("click", () =>
          run(b, async () => {
            await rpc(supabase, "comsw_request_instructor_link", {
              p_instructor_id: i.id,
              p_name: name.value.trim(),
            });
            await reload();
          }));
        return b;
      }));
      setState(
        result.length
          ? "본인 정보를 선택하면 관리자·학과장이 확인합니다."
          : "같은 이름의 미연결 강사가 없습니다. 새 강사로 시작할 수 있습니다.",
      );
    }));
  create.addEventListener("click", () =>
    run(create, async () => {
      if (
        !confirm(
          "기존 강사인 경우 먼저 이름으로 찾아주세요. 새 강사 정보를 만들까요?",
        )
      ) return;
      await rpc(supabase, "comsw_create_my_instructor", {
        p_name: name.value.trim(),
      });
      await reload();
    }));
  actions.append(check, create);
  panel.append(actions, candidates);
  container.append(panel);
  return null;
}
