-- ============================================================
-- Upgrind online: contas, save na nuvem e placar (Supabase)
-- Cole tudo no SQL Editor do projeto e clique em "Run".
-- Pode rodar de novo sem problema: tudo usa "if not exists"/"or replace".
-- ============================================================

-- Perfis: o apelido público de cada conta
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 2 and 20),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_name_lower on public.profiles (lower(name));
alter table public.profiles enable row level security;
drop policy if exists "perfis são públicos" on public.profiles;
create policy "perfis são públicos" on public.profiles for select using (true);
drop policy if exists "cada um cria o próprio perfil" on public.profiles;
create policy "cada um cria o próprio perfil" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "cada um edita o próprio perfil" on public.profiles;
create policy "cada um edita o próprio perfil" on public.profiles for update using (auth.uid() = id);

-- Saves na nuvem: slot 0 = perfil (progresso permanente), slots 1 a 3 = jornadas. Só o dono enxerga.
create table if not exists public.saves (
  user_id uuid not null references auth.users on delete cascade,
  slot int not null check (slot between 0 and 3),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.saves drop constraint if exists saves_slot_check;
alter table public.saves add constraint saves_slot_check check (slot between 0 and 3);
alter table public.saves enable row level security;
drop policy if exists "dono lê os saves" on public.saves;
create policy "dono lê os saves" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "dono cria saves" on public.saves;
create policy "dono cria saves" on public.saves for insert with check (auth.uid() = user_id);
drop policy if exists "dono atualiza saves" on public.saves;
create policy "dono atualiza saves" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "dono apaga saves" on public.saves;
create policy "dono apaga saves" on public.saves for delete using (auth.uid() = user_id);

-- Placar: a melhor marca de cada conta (todos podem ver; só a função abaixo grava)
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  hero text,
  cls text,
  species text,
  max_zone int not null default 0,
  max_hit double precision not null default 0,
  play_time double precision not null default 0,  -- segundos, somando os slots da conta
  level int not null default 0,
  ascensions int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.leaderboard enable row level security;
drop policy if exists "placar é público" on public.leaderboard;
create policy "placar é público" on public.leaderboard for select using (true);

-- Envia as marcas da conta logada. Só aumenta (nunca diminui) cada recorde.
create or replace function public.submit_score(
  p_hero text, p_cls text, p_species text,
  p_zone int, p_hit double precision, p_time double precision, p_level int, p_asc int
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select name into v_name from profiles where id = auth.uid();
  if v_name is null then raise exception 'no profile'; end if;
  -- limites de sanidade contra valores absurdos
  p_zone := least(greatest(coalesce(p_zone, 0), 0), 100000);
  p_level := least(greatest(coalesce(p_level, 0), 0), 100000);
  p_asc := least(greatest(coalesce(p_asc, 0), 0), 100000);
  p_hit := least(greatest(coalesce(p_hit, 0), 0), 1e300);
  p_time := least(greatest(coalesce(p_time, 0), 0), 1e9);
  insert into leaderboard as l (user_id, name, hero, cls, species, max_zone, max_hit, play_time, level, ascensions, updated_at)
  values (auth.uid(), v_name, left(p_hero, 40), left(p_cls, 60), left(p_species, 60), p_zone, p_hit, p_time, p_level, p_asc, now())
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

-- Mantém o apelido do placar igual ao do perfil
create or replace function public.sync_leaderboard_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update leaderboard set name = new.name where user_id = new.id;
  return new;
end $$;
drop trigger if exists profiles_name_sync on public.profiles;
create trigger profiles_name_sync after update of name on public.profiles
  for each row execute function public.sync_leaderboard_name();
