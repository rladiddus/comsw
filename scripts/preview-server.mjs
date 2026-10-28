import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const target = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (
      (target !== root && !target.startsWith(root + path.sep)) || url.pathname.split("/").some((p) =>
        p.startsWith(".")
      ) || url.pathname.includes("node_modules")
    ) throw Error();
    const file = (await stat(target)).isDirectory()
      ? path.join(target, "index.html")
      : target;
    if (!mime[path.extname(file)]) throw Error();
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)],
      "Cache-Control": "no-store",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(
  8787,
  "127.0.0.1",
  () => console.log([
    "관리 화면(운영 DB 연결 — 고치면 실제 데이터가 바뀜): http://localhost:8787/admin/",
    "공개 사이트: http://localhost:8787/",
    "예시 데이터 미리보기: http://localhost:8787/test/admin-preview.html",
    "끄려면 이 창을 닫으세요.",
  ].join("\n")),
);
