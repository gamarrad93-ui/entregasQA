-- =====================================================================
-- Primer administrador (Diego). Se hace UNA sola vez, en dos partes.
-- Supabase → SQL Editor → New query → pegar → cambiar la cédula → Run.
-- La cédula va SOLO con números, con el dígito verificador (8 números;
-- si tiene 7, agregale un 0 adelante). Ej.: 1.234.567-2 → '12345672'
-- =====================================================================

-- PARTE 1 (antes de crear la cuenta): agregarte al padrón.
insert into public.padron (cedula, nombre, apellido, grupo, rol)
values ('TU_CEDULA', 'Diego', 'Gamarra', 'Docentes', 'docente')
on conflict (cedula) do update set rol = 'docente', activo = true;

-- Ahora andá a la app → "Primera vez" → tu cédula → creá tu contraseña.
-- Después volvé acá y corré la PARTE 2 (seleccioná solo esa línea y Run).

-- PARTE 2 (después de crear la cuenta): hacerte admin.
update public.perfiles set rol = 'admin' where cedula = 'TU_CEDULA';

-- Comprobar (tiene que decir admin):
select cedula, nombre, rol from public.perfiles where cedula = 'TU_CEDULA';
