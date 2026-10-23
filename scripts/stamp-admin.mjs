// 관리 화면 파일 주소에 내용 해시(?v=)를 붙인다. 파일이 바뀌면 주소가 바뀌어 브라우저가 예전 파일을 섞어 쓰지 않는다.
// (GitHub Pages는 파일을 10분 동안 캐시해서, 배포 직후 새 파일과 예전 파일이 섞여 화면이 깨질 수 있다.)
// 사용: node scripts/stamp-admin.mjs        → admin/index.html 갱신
//       node scripts/stamp-admin.mjs --check → 갱신이 필요하면 실패(테스트에서 사용)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const admin = join(root, "admin");
const indexPath = join(admin, "index.html");
const hash = (file) => createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 8);
const rel = (file) => {
  const r = relative(admin, file).split("\\").join("/");
  return r.startsWith(".") ? r : `./${r}`;
};
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".mjs") ? [join(dir, d.name)] : []);

export function stamped() {
  const modules = [...walk(join(admin, "js")), join(root, "supabase/functions/comsw-tools/policy.mjs")];
  const imports = Object.fromEntries(modules.map((f) => [rel(f), `${rel(f)}?v=${hash(f)}`]));
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n  </script>`;
  return readFileSync(indexPath, "utf8")
    .replace(/<script type="importmap">[\s\S]*?<\/script>|<!-- importmap -->/, map)
    .replace(/\.\/admin\.css(\?v=\w+)?/, `./admin.css?v=${hash(join(admin, "admin.css"))}`)
    .replace(/src="\.\/js\/main\.mjs(\?v=\w+)?"/, `src="${imports["./js/main.mjs"]}"`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = stamped();
  const now = readFileSync(indexPath, "utf8");
  if (process.argv.includes("--check")) {
    if (next !== now) {
      console.error("admin/index.html 버전이 오래됐습니다. node scripts/stamp-admin.mjs 를 실행하세요.");
      process.exit(1);
    }
  } else if (next !== now) {
    writeFileSync(indexPath, next);
    console.log("admin/index.html 갱신");
  }
}
