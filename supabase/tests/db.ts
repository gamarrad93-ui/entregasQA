/**
 * Base de datos de prueba: Postgres de verdad (PGlite, corre dentro de Node)
 * con una imitación mínima de Supabase y TODAS las migraciones de supabase/migrations.
 * Sirve para probar las políticas RLS sin crear nada en la nube.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..', 'migrations');

export async function crearBase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, 'shim-supabase.sql'), 'utf8'));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}

export type Rol = 'anon' | 'authenticated' | 'service_role';

/** Corre `sql` como lo haría la API de Supabase para ese usuario (o anónimo). */
export async function como<T = Record<string, unknown>>(
  db: PGlite,
  usuario: string | null,
  sql: string,
  params: unknown[] = [],
  rol: Rol = usuario ? 'authenticated' : 'anon',
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(usuario ? { sub: usuario, role: rol } : { role: rol })]);
    await tx.query(`set local role ${rol}`);
    const r = await tx.query<T>(sql, params);
    return r.rows;
  });
}

/** Crea la cuenta como lo hace Supabase Auth (dispara el trigger del padrón). */
export async function crearCuenta(db: PGlite, cedula: string): Promise<string> {
  const r = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${cedula}@entregas.local`]);
  return r.rows[0].id;
}

/** Cédulas válidas para las pruebas (dígito verificador correcto). */
export function cedulaDePrueba(base7: number): string {
  const s = String(base7).padStart(7, '0');
  const p = [2, 9, 8, 7, 6, 3, 4];
  const suma = [...s].reduce((a, d, i) => a + Number(d) * p[i], 0);
  return s + ((10 - (suma % 10)) % 10);
}
