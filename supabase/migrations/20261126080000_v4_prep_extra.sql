-- V4 준비물 저장에 가격·구독 비용(extra)과 교재 이미지(image_url)도 함께(2026-11-26 사용자 요청). 운영 DB에는 사용자가 직접 실행한다.
--   예전 comsw_v4_confirm_prep는 분류·내용·링크·학과만 다시 넣어, V4에서 [사이트 적용]하면 홈페이지 교재의 가격·이미지가 지워졌다.
--   이제 화면이 보낸 extra·image_url을 그대로 저장한다(가격·비용 200자, 이미지 주소는 http(s)).
create or replace function public.comsw_v4_confirm_prep(p_base text, p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare members uuid[];
begin
  perform comsw_private.v4_guard();
  select array_agg(id) into members from public.subjects
    where deleted_at is null and not is_vacation and comsw_private.v4_base(name) = btrim(coalesce(p_base, ''));
  if members is null then raise exception '과목이 없습니다' using errcode = 'P0001'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
            where coalesce(x->>'category', '') not in ('textbook', 'supply', 'ai')
               or btrim(coalesce(x->>'content', '')) = '' or length(x->>'content') > 500
               or (coalesce(x->>'link_url', '') <> '' and (x->>'link_url' !~* '^https?://' or length(x->>'link_url') > 2000))
               or (coalesce(x->>'image_url', '') <> '' and (x->>'image_url' !~* '^https?://' or length(x->>'image_url') > 2000))
               or length(coalesce(x->>'extra', '')) > 200) then
    raise exception '준비물 칸(분류·내용, 링크·이미지는 http(s), 가격·비용 200자)을 확인해주세요' using errcode = 'P0001';
  end if;
  delete from public.course_prep_items where subject_id = any(members);
  insert into public.course_prep_items(subject_id, category, content, link_url, image_url, extra, department_id, sort_order)
    select m, x->>'category', btrim(x->>'content'), nullif(btrim(coalesce(x->>'link_url', '')), ''),
           nullif(btrim(coalesce(x->>'image_url', '')), ''), nullif(btrim(coalesce(x->>'extra', '')), ''),
           nullif(x->>'department_id', '')::uuid, n
    from unnest(members) m cross join jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality e(x, n);
  perform comsw_private.v4_publish();
  return array_length(members, 1);
end $$;
