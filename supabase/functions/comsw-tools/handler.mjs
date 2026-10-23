import {
  checkImage,
  digest,
  PROMPTS,
  requireMember,
  safeFilename,
  summaryReservation,
  usageCost,
} from "./policy.mjs";

const result = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};
const dataUrl = (bytes, mime) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

// 네트워크·DB를 주입하여 실제 외부 서비스 없이 권한과 실패 흐름을 검사한다.
export function createHandler(
  {
    env,
    verifyToken,
    userClient,
    serviceClient,
    storage,
    toWebp,
    fetcher = fetch,
    preparePortrait,
    validateCurriculumImage,
  },
) {
  return async (req) => {
    const origin = req.headers.get("Origin");
    const allowed = (env("COMSW_ALLOWED_ORIGINS") ||
      "https://rladiddus.github.io,http://127.0.0.1:8787,http://localhost:8787")
      .split(",").map((x) => x.trim());
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(origin && allowed.includes(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
    };
    const send = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !allowed.includes(origin)) {
      return send({ error: "허용되지 않은 사이트입니다" }, 403);
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "authorization, apikey, content-type, x-client-info",
        },
      });
    }
    if (req.method !== "POST") {
      return send({ error: "지원하지 않는 요청입니다" }, 405);
    }
    let member, token;
    try {
      token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) throw new Error();
      member = requireMember(await verifyToken(token));
    } catch {
      return send({ error: "접근 권한이 없습니다. 다시 로그인해주세요" }, 401);
    }
    try {
      if (Number(req.headers.get("Content-Length")) > 11 * 1024 * 1024) {
        throw new Error("이미지는 10MB 이하로 올려주세요");
      }
      const user = userClient(token);
      const admin = serviceClient();
      const budget = () => result(user.rpc("comsw_ai_budget"));
      async function settings() {
        return await result(
          admin.from("site_settings").select("key,value").in(
            "key",
            Object.keys(PROMPTS).map((k) => `ai_prompt_${k}`),
          ),
        ) || [];
      }
      async function saveAsset(
        bytes,
        kind,
        filename,
        mime,
        owner = member.uid,
      ) {
        // 공개 이미지는 WebP로 줄여 저장한다. 원본 사진은 AI 입력용이라 그대로 둔다.
        if (kind !== "profile-source") {
          bytes = await toWebp(bytes, kind);
          mime = "image/webp";
          filename = String(filename || "image").replace(/\.[^.]*$/, "") +
            ".webp";
        }
        const stored = await storage.upload(bytes, {
          mimeType: mime,
          privateSource: kind === "profile-source",
        });
        try {
          const asset = await result(
            admin.from("media_assets").insert({
              owner_uid: owner,
              kind,
              storage_path: stored.path,
              public_url: stored.url,
              filename: safeFilename(filename),
              mime_type: mime,
              byte_size: bytes.length,
            }).select("id,filename").single(),
          );
          return { ...asset, url: stored.url };
        } catch (e) {
          await storage.remove(stored.path).catch(() => {});
          throw e;
        }
      }
      if (req.headers.get("Content-Type")?.includes("multipart/form-data")) {
        const form = await req.formData();
        const file = form.get("file");
        const kind = form.get("kind");
        if (kind !== "profile-source" && !storage.ready()) {
          throw new Error("관리자가 이미지 저장소 연결을 완료해야 합니다");
        }
        if (
          !["image", "curriculum", "profile-source"].includes(kind) ||
          (!member.manager && kind === "image")
        ) throw new Error("이 이미지를 올릴 권한이 없습니다");
        if (!file || typeof file.arrayBuffer !== "function") {
          throw new Error("이미지 파일을 선택해주세요");
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        checkImage(bytes, file.type);
        if (kind === "curriculum") await validateCurriculumImage(bytes);
        return send(await saveAsset(bytes, kind, file.name, file.type));
      }
      const raw = await req.text();
      if (raw.length > 24000) throw new Error("입력 내용이 너무 깁니다");
      const body = JSON.parse(raw);
      if (["summarize", "profile"].includes(body.action) && !member.manager) {
        return send({
          error:
            "AI 생성은 학과장·관리자만 할 수 있습니다. 원문과 사진을 제출해주세요.",
        }, 403);
      }
      if (body.action === "status") {
        return send({
          storage: storage.ready(),
          ai: Boolean(env("OPENAI_API_KEY")),
          budget: await budget(),
        });
      }
      if (body.action === "source") {
        const asset = await result(
          user.from("media_assets").select("*").eq("id", body.assetId)
            .maybeSingle(),
        );
        if (!asset || asset.kind !== "profile-source") {
          throw new Error("본인 사진을 확인할 권한이 없습니다");
        }
        const bytes = await storage.download(asset.storage_path);
        checkImage(bytes, asset.mime_type);
        return send({ dataUrl: dataUrl(bytes, asset.mime_type) });
      }
      if (!env("OPENAI_API_KEY")) {
        throw new Error("관리자가 AI 연결을 완료해야 합니다");
      }
      const fx = Number(env("COMSW_USD_KRW") || 2000);
      if (!Number.isFinite(fx) || fx < 1000 || fx > 10000) {
        throw new Error("AI 환율 설정을 확인해주세요");
      }
      const prompts = await settings();
      const promptFor = (kind) =>
        prompts.find((p) => p.key === `ai_prompt_${kind}`)?.value ||
        PROMPTS[kind];
      const openai = async (path, body, isForm = false) => {
        const response = await fetcher(`https://api.openai.com/v1/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
            ...(!isForm ? { "Content-Type": "application/json" } : {}),
          },
          body: isForm ? body : JSON.stringify(body),
          signal: AbortSignal.timeout(150000),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            "AI 요청을 완료하지 못했습니다. 관리자에게 사용량과 연결 상태 확인을 요청해주세요",
          );
        }
        return data;
      };
      async function withBudget(kind, key, reserve, work) {
        const reservation = await result(
          admin.rpc("comsw_reserve_ai", {
            p_owner_uid: member.uid,
            p_kind: kind,
            p_cache_key: key,
            p_reserve_krw: reserve,
          }),
        );
        if (reservation.cached) return { ...reservation.result, cached: true };
        let finished = false;
        try {
          const { output, usage } = await work();
          const cost = usageCost(usage, fx, kind === "profile");
          if (cost > reserve) {
            throw new Error(
              "AI 비용 상한을 확인해야 합니다. 관리자에게 문의해주세요",
            );
          }
          await result(
            admin.rpc("comsw_finish_ai", {
              p_id: reservation.id,
              p_cost_krw: cost,
              p_result: output,
              p_usage: usage,
              p_failed: false,
            }),
          );
          finished = true;
          return { ...output, cached: false, budget: await budget() };
        } catch (error) {
          if (!finished) {
            await admin.rpc("comsw_finish_ai", {
              p_id: reservation.id,
              p_cost_krw: reserve,
              p_result: null,
              p_usage: null,
              p_failed: true,
            });
          }
          throw error;
        }
      }
      if (body.action === "summarize") {
        if (
          !["week", "department", "roadmap", "refine"].includes(body.kind) ||
          !member.manager
        ) throw new Error("요약 권한이 없습니다");
        const text = String(body.text || "").trim();
        const prompt = promptFor(body.kind);
        if (!text || text.length > 12000 || prompt.length > 4000) {
          throw new Error("요약할 원문은 12,000자 이하로 입력해주세요");
        }
        const model = "gpt-4.1-mini";
        // 다듬기는 원문 전체를 돌려주므로 출력을 더 길게 허용한다(예산 예약도 그만큼).
        const outputTokens = body.kind === "refine" ? 2000 : 512;
        const key = await digest(
          JSON.stringify([model, body.kind, prompt, text]),
        );
        return send(
          await withBudget(
            body.kind,
            key,
            summaryReservation(prompt, text, fx, outputTokens),
            async () => {
              const data = await openai("responses", {
                model,
                instructions: prompt,
                input: text,
                max_output_tokens: outputTokens,
                store: false,
              });
              const summary = (data.output || []).flatMap((o) =>
                o.content || []
              ).filter((c) => c.type === "output_text").map((c) => c.text).join(
                "\n",
              ).trim();
              if (!summary || data.status === "incomplete") {
                throw new Error("AI 요약이 완성되지 않았습니다");
              }
              return { output: { text: summary }, usage: data.usage };
            },
          ),
        );
      }
      if (body.action === "profile") {
        if (!storage.ready()) {
          throw new Error("관리자가 이미지 저장소 연결을 완료해야 합니다");
        }
        const draft = await result(
          user.from("instructor_profile_drafts").select("*").eq(
            "instructor_id",
            body.instructorId,
          ).maybeSingle(),
        );
        if (!draft?.source_asset_id) {
          throw new Error("프로필과 본인 사진을 먼저 저장해주세요");
        }
        if (!draft.source_consent) {
          throw new Error("선생님의 사진 사용 동의를 먼저 확인해주세요");
        }
        const asset = await result(
          user.from("media_assets").select("*").eq("id", draft.source_asset_id)
            .maybeSingle(),
        );
        if (
          !asset || asset.kind !== "profile-source" ||
          (!member.manager && asset.owner_uid !== member.uid)
        ) throw new Error("사진 사용 권한이 없습니다");
        const bytes = await storage.download(asset.storage_path);
        checkImage(bytes, asset.mime_type);
        const prompt = promptFor("profile");
        if (prompt.length > 4000) {
          throw new Error("프로필 지시문은 4,000자 이하로 입력해주세요");
        }
        return send(
          await withBudget(
            "profile",
            crypto.randomUUID(),
            Math.min(3000, Math.ceil(1.4 * fx)),
            async () => {
              const image = await preparePortrait(bytes, false);
              const form = new FormData();
              form.set("model", "gpt-image-2.5-flare");
              form.set(
                "image",
                new Blob([image], { type: "image/png" }),
                "source.png",
              );
              form.set("prompt", prompt);
              form.set("size", "1024x1536");
              form.set("quality", "medium");
              form.set("background", "transparent");
              form.set("output_format", "png");
              form.set("n", "1");
              const data = await openai("images/edits", form, true);
              if (!data.data?.[0]?.b64_json) {
                throw new Error("AI 사진을 받지 못했습니다");
              }
              // 사용량 확인 후에만 저장. 원본 변경 시 이전 결과로 덮어쓰지 않는다.
              usageCost(data.usage, fx, true);
              const png = Uint8Array.from(
                atob(data.data[0].b64_json),
                (c) => c.charCodeAt(0),
              );
              const portrait = await preparePortrait(png, true);
              const saved = await saveAsset(
                portrait,
                "profile-generated",
                `${draft.name}-profile.png`,
                "image/png",
                asset.owner_uid,
              );
              const changed = await result(
                admin.from("instructor_profile_drafts").update({
                  photo_url: saved.url,
                  status: "pending",
                  updated_at: new Date().toISOString(),
                }).eq("instructor_id", draft.instructor_id).eq(
                  "updated_at",
                  draft.updated_at,
                ).select("instructor_id"),
              );
              if (!changed?.length) {
                throw new Error(
                  "제작 중 프로필이 변경되었습니다. 새로고침 후 다시 확인해주세요",
                );
              }
              return { output: { url: saved.url }, usage: data.usage };
            },
          ),
        );
      }
      return send({ error: "지원하지 않는 요청입니다" }, 400);
    } catch (error) {
      return send(
        { error: error.message || "요청을 완료하지 못했습니다" },
        400,
      );
    }
  };
}
