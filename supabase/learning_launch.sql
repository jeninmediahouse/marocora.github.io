-- Launch preparation: explicit staff publication, private student accounts,
-- teacher availability and nonbinding lesson requests. No payments or bookings.
begin;
create table if not exists public.learning_launch_subjects (
 id text primary key, category_id text not null, name_en text not null, name_fr text not null,
 aliases text[] not null, category_aliases text[] not null
);
alter table public.learning_launch_subjects enable row level security;
revoke all on public.learning_launch_subjects from public,anon,authenticated;
insert into public.learning_launch_subjects(id,category_id,name_en,name_fr,aliases,category_aliases) values
('english','languages','English','Anglais',array['english','english','anglais','anglais'],array['languages','languages','langues']),
('arabic','languages','Arabic','Arabe',array['arabic','arabic','arabe','arabe'],array['languages','languages','langues']),
('darija','languages','Moroccan Darija','Darija marocaine',array['darija','moroccan darija','darija marocaine','darija','moroccan arabic','arabe marocain'],array['languages','languages','langues']),
('french','languages','French','Français',array['french','french','français','francais'],array['languages','languages','langues']),
('spanish','languages','Spanish','Espagnol',array['spanish','spanish','espagnol','espagnol'],array['languages','languages','langues']),
('arithmetic','mathematics','Arithmetic','Arithmétique',array['arithmetic','arithmetic','arithmétique','arithmetique','basic math'],array['mathematics','mathematics','mathématiques']),
('pre-algebra','mathematics','Pre-algebra','Pré-algèbre',array['pre-algebra','pre-algebra','pré-algèbre','prealgebra'],array['mathematics','mathematics','mathématiques']),
('algebra','mathematics','Algebra','Algèbre',array['algebra','algebra','algèbre','algebre'],array['mathematics','mathematics','mathématiques']),
('geometry','mathematics','Geometry','Géométrie',array['geometry','geometry','géométrie','geometrie','geomatry'],array['mathematics','mathematics','mathématiques']),
('trigonometry','mathematics','Trigonometry','Trigonométrie',array['trigonometry','trigonometry','trigonométrie','trigonometrie'],array['mathematics','mathematics','mathématiques']),
('precalculus','mathematics','Precalculus','Pré-calcul',array['precalculus','precalculus','pré-calcul','pre-calculus'],array['mathematics','mathematics','mathématiques']),
('calculus','mathematics','Calculus','Calcul différentiel et intégral',array['calculus','calculus','calcul différentiel et intégral','calculus'],array['mathematics','mathematics','mathématiques']),
('statistics','mathematics','Statistics','Statistiques',array['statistics','statistics','statistiques','statistiques'],array['mathematics','mathematics','mathématiques']),
('probability','mathematics','Probability','Probabilités',array['probability','probability','probabilités','probabilites'],array['mathematics','mathematics','mathématiques']),
('linear-algebra','mathematics','Linear algebra','Algèbre linéaire',array['linear-algebra','linear algebra','algèbre linéaire','linear algebra'],array['mathematics','mathematics','mathématiques']),
('discrete-mathematics','mathematics','Discrete mathematics','Mathématiques discrètes',array['discrete-mathematics','discrete mathematics','mathématiques discrètes','discrete math'],array['mathematics','mathematics','mathématiques']),
('physics','science','Physics','Physique',array['physics','physics','physique','physique'],array['science','science','sciences'])
on conflict(id) do update set category_id=excluded.category_id,name_en=excluded.name_en,name_fr=excluded.name_fr,aliases=excluded.aliases,category_aliases=excluded.category_aliases;
create table if not exists public.learning_launch_specialties(id text primary key,subject_ids text[] not null,aliases text[] not null);
alter table public.learning_launch_specialties enable row level security;
revoke all on public.learning_launch_specialties from public,anon,authenticated;
insert into public.learning_launch_specialties(id,subject_ids,aliases) values
('conversation',array['english','arabic','darija','french','spanish'],array['conversation','conversation','conversation']),
('beginners',array['english','arabic','darija','french','spanish'],array['beginners','beginners','débutants']),
('travel',array['english','arabic','darija','french','spanish'],array['travel','travel','voyage']),
('expats',array['darija'],array['expats','for expats','pour les expatriés']),
('business',array['english','arabic','french','spanish'],array['business','business language','langue professionnelle']),
('mechanics',array['physics'],array['mechanics','mechanics','mécanique']),
('electricity',array['physics'],array['electricity','electricity and magnetism','électricité et magnétisme']),
('waves',array['physics'],array['waves','waves and optics','ondes et optique']),
('thermodynamics',array['physics'],array['thermodynamics','thermodynamics','thermodynamique']),
('modern-physics',array['physics'],array['modern-physics','modern physics','physique moderne'])
on conflict(id) do update set subject_ids=excluded.subject_ids,aliases=excluded.aliases;
create table if not exists public.learning_country_codes(id text primary key);
alter table public.learning_country_codes enable row level security;
revoke all on public.learning_country_codes from public,anon,authenticated;
insert into public.learning_country_codes(id) values ('AD'),('AE'),('AF'),('AG'),('AI'),('AL'),('AM'),('AO'),('AQ'),('AR'),('AS'),('AT'),('AU'),('AW'),('AX'),('AZ'),('BA'),('BB'),('BD'),('BE'),('BF'),('BG'),('BH'),('BI'),('BJ'),('BL'),('BM'),('BN'),('BO'),('BQ'),('BR'),('BS'),('BT'),('BV'),('BW'),('BY'),('BZ'),('CA'),('CC'),('CD'),('CF'),('CG'),('CH'),('CI'),('CK'),('CL'),('CM'),('CN'),('CO'),('CR'),('CU'),('CV'),('CW'),('CX'),('CY'),('CZ'),('DE'),('DJ'),('DK'),('DM'),('DO'),('DZ'),('EC'),('EE'),('EG'),('EH'),('ER'),('ES'),('ET'),('FI'),('FJ'),('FK'),('FM'),('FO'),('FR'),('GA'),('GB'),('GD'),('GE'),('GF'),('GG'),('GH'),('GI'),('GL'),('GM'),('GN'),('GP'),('GQ'),('GR'),('GS'),('GT'),('GU'),('GW'),('GY'),('HK'),('HM'),('HN'),('HR'),('HT'),('HU'),('ID'),('IE'),('IL'),('IM'),('IN'),('IO'),('IQ'),('IR'),('IS'),('IT'),('JE'),('JM'),('JO'),('JP'),('KE'),('KG'),('KH'),('KI'),('KM'),('KN'),('KP'),('KR'),('KW'),('KY'),('KZ'),('LA'),('LB'),('LC'),('LI'),('LK'),('LR'),('LS'),('LT'),('LU'),('LV'),('LY'),('MA'),('MC'),('MD'),('ME'),('MF'),('MG'),('MH'),('MK'),('ML'),('MM'),('MN'),('MO'),('MP'),('MQ'),('MR'),('MS'),('MT'),('MU'),('MV'),('MW'),('MX'),('MY'),('MZ'),('NA'),('NC'),('NE'),('NF'),('NG'),('NI'),('NL'),('NO'),('NP'),('NR'),('NU'),('NZ'),('OM'),('PA'),('PE'),('PF'),('PG'),('PH'),('PK'),('PL'),('PM'),('PN'),('PR'),('PS'),('PT'),('PW'),('PY'),('QA'),('RE'),('RO'),('RS'),('RU'),('RW'),('SA'),('SB'),('SC'),('SD'),('SE'),('SG'),('SH'),('SI'),('SJ'),('SK'),('SL'),('SM'),('SN'),('SO'),('SR'),('SS'),('ST'),('SV'),('SX'),('SY'),('SZ'),('TC'),('TD'),('TF'),('TG'),('TH'),('TJ'),('TK'),('TL'),('TM'),('TN'),('TO'),('TR'),('TT'),('TV'),('TW'),('TZ'),('UA'),('UG'),('UM'),('US'),('UY'),('UZ'),('VA'),('VC'),('VE'),('VG'),('VI'),('VN'),('VU'),('WF'),('WS'),('YE'),('YT'),('ZA'),('ZM'),('ZW') on conflict do nothing;
create table if not exists public.learning_publications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_id uuid not null unique default gen_random_uuid(),
 revision bigint not null, review_id bigint not null references public.learning_application_reviews(id),
 subject_indices integer[] not null, data jsonb not null, active boolean not null default true,
 published_at timestamptz not null default now()
);
create table if not exists public.learning_publication_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('publish','unpublish')),
 revision bigint not null, review_id bigint not null,
 subject_indices integer[] not null, created_at timestamptz not null default now()
);
alter table public.learning_publication_events enable row level security;
revoke all on public.learning_publication_events from public,anon,authenticated;
create table if not exists public.learning_student_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 120),
 timezone text not null, locale text not null check(locale in ('en','fr')),
 goals text not null default '' check(length(goals)<=2000),
 subjects text[] not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.learning_student_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 instructor_id uuid not null references public.learning_publications(public_id) on delete cascade,
 primary key(user_id,instructor_id)
);
create table if not exists public.learning_availability (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.learning_publications(user_id) on delete cascade,
 revision bigint not null, starts_at timestamptz not null, ends_at timestamptz not null,
 offering_ids text[] not null, active boolean not null default true,
 check(ends_at>starts_at), check(cardinality(offering_ids) between 1 and 96)
);
create index if not exists learning_availability_owner on public.learning_availability(user_id,starts_at);
create table if not exists public.learning_lesson_requests (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 instructor_id uuid not null references public.learning_publications(public_id) on delete cascade,
 slot_id uuid not null references public.learning_availability(id),
 offering_id text not null, goal text not null check(length(goal) between 1 and 2000),
 timezone text not null, snapshot jsonb not null,
 status text not null default 'requested' check(status in ('requested','acknowledged','declined','cancelled')),
 created_at timestamptz not null default now(),
 unique(student_id,slot_id,offering_id)
);
create index if not exists learning_requests_instructor on public.learning_lesson_requests(instructor_id,created_at);
alter table public.learning_publications enable row level security;
alter table public.learning_student_profiles enable row level security;
alter table public.learning_student_favorites enable row level security;
alter table public.learning_availability enable row level security;
alter table public.learning_lesson_requests enable row level security;
revoke all on public.learning_publications,public.learning_student_profiles,public.learning_student_favorites,
 public.learning_availability,public.learning_lesson_requests from public,anon,authenticated;

-- Internal visibility check. Every public read rechecks the latest review and
-- current revision. Edits/reviews/revocation hide previously published data.
create or replace function public.learning_publication_visible(p public.learning_publications)
returns boolean language sql stable security definer set search_path='' as $$
 select p.active and exists(
 select 1 from public.learning_instructor_drafts d
 join public.learning_application_reviews r on r.user_id=d.user_id and r.revision=d.revision
 where d.user_id=p.user_id and d.revision=p.revision and d.status in ('submitted','needs_changes')
 and r.id=p.review_id and r.id=(select max(v.id) from public.learning_application_reviews v where v.user_id=d.user_id and v.revision=d.revision)
 and r.profile_decision='approved' and d.data #> '{profile,publicationConsent}'='true'::jsonb
 and coalesce(d.data #>> '{profile,displayName}','') not ilike '%Do Not Publish%'
 and d.user_id not in ('6748d479-b3d6-46a5-aa3c-7516da0b07d2'::uuid,'5821ea83-6934-4a66-bfff-f0df97f88273'::uuid)
 and not exists(select 1 from public.learning_review_exclusions x where x.user_id=d.user_id)
 and not exists(select 1 from unnest(p.subject_indices) n where r.subject_decisions -> n ->> 'decision' is distinct from 'approved')
 );
$$;

-- Internal projection: no arbitrary public JSON, evidence, feedback or auth IDs.
create or replace function public.learning_build_publication(applicant_id uuid,expected_revision bigint,selected_subjects integer[],profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.learning_instructor_drafts%rowtype; r public.learning_application_reviews%rowtype;
 p jsonb; s jsonb; o jsonb; n integer; k integer; sp text; j integer; t public.learning_launch_subjects%rowtype;
 subjects jsonb:='[]'; offerings jsonb:='[]'; specialties jsonb:='[]'; spids jsonb; sid text;
 native_ids jsonb; spoken_ids jsonb;
begin
 select * into d from public.learning_instructor_drafts where user_id=applicant_id;
 if not found or d.revision is distinct from expected_revision then raise exception 'STALE_REVISION'; end if;
 if d.status not in ('submitted','needs_changes') then raise exception 'NOT_SUBMITTED'; end if;
 if applicant_id in ('6748d479-b3d6-46a5-aa3c-7516da0b07d2'::uuid,'5821ea83-6934-4a66-bfff-f0df97f88273'::uuid)
 or exists(select 1 from public.learning_review_exclusions where user_id=applicant_id)
 or coalesce(d.data #>> '{profile,displayName}','') ilike '%Do Not Publish%' then raise exception 'QA_PUBLICATION_DENIED'; end if;
 select * into r from public.learning_application_reviews where user_id=applicant_id and revision=expected_revision order by id desc limit 1;
 if not found or r.profile_decision<>'approved' then raise exception 'PROFILE_NOT_APPROVED'; end if;
 if d.data #> '{profile,publicationConsent}' is distinct from 'true'::jsonb then raise exception 'PUBLICATION_CONSENT_REQUIRED'; end if;
 if selected_subjects is null or cardinality(selected_subjects) not between 1 and 12
 or cardinality(selected_subjects)<>(select count(distinct v) from unnest(selected_subjects) v)
 or exists(select 1 from unnest(selected_subjects) v where v is null) then raise exception 'INVALID_SUBJECT_SELECTION'; end if;
 p:=d.data->'profile';
 if not exists(select 1 from public.learning_country_codes where id=p->>'countryOfResidence')
 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p->>'timezone')
 or length(coalesce(p->>'displayName','')) not between 1 and 120
 or length(coalesce(p->>'headline','')) not between 1 and 180
 or length(coalesce(p->>'bio','')) not between 1 and 4000
 or length(coalesce(p->>'education',''))>2000 or length(coalesce(p->>'city',''))>120
 or length(coalesce(p->>'nativeLanguages',''))>300 or length(coalesce(p->>'spokenLanguages',''))>300
 or (p->'yearsExperience' is not null and p->'yearsExperience'<>'null'::jsonb and (coalesce(p->>'yearsExperience','') !~ '^[0-9]+$' or (p->>'yearsExperience')::numeric not between 0 and 80))
 or (nullif(p->>'photoURL','') is not null and p->>'photoURL' !~ '^https://')
 or (nullif(p->>'introductionVideo','') is not null and p->>'introductionVideo' !~ '^https://')
 then raise exception 'INVALID_PUBLIC_PROFILE'; end if;
 foreach n in array selected_subjects loop
  s:=d.data->'subjects'->n;
  if n<0 or s is null or r.subject_decisions->n->>'decision' is distinct from 'approved'
  or r.subject_decisions->n->>'subject' is distinct from s->>'subject'
  or r.subject_decisions->n->>'category' is distinct from s->>'category' then raise exception 'SUBJECT_NOT_APPROVED'; end if;
  select * into t from public.learning_launch_subjects where lower(btrim(s->>'subject'))=any(aliases) and lower(btrim(s->>'category'))=any(category_aliases);
  if not found then raise exception 'SUBJECT_OUTSIDE_LAUNCH'; end if;
  if exists(select 1 from jsonb_array_elements(subjects) v where v->>'subjectId'=t.id) then raise exception 'DUPLICATE_SUBJECT'; end if;
  if length(coalesce(s->>'qualifications','')) not between 1 and 2000 then raise exception 'INVALID_PUBLIC_PROFILE'; end if;
  subjects:=subjects || jsonb_build_array(jsonb_build_object('subjectId',t.id,'approval','approved','qualifications',s->>'qualifications','categoryMetadata','{}'::jsonb));
  spids:='[]'; j:=0;
  if s->'specialties' is not null and jsonb_typeof(s->'specialties')<>'array' then raise exception 'INVALID_PUBLIC_PROFILE'; end if;
  for sp in select jsonb_array_elements_text(coalesce(s->'specialties','[]')) loop
   if length(sp)>100 or j>=10 then raise exception 'INVALID_PUBLIC_PROFILE'; end if;
   select x.id into sid from public.learning_launch_specialties x where t.id=any(x.subject_ids) and lower(btrim(sp))=any(x.aliases);
   if sid is null then
    sid:=profile_id::text||':'||n||':specialty:'||j;
    specialties:=specialties||jsonb_build_array(jsonb_build_object('id',sid,'name',sp,'subjectIds',jsonb_build_array(t.id)));
   end if;
   spids:=spids||jsonb_build_array(sid); j:=j+1;
  end loop;
  if jsonb_typeof(s->'offerings') is distinct from 'array' or jsonb_array_length(s->'offerings') not between 1 and 8 then raise exception 'INVALID_PUBLIC_PROFILE'; end if;
  k:=0;
  for o in select value from jsonb_array_elements(s->'offerings') loop
   if length(coalesce(o->>'title','')) not between 1 and 140
    or coalesce(o->>'currency','') !~ '^[A-Z]{3}$'
    or coalesce(o->>'priceMinor','') !~ '^[0-9]+$' or (o->>'priceMinor')::numeric>1000000000
    or coalesce(o->>'durationMinutes','') !~ '^[0-9]+$' or (o->>'durationMinutes')::numeric not between 15 and 240
    or coalesce(o->>'lessonCount','1') !~ '^[0-9]+$' or coalesce(o->>'lessonCount','1')::numeric not between 1 and 20
    or coalesce(o->>'deliveryMode','online')<>'online'
    or jsonb_typeof(coalesce(o->'levels','[]'))<>'array'
    or jsonb_array_length(coalesce(o->'levels','[]'))>6
    or exists(select 1 from jsonb_array_elements(coalesce(o->'levels','[]')) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>60)
    then raise exception 'INVALID_PUBLIC_OFFERING'; end if;
   offerings:=offerings||jsonb_build_array(jsonb_build_object('id',profile_id::text||':'||n||':'||k,'instructorId',profile_id,
    'subjectId',t.id,'title',o->>'title','durationMinutes',(o->>'durationMinutes')::integer,
    'lessonCount',coalesce(o->>'lessonCount','1')::integer,'priceMinor',(o->>'priceMinor')::bigint,
    'currency',o->>'currency','deliveryMode','online','kind',case when coalesce(o->>'lessonCount','1')::integer>1 then 'package' else 'lesson' end,
    'levels',(select coalesce(jsonb_agg(case lower(btrim(value)) when 'beginner' then 'beginner' when 'débutant' then 'beginner' when 'debutant' then 'beginner' when 'intermediate' then 'intermediate' when 'intermédiaire' then 'intermediate' when 'intermediaire' then 'intermediate' when 'advanced' then 'advanced' when 'avancé' then 'advanced' when 'avance' then 'advanced' when 'primary-school' then 'primary-school' when 'primary school' then 'primary-school' when 'elementary school' then 'primary-school' when 'primaire' then 'primary-school' when 'middle-school' then 'middle-school' when 'middle school' then 'middle-school' when 'collège' then 'middle-school' when 'high-school' then 'high-school' when 'high school' then 'high-school' when 'lycée' then 'high-school' when 'lycee' then 'high-school' when 'university' then 'university' when 'université' then 'university' when 'universite' then 'university' when 'adult' then 'adult' when 'adults' then 'adult' when 'adulte' then 'adult' when 'adultes' then 'adult' else value end),'[]') from jsonb_array_elements_text(coalesce(o->'levels','[]'))),'specialtyIds',spids,'active',true,'bookingEnabled',false));
   k:=k+1;
  end loop;
 end loop;
 select coalesce(jsonb_agg(id),'[]') into native_ids from public.learning_launch_subjects
 where category_id='languages' and exists(select 1 from regexp_split_to_table(coalesce(p->>'nativeLanguages',''),',') v where lower(btrim(v))=any(aliases));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'level','unspecified')),'[]') into spoken_ids from public.learning_launch_subjects
 where category_id='languages' and exists(select 1 from regexp_split_to_table(coalesce(p->>'spokenLanguages',''),',') v where lower(btrim(v))=any(aliases));
 return jsonb_build_object('instructor',jsonb_build_object('id',profile_id,'displayName',p->>'displayName','headline',p->>'headline','bio',p->>'bio',
  'countryOfResidence',p->>'countryOfResidence','city',p->>'city','timezone',p->>'timezone','yearsExperience',p->'yearsExperience',
  'photo',p->>'photoURL','introductionVideo',p->>'introductionVideo','nativeLanguages',native_ids,'spokenLanguages',spoken_ids,
  'nativeLanguageText',p->>'nativeLanguages','spokenLanguageText',p->>'spokenLanguages',
  'education',case when length(coalesce(p->>'education',''))>0 then jsonb_build_array(jsonb_build_object('description',p->>'education')) else '[]'::jsonb end,
  'credentials','[]'::jsonb,'verifications','[]'::jsonb,'teachingStyles','[]'::jsonb,'performance',null,'status','active','subjects',subjects),
  'offerings',offerings,'specialties',specialties);
end;
$$;

create or replace function public.learning_staff_publication_preview(applicant_id uuid,expected_revision bigint,selected_subjects integer[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
 if applicant_id=auth.uid() then raise exception 'SELF_PUBLICATION_DENIED'; end if;
 select public_id into pid from public.learning_publications where user_id=applicant_id;
 return public.learning_build_publication(applicant_id,expected_revision,selected_subjects,coalesce(pid,gen_random_uuid()));
end;
$$;
create or replace function public.publish_learning_instructor(applicant_id uuid,expected_revision bigint,selected_subjects integer[])
returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; payload jsonb; rid bigint;
begin
 perform 1 from public.learning_review_staff where user_id=auth.uid() for share;
 if not found then raise exception 'STAFF_REQUIRED'; end if;
 if applicant_id=auth.uid() then raise exception 'SELF_PUBLICATION_DENIED'; end if;
 perform 1 from public.learning_instructor_drafts where user_id=applicant_id for update;
 select public_id into pid from public.learning_publications where user_id=applicant_id;
 pid:=coalesce(pid,gen_random_uuid());
 payload:=public.learning_build_publication(applicant_id,expected_revision,selected_subjects,pid);
 select max(id) into rid from public.learning_application_reviews where user_id=applicant_id and revision=expected_revision;
 insert into public.learning_publications(user_id,public_id,revision,review_id,subject_indices,data)
 values(applicant_id,pid,expected_revision,rid,selected_subjects,payload)
 on conflict(user_id) do update set revision=excluded.revision,review_id=excluded.review_id,subject_indices=excluded.subject_indices,data=excluded.data,active=true,published_at=now();
 insert into public.learning_publication_events(user_id,actor_id,action,revision,review_id,subject_indices) values(applicant_id,auth.uid(),'publish',expected_revision,rid,selected_subjects);
 return pid;
end;
$$;
create or replace function public.unpublish_learning_instructor(applicant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.learning_review_staff where user_id=auth.uid() for share;
 if not found then raise exception 'STAFF_REQUIRED'; end if;
 insert into public.learning_publication_events(user_id,actor_id,action,revision,review_id,subject_indices) select user_id,auth.uid(),'unpublish',revision,review_id,subject_indices from public.learning_publications where user_id=applicant_id and active;
 update public.learning_publications set active=false where user_id=applicant_id;
end;
$$;
create or replace function public.learning_public_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('instructors',coalesce(jsonb_agg(p.data->'instructor'),'[]'),
 'offerings',coalesce((select jsonb_agg(o) from public.learning_publications q cross join lateral jsonb_array_elements(q.data->'offerings') o where public.learning_publication_visible(q)),'[]'),
 'specialties',coalesce((select jsonb_agg(o) from public.learning_publications q cross join lateral jsonb_array_elements(q.data->'specialties') o where public.learning_publication_visible(q)),'[]'))
 from public.learning_publications p where public.learning_publication_visible(p);
$$;

create or replace function public.learning_save_student_profile(display_name text,timezone text,locale text,goals text,subjects text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if display_name is null or length(btrim(display_name)) not between 1 and 120
 or timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone)
 or locale is null or locale not in ('en','fr') or goals is null or length(goals)>2000
 or subjects is null or cardinality(subjects)>17
 or exists(select 1 from unnest(subjects) s where s is null or not exists(select 1 from public.learning_launch_subjects t where t.id=s)) then raise exception 'INVALID_STUDENT_PROFILE'; end if;
 insert into public.learning_student_profiles(user_id,display_name,timezone,locale,goals,subjects)
 values(auth.uid(),btrim(display_name),timezone,locale,goals,subjects)
 on conflict(user_id) do update set display_name=excluded.display_name,timezone=excluded.timezone,locale=excluded.locale,goals=excluded.goals,subjects=excluded.subjects,updated_at=now();
end;
$$;
create or replace function public.learning_student_dashboard()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('profile',(select to_jsonb(p)-'user_id' from public.learning_student_profiles p where p.user_id=auth.uid()),
 'favorites',coalesce((select jsonb_agg(f.instructor_id) from public.learning_student_favorites f where f.user_id=auth.uid()),'[]'),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'goal',r.goal,'timezone',r.timezone,'snapshot',r.snapshot,'created_at',r.created_at) order by r.created_at desc) from public.learning_lesson_requests r where r.student_id=auth.uid()),'[]'));
$$;
create or replace function public.learning_set_favorite(instructor_id uuid,saved boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if saved is null then raise exception 'INVALID_FAVORITE'; end if;
 if saved then
  if not exists(select 1 from public.learning_publications p where p.public_id=instructor_id and public.learning_publication_visible(p)) then raise exception 'INSTRUCTOR_UNAVAILABLE'; end if;
  insert into public.learning_student_favorites values(auth.uid(),instructor_id) on conflict do nothing;
 else delete from public.learning_student_favorites f where f.user_id=auth.uid() and f.instructor_id=learning_set_favorite.instructor_id; end if;
end;
$$;

create or replace function public.learning_public_slots(instructor_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'instructorId',p.public_id,'startsAt',a.starts_at,'endsAt',a.ends_at,'offeringIds',(select jsonb_agg(o->>'id') from jsonb_array_elements(p.data->'offerings') o where o->>'id'=any(a.offering_ids) and a.ends_at-a.starts_at>=make_interval(mins=>(o->>'durationMinutes')::integer))) order by a.starts_at),'[]')
 from public.learning_availability a join public.learning_publications p on p.user_id=a.user_id
 where p.public_id=instructor_id and public.learning_publication_visible(p) and a.active and a.revision=p.revision and a.starts_at>now()
 and exists(select 1 from jsonb_array_elements(p.data->'offerings') o where o->>'id'=any(a.offering_ids)
 and a.ends_at-a.starts_at>=make_interval(mins=>(o->>'durationMinutes')::integer));
$$;
create or replace function public.learning_instructor_dashboard()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publication',(select jsonb_build_object('id',p.public_id,'revision',p.revision,'visible',public.learning_publication_visible(p),'data',p.data) from public.learning_publications p where p.user_id=auth.uid()),
 'slots',coalesce((select jsonb_agg(to_jsonb(a)-'user_id' order by a.starts_at) from public.learning_availability a where a.user_id=auth.uid() and a.active and a.starts_at>now()),'[]'),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'goal',r.goal,'timezone',r.timezone,'snapshot',r.snapshot,'created_at',r.created_at,'studentName',s.display_name) order by r.created_at desc)
 from public.learning_lesson_requests r join public.learning_publications p on p.public_id=r.instructor_id
 join public.learning_student_profiles s on s.user_id=r.student_id where p.user_id=auth.uid()),'[]'));
$$;
create or replace function public.learning_save_availability(starts_at timestamptz,ends_at timestamptz,offering_ids text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.learning_publications%rowtype; aid uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into p from public.learning_publications where user_id=auth.uid() for update;
 if not found or not public.learning_publication_visible(p) then raise exception 'PUBLICATION_REQUIRED'; end if;
 if starts_at is null or ends_at is null or starts_at<=now() or starts_at>now()+interval '365 days'
 or ends_at-starts_at not between interval '15 minutes' and interval '4 hours'
 or offering_ids is null or cardinality(offering_ids) not between 1 and 96
 or exists(select 1 from unnest(offering_ids) x where x is null or not exists(select 1 from jsonb_array_elements(p.data->'offerings') o where o->>'id'=x and (o->>'lessonCount')::integer=1 and ends_at-starts_at>=make_interval(mins=>(o->>'durationMinutes')::integer)))
 then raise exception 'INVALID_AVAILABILITY'; end if;
 if exists(select 1 from public.learning_availability a where a.user_id=auth.uid() and a.active and a.revision=p.revision and a.starts_at<learning_save_availability.ends_at and a.ends_at>learning_save_availability.starts_at)
 then raise exception 'OVERLAPPING_AVAILABILITY'; end if;
 insert into public.learning_availability(user_id,revision,starts_at,ends_at,offering_ids) values(auth.uid(),p.revision,starts_at,ends_at,offering_ids) returning id into aid;
 return aid;
end;
$$;
create or replace function public.learning_remove_availability(slot_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.learning_availability set active=false where id=slot_id and user_id=auth.uid();
end;
$$;
create or replace function public.learning_request_lesson(slot_id uuid,offering_id text,goal text,timezone text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.learning_availability%rowtype; p public.learning_publications%rowtype; o jsonb; rid uuid; snap jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.learning_student_profiles where user_id=auth.uid()) then raise exception 'STUDENT_PROFILE_REQUIRED'; end if;
 if goal is null or length(btrim(goal)) not between 1 and 2000 or timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone) then raise exception 'INVALID_REQUEST'; end if;
 -- Consistent publication -> availability lock order with schedule writes.
 select q.* into p from public.learning_publications q join public.learning_availability v on v.user_id=q.user_id where v.id=slot_id for share of q;
 if not found or p.user_id=auth.uid() or not public.learning_publication_visible(p) then raise exception 'SLOT_UNAVAILABLE'; end if;
 select * into a from public.learning_availability where id=slot_id for share;
 if not a.active or a.starts_at<=now() or a.revision<>p.revision or offering_id is null or not offering_id=any(a.offering_ids) then raise exception 'SLOT_UNAVAILABLE'; end if;
 select value into o from jsonb_array_elements(p.data->'offerings') where value->>'id'=offering_id;
 if o is null or (o->>'lessonCount')::integer<>1 or a.ends_at-a.starts_at<make_interval(mins=>(o->>'durationMinutes')::integer) then raise exception 'SLOT_UNAVAILABLE'; end if;
 select id into rid from public.learning_lesson_requests r where r.student_id=auth.uid() and r.slot_id=learning_request_lesson.slot_id and r.offering_id=learning_request_lesson.offering_id and r.status in ('requested','acknowledged');
 if rid is not null then return rid; end if;
 if exists(select 1 from public.learning_lesson_requests r where r.student_id=auth.uid() and r.slot_id=learning_request_lesson.slot_id and r.offering_id=learning_request_lesson.offering_id) then raise exception 'REQUEST_ALREADY_CLOSED'; end if;
 if (select count(*) from public.learning_lesson_requests where student_id=auth.uid() and created_at>now()-interval '24 hours')>=20 then raise exception 'REQUEST_LIMIT'; end if;
 snap:=jsonb_build_object('instructorName',p.data #>> '{instructor,displayName}','instructorId',p.public_id,
 'offering',o,'startsAt',a.starts_at,'endsAt',a.starts_at+make_interval(mins=>(o->>'durationMinutes')::integer));
 insert into public.learning_lesson_requests(student_id,instructor_id,slot_id,offering_id,goal,timezone,snapshot)
 values(auth.uid(),p.public_id,slot_id,offering_id,btrim(goal),timezone,snap)
 on conflict do nothing returning id into rid;
 if rid is null then select id into rid from public.learning_lesson_requests r where r.student_id=auth.uid() and r.slot_id=learning_request_lesson.slot_id and r.offering_id=learning_request_lesson.offering_id; end if;
 return rid;
end;
$$;
create or replace function public.learning_update_lesson_request(request_id uuid,decision text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.learning_lesson_requests%rowtype; owner_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from public.learning_lesson_requests where id=request_id for update;
 if not found then raise exception 'REQUEST_UNAVAILABLE'; end if;
 select user_id into owner_id from public.learning_publications where public_id=r.instructor_id;
 if r.student_id=auth.uid() and decision='cancelled' and r.status in ('requested','acknowledged') then
  update public.learning_lesson_requests set status=decision where id=request_id;
 elsif owner_id=auth.uid() and decision in ('acknowledged','declined') and r.status='requested' then
  update public.learning_lesson_requests set status=decision where id=request_id;
 else raise exception 'REQUEST_ACTION_DENIED'; end if;
end;
$$;

create or replace function public.learning_staff_publications()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'public_id',p.public_id,'displayName',p.data#>>'{instructor,displayName}','revision',p.revision,'visible',public.learning_publication_visible(p),'active',p.active) order by p.published_at desc) from public.learning_publications p),'[]');
end;
$$;

-- No direct table privileges, including the public projection. Narrow RPCs only.
revoke all on function public.learning_publication_visible(public.learning_publications),public.learning_build_publication(uuid,bigint,integer[],uuid) from public,anon,authenticated;
revoke all on function public.learning_staff_publications(),public.learning_staff_publication_preview(uuid,bigint,integer[]),public.publish_learning_instructor(uuid,bigint,integer[]),public.unpublish_learning_instructor(uuid),
 public.learning_save_student_profile(text,text,text,text,text[]),public.learning_student_dashboard(),public.learning_set_favorite(uuid,boolean),
 public.learning_instructor_dashboard(),public.learning_save_availability(timestamptz,timestamptz,text[]),public.learning_remove_availability(uuid),
 public.learning_request_lesson(uuid,text,text,text),public.learning_update_lesson_request(uuid,text),public.learning_public_catalog(),public.learning_public_slots(uuid) from public,anon,authenticated;
grant execute on function public.learning_staff_publications(),public.learning_staff_publication_preview(uuid,bigint,integer[]),public.publish_learning_instructor(uuid,bigint,integer[]),public.unpublish_learning_instructor(uuid),
 public.learning_save_student_profile(text,text,text,text,text[]),public.learning_student_dashboard(),public.learning_set_favorite(uuid,boolean),
 public.learning_instructor_dashboard(),public.learning_save_availability(timestamptz,timestamptz,text[]),public.learning_remove_availability(uuid),
 public.learning_request_lesson(uuid,text,text,text),public.learning_update_lesson_request(uuid,text) to authenticated;
grant execute on function public.learning_public_catalog(),public.learning_public_slots(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
