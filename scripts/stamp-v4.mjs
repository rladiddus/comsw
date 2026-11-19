// V4 관리 화면(admin-v4/index.html) 파일 주소에 내용 해시(?v=)를 붙인다(stamp-admin.mjs와 같은 방식, 2026-11-19).
// GitHub Pages는 파일을 10분 캐시해서 배포 직후 예전 화면 파일이 보였다. 파일이 바뀌면 주소가 바뀌어 새 파일을 받는다.
// 사용: node scripts/stamp-v4.mjs (갱신) / --check (갱신이 필요하면 실패, 테스트에서 사용)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const v4 = join(root, "admin-v4");
const indexPath = join(v4, "index.html");
export const read = (file) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const hash = (file) => createHash("sha1").update(read(file)).digest("hex").slice(0, 8);
const rel = (file) => {
  const r = relative(v4, file).split("\\").join("/");
  return r.startsWith(".") ? r : `./${r}`;
};
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".mjs") ? [join(dir, d.name)] : []);

export function stamped() {
  const modules = [...walk(join(v4, "js")), ...walk(join(root, "admin", "js")), join(root, "supabase/functions/comsw-tools/policy.mjs")];
  const imports = Object.fromEntries(modules.map((f) => [rel(f), `${rel(f)}?v=${hash(f)}`]));
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n  </script>`;
  return read(indexPath)
    .replace(/<script type="importmap">[\s\S]*?<\/script>|<!-- importmap -->/, map)
    .replace(/\.\/v4\.css(\?v=\w+)?/, `./v4.css?v=${hash(join(v4, "v4.css"))}`)
    .replace(/src="\.\/js\/main\.mjs(\?v=\w+)?"/, `src="${imports["./js/main.mjs"]}"`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = stamped();
  if (process.argv.includes("--check")) {
    if (next !== read(indexPath)) { console.error("admin-v4/index.html 버전이 오래됐습니다. node scripts/stamp-v4.mjs 를 실행하세요."); process.exit(1); }
  } else if (next !== read(indexPath)) {
    writeFileSync(indexPath, next);
    console.log("admin-v4/index.html 갱신");
  }
}
