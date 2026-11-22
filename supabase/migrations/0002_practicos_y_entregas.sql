-- =====================================================================
-- 0002 · Prácticos y entregas de los alumnos
-- ---------------------------------------------------------------------
-- Se puede correr más de una vez. Requiere la 0001.
--
--   * practicos : un registro por práctico (p1, p2, …): activo, fecha límite,
--                 devolución publicada. Lo edita el docente.
--   * entregas  : una fila por alumno y práctico.
--       borrador -> lo que el alumno va escribiendo (se guarda solo)
--       entrega  -> la copia que ENVIÓ (es la que corrige el docente)
--   El alumno puede editar hasta la fecha límite; después queda cerrada,
--   salvo que el docente la reabra.
-- =====================================================================

create table if not exists public.practicos (
  id                   text primary key,
  activo               boolean not null default false,
  fecha_limite         timestamptz,
  devolucion_publicada boolean not null default false,
  actualizado          timestamptz not null default now()
);

-- Prácticos habilitados por ahora (agregar más: una línea por práctico)
insert into public.practicos (id, activo) values ('p1', true)
on conflict (id) do nothing;

create table if not exists public.entregas (
  id                   uuid primary key default gen_random_uuid(),
  alumno               uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  practica             text not null references public.practicos (id),
  borrador             jsonb,
  borrador_guardado    timestamptz,
  entrega              jsonb,
  enviada_en           timestamptz,
  reabierta            boolean not null default false,
  devolucion_publicada boolean not null default false,
  creada               timestamptz not null default now(),
  unique (alumno, practica)
);

create index if not exists entregas_practica on public.entregas (practica);

-- ¿Se puede editar todavía? (práctico activo y dentro del plazo, o reabierta)
create or replace function public.practico_abierto(p_practica text, p_reabierta boolean)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.practicos
    where id = p_practica
      and activo
      and (fecha_limite is null or now() <= fecha_limite or coalesce(p_reabierta, false))
  )
$$;

-- Campos que el alumno NO puede tocar (los fija el servidor), y campos que
-- el docente NO puede tocar (el contenido de lo que escribió el alumno).
create or replace function public.al_guardar_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.es_docente() then
      raise exception 'SOLO_ALUMNOS_ENTREGAN';
    end if;
    new.alumno := auth.uid();
    new.reabierta := false;
    new.devolucion_publicada := false;
    new.creada := now();
    new.borrador_guardado := case when new.borrador is not null then now() end;
    new.enviada_en := case when new.entrega is not null then now() end;
    return new;
  end if;

  -- UPDATE: nunca cambian
  new.id := old.id;
  new.alumno := old.alumno;
  new.practica := old.practica;
  new.creada := old.creada;

  if public.es_docente() then
    -- el docente solo cambia reabierta / devolucion_publicada
    new.borrador := old.borrador;
    new.borrador_guardado := old.borrador_guardado;
    new.entrega := old.entrega;
    new.enviada_en := old.enviada_en;
  else
    new.reabierta := old.reabierta;
    new.devolucion_publicada := old.devolucion_publicada;
    new.borrador_guardado := case when new.borrador is distinct from old.borrador then now() else old.borrador_guardado end;
    new.enviada_en := case when new.entrega is distinct from old.entrega then now() else old.enviada_en end;
  end if;
  return new;
end
$$;

drop trigger if exists al_guardar_entrega on public.entregas;
create trigger al_guardar_entrega
  before insert or update on public.entregas
  for each row execute function public.al_guardar_entrega();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.practicos enable row level security;
alter table public.entregas enable row level security;

revoke all on public.practicos from anon, authenticated;
revoke all on public.entregas from anon, authenticated;
grant select, insert, update on public.practicos to authenticated;
grant select, insert, update on public.entregas to authenticated;

drop policy if exists practicos_leer on public.practicos;
create policy practicos_leer on public.practicos
  for select to authenticated
  using (public.mi_rol() is not null);

drop policy if exists practicos_crear on public.practicos;
create policy practicos_crear on public.practicos
  for insert to authenticated
  with check (public.es_docente());

drop policy if exists practicos_modificar on public.practicos;
create policy practicos_modificar on public.practicos
  for update to authenticated
  using (public.es_docente())
  with check (public.es_docente());

-- entregas: el alumno solo las suyas; el docente todas
drop policy if exists entregas_leer on public.entregas;
create policy entregas_leer on public.entregas
  for select to authenticated
  using ((alumno = auth.uid() and public.mi_rol() is not null) or public.es_docente());

drop policy if exists entregas_crear on public.entregas;
create policy entregas_crear on public.entregas
  for insert to authenticated
  with check (
    alumno = auth.uid()
    and public.mi_rol() = 'alumno'
    and public.practico_abierto(practica, false)
  );

drop policy if exists entregas_modificar_alumno on public.entregas;
create policy entregas_modificar_alumno on public.entregas
  for update to authenticated
  using (alumno = auth.uid() and public.mi_rol() = 'alumno' and public.practico_abierto(practica, reabierta))
  with check (alumno = auth.uid() and public.mi_rol() = 'alumno' and public.practico_abierto(practica, reabierta));

drop policy if exists entregas_modificar_docente on public.entregas;
create policy entregas_modificar_docente on public.entregas
  for update to authenticated
  using (public.es_docente())
  with check (public.es_docente());

-- (no hay política de borrado: nadie borra entregas desde la app)

revoke all on function public.practico_abierto(text, boolean) from public, anon, authenticated;
revoke all on function public.al_guardar_entrega() from public, anon, authenticated;
grant execute on function public.practico_abierto(text, boolean) to authenticated;
