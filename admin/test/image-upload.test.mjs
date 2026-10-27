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

test("올리기 전에 브라우저에서 줄이고 WebP로: 커리큘럼은 긴 변 2560px, 일반 이미지는 1920px, 원본 이름은 .webp로", async () => {
  const { shrinkImage } = await import("../js/image-upload.mjs");
  const drawn = [];
  globalThis.createImageBitmap = async (f) => ({ width: f.w, height: f.h, close() {} });
  const real = document.createElement.bind(document);
  document.createElement = (tag) => {
    if (tag !== "canvas") return real(tag);
    const c = { getContext: () => ({ drawImage: (_b, _x, _y, w, h) => drawn.push([w, h]) }),
      toBlob: (done, type) => done(new Blob(["x"], { type })) };
    return c;
  };
  try {
    const photo = Object.assign(new File(["y".repeat(100)], "사진.JPG", { type: "image/jpeg" }), { w: 3024, h: 4032 });
    const out = await shrinkImage(photo, "curriculum");
    assert.deepEqual(drawn.at(-1), [1920, 2560]);
    assert.equal(out.type, "image/webp");
    assert.equal(out.name, "사진.webp");
    await shrinkImage(photo, "image");
    assert.deepEqual(drawn.at(-1), [1440, 1920]);
    assert.equal(await shrinkImage(photo, "profile-source"), photo, "본인 사진(AI 원본)은 그대로");
    const smallWebp = Object.assign(new File(["z"], "a.webp", { type: "image/webp" }), { w: 800, h: 600 });
    assert.equal(await shrinkImage(smallWebp, "curriculum"), smallWebp, "작은 WebP는 그대로");
    delete globalThis.createImageBitmap;
    assert.equal(await shrinkImage(photo, "curriculum"), photo, "브라우저가 못 하면 원본");
  } finally {
    document.createElement = real;
    delete globalThis.createImageBitmap;
  }
});
