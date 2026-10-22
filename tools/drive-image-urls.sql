-- tools/move-drive-images.ts 1단계: 드라이브 링크 목록 (tools/drive-image-columns.json과 같은 칸)
select image_url as url from public.course_prep_items where image_url ilike '%drive.google.com%'
union
select image_url as url from public.departments where image_url ilike '%drive.google.com%'
union
select media_url as url from public.instructor_curricula where media_url ilike '%drive.google.com%'
union
select photo_url as url from public.instructors where photo_url ilike '%drive.google.com%'
union
select image_url as url from public.loading_items where image_url ilike '%drive.google.com%'
union
select poster_url as url from public.seminars where poster_url ilike '%drive.google.com%'
union
select value as url from public.site_settings where value ilike '%drive.google.com%'
union
select image_url as url from public.subject_weeks where image_url ilike '%drive.google.com%';
