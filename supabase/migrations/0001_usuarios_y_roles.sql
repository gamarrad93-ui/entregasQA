-- =====================================================================
-- 0001 · Usuarios, padrón y roles
-- ---------------------------------------------------------------------
-- Se puede correr más de una vez (no rompe nada si ya existe).
-- Cómo correrlo: Supabase → SQL Editor → New query → pegar todo → Run.
--
-- Idea general:
--   * padron   : lista de cédulas habilitadas para crear cuenta (la carga el docente).
--   * perfiles : una fila por cuenta creada (id = auth.uid()), con su rol.
--   * Toda la seguridad está en las políticas RLS y en funciones con
--     controles adentro: la interfaz solo esconde botones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cédula uruguaya: se guarda siempre con 8 dígitos (con ceros a la izquierda)
-- y se valida el dígito verificador (pesos 2-9-8-7-6-3-4).
-- ---------------------------------------------------------------------
create or replace function public.normalizar_cedula(c text)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when c is null then null
    when length(regexp_replace(c, '\D', '', 'g')) between 7 and 8
      then lpad(regexp_replace(c, '\D', '', 'g'), 8, '0')
    else regexp_replace(c, '\D', '', 'g')
  end
$$;

create or replace function public.cedula_valida(c text)
returns boolean
language plpgsql immutable
set search_path = public
as $$
declare
  pesos int[] := array[2, 9, 8, 7, 6, 3, 4];
  suma int := 0;
  i int;
begin
  if c is null or c !~ '^\d{8}$' then
    return false;
  end if;
  for i in 1..7 loop
    suma := suma + substr(c, i, 1)::int * pesos[i];
  end loop;
  return (10 - suma % 10) % 10 = substr(c, 8, 1)::int;
end
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.padron (
  cedula      text primary key check (public.cedula_valida(cedula)),
  nombre      text not null,
  apellido    text not null default '',
  grupo       text not null default '',
  -- 'docente' lo pone solo el admin (pantalla Docentes). Nunca 'admin'.
  rol         text not null default 'alumno' check (rol in ('alumno', 'docente')),
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.perfiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  cedula             text not null unique,
  nombre             text not null default '',
  apellido           text not null default '',
  grupo              text not null default '',
  rol                text not null default 'alumno' check (rol in ('alumno', 'docente', 'admin')),
  debe_cambiar_clave boolean not null default false,
  creado             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ayudantes para las políticas (security definer: leen perfiles sin RLS)
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text
language sql stable security definer
set search_path = public
as $$
  select p.rol
  from public.perfiles p
  left join public.padron pa on pa.cedula = p.cedula
  where p.id = auth.uid()
    and (p.rol = 'admin' or coalesce(pa.activo, false))
$$;

create or replace function public.es_docente()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.mi_rol() in ('docente', 'admin'), false) $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.mi_rol() = 'admin', false) $$;

-- ---------------------------------------------------------------------
-- Alta de cuenta: solo cédulas del padrón (activas).
-- Supabase Auth usa el mail ficticio <cedula>@entregas.local.
-- Si la cédula no está habilitada, la creación de la cuenta FALLA.
-- ---------------------------------------------------------------------
create or replace function public.al_crear_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  ced text;
  fila public.padron%rowtype;
begin
  if new.email is null or lower(new.email) !~ '^\d{8}@entregas\.local$' then
    raise exception 'CEDULA_NO_HABILITADA';
  end if;
  ced := split_part(lower(new.email), '@', 1);
  select * into fila from public.padron where cedula = ced and activo;
  if not found then
    raise exception 'CEDULA_NO_HABILITADA';
  end if;
  insert into public.perfiles (id, cedula, nombre, apellido, grupo, rol)
  values (new.id, ced, fila.nombre, fila.apellido, fila.grupo, fila.rol);
  return new;
end
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- Cambios en el padrón (nombre, grupo, rol docente) se copian al perfil.
-- El rol 'admin' nunca se toca desde acá.
create or replace function public.al_cambiar_padron()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.actualizado := now();
  update public.perfiles
     set nombre = new.nombre,
         apellido = new.apellido,
         grupo = new.grupo,
         rol = case when rol = 'admin' then 'admin' else new.rol end
   where cedula = new.cedula;
  return new;
end
$$;

drop trigger if exists al_cambiar_padron on public.padron;
create trigger al_cambiar_padron
  before update on public.padron
  for each row execute function public.al_cambiar_padron();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.padron enable row level security;
alter table public.perfiles enable row level security;

revoke all on public.padron from anon, authenticated;
revoke all on public.perfiles from anon, authenticated;
grant select, insert, update, delete on public.padron to authenticated;
grant select on public.perfiles to authenticated;

-- perfiles: cada uno ve el suyo; el docente ve todos. Nadie lo modifica
-- directamente (no hay políticas de insert/update/delete): solo las funciones.
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_docente());

-- padrón: lo ve y lo edita el docente, pero solo filas de alumnos.
-- Las filas de docentes se manejan con asignar_docente() (solo admin).
drop policy if exists padron_leer on public.padron;
create policy padron_leer on public.padron
  for select to authenticated
  using (public.es_docente());

drop policy if exists padron_insertar on public.padron;
create policy padron_insertar on public.padron
  for insert to authenticated
  with check (public.es_docente() and rol = 'alumno');

drop policy if exists padron_modificar on public.padron;
create policy padron_modificar on public.padron
  for update to authenticated
  using (public.es_docente() and rol = 'alumno')
  with check (public.es_docente() and rol = 'alumno');

drop policy if exists padron_borrar on public.padron;
create policy padron_borrar on public.padron
  for delete to authenticated
  using (public.es_docente() and rol = 'alumno');

-- ---------------------------------------------------------------------
-- Funciones que llama la app
-- ---------------------------------------------------------------------

-- Antes de crear la cuenta: ¿la cédula está habilitada? (pantalla "Primera vez")
create or replace function public.estado_cedula(p_cedula text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  ced text := public.normalizar_cedula(p_cedula);
begin
  if not public.cedula_valida(ced) then
    return 'invalida';
  end if;
  if exists (select 1 from public.perfiles where cedula = ced) then
    return 'registrada';
  end if;
  if exists (select 1 from public.padron where cedula = ced and activo) then
    return 'disponible';
  end if;
  return 'no_habilitada';
end
$$;

-- Mi perfil (con el estado en el padrón). Si me dieron de baja, activo = false.
create or replace function public.mi_perfil()
returns table (
  id uuid, cedula text, nombre text, apellido text, grupo text,
  rol text, debe_cambiar_clave boolean, activo boolean
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.cedula, p.nombre, p.apellido, p.grupo, p.rol, p.debe_cambiar_clave,
         (p.rol = 'admin' or coalesce(pa.activo, false)) as activo
  from public.perfiles p
  left join public.padron pa on pa.cedula = p.cedula
  where p.id = auth.uid()
$$;

-- Después de cambiar la contraseña temporal.
create or replace function public.marcar_clave_cambiada()
returns void
language sql security definer
set search_path = public
as $$
  update public.perfiles set debe_cambiar_clave = false where id = auth.uid()
$$;

-- Pantalla "Docentes" (solo admin): poner o sacar el rol docente a una cédula.
-- Si la persona no está en el padrón se agrega (grupo "Docentes").
-- Nunca convierte a nadie en admin y nunca toca a un admin.
create or replace function public.asignar_docente(
  p_cedula text, p_es_docente boolean, p_nombre text default null, p_apellido text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  ced text := public.normalizar_cedula(p_cedula);
begin
  if not public.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  if not public.cedula_valida(ced) then
    raise exception 'CEDULA_INVALIDA';
  end if;
  if exists (select 1 from public.perfiles where cedula = ced and rol = 'admin') then
    raise exception 'NO_SE_PUEDE_CAMBIAR_ADMIN';
  end if;
  if p_es_docente then
    if exists (select 1 from public.padron where cedula = ced) then
      update public.padron
         set rol = 'docente', activo = true,
             nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
             apellido = coalesce(nullif(trim(p_apellido), ''), apellido)
       where cedula = ced;
    else
      if coalesce(trim(p_nombre), '') = '' then
        raise exception 'FALTA_NOMBRE';
      end if;
      insert into public.padron (cedula, nombre, apellido, grupo, rol)
      values (ced, trim(p_nombre), coalesce(trim(p_apellido), ''), 'Docentes', 'docente');
    end if;
  else
    update public.padron set rol = 'alumno' where cedula = ced;
    update public.perfiles set rol = 'alumno' where cedula = ced and rol = 'docente';
  end if;
end
$$;

-- Lista para la pantalla "Docentes" (solo admin).
create or replace function public.listar_docentes()
returns table (cedula text, nombre text, apellido text, rol text, tiene_cuenta boolean)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  return query
    select pa.cedula, pa.nombre, pa.apellido, coalesce(p.rol, pa.rol), p.id is not null
    from public.padron pa
    left join public.perfiles p on p.cedula = pa.cedula
    where pa.rol = 'docente' or p.rol in ('docente', 'admin')
    union
    select p.cedula, p.nombre, p.apellido, p.rol, true
    from public.perfiles p
    where p.rol = 'admin' and not exists (select 1 from public.padron x where x.cedula = p.cedula)
    order by 3, 2;
end
$$;

-- Blanqueo de contraseña: la usa SOLO la Edge Function "blanquear-clave"
-- (con la service_role). Recibe quién lo pide y a quién; si está permitido,
-- marca que la persona debe cambiar la clave y devuelve su id.
--   * docente → puede blanquear alumnos
--   * admin   → alumnos y docentes
--   * a un admin no lo blanquea nadie desde la app
create or replace function public.objetivo_blanqueo(p_solicitante uuid, p_cedula text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  rol_sol text;
  obj public.perfiles%rowtype;
begin
  select p.rol into rol_sol
  from public.perfiles p
  left join public.padron pa on pa.cedula = p.cedula
  where p.id = p_solicitante and (p.rol = 'admin' or coalesce(pa.activo, false));
  if rol_sol is null or rol_sol not in ('docente', 'admin') then
    raise exception 'SOLO_DOCENTE';
  end if;
  select * into obj from public.perfiles where cedula = public.normalizar_cedula(p_cedula);
  if not found then
    raise exception 'SIN_CUENTA';
  end if;
  if obj.rol = 'admin' or (obj.rol = 'docente' and rol_sol <> 'admin') then
    raise exception 'NO_PERMITIDO';
  end if;
  update public.perfiles set debe_cambiar_clave = true where id = obj.id;
  return obj.id;
end
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución (por defecto Postgres deja ejecutar a todos)
-- ---------------------------------------------------------------------
revoke all on function public.normalizar_cedula(text) from public;
revoke all on function public.cedula_valida(text) from public;
revoke all on function public.mi_rol() from public;
revoke all on function public.es_docente() from public;
revoke all on function public.es_admin() from public;
revoke all on function public.al_crear_usuario() from public;
revoke all on function public.al_cambiar_padron() from public;
revoke all on function public.estado_cedula(text) from public;
revoke all on function public.mi_perfil() from public;
revoke all on function public.marcar_clave_cambiada() from public;
revoke all on function public.asignar_docente(text, boolean, text, text) from public;
revoke all on function public.listar_docentes() from public;
revoke all on function public.objetivo_blanqueo(uuid, text) from public;

revoke all on function public.normalizar_cedula(text) from anon, authenticated;
revoke all on function public.cedula_valida(text) from anon, authenticated;
revoke all on function public.mi_rol() from anon, authenticated;
revoke all on function public.es_docente() from anon, authenticated;
revoke all on function public.es_admin() from anon, authenticated;
revoke all on function public.al_crear_usuario() from anon, authenticated;
revoke all on function public.al_cambiar_padron() from anon, authenticated;
revoke all on function public.estado_cedula(text) from anon, authenticated;
revoke all on function public.mi_perfil() from anon, authenticated;
revoke all on function public.marcar_clave_cambiada() from anon, authenticated;
revoke all on function public.asignar_docente(text, boolean, text, text) from anon, authenticated;
revoke all on function public.listar_docentes() from anon, authenticated;
revoke all on function public.objetivo_blanqueo(uuid, text) from anon, authenticated;

grant execute on function public.normalizar_cedula(text) to anon, authenticated;
grant execute on function public.cedula_valida(text) to anon, authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.es_docente() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.estado_cedula(text) to anon, authenticated;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.marcar_clave_cambiada() to authenticated;
grant execute on function public.asignar_docente(text, boolean, text, text) to authenticated;
grant execute on function public.listar_docentes() to authenticated;
grant execute on function public.objetivo_blanqueo(uuid, text) to service_role;
