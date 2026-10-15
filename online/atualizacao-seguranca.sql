-- ============================================================
-- Atualização de segurança do Upgrind online
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.
-- Não apaga nem altera dados de ninguém.
-- ============================================================

-- 1) Permissões mínimas (segunda tranca, além das regras RLS que já existem)
--    Visitante sem conta: só lê perfis (para checar apelido) e o placar.
--    Conta logada: cria/renomeia o próprio perfil e mexe só nos próprios saves.
--    O placar só é gravado pela função submit_score.
revoke all on table public.saves from anon;
revoke truncate, references, trigger on table public.saves from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated;
grant insert (id, name) on table public.profiles to authenticated;
grant update (name) on table public.profiles to authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.leaderboard from anon, authenticated;

-- 2) Apelidos: sem HTML, sem espaços nas pontas e sem caracteres invisíveis (usados para imitar outro jogador)
alter table public.profiles drop constraint if exists profiles_name_chars;
alter table public.profiles add constraint profiles_name_chars check (
  name = btrim(name)
  and name !~ '[[:cntrl:]<>"&`\\]'
  and name !~ '[\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
) not valid;

-- 3) Saves: no máximo 1 MB por slot (um save cheio tem uns 100 KB). Impede alguém de lotar o banco.
alter table public.saves drop constraint if exists saves_data_size;
alter table public.saves add constraint saves_data_size check (
  jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1000000
) not valid;

-- 4) Placar com moderação: marque "hidden" = true no Table Editor para esconder um trapaceiro.
--    Ele continua vendo a própria linha (não percebe que foi escondido); os outros não veem.
alter table public.leaderboard add column if not exists hidden boolean not null default false;
drop policy if exists "placar é público" on public.leaderboard;
create policy "placar é público" on public.leaderboard for select
  using (not hidden or (select auth.uid()) = user_id);

-- 5) Envio de marcas mais rígido
create or replace function public.submit_score(
  p_hero text, p_cls text, p_species text,
  p_zone int, p_hit double precision, p_time double precision, p_level int, p_asc int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_created timestamptz;
  v_row public.leaderboard%rowtype;
  v_max_time double precision;
  v_has boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select p.name, p.created_at into v_name, v_created from public.profiles p where p.id = v_uid;
  if v_name is null then raise exception 'no profile'; end if;
  select * into v_row from public.leaderboard l where l.user_id = v_uid;
  v_has := found;

  -- no máximo um envio a cada 20 segundos por conta (o jogo envia a cada 2 minutos)
  if v_has and v_row.updated_at > now() - interval '20 seconds' then return; end if;

  -- textos: só o que o jogo usa, sem HTML nem caracteres invisíveis
  p_hero := left(regexp_replace(coalesce(p_hero, ''), '[[:cntrl:]<>"&`\\\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]', '', 'g'), 24);
  p_cls := left(regexp_replace(coalesce(p_cls, ''), '[[:cntrl:]<>"&`\\\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]', '', 'g'), 60);
  p_species := left(regexp_replace(coalesce(p_species, ''), '[[:cntrl:]<>"&`\\\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]', '', 'g'), 60);

  -- limites de sanidade contra valores absurdos
  p_zone := least(greatest(coalesce(p_zone, 0), 0), 100000);
  p_level := least(greatest(coalesce(p_level, 0), 0), 100000);
  p_asc := least(greatest(coalesce(p_asc, 0), 0), 100000);
  p_hit := least(greatest(coalesce(p_hit, 0), 0), 1e300);

  -- o tempo de jogo conta em segundos reais: não pode crescer mais rápido que o relógio.
  -- Primeiro envio: até a idade da conta + 72 h (para quem jogou antes de criar a conta).
  if v_has then
    v_max_time := v_row.play_time + extract(epoch from now() - v_row.updated_at) + 900;
  else
    v_max_time := extract(epoch from now() - v_created) + 72 * 3600;
  end if;
  p_time := least(greatest(coalesce(p_time, 0), 0), v_max_time, 1e9);

  insert into public.leaderboard as l (user_id, name, hero, cls, species, max_zone, max_hit, play_time, level, ascensions, updated_at)
  values (v_uid, v_name, p_hero, p_cls, p_species, p_zone, p_hit, p_time, p_level, p_asc, now())
  on conflict (user_id) do update set
    name = excluded.name,
    hero = case when excluded.max_zone >= l.max_zone then excluded.hero else l.hero end,
    cls = case when excluded.max_zone >= l.max_zone then excluded.cls else l.cls end,
    species = case when excluded.max_zone >= l.max_zone then excluded.species else l.species end,
    max_zone = greatest(l.max_zone, excluded.max_zone),
    max_hit = greatest(l.max_hit, excluded.max_hit),
    play_time = greatest(l.play_time, excluded.play_time),
    level = greatest(l.level, excluded.level),
    ascensions = greatest(l.ascensions, excluded.ascensions),
    updated_at = now();
end $$;
revoke all on function public.submit_score(text, text, text, int, double precision, double precision, int, int) from public, anon;
grant execute on function public.submit_score(text, text, text, int, double precision, double precision, int, int) to authenticated;

-- 6) Gatilho do apelido com caminho de busca fixo (recomendação do Security Advisor do Supabase)
create or replace function public.sync_leaderboard_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.leaderboard set name = new.name where user_id = new.id;
  return new;
end $$;

-- Conferência: deve listar profiles_name_chars, saves_data_size e saves_slot_check
select conrelid::regclass as tabela, conname as regra
from pg_constraint
where conname in ('profiles_name_chars', 'saves_data_size', 'saves_slot_check')
order by 1, 2;
