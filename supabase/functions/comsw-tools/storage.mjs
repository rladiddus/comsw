// 공개 이미지는 Firebase Storage(sbs-com-sw, 서울), 본인 사진 원본은 Supabase 비공개 버킷.
// 저장 위치는 "firebase:경로" / "supabase:경로" 한 문자열로 media_assets.storage_path에 남긴다.
export const PRIVATE_BUCKET = "comsw-private";
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function createStorage(
  { env, supabase, firebaseToken, fetcher = fetch },
) {
  const bucket = () =>
    env("FIREBASE_STORAGE_BUCKET") || "sbs-com-sw.firebasestorage.app";
  const failed = () => {
    throw new Error("이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요");
  };
  async function firebase(path, options) {
    const response = await fetcher(`https://storage.googleapis.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${await firebaseToken()}`,
        ...options.headers,
      },
    });
    if (!response.ok) failed();
    return response;
  }
  const split = (stored) => {
    const i = stored.indexOf(":");
    return [stored.slice(0, i), stored.slice(i + 1)];
  };
  return {
    ready: () => Boolean(env("FIREBASE_SERVICE_ACCOUNT")),
    async upload(bytes, { mimeType, privateSource = false }) {
      const month = new Date().toISOString().slice(0, 7);
      const name = `${month}/${crypto.randomUUID()}.${EXT[mimeType] || "bin"}`;
      if (privateSource) {
        const { error } = await supabase().storage.from(PRIVATE_BUCKET).upload(
          name,
          bytes,
          { contentType: mimeType, upsert: false },
        );
        if (error) failed();
        return { path: `supabase:${name}`, url: null };
      }
      const path = `public/${name}`;
      const boundary = `comsw_${crypto.randomUUID()}`;
      // 파일 이름이 매번 새로 생기므로 브라우저가 1년간 캐시해도 된다(전송량 절약).
      const metadata = {
        name: path,
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      };
      await firebase(
        `/upload/storage/v1/b/${bucket()}/o?uploadType=multipart&fields=name`,
        {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body: new Blob([
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${
              JSON.stringify(metadata)
            }\r\n`,
            `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
            bytes,
            `\r\n--${boundary}--`,
          ]),
        },
      );
      return {
        path: `firebase:${path}`,
        url: `https://firebasestorage.googleapis.com/v0/b/${bucket()}/o/${
          encodeURIComponent(path)
        }?alt=media`,
      };
    },
    async download(stored) {
      const [where, name] = split(stored);
      if (where !== "supabase") throw new Error("본인 사진을 찾지 못했습니다");
      const { data, error } = await supabase().storage.from(PRIVATE_BUCKET)
        .download(name);
      if (error) throw new Error("본인 사진을 불러오지 못했습니다");
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(stored) {
      const [where, name] = split(stored);
      if (where === "supabase") {
        await supabase().storage.from(PRIVATE_BUCKET).remove([name]);
      } else {
        await firebase(
          `/storage/v1/b/${bucket()}/o/${encodeURIComponent(name)}`,
          { method: "DELETE" },
        );
      }
    },
  };
}
