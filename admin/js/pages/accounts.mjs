import { el, instructorHints, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";

// 쌤톡 교육부 회원과 강사 정보를 나란히 보고 바로 연결한다.
// 연결된 선생님은 연결 요청 없이 '내 커리큘럼'·'내 프로필'에서 본인 강사 정보를 쓴다.
export async function render(container, { supabase, loadMembers }) {
  loadMembers ??= (await import("../ssamtalk-members.mjs")).loadTeacherMembers;
  container.append(
    el("h2", { textContent: "계정 연결" }),
    el("p", {
      className: "desc",
      textContent:
        "쌤톡 교육부 회원마다 해당하는 강사를 고르면 바로 연결됩니다. ★는 이름이 같은 강사입니다. 연결된 선생님은 연결 요청 없이 '내 커리큘럼'·'내 프로필'을 씁니다.",
    }),
  );
  const setState = stateLine(container);
  const table = el("table", { className: "editor" });
  container.append(table);
  let members, instructors, requests, hintOf;
  try {
    [members, instructors, requests, hintOf] = await Promise.all([
      loadMembers(),
      rows(supabase, "instructors"),
      rows(supabase, "instructor_link_requests"),
      instructorHints(supabase),
    ]);
  } catch (e) {
    setState(`목록을 불러오지 못했습니다: ${e.message}`, true);
    return;
  }
  const key = (s) => String(s ?? "").replace(/\s+/g, "");
  const linkedTo = (uid) => instructors.find((i) => i.account_uid === uid);
  const nameOf = (id) => instructors.find((i) => i.id === id)?.name ?? "강사";

  async function link(uid, instructorId) {
    const check = ({ error }) => {
      if (error) {
        throw new Error(dbErrorMessage(error, {
          duplicate: "이미 다른 계정에 연결된 강사입니다",
        }));
      }
    };
    // ponytail: 해제 → 연결 두 번 저장. 연결이 실패하면 해제된 채로 남고 화면에 오류가 보인다.
    const prev = linkedTo(uid);
    if (prev) {
      check(await supabase.from("instructors").update({ account_uid: null }).eq("id", prev.id));
      prev.account_uid = null;
    }
    if (!instructorId) return;
    check(await supabase.from("instructors").update({ account_uid: uid }).eq("id", instructorId));
    instructors.find((i) => i.id === instructorId).account_uid = uid;
    check(await supabase.from("instructor_link_requests").delete().eq("account_uid", uid));
    requests = requests.filter((r) => r.account_uid !== uid);
  }

  function row(m) {
    const current = linkedTo(m.uid);
    const request = requests.find((r) => r.account_uid === m.uid);
    const same = (i) => key(i.name) === key(m.name);
    const taken = (i) => i.account_uid && i.account_uid !== m.uid;
    const options = [...instructors]
      .sort((a, b) => Number(same(b)) - Number(same(a)) || a.name.localeCompare(b.name))
      .map((i) =>
        el("option", {
          value: i.id,
          disabled: Boolean(taken(i)),
          textContent: `${same(i) ? "★ " : ""}${i.name} · ${hintOf(i.id)}${
            taken(i) ? " (다른 계정에 연결됨)" : ""
          }`,
        })
      );
    const select = el("select", {}, [
      el("option", { value: "", textContent: "연결 안 함" }),
      ...options,
    ]);
    select.value = current?.id ?? "";
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        await link(m.uid, select.value || null);
        setState(select.value ? `${m.name} 님을 ${nameOf(select.value)} 강사에 연결했습니다` : `${m.name} 님의 연결을 풀었습니다`);
      } catch (e) {
        setState(e.message, true);
      } finally {
        draw();
      }
    });
    return el("tr", {}, [
      el("td", { textContent: m.name }),
      el("td", { textContent: m.username }),
      el("td", { textContent: m.majors.join(", ") }),
      el("td", {}, [select]),
      el("td", {
        textContent: current
          ? "연결됨"
          : request
          ? `연결 요청: ${nameOf(request.instructor_id)}`
          : "",
      }),
    ]);
  }

  function draw() {
    // 아직 연결 안 된 회원을 위로.
    const sorted = [...members].sort((a, b) =>
      Number(Boolean(linkedTo(a.uid))) - Number(Boolean(linkedTo(b.uid))) ||
      a.name.localeCompare(b.name)
    );
    table.replaceChildren(
      el("thead", {}, [
        el("tr", {}, ["쌤톡 회원", "아이디", "쌤톡 학과", "연결할 강사", "상태"]
          .map((t) => el("th", { textContent: t }))),
      ]),
      el("tbody", {}, sorted.map(row)),
    );
    if (!members.length) setState("쌤톡 교육부 승인 회원이 없습니다.");
  }
  draw();
}
