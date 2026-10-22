import "jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";
import { preparePortrait, validateCurriculumImage } from "./portrait.ts";
import { createHandler } from "./handler.mjs";
import { createDrive } from "./drive.mjs";

const env = (name: string) => Deno.env.get(name);
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const handler = createHandler({
  env,
  verifyToken: async (token: string) =>
    (await jwtVerify(token, keys, {
      issuer: "https://securetoken.google.com/ssamtalk-sbs",
      audience: "ssamtalk-sbs",
      algorithms: ["RS256"],
    })).payload,
  userClient: (token: string) =>
    createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
      ...options,
      global: { headers: { Authorization: `Bearer ${token}` } },
    }),
  serviceClient: () =>
    createClient(
      env("SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      options,
    ),
  drive: createDrive({ env }),
  preparePortrait,
  validateCurriculumImage,
});
Deno.serve(handler);
