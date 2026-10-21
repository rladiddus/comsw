// 열 설정: { key, label, type: 'text'|'textarea'|'checkbox'|'number'|'image'|'select', required?, options? }

export function toDbValue(field, raw) {
  if (field.type === "checkbox") return { value: Boolean(raw) };
  if (field.type === "select" && (raw === "" || raw == null)) return { value: null };
  const text = String(raw ?? "").trim();
  if (field.required && !text) return { error: `${field.label}을(를) 입력해주세요` };
  if (field.type === "number") {
    if (!text) return { value: null };
    if (!/^-?\d+$/.test(text)) return { error: `${field.label}에는 숫자만 입력할 수 있습니다` };
    return { value: Number(text) };
  }
  return { value: text };
}

export function dbErrorMessage(err, { duplicate } = {}) {
  if (err?.code === "23505") return duplicate ?? "같은 이름이 이미 있습니다";
  if (err?.code === "23502") return "필수 칸이 비어 있습니다";
  if (err?.code === "42501" || err?.status === 401 || err?.status === 403) return "권한이 없습니다. 다시 로그인해주세요";
  return `저장하지 못했습니다: ${err?.message ?? err}`;
}
