/**
 * Ajustes de corrección (tolerancias, masas molares, materiales, tabla Z).
 * Por ahora, los valores por defecto del motor. En la etapa 5 se leen de la base
 * (pestaña Ajustes del docente).
 */
import { ajustesPorDefecto } from '../chem/practicos/datos';
import type { Ajustes } from '../chem/practicos/tipos';

let cache: Ajustes | null = null;

export async function obtenerAjustes(): Promise<Ajustes> {
  if (!cache) cache = ajustesPorDefecto();
  return cache;
}
