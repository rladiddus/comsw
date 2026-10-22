let services = {};
export function configureServices(value = {}) {
  services = value;
}
export function getServices() {
  return services;
}

export function createServices({ url, anonKey, getToken, fetcher = fetch }) {
  async function call(body) {
    const token = await getToken();
    if (!token) throw new Error("다시 로그인해주세요");
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetcher(`${url}/functions/v1/comsw-tools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        ...(!isForm ? { "Content-Type": "application/json" } : {}),
      },
      body: isForm ? body : JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        result.error ||
          (response.status === 404
            ? "업로드·AI 연결을 준비 중입니다. 관리자에게 문의해주세요."
            : "요청에 실패했습니다. 잠시 후 다시 시도해주세요."),
      );
    }
    return result;
  }
  return {
    async upload(file, kind = "image") {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      return call(form);
    },
    summarize: (kind, text) => call({ action: "summarize", kind, text }),
    generateProfile: (instructorId) =>
      call({ action: "profile", instructorId }),
    status: () => call({ action: "status" }),
    source: (assetId) => call({ action: "source", assetId }),
  };
}
