/**
 * Veredicto final = el del docente si anuló el ítem, si no el automático del motor.
 * Todo lo que se muestra o exporta (nota, tendencias, devolución) usa el final.
 */
import type { CampoCorregido, Correccion } from '../chem/practicos/correccion';

export interface Anulacion {
  id: string;
  entrega: string;
  campo: string;
  veredicto_auto: boolean | null;
  veredicto_docente: boolean;
  comentario: string;
  docente: string;
  fecha: string;
}

/** Clave estable de un campo corregido: "seccion:clave:fila" (fila vacía si no es por determinación). */
export const claveCampo = (c: Pick<CampoCorregido, 'seccion' | 'clave' | 'fila'>) => `${c.seccion}:${c.clave}:${c.fila ?? ''}`;

export interface CampoFinal extends CampoCorregido {
  campo: string;
  auto: boolean | null;
  final: boolean | null;
  anulacion: Anulacion | null;
}

export function camposFinales(cr: Correccion, anulaciones: Anulacion[]): CampoFinal[] {
  const porCampo = new Map(anulaciones.map((a) => [a.campo, a]));
  return cr.campos.map((c) => {
    const campo = claveCampo(c);
    const an = porCampo.get(campo) ?? null;
    return { ...c, campo, auto: c.ok, final: an ? an.veredicto_docente : c.ok, anulacion: an };
  });
}

export interface ResumenFinal {
  total: number;
  aciertosAuto: number;
  aciertos: number;
  errores: number;
  sinDato: number;
  anulados: number;
  /** % de aciertos finales sobre el total de campos */
  pct: number;
}

export function resumenFinal(campos: CampoFinal[]): ResumenFinal {
  const total = campos.length;
  const aciertos = campos.filter((c) => c.final === true).length;
  return {
    total,
    aciertosAuto: campos.filter((c) => c.auto === true).length,
    aciertos,
    errores: campos.filter((c) => c.final === false).length,
    sinDato: campos.filter((c) => c.final === null).length,
    anulados: campos.filter((c) => c.anulacion).length,
    pct: total ? Math.round((1000 * aciertos) / total) / 10 : 0,
  };
}

/** Lo que ve el alumno en la devolución: su valor, ✓/✗ final y el comentario del ítem. Nunca el valor correcto. */
export interface ItemDevolucion {
  etiqueta: string;
  unidad?: string;
  fila?: number;
  alumno: string;
  ok: boolean | null;
  comentario?: string;
}

export function itemsDevolucion(campos: CampoFinal[]): ItemDevolucion[] {
  return campos.map((c) => ({
    etiqueta: c.etiqueta,
    unidad: c.unidad,
    fila: c.fila,
    alumno: c.tipo === 'cumple' ? (c.alumno === 'si' ? 'Cumple' : c.alumno === 'no' ? 'No cumple' : c.alumno) : c.alumno,
    ok: c.final,
    comentario: c.anulacion?.comentario || undefined,
  }));
}
