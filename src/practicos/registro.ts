/**
 * Prácticos habilitados en la app de entregas.
 * Para agregar uno: que exista en el motor (src/chem/practicos/practicas.ts),
 * sumar su id acá y agregar su fila en la tabla `practicos` (migración nueva).
 */
import type { PracticaDef } from '../chem/practicos/motor';
import { nombrePractica, practica } from '../chem/practicos/practicas';
import type { PracticaId } from '../chem/practicos/tipos';

export const PRACTICOS_HABILITADOS: PracticaId[] = ['p1'];

export function definicion(id: string): PracticaDef | undefined {
  return PRACTICOS_HABILITADOS.includes(id as PracticaId) ? practica(id as PracticaId) : undefined;
}

export function nombreCorto(id: string): string {
  const p = practica(id as PracticaId);
  return p ? nombrePractica(p) : id.toUpperCase();
}
