-- 이미지 저장 위치: 공개 이미지는 Firebase Storage(sbs-com-sw), 본인 사진 원본은 Supabase 비공개 버킷.
-- storage_path 형식: 'firebase:public/...' 또는 'supabase:...'
alter table public.media_assets rename column drive_file_id to storage_path;

-- 정책을 두지 않아 서비스 키(서버 함수)만 읽고 쓴다. 테스트 DB(PGlite)에는 storage 스키마가 없다.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('comsw-private', 'comsw-private', false, 10485760, array['image/png','image/jpeg','image/webp'])
    on conflict (id) do update set public = false;
  end if;
end $$;
