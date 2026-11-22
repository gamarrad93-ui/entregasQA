/**
 * Reglas de permisos de prácticos y entregas:
 * cada alumno solo ve y escribe las suyas; plazo; reabrir; el docente lee todo.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { cedulaDePrueba, como, crearBase, crearCuenta } from './db';

let db: PGlite;
const id: Record<string, string> = {};
const CI = { docente: cedulaDePrueba(2222222), ana: cedulaDePrueba(3333333), bruno: cedulaDePrueba(4444444) };

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

const planilla = (x: string) => JSON.stringify({ practica: 'p1', muestra: x });

beforeAll(async () => {
  db = await crearBase();
  await db.query(
    `insert into padron (cedula, nombre, apellido, grupo, rol) values
     ($1,'Dora','Docente','Docentes','docente'), ($2,'Ana','Pérez','G1','alumno'), ($3,'Bruno','Silva','G2','alumno')`,
    [CI.docente, CI.ana, CI.bruno],
  );
  id.docente = await crearCuenta(db, CI.docente);
  id.ana = await crearCuenta(db, CI.ana);
  id.bruno = await crearCuenta(db, CI.bruno);
  await db.query(`insert into practicos (id, activo) values ('p2', false) on conflict do nothing`);
});

describe('Prácticos', () => {
  it('P1 viene activo; todos lo leen; solo el docente lo modifica', async () => {
    const r = await como<{ id: string; activo: boolean }>(db, id.ana, `select id, activo from practicos where id = 'p1'`);
    expect(r).toEqual([{ id: 'p1', activo: true }]);
    const cambio = await como(db, id.ana, `update practicos set fecha_limite = now() + interval '1 year' where id = 'p1' returning id`);
    expect(cambio).toEqual([]);
    await falla(como(db, id.ana, `insert into practicos (id, activo) values ('p9', true)`));
    const ok = await como(db, id.docente, `update practicos set fecha_limite = now() + interval '7 days' where id = 'p1' returning id`);
    expect(ok.length).toBe(1);
  });

  it('un anónimo no ve nada', async () => {
    await falla(como(db, null, `select * from practicos`));
  });
});

describe('Entregas', () => {
  it('el alumno crea su borrador y lo envía; el servidor pone la hora', async () => {
    const r = await como<{ alumno: string; enviada_en: string | null }>(
      db,
      id.ana,
      `insert into entregas (practica, borrador, enviada_en) values ('p1', $1, '2000-01-01') returning alumno, enviada_en`,
      [planilla('ana-borrador')],
    );
    expect(r[0].alumno).toBe(id.ana);
    expect(r[0].enviada_en).toBeNull(); // no puede inventar la hora de envío
    const env = await como<{ enviada_en: string | null }>(db, id.ana, `update entregas set entrega = borrador where practica = 'p1' returning enviada_en`);
    expect(env[0].enviada_en).not.toBeNull();
  });

  it('un alumno NO puede leer la entrega de otro', async () => {
    await como(db, id.bruno, `insert into entregas (practica, borrador) values ('p1', $1)`, [planilla('bruno')]);
    const deBruno = await como<{ alumno: string }>(db, id.bruno, `select alumno from entregas`);
    expect(deBruno).toEqual([{ alumno: id.bruno }]);
    const deAna = await como<{ alumno: string }>(db, id.ana, `select alumno from entregas`);
    expect(deAna).toEqual([{ alumno: id.ana }]);
  });

  it('un alumno NO puede escribir la entrega de otro ni crear una a nombre de otro', async () => {
    const r = await como(db, id.ana, `update entregas set borrador = '{"hack":1}' where alumno = $1 returning id`, [id.bruno]);
    expect(r).toEqual([]);
    // si intenta poner otro alumno, el servidor usa el suyo (y ya tiene una → choca)
    await falla(como(db, id.ana, `insert into entregas (alumno, practica) values ($1, 'p1')`, [id.bruno]));
    const b = await db.query<{ borrador: { muestra: string } }>(`select borrador from entregas where alumno = $1`, [id.bruno]);
    expect(b.rows[0].borrador.muestra).toBe('bruno');
  });

  it('el alumno no puede reabrirse la entrega ni publicarse la devolución', async () => {
    await como(db, id.ana, `update entregas set reabierta = true, devolucion_publicada = true, alumno = $1 where practica = 'p1'`, [id.bruno]);
    const r = await db.query<{ reabierta: boolean; devolucion_publicada: boolean; alumno: string }>(
      `select reabierta, devolucion_publicada, alumno from entregas where alumno = $1`,
      [id.ana],
    );
    expect(r.rows[0]).toEqual({ reabierta: false, devolucion_publicada: false, alumno: id.ana });
  });

  it('no se entrega en un práctico desactivado', async () => {
    await falla(como(db, id.ana, `insert into entregas (practica, borrador) values ('p2', '{}')`));
  });

  it('después de la fecha límite queda cerrada; el docente la puede reabrir', async () => {
    await db.query(`update practicos set fecha_limite = now() - interval '1 hour' where id = 'p1'`);
    const cerrada = await como(db, id.ana, `update entregas set borrador = '{"tarde":1}' where practica = 'p1' returning id`);
    expect(cerrada).toEqual([]);
    // el docente reabre la de Ana
    await como(db, id.docente, `update entregas set reabierta = true where alumno = $1`, [id.ana]);
    const abierta = await como(db, id.ana, `update entregas set borrador = '{"tarde":1}' where practica = 'p1' returning id`);
    expect(abierta.length).toBe(1);
    // la de Bruno sigue cerrada
    const deBruno = await como(db, id.bruno, `update entregas set borrador = '{"tarde":1}' where practica = 'p1' returning id`);
    expect(deBruno).toEqual([]);
    await db.query(`update practicos set fecha_limite = null where id = 'p1'`);
  });

  it('el docente lee todas, pero no cambia lo que escribió el alumno ni entrega en su nombre', async () => {
    const todas = await como(db, id.docente, `select id from entregas`);
    expect(todas.length).toBe(2);
    await como(db, id.docente, `update entregas set entrega = '{"trucho":1}', devolucion_publicada = true where alumno = $1`, [id.bruno]);
    const r = await db.query<{ entrega: unknown; devolucion_publicada: boolean }>(`select entrega, devolucion_publicada from entregas where alumno = $1`, [id.bruno]);
    expect(r.rows[0]).toEqual({ entrega: null, devolucion_publicada: true });
    await falla(como(db, id.docente, `insert into entregas (practica) values ('p1')`), 'SOLO_ALUMNOS_ENTREGAN');
  });

  it('nadie borra entregas desde la app', async () => {
    await falla(como(db, id.ana, `delete from entregas`));
    await falla(como(db, id.docente, `delete from entregas`));
  });

  it('un alumno dado de baja no ve ni modifica sus entregas', async () => {
    await db.query(`update padron set activo = false where cedula = $1`, [CI.bruno]);
    expect(await como(db, id.bruno, `select id from entregas`)).toEqual([]);
    expect(await como(db, id.bruno, `update entregas set borrador = '{}' returning id`)).toEqual([]);
    await db.query(`update padron set activo = true where cedula = $1`, [CI.bruno]);
  });
});
