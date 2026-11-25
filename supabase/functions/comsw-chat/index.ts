// 홈페이지 AI 챗봇(로그인 없이 누구나). 관리자용 comsw-tools와 나눠 둔 함수로, 사이트 자료를 바꾸지 않는다.
import { createChatHandler } from "./handler.mjs";

Deno.serve(createChatHandler({ env: (name: string) => Deno.env.get(name) }));
