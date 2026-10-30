-- Ranking de "Escapale al Lunes" para Supabase.
-- Pegar todo en el SQL Editor del proyecto y ejecutar (se puede correr de nuevo sin romper nada).
-- La tabla no se puede leer ni escribir directo con la clave pública: todo pasa por estas funciones.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.players (
  handle     text primary key check (handle ~ '^[a-z0-9._]{1,30}$'),
  token_hash text not null,               -- hash del secreto del dispositivo que anotó el usuario
  score      integer not null default 0 check (score >= 0),
  meters     integer not null default 0 check (meters >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
revoke all on public.players from anon, authenticated;

create index if not exists players_score_idx on public.players (score desc);

-- Anota un usuario para un dispositivo. 'ok' si quedó anotado (o ya era de este dispositivo),
-- 'taken' si lo anotó otro, 'invalid' si el usuario o el secreto no sirven.
create or replace function public.register_player(p_handle text, p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text := lower(trim(p_handle));
  th text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  owner text;
begin
  if h !~ '^[a-z0-9._]{1,30}$' or length(coalesce(p_token, '')) < 32 then
    return 'invalid';
  end if;
  insert into players (handle, token_hash) values (h, th) on conflict (handle) do nothing;
  select token_hash into owner from players where handle = h;
  return case when owner = th then 'ok' else 'taken' end;
end;
$$;

-- Sube un puntaje (se guarda solo si mejora el anterior) y devuelve el puesto.
-- -1 si el secreto no corresponde al usuario o el puntaje no es creíble.
create or replace function public.submit_score(p_handle text, p_token text, p_score integer, p_meters integer)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text := lower(trim(p_handle));
  th text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  best integer;
begin
  -- Puntaje = metros × multiplicador (x2 como máximo) + fichitas: no puede pasar de ~3 por metro
  if p_score < 0 or p_meters < 0 or p_meters > 200000 or p_score > p_meters * 3 + 200 then
    return -1;
  end if;
  update players
     set score = greatest(score, p_score),
         meters = case when p_score > score then p_meters else meters end,
         updated_at = case when p_score > score then now() else updated_at end
   where handle = h and token_hash = th
  returning score into best;
  if best is null then
    return -1;
  end if;
  return 1 + (select count(*) from players where score > best);
end;
$$;

-- Top N por puntaje, más la fila del usuario pedido si quedó afuera del top.
create or replace function public.get_ranking(p_limit integer default 50, p_handle text default null)
returns table (pos bigint, handle text, score integer, meters integer)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select rank() over (order by p.score desc) as pos, p.handle, p.score, p.meters, p.updated_at
      from players p
     where p.score > 0
  )
  select r.pos, r.handle, r.score, r.meters
    from ranked r
   where r.pos <= least(greatest(p_limit, 1), 200) or r.handle = lower(p_handle)
   order by r.pos, r.updated_at;
$$;

revoke all on function public.register_player(text, text) from public;
revoke all on function public.submit_score(text, text, integer, integer) from public;
revoke all on function public.get_ranking(integer, text) from public;
grant execute on function public.register_player(text, text) to anon, authenticated;
grant execute on function public.submit_score(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_ranking(integer, text) to anon, authenticated;
