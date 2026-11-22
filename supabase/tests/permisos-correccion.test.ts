/**
 * Reglas de permisos de anulaciones y devoluciones:
 * el alumno nunca ve la corrección ni las anulaciones; ve la devolución
 * solo si el docente la publicó (por entrega o por práctico), y solo la suya.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { cedulaDePrueba, como, crearBase, crearCuenta } from './db';

let db: PGlite;
const id: Record<string, string> = {};
const ent: Record<string, string> = {};

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
  const CI = { docente: cedulaDePrueba(2222222), ana: cedulaDePrueba(3333333), bruno: cedulaDePrueba(4444444) };
  await db.query(
    `insert into padron (cedula, nombre, apellido, grupo, rol) values
     ($1,'Dora','Docente','Docentes','docente'), ($2,'Ana','Pérez','G1','alumno'), ($3,'Bruno','Silva','G2','alumno')`,
    [CI.docente, CI.ana, CI.bruno],
  );
  id.docente = await crearCuenta(db, CI.docente);
  id.ana = await crearCuenta(db, CI.ana);
  id.bruno = await crearCuenta(db, CI.bruno);
  for (const a of ['ana', 'bruno']) {
    const r = await como<{ id: string }>(db, id[a], `insert into entregas (practica, borrador, entrega) values ('p1', '{}', '{}') returning id`);
    ent[a] = r[0].id;
  }
});

describe('Anulaciones', () => {
  it('el docente anula, cambia y deshace; queda el historial', async () => {
    await como(db, id.docente, `select anular($1, 'resumen:media:', false, true, 'Redondeo aceptable')`, [ent.ana]);
    await como(db, id.docente, `select anular($1, 'resumen:media:', false, true, 'Lo acepto')`, [ent.ana]);
    const vig = await como<{ comentario: string }>(db, id.docente, `select comentario from anulaciones where entrega = $1 and deshecha_en is null`, [ent.ana]);
    expect(vig).toEqual([{ comentario: 'Lo acepto' }]);
    await como(db, id.docente, `select deshacer_anulacion($1, 'resumen:media:')`, [ent.ana]);
    const todas = await como<{ deshecha_en: string | null }>(db, id.docente, `select deshecha_en from anulaciones where entrega = $1`, [ent.ana]);
    expect(todas.length).toBe(2);
    expect(todas.every((x) => x.deshecha_en)).toBe(true);
  });

  it('un alumno no puede anular ni ver anulaciones', async () => {
    await falla(como(db, id.ana, `select anular($1, 'resumen:s:', false, true, '')`, [ent.ana]), 'SOLO_DOCENTE');
    await falla(como(db, id.ana, `select deshacer_anulacion($1, 'resumen:s:')`, [ent.ana]), 'SOLO_DOCENTE');
    await falla(como(db, id.ana, `insert into anulaciones (entrega, campo, veredicto_docente) values ($1, 'x', true)`, [ent.ana]));
    await como(db, id.docente, `select anular($1, 'resumen:s:', true, false, 'mal')`, [ent.ana]);
    expect(await como(db, id.ana, `select * from anulaciones`)).toEqual([]);
  });

  it('nadie modifica ni borra anulaciones directamente (ni el docente)', async () => {
    await falla(como(db, id.docente, `update anulaciones set veredicto_auto = true`));
    await falla(como(db, id.docente, `delete from anulaciones`));
  });
});

describe('Devoluciones', () => {
  it('el docente escribe la devolución; el alumno NO la ve hasta que se publique', async () => {
    await como(db, id.docente, `insert into devoluciones (entrega, comentario, items, nota) values ($1, 'Muy bien', '[]', 90), ($2, 'Revisar', '[]', 40)`, [
      ent.ana,
      ent.bruno,
    ]);
    expect(await como(db, id.ana, `select * from devoluciones`)).toEqual([]);
    await falla(como(db, id.ana, `update devoluciones set nota = 100`).then((r) => (r.length ? r : Promise.reject(new Error('0 filas')))));
  });

  it('publicada por entrega: el alumno ve SOLO la suya', async () => {
    await como(db, id.docente, `update entregas set devolucion_publicada = true where id = $1`, [ent.ana]);
    const a = await como<{ comentario: string }>(db, id.ana, `select comentario from devoluciones`);
    expect(a).toEqual([{ comentario: 'Muy bien' }]);
    expect(await como(db, id.bruno, `select * from devoluciones`)).toEqual([]);
  });

  it('publicada por práctico: la ven todos (cada uno la suya)', async () => {
    await como(db, id.docente, `update practicos set devolucion_publicada = true where id = 'p1'`);
    const b = await como<{ comentario: string }>(db, id.bruno, `select comentario from devoluciones`);
    expect(b).toEqual([{ comentario: 'Revisar' }]);
    await como(db, id.docente, `update practicos set devolucion_publicada = false where id = 'p1'`);
    expect(await como(db, id.bruno, `select * from devoluciones`)).toEqual([]);
  });

  it('el alumno no puede escribir devoluciones', async () => {
    await falla(como(db, id.bruno, `insert into devoluciones (entrega, comentario) values ($1, 'me pongo 100')`, [ent.bruno]));
    const r = await como(db, id.ana, `update devoluciones set nota = 100 returning nota`);
    expect(r).toEqual([]);
  });
});

describe('Reabrir', () => {
  it('el docente reabre aunque el alumno nunca haya abierto la planilla', async () => {
    const CI = cedulaDePrueba(5555555);
    await db.query(`insert into padron (cedula, nombre, grupo) values ($1, 'Caro', 'G1')`, [CI]);
    const caro = await crearCuenta(db, CI);
    await db.query(`update practicos set fecha_limite = now() - interval '1 day' where id = 'p1'`);
    await falla(como(db, caro, `insert into entregas (practica, borrador) values ('p1', '{}')`));
    await como(db, id.docente, `select reabrir_entrega($1, 'p1', true)`, [caro]);
    const r = await como(db, caro, `update entregas set borrador = '{"x":1}', entrega = '{"x":1}' where practica = 'p1' returning id`);
    expect(r.length).toBe(1);
    await como(db, id.docente, `select reabrir_entrega($1, 'p1', false)`, [caro]);
    expect(await como(db, caro, `update entregas set borrador = '{}' returning id`)).toEqual([]);
    await db.query(`update practicos set fecha_limite = null where id = 'p1'`);
  });

  it('un alumno no puede reabrirse ni el docente insertar entregas a mano', async () => {
    await falla(como(db, id.ana, `select reabrir_entrega($1, 'p1', true)`, [id.ana]), 'SOLO_DOCENTE');
    // aunque el docente prenda la marca a mano, la regla RLS de inserción lo frena
    await falla(
      db.transaction(async (tx) => {
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id.docente, role: 'authenticated' })]);
        await tx.query(`set local role authenticated`);
        await tx.query(`select set_config('entregas.reabrir', '1', true)`);
        await tx.query(`insert into entregas (alumno, practica) values ($1, 'p2')`, [id.bruno]);
      }),
      'row-level security',
    );
    await falla(como(db, id.docente, `select reabrir_entrega($1, 'p1', true)`, [id.docente]), 'NO_ES_ALUMNO');
  });
});

