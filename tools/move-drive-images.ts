// 한 번만 쓰는 도구: 콘텐츠 표의 구글 드라이브 이미지를 WebP로 바꿔 Firebase Storage로 옮긴다.
//
// 1) 목록:  npx supabase db query --linked --project-ref bpdxbqsvkvvybrtgvrnf -f tools/drive-image-urls.sql > 목록.json
// 2) 변환:  npx deno run -A --config supabase/functions/comsw-tools/deno.json tools/move-drive-images.ts 목록.json 작업폴더
//    (영상·문서 등 이미지가 아닌 파일은 건너뛴다. 이미 변환한 파일은 다시 받지 않는다.)
// 3) 업로드: 같은 명령 끝에 --upload 서비스계정.json  → 작업폴더/links.json, 작업폴더/update.sql 생성
// 4) update.sql 확인 후 운영 DB에서 실행 → 관리 화면 '적용'으로 공개.
import { toWebp } from "../supabase/functions/comsw-tools/portrait.ts";
import { createStorage } from "../supabase/functions/comsw-tools/storage.mjs";
import { importPKCS8, SignJWT } from "npm:jose@6.1.0";

const [listFile, dir, flag, keyFile] = Deno.args;
if (!listFile || !dir) throw new Error("사용법은 파일 맨 위 주석을 보세요");
await Deno.mkdir(dir, { recursive: true });

// 공개 사이트·관리 화면의 driveThumbnail과 같은 규칙으로 파일 id를 찾는다.
function driveId(url: string) {
  const raw = String(url ?? "").trim();
  const m = raw.match(/\/file\/d\/([^/?#]+)/) ||
    (raw.includes("drive.google.com") && raw.match(/[?&]id=([^&#]+)/));
  return m ? m[1] : null;
}

const rows: { url: string }[] = JSON.parse(await Deno.readTextFile(listFile))
  .rows;
const ids = [...new Set(rows.map((r) => driveId(r.url)).filter(Boolean))] as
  string[];
const exists = (p: string) => Deno.stat(p).then(() => true, () => false);
const skipped: string[] = [];

async function convert(id: string) {
  const out = `${dir}/${id}.webp`;
  if (await exists(out) || await exists(`${dir}/${id}.skip`)) return;
  const res = await fetch(
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
  );
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.startsWith("image/")) {
    await res.body?.cancel();
    await Deno.writeTextFile(`${dir}/${id}.skip`, `${res.status} ${type}`);
    return;
  }
  try {
    let bytes = new Uint8Array(await res.arrayBuffer());
    try {
      await Deno.writeFile(out, await toWebp(bytes, "image"));
    } catch {
      // 6000px 넘는 사진은 변환기 한도를 넘으므로 드라이브가 줄여 주는 1920px 판을 쓴다.
      const small = await fetch(
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1920`,
      );
      if (!small.ok) throw new Error(`썸네일 ${small.status}`);
      bytes = new Uint8Array(await small.arrayBuffer());
      await Deno.writeFile(out, await toWebp(bytes, "image"));
    }
  } catch (e) {
    await Deno.writeTextFile(`${dir}/${id}.skip`, `변환 실패 ${e}`);
  }
}

// ponytail: 동시 4개 고정. 드라이브가 막으면(429) .skip을 지우고 다시 실행하면 이어서 한다.
for (let i = 0; i < ids.length; i += 4) {
  await Promise.all(ids.slice(i, i + 4).map(convert));
  if (i % 100 === 0) console.log(`${i}/${ids.length}`);
}
for await (const f of Deno.readDir(dir)) {
  if (f.name.endsWith(".skip")) skipped.push(f.name.replace(/\.skip$/, ""));
}
let bytes = 0;
for await (const f of Deno.readDir(dir)) {
  if (f.name.endsWith(".webp")) bytes += (await Deno.stat(`${dir}/${f.name}`)).size;
}
console.log(
  `드라이브 파일 ${ids.length}개 · WebP ${ids.length - skipped.length}개 ${
    (bytes / 1048576).toFixed(1)
  }MB · 건너뜀 ${skipped.length}개(${dir}/*.skip)`,
);

if (flag === "--upload") {
  const account = JSON.parse(await Deno.readTextFile(keyFile));
  let token = "";
  const firebaseToken = async () => {
    if (token) return token;
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/devstorage.read_write",
    }).setProtectedHeader({ alg: "RS256", kid: account.private_key_id })
      .setIssuer(account.client_email)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt(now).setExpirationTime(now + 3600)
      .sign(await importPKCS8(account.private_key, "RS256"));
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    token = (await r.json()).access_token;
    if (!token) throw new Error("서비스 계정 키를 확인해주세요");
    return token;
  };
  const storage = createStorage({
    env: (n: string) => Deno.env.get(n),
    supabase: () => {
      throw new Error("공개 이미지만 옮긴다");
    },
    firebaseToken,
  });
  const linksFile = `${dir}/links.json`;
  const links: Record<string, string> = await exists(linksFile)
    ? JSON.parse(await Deno.readTextFile(linksFile))
    : {};
  for (const id of ids) {
    if (links[id] || skipped.includes(id)) continue;
    const saved = await storage.upload(
      await Deno.readFile(`${dir}/${id}.webp`),
      { mimeType: "image/webp" },
    );
    links[id] = saved.url!;
    await Deno.writeTextFile(linksFile, JSON.stringify(links, null, 1));
  }
  const values = Object.entries(links).map(([id, url]) =>
    `('${id.replaceAll("'", "''")}','${url.replaceAll("'", "''")}')`
  ).join(",\n");
  const targets = JSON.parse(
    await Deno.readTextFile(new URL("./drive-image-columns.json", import.meta.url)),
  ) as [string, string][];
  const sql = [
    "begin;",
    `create temp table moved(id text primary key, url text) on commit drop;`,
    `insert into moved values\n${values};`,
    ...targets.map(([t, c]) =>
      `update public.${t} x set ${c} = m.url from moved m where x.${c} ilike '%drive.google.com%' and coalesce(substring(x.${c} from '/file/d/([^/?#]+)'), substring(x.${c} from '[?&]id=([^&#]+)')) = m.id;`
    ),
    "commit;",
  ].join("\n");
  await Deno.writeTextFile(`${dir}/update.sql`, sql);
  console.log(`업로드 ${Object.keys(links).length}개 · ${dir}/update.sql 생성`);
}
