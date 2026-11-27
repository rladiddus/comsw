// 로그인 직후 역할 갱신 함수의 결과와 새 Firebase 토큰의 역할이 같을 때만 입장한다.
// 데이터 조회 권한은 이후 Supabase의 RLS가 토큰을 기준으로 다시 검사한다.
export async function resolveSyncedRole({ refresh, user }) {
  const { role } = await refresh();
  if (!role) return null;
  const tokenRole = (await user.getIdTokenResult(true)).claims?.comsw_role ?? null;
  return tokenRole === role ? role : null;
}
