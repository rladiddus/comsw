import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";
import { mountInstructorReview } from "../js/instructor-review.mjs";
import { configureServices } from "../js/services.mjs";
const dom = new JSDOM("<body></body>");
globalThis.document = dom.window.document;
globalThis.confirm = () => true;
test("프로필 승인 뒤 대기 카드가 사라지고 적용 안내를 남긴다", async () => {
  const tables = {
    instructors: [{ id: "i", name: "선생님" }],
    instructor_link_requests: [],
    instructor_profile_drafts: [{
      instructor_id: "i",
      name: "선생님",
      career: "5년",
      message: "안녕하세요",
      status: "pending",
      updated_at: "2026-10-21T00:00:00Z",
    }],
  };
  const sb = fakeSupabase(tables);
  let received;
  sb.rpc = async (name, args) => {
    received = [name, args];
    tables.instructor_profile_drafts[0].status = "approved";
    return { error: null };
  };
  const c = document.createElement("div");
  await mountInstructorReview(c, sb);
  [...c.querySelectorAll("button")].find((b) => b.textContent === "프로필 승인")
    .click();
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(received[1].p_updated_at, "2026-10-21T00:00:00Z");
  assert.doesNotMatch(c.textContent, /프로필 승인 대기 ·/);
  assert.match(c.textContent, /적용.*공개 사이트/);
});

test("학과장은 전달받은 동의된 사진으로 프로필 생성 후 확인·승인", async () => {
  const tables = {
    instructors: [{ id: "i", name: "선생님" }],
    instructor_link_requests: [],
    instructor_profile_drafts: [{
      instructor_id: "i",
      name: "선생님",
      career: "5년",
      message: "안녕하세요",
      source_asset_id: "photo",
      source_consent: true,
      status: "pending",
    }],
  };
  let generated;
  configureServices({
    generateProfile: async (id) => {
      generated = id;
      tables.instructor_profile_drafts[0].photo_url =
        "https://image.example/profile.png";
    },
  });
  try {
    const c = document.createElement("div");
    await mountInstructorReview(c, fakeSupabase(tables));
    [...c.querySelectorAll("button")].find((b) =>
      b.textContent === "AI 프로필 만들기"
    ).click();
    for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(generated, "i");
    assert.match(c.textContent, /결과를 확인한 뒤 승인/);
    assert.equal(
      c.querySelector("img").src,
      "https://image.example/profile.png",
    );
  } finally {
    configureServices();
  }
});
