import { safeFilename } from "./policy.mjs";

export function createDrive({ env, fetcher = fetch }) {
  let cachedToken;
  let expires = 0;
  const required = (name) => {
    const value = env(name);
    if (!value) {
      throw new Error("관리자가 구글 드라이브 연결을 완료해야 합니다");
    }
    return value;
  };
  async function token() {
    if (cachedToken && Date.now() < expires) return cachedToken;
    const response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        refresh_token: required("GOOGLE_REFRESH_TOKEN"),
        grant_type: "refresh_token",
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) {
      throw new Error(
        "구글 드라이브 연결이 만료되었습니다. 관리자에게 다시 연결을 요청해주세요",
      );
    }
    cachedToken = data.access_token;
    expires = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
    return cachedToken;
  }
  async function api(path, options = {}) {
    const response = await fetcher(`https://www.googleapis.com${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${await token()}`, ...options.headers },
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "구글 드라이브를 다시 연결해주세요"
          : "드라이브에 저장하지 못했습니다. 폴더 권한을 확인해주세요",
      );
    }
    return response;
  }
  const json = async (path, options) => (await api(path, options)).json();
  async function permissions(id) {
    return (await json(
      `/drive/v3/files/${
        encodeURIComponent(id)
      }/permissions?fields=permissions(type,role)`,
    )).permissions || [];
  }
  async function ensurePrivate(id) {
    const list = await permissions(id);
    if (
      !list.length || list.some((p) => p.type !== "user" || p.role !== "owner")
    ) {
      throw new Error(
        "원본 사진용 폴더가 공개·공유되어 있습니다. 소유자 전용 비공개 폴더를 설정해주세요",
      );
    }
  }
  return {
    ready: () =>
      [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN",
        "GOOGLE_DRIVE_FOLDER_ID",
        "GOOGLE_DRIVE_PRIVATE_FOLDER_ID",
      ].every((n) => Boolean(env(n))),
    async upload(bytes, { filename, mimeType, privateSource = false }) {
      const folder = required(
        privateSource
          ? "GOOGLE_DRIVE_PRIVATE_FOLDER_ID"
          : "GOOGLE_DRIVE_FOLDER_ID",
      );
      if (privateSource) {
        if (folder === env("GOOGLE_DRIVE_FOLDER_ID")) {
          throw new Error("원본 사진은 별도의 비공개 폴더가 필요합니다");
        }
        await ensurePrivate(folder);
      }
      const boundary = `comsw_${crypto.randomUUID()}`;
      const metadata = { name: safeFilename(filename), parents: [folder] };
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${
          JSON.stringify(metadata)
        }\r\n`,
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
        bytes,
        `\r\n--${boundary}--`,
      ]);
      const file = await json(
        "/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      try {
        if (privateSource) await ensurePrivate(file.id);
        else {await json(
            `/drive/v3/files/${encodeURIComponent(file.id)}/permissions`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "anyone",
                role: "reader",
                allowFileDiscovery: false,
              }),
            },
          );}
      } catch (error) {
        await api(`/drive/v3/files/${encodeURIComponent(file.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        }).catch(() => {});
        throw error;
      }
      return {
        drive_file_id: file.id,
        url: privateSource
          ? null
          : `https://drive.google.com/file/d/${file.id}/view`,
      };
    },
    async download(id) {
      await ensurePrivate(id);
      return new Uint8Array(
        await (await api(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`))
          .arrayBuffer(),
      );
    },
    async trash(id) {
      await api(`/drive/v3/files/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
    },
  };
}
