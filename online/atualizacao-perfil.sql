-- ============================================================
-- Atualização: perfil na nuvem
-- O slot 0 da tabela saves passa a guardar o perfil (Almas, Altar, liberações,
-- Armas Ancestrais...). Os slots 1 a 3 continuam sendo as jornadas.
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.
-- ============================================================
alter table public.saves drop constraint if exists saves_slot_check;
alter table public.saves add constraint saves_slot_check check (slot between 0 and 3);
