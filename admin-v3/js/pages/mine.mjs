import { el, chip, hint } from "../../../admin-v2/js/ui.mjs";
import { CAT } from "../v3.mjs";
import { render as v2 } from "../../../admin-v2/js/pages/classes.mjs";

// 내 커리큘럼(V3 시안 '내 수업·제출'): 제출은 기존 화면 그대로(실제 저장). 4분류 직접 입력은 DB 추가 후라 안내만.
export async function render(container, ctx) {
  container.append(el("div", { className: "v3-callout" }, [chip("9D", "vacation"),
    document.createTextNode(` 앞으로 재료는 ${Object.values(CAT).join(" / ")} 중 하나를 직접 골라 적습니다. 지금은 아래 '사용 프로그램'과 '준비물' 칸에 적어 주세요. 학과장이 확인한 뒤 공개됩니다.`)]));
  await v2(container, ctx);
  container.append(hint("정규와 방특은 이름이 같아도 다른 과목입니다. 방특 수업은 방특으로 표시해 제출합니다."));
}
