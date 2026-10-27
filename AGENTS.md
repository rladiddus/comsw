# AGENTS.md

> Codex가 이 파일을 읽고 있다면: 너는 검토만 한다. 파일을 수정하지 말고 문제점만 보고한다. 개발은 Claude Code가 한다(규칙 원본은 CLAUDE.md).

## Codex CLI 보조 개발 에이전트

Claude Code가 메인 개발 에이전트이고, Codex CLI는 독립적인 코드 리뷰와 오류 분석만 맡는다.
Codex는 프로젝트 파일을 직접 고치지 않는다(항상 read-only로 실행).

### 확인된 환경 (2026-10-27)

- `codex-cli 0.164.0`, ChatGPT 계정으로 로그인됨(`codex login status`).
- 설치·로그인이 안 돼 있으면 사용자에게 안내만 한다: 설치 `npm install -g @openai/codex`, 로그인 `codex login`(사용자가 직접 실행).

### Codex 검토를 제안하는 경우

다음 작업을 마쳤을 때 Codex 검토를 **제안**한다(바로 실행하지 않음).

- 새로운 핵심 기능 구현 완료
- Firebase 또는 Supabase 관련 코드 변경(`supabase/migrations/`, `supabase/functions/`, RLS·RPC, `admin/js/firebase.mjs`·`session.mjs` 등)
- 인증 및 사용자 권한 기능 변경(로그인, 역할 클레임, `comsw_role()`, 승인·대신 등록 권한 등)
- 결제 및 광고 관련 로직 변경
- 복잡한 오류가 반복적으로 발생하는 경우
- 대규모 리팩터링 완료

단순한 UI 수정, 텍스트·문구 변경, CSS 조정, 매뉴얼·record.md 수정에는 Codex를 제안하지 않는다.

### 작업 절차

1. Claude Code가 기능을 구현한다(테스트 포함).
2. 변경 사항을 정리한다(바뀐 파일, 커밋 범위, 확인할 점).
3. 위 조건에 해당하면 Codex 검토를 제안하고 **사용자 승인을 받은 뒤** 호출한다.
4. Codex의 검토 결과를 수집한다.
5. 결과마다 타당성을 Claude Code가 코드와 테스트로 직접 확인한다(Codex 결과를 그대로 믿지 않는다).
6. 타당한 항목과 근거, 버린 항목과 이유를 사용자에게 보고한다.
7. 사용자가 승인한 항목만 Claude Code가 수정한다.

### 호출 방법

항상 `codex exec`를 read-only 샌드박스로 실행하고, 결과는 저장소 밖(세션 scratchpad)에 받는다.

```sh
codex exec --sandbox read-only --ephemeral \
  --cd "E:/바이브코딩/컴수원-관리플랫폼/comsw" \
  -o "<scratchpad>/codex-review.md" \
  "다음 변경을 코드 리뷰해 줘. 파일을 수정하지 말고 문제점만 보고해 줘.
   범위: git diff <기준커밋>..HEAD (또는 작업 트리의 변경)
   중점: <예: Supabase RLS 권한 누락, 승인 함수의 경계 조건>
   형식: 심각도(높음/중간/낮음) · 파일:줄 · 문제 · 근거 · 제안" < /dev/null
```

- 명령 끝에 반드시 `< /dev/null`을 붙인다. 안 붙이면 Codex가 입력(stdin)이 끝나기를 기다리며 "Reading additional input from stdin..."에서 멈춘다. 오래 걸리면 백그라운드로 실행하고 `-o` 결과 파일이 생겼는지 확인한다.

- `--sandbox read-only`를 빼거나 `workspace-write`, `danger-full-access`, `--dangerously-bypass-approvals-and-sandbox`, `--full-auto`를 쓰지 않는다.
- 결과 파일(`-o`)은 저장소 안에 만들지 않는다.

### 안전 규칙

- Codex는 read-only 모드로만 실행한다.
- Codex 호출 전에 사용자 승인을 받는다(호출할 명령과 검토 범위를 먼저 보여 준다).
- Codex에게 환경변수, 비밀키, 토큰, 서비스 키(service_role 등), 개인정보가 든 데이터를 프롬프트나 파일로 전달하지 않는다. 저장소 밖 `research/` 폴더의 개인정보 데이터도 검토 범위에 넣지 않는다.
- 두 AI가 동시에 같은 파일을 수정하지 않는다. Codex가 실행 중일 때 Claude Code는 파일을 고치지 않고, 수정은 Codex 결과를 받은 뒤 Claude Code만 한다.
- Codex 결과를 무조건 신뢰하지 않는다. 재현·테스트로 확인된 것만 수정 대상으로 올린다.
- 모든 변경 사항은 Git으로 관리한다(작업 브랜치 → 테스트 → 커밋 → main).
