// 공개 사이트 assets/js/supabase-client.js의 convertDriveUrl과 같은 규칙.
export function driveThumbnail(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  let m = raw.match(/\/file\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  m = raw.match(/[?&]id=([^&]+)/);
  if (m && raw.includes("drive.google.com")) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  return raw;
}
