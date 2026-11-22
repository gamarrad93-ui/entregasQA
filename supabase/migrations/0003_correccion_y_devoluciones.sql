-- =====================================================================
-- 0003 · Corrección del docente: anulaciones y devoluciones
-- ---------------------------------------------------------------------
-- Se puede correr más de una vez. Requiere 0001 y 0002.
--
--   * anulaciones : cuando el docente cambia un veredicto automático (✓ ↔ ✗).
--                   Nunca se pisa el resultado automático: se guarda aparte.
--                   "Deshacer" no borra: marca la anulación como deshecha
--                   (queda el historial). Vigente = deshecha_en is null.
--   * devoluciones: comentario general del docente y la "foto" de la
--                   devolución (✓/✗ final por valor) que ve el alumno.
--                   El alumno la ve SOLO si el docente la publicó
--                   (por entrega o por práctico).
-- =====================================================================

create table if not exists public.anulaciones (
  id                uuid primary key default gen_random_uuid(),
  entrega           uuid not null references public.entregas (id) on delete cascade,
  campo             text not null,
  veredicto_auto    boolean,          -- null = el alumno no lo completó
  veredicto_docente boolean not null,
  comentario        text not null default '',
  docente           uuid not null default auth.uid() references public.perfiles (id),
  fecha             timestamptz not null default now(),
  deshecha_en       timestamptz,
  deshecha_por      uuid references public.perfiles (id)
);

create unique index if not exists anulaciones_vigente
  on public.anulaciones (entrega, campo) where deshecha_en is null;

create table if not exists public.devoluciones (
  entrega     uuid primary key references public.entregas (id) on delete cascade,
  comentario  text not null default '',
  items       jsonb,                 -- foto de la devolución (la arma la app del docente)
  nota        numeric,               -- % final (con las anulaciones)
  actualizada timestamptz not null default now(),
  docente     uuid references public.perfiles (id)
);

-- ¿Puede este usuario ver la devolución de esta entrega?
create or replace function public.devolucion_visible(p_entrega uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entregas e
    join public.practicos p on p.id = e.practica
    where e.id = p_entrega
      and e.alumno = auth.uid()
      and e.entrega is not null
      and (e.devolucion_publicada or p.devolucion_publicada)
  ) and public.mi_rol() is not null
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.anulaciones enable row level security;
alter table public.devoluciones enable row level security;

revoke all on public.anulaciones from anon, authenticated;
revoke all on public.devoluciones from anon, authenticated;
grant select on public.anulaciones to authenticated;           -- se escribe solo con las funciones
grant select, insert, update on public.devoluciones to authenticated;

drop policy if exists anulaciones_leer on public.anulaciones;
create policy anulaciones_leer on public.anulaciones
  for select to authenticated
  using (public.es_docente());

drop policy if exists devoluciones_leer on public.devoluciones;
create policy devoluciones_leer on public.devoluciones
  for select to authenticated
  using (public.es_docente() or public.devolucion_visible(entrega));

drop policy if exists devoluciones_crear on public.devoluciones;
create policy devoluciones_crear on public.devoluciones
  for insert to authenticated
  with check (public.es_docente());

drop policy if exists devoluciones_modificar on public.devoluciones;
create policy devoluciones_modificar on public.devoluciones
  for update to authenticated
  using (public.es_docente())
  with check (public.es_docente());

create or replace function public.al_guardar_devolucion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizada := now();
  new.docente := auth.uid();
  return new;
end
$$;

drop trigger if exists al_guardar_devolucion on public.devoluciones;
create trigger al_guardar_devolucion
  before insert or update on public.devoluciones
  for each row execute function public.al_guardar_devolucion();

-- ---------------------------------------------------------------------
-- Funciones del docente
-- ---------------------------------------------------------------------

-- Anular (o cambiar una anulación): la anterior queda como deshecha.
create or replace function public.anular(
  p_entrega uuid, p_campo text, p_veredicto_auto boolean, p_veredicto_docente boolean, p_comentario text default ''
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  nuevo uuid;
begin
  if not public.es_docente() then
    raise exception 'SOLO_DOCENTE';
  end if;
  if not exists (select 1 from public.entregas where id = p_entrega and entrega is not null) then
    raise exception 'ENTREGA_NO_ENCONTRADA';
  end if;
  update public.anulaciones
     set deshecha_en = now(), deshecha_por = auth.uid()
   where entrega = p_entrega and campo = p_campo and deshecha_en is null;
  insert into public.anulaciones (entrega, campo, veredicto_auto, veredicto_docente, comentario, docente)
  values (p_entrega, p_campo, p_veredicto_auto, p_veredicto_docente, coalesce(p_comentario, ''), auth.uid())
  returning id into nuevo;
  return nuevo;
end
$$;

-- Deshacer: vuelve al veredicto automático.
create or replace function public.deshacer_anulacion(p_entrega uuid, p_campo text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_docente() then
    raise exception 'SOLO_DOCENTE';
  end if;
  update public.anulaciones
     set deshecha_en = now(), deshecha_por = auth.uid()
   where entrega = p_entrega and campo = p_campo and deshecha_en is null;
end
$$;

-- ---------------------------------------------------------------------
-- Reabrir / cerrar una entrega (aunque el alumno nunca haya abierto la planilla).
-- Si no existe la fila, la crea vacía y reabierta.
-- ---------------------------------------------------------------------
create or replace function public.al_guardar_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.es_docente() then
      -- solo desde reabrir_entrega(): fila vacía, sin contenido del alumno
      if coalesce(current_setting('entregas.reabrir', true), '') <> '1' then
        raise exception 'SOLO_ALUMNOS_ENTREGAN';
      end if;
      new.borrador := null;
      new.borrador_guardado := null;
      new.entrega := null;
      new.enviada_en := null;
      new.devolucion_publicada := false;
      new.creada := now();
      return new;
    end if;
    new.alumno := auth.uid();
    new.reabierta := false;
    new.devolucion_publicada := false;
    new.creada := now();
    new.borrador_guardado := case when new.borrador is not null then now() end;
    new.enviada_en := case when new.entrega is not null then now() end;
    return new;
  end if;

  new.id := old.id;
  new.alumno := old.alumno;
  new.practica := old.practica;
  new.creada := old.creada;

  if public.es_docente() then
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

create or replace function public.reabrir_entrega(p_alumno uuid, p_practica text, p_valor boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_docente() then
    raise exception 'SOLO_DOCENTE';
  end if;
  if not exists (select 1 from public.perfiles where id = p_alumno and rol = 'alumno') then
    raise exception 'NO_ES_ALUMNO';
  end if;
  perform set_config('entregas.reabrir', '1', true);
  insert into public.entregas (alumno, practica, reabierta)
  values (p_alumno, p_practica, p_valor)
  on conflict (alumno, practica) do update set reabierta = excluded.reabierta;
  perform set_config('entregas.reabrir', '', true);
end
$$;

revoke all on function public.al_guardar_entrega() from public, anon, authenticated;
revoke all on function public.reabrir_entrega(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reabrir_entrega(uuid, text, boolean) to authenticated;

revoke all on function public.devolucion_visible(uuid) from public, anon, authenticated;
revoke all on function public.al_guardar_devolucion() from public, anon, authenticated;
revoke all on function public.anular(uuid, text, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.deshacer_anulacion(uuid, text) from public, anon, authenticated;
grant execute on function public.devolucion_visible(uuid) to authenticated;
grant execute on function public.anular(uuid, text, boolean, boolean, text) to authenticated;
grant execute on function public.deshacer_anulacion(uuid, text) to authenticated;
