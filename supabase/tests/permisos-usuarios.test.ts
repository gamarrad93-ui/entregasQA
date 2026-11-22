/**
 * Reglas de permisos (RLS) de usuarios, padrón y roles.
 * Corre contra un Postgres real (PGlite) con las migraciones del repo.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { cedulaDePrueba, como, crearBase, crearCuenta } from './db';

let db: PGlite;
const CI = {
  admin: cedulaDePrueba(1111111),
  docente: cedulaDePrueba(2222222),
  ana: cedulaDePrueba(3333333),
  bruno: cedulaDePrueba(4444444),
  fuera: cedulaDePrueba(5555555), // no está en el padrón
  baja: cedulaDePrueba(6666666),
};
const id: Record<string, string> = {};

async function falla(p: Promise<unknown>, texto?: string) {
  let error: unknown = null;
  try {
    await p;
  } catch (e) {
    error = e;
  }
  expect(error, 'se esperaba un error').not.toBeNull();
  if (texto) expect(String((error as Error).message)).toContain(texto);
}

beforeAll(async () => {
  db = await crearBase();
  // padrón inicial (como superusuario, igual que en el SQL Editor)
  await db.query(
    `insert into padron (cedula, nombre, apellido, grupo, rol, activo) values
     ($1,'Diego','Admin','Docentes','docente',true),
     ($2,'Dora','Docente','Docentes','docente',true),
     ($3,'Ana','Pérez','G1','alumno',true),
     ($4,'Bruno','Silva','G2','alumno',true),
     ($5,'Beto','DeBaja','G1','alumno',false)`,
    [CI.admin, CI.docente, CI.ana, CI.bruno, CI.baja],
  );
  id.admin = await crearCuenta(db, CI.admin);
  await db.query(`update perfiles set rol = 'admin' where cedula = $1`, [CI.admin]); // paso manual del primer admin
  id.docente = await crearCuenta(db, CI.docente);
  id.ana = await crearCuenta(db, CI.ana);
  id.bruno = await crearCuenta(db, CI.bruno);
});

describe('Cédula', () => {
  it('valida el dígito verificador y normaliza', async () => {
    const r = await como<{ a: boolean; b: boolean; n: string }>(
      db,
      null,
      `select cedula_valida('12345672') a, cedula_valida('12345673') b, normalizar_cedula('1.234.567-2') n`,
    );
    expect(r[0]).toEqual({ a: true, b: false, n: '12345672' });
  });
});

describe('Alta de cuentas', () => {
  it('solo se registran cédulas del padrón (activas)', async () => {
    await falla(crearCuenta(db, CI.fuera), 'CEDULA_NO_HABILITADA');
    await falla(crearCuenta(db, CI.baja), 'CEDULA_NO_HABILITADA');
    await falla(db.query(`insert into auth.users (email) values ('alguien@gmail.com')`), 'CEDULA_NO_HABILITADA');
  });

  it('el perfil se crea con el rol del padrón', async () => {
    const r = await db.query<{ cedula: string; rol: string }>(`select cedula, rol from perfiles order by cedula`);
    expect(r.rows.find((x) => x.cedula === CI.ana)?.rol).toBe('alumno');
    expect(r.rows.find((x) => x.cedula === CI.docente)?.rol).toBe('docente');
  });

  it('estado_cedula lo puede consultar cualquiera (pantalla "Primera vez")', async () => {
    const q = (c: string) => como<{ e: string }>(db, null, `select estado_cedula($1) e`, [c]).then((r) => r[0].e);
    expect(await q(CI.ana)).toBe('registrada');
    expect(await q(CI.fuera)).toBe('no_habilitada');
    expect(await q('12345673')).toBe('invalida');
    await db.query(`insert into padron (cedula, nombre) values ($1, 'Nuevo')`, [CI.fuera]);
    expect(await q(CI.fuera)).toBe('disponible');
    await db.query(`delete from padron where cedula = $1`, [CI.fuera]);
  });
});

describe('Perfiles y roles', () => {
  it('un alumno ve solo su perfil; el docente ve todos', async () => {
    const a = await como(db, id.ana, `select cedula from perfiles`);
    expect(a).toEqual([{ cedula: CI.ana }]);
    const d = await como(db, id.docente, `select cedula from perfiles`);
    expect(d.length).toBe(4);
  });

  it('nadie puede cambiar su propio rol (ni el de otro) directamente', async () => {
    await falla(como(db, id.ana, `update perfiles set rol = 'admin' where id = $1`, [id.ana]));
    await falla(como(db, id.docente, `update perfiles set rol = 'admin' where id = $1`, [id.docente]));
    await falla(como(db, id.admin, `update perfiles set rol = 'docente' where id = $1`, [id.bruno]));
    await falla(como(db, id.ana, `insert into perfiles (id, cedula, rol) values (gen_random_uuid(), '00000000', 'admin')`));
    const r = await db.query<{ rol: string }>(`select rol from perfiles where id = $1`, [id.ana]);
    expect(r.rows[0].rol).toBe('alumno');
  });

  it('un alumno no puede leer ni tocar el padrón', async () => {
    expect(await como(db, id.ana, `select * from padron`)).toEqual([]);
    await falla(como(db, id.ana, `insert into padron (cedula, nombre) values ($1, 'X')`, [CI.fuera]));
    const upd = await como(db, id.ana, `update padron set rol = 'docente' where cedula = $1 returning cedula`, [CI.ana]);
    expect(upd).toEqual([]);
  });

  it('un docente no puede hacerse docente a otro ni volverse admin vía padrón', async () => {
    await falla(como(db, id.docente, `update padron set rol = 'docente' where cedula = $1`, [CI.ana]));
    await falla(como(db, id.docente, `insert into padron (cedula, nombre, rol) values ($1, 'X', 'docente')`, [CI.fuera]));
    // el check del padrón no admite 'admin' ni para el superusuario
    await falla(db.query(`update padron set rol = 'admin' where cedula = $1`, [CI.ana]));
    await falla(como(db, id.docente, `select asignar_docente($1, true, 'X', 'Y')`, [CI.ana]), 'SOLO_ADMIN');
  });

  it('el docente puede editar el padrón de alumnos y el cambio llega al perfil', async () => {
    await como(db, id.docente, `update padron set grupo = 'G3' where cedula = $1`, [CI.bruno]);
    const r = await db.query<{ grupo: string }>(`select grupo from perfiles where id = $1`, [id.bruno]);
    expect(r.rows[0].grupo).toBe('G3');
  });

  it('el admin pone y saca el rol docente, pero nunca crea admins ni toca al admin', async () => {
    await como(db, id.admin, `select asignar_docente($1, true)`, [CI.bruno]);
    expect((await db.query<{ rol: string }>(`select rol from perfiles where id = $1`, [id.bruno])).rows[0].rol).toBe('docente');
    await como(db, id.admin, `select asignar_docente($1, false)`, [CI.bruno]);
    expect((await db.query<{ rol: string }>(`select rol from perfiles where id = $1`, [id.bruno])).rows[0].rol).toBe('alumno');
    await falla(como(db, id.admin, `select asignar_docente($1, false)`, [CI.admin]), 'NO_SE_PUEDE_CAMBIAR_ADMIN');
    const lista = await como<{ cedula: string }>(db, id.admin, `select cedula from listar_docentes()`);
    expect(lista.map((x) => x.cedula).sort()).toEqual([CI.admin, CI.docente].sort());
  });

  it('un alumno dado de baja pierde los permisos de su rol', async () => {
    await db.query(`insert into padron (cedula, nombre, rol) values ($1, 'Temporal', 'docente')`, [CI.fuera]);
    const idT = await crearCuenta(db, CI.fuera);
    expect((await como<{ d: boolean }>(db, idT, `select es_docente() d`))[0].d).toBe(true);
    await db.query(`update padron set activo = false where cedula = $1`, [CI.fuera]);
    expect((await como<{ d: boolean }>(db, idT, `select es_docente() d`))[0].d).toBe(false);
    const p = await como<{ activo: boolean }>(db, idT, `select activo from mi_perfil()`);
    expect(p[0].activo).toBe(false);
  });
});

describe('Blanqueo de contraseña', () => {
  const blanqueo = (sol: string, ced: string) => como(db, null, `select objetivo_blanqueo($1, $2) id`, [sol, ced], 'service_role');

  it('solo lo usa la service_role (la Edge Function), no la app', async () => {
    await falla(como(db, id.docente, `select objetivo_blanqueo($1, $2)`, [id.docente, CI.ana]));
    await falla(como(db, null, `select objetivo_blanqueo($1, $2)`, [id.docente, CI.ana]));
  });

  it('docente → alumno sí; alumno → nadie; docente → docente/admin no', async () => {
    const r = await blanqueo(id.docente, CI.ana);
    expect(r[0].id).toBe(id.ana);
    expect((await db.query<{ d: boolean }>(`select debe_cambiar_clave d from perfiles where id = $1`, [id.ana])).rows[0].d).toBe(true);
    await falla(blanqueo(id.bruno, CI.ana), 'SOLO_DOCENTE');
    await falla(blanqueo(id.docente, CI.admin), 'NO_PERMITIDO');
    await falla(blanqueo(id.docente, CI.docente), 'NO_PERMITIDO');
    await falla(blanqueo(id.docente, cedulaDePrueba(7777777)), 'SIN_CUENTA');
  });

  it('el admin puede blanquear a un docente; marcar_clave_cambiada lo destraba', async () => {
    const r = await blanqueo(id.admin, CI.docente);
    expect(r[0].id).toBe(id.docente);
    await como(db, id.docente, `select marcar_clave_cambiada()`);
    expect((await db.query<{ d: boolean }>(`select debe_cambiar_clave d from perfiles where id = $1`, [id.docente])).rows[0].d).toBe(false);
  });
});
