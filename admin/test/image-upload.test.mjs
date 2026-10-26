import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountImageUpload, validateImage } from "../js/image-upload.mjs";
const dom = new JSDOM("<body></body>");
globalThis.document = dom.window.document;
const flush = () => new Promise((r) => setTimeout(r, 10));
test("이미지 형식과 10MB 제한", () => {
  assert.throws(() => validateImage({ type: "text/html", size: 100 }), /PNG/);
  assert.throws(
    () => validateImage({ type: "image/png", size: 11 * 1024 * 1024 }),
    /10MB/,
  );
  assert.doesNotThrow(() => validateImage({ type: "image/png", size: 500 }));
});
test("드롭 업로드는 서버 결과를 전달하고 실패 시 저장됐다고 표시하지 않음", async () => {
  const c = document.createElement("div");
  let saved;
  const { box } = mountImageUpload(c, {
    upload: async () => ({
      id: "asset",
      url: "https://drive.google.com/file/d/test/view",
    }),
    onUploaded: (a) => {
      saved = a;
    },
  });
  const e = new dom.window.Event("drop", { cancelable: true });
  e.dataTransfer = { files: [{ type: "image/png", size: 50 }] };
  box.dispatchEvent(e);
  await flush();
  assert.equal(saved.id, "asset");
  assert.match(c.textContent, /이미지를 올렸습니다/);
  const failed = document.createElement("div");
  const bad = mountImageUpload(failed, {
    upload: async () => {
      throw new Error("연결 만료");
    },
  });
  const e2 = new dom.window.Event("drop");
  e2.dataTransfer = e.dataTransfer;
  bad.box.dispatchEvent(e2);
  await flush();
  assert.match(failed.textContent, /연결 만료/);
  assert.doesNotMatch(failed.textContent, /이미지를 올렸습니다/);
});

test("커리큘럼은 썸네일 영역을 고르면 원본을 올리고 주소 뒤에 영역을 붙이며, 취소 시 업로드하지 않음", async () => {
  const c = document.createElement("div");
  const input = { type: "image/png", size: 50 };
  let sent, uploaded;
  const { box } = mountImageUpload(c, {
    kind: "curriculum",
    crop: async (file) => {
      assert.equal(file, input);
      return "#crop=0.1,0,0.5,1";
    },
    upload: async (file) => {
      sent = file;
      return { url: "https://image" };
    },
    onUploaded: (asset) => { uploaded = asset.url; },
  });
  const event = new dom.window.Event("drop");
  event.dataTransfer = { files: [input] };
  box.dispatchEvent(event);
  await flush();
  assert.equal(sent, input, "원본 그대로");
  assert.equal(uploaded, "https://image#crop=0.1,0,0.5,1");
  sent = null;
  const cancelled = mountImageUpload(document.createElement("div"), {
    kind: "curriculum",
    crop: async () => null,
    upload: async (file) => {
      sent = file;
    },
  });
  const cancelEvent = new dom.window.Event("drop");
  cancelEvent.dataTransfer = event.dataTransfer;
  cancelled.box.dispatchEvent(cancelEvent);
  await flush();
  assert.equal(sent, null);
});
