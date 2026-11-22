/** Datos para la vista del docente: todas las entregas, anulaciones y devoluciones. */
import { corregir, type Correccion } from '../chem/practicos/correccion';
import type { Ajustes } from '../chem/practicos/tipos';
import { camposFinales, itemsDevolucion, resumenFinal, type Anulacion, type CampoFinal, type ResumenFinal } from '../correccion/final';
import { definicion } from '../practicos/registro';
import { normalizarPlanilla } from '../practicos/planilla';
import { vencido, type FilaEntrega, type PracticoConfig } from './entregas';
import { sb } from './supabase';

export interface AlumnoPadron {
  cedula: string;
  nombre: string;
  apellido: string;
  grupo: string;
  activo: boolean;
  perfilId: string | null;
}

export interface Devolucion {
  entrega: string;
  comentario: string;
  items: unknown;
  nota: number | null;
  actualizada: string;
}

export type EstadoDocente = 'sin_cuenta' | 'pendiente' | 'borrador' | 'fuera_de_plazo' | 'entregado' | 'devuelto';

export const ETIQUETA_ESTADO_DOCENTE: Record<EstadoDocente, string> = {
  sin_cuenta: 'Sin cuenta',
  pendiente: 'Pendiente',
  borrador: 'Borrador (sin enviar)',
  fuera_de_plazo: 'Fuera de plazo',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
};

export interface Renglon {
  clave: string;
  alumno: AlumnoPadron;
  practico: PracticoConfig;
  fila: FilaEntrega | null;
  estado: EstadoDocente;
  /** solo si hay entrega enviada */
  correccion: Correccion | null;
  campos: CampoFinal[];
  resumen: ResumenFinal | null;
  anulaciones: Anulacion[];
  devolucion: Devolucion | null;
  publicada: boolean;
}

export interface DatosDocente {
  practicos: PracticoConfig[];
  alumnos: AlumnoPadron[];
  filas: FilaEntrega[];
  anulaciones: Anulacion[];
  devoluciones: Devolucion[];
}

export async function cargarDatosDocente(): Promise<DatosDocente> {
  const c = sb();
  const [pr, pa, pe, en, an, de] = await Promise.all([
    c.from('practicos').select('id, activo, fecha_limite, devolucion_publicada').order('id'),
    c.from('padron').select('cedula, nombre, apellido, grupo, activo, rol').eq('rol', 'alumno'),
    c.from('perfiles').select('id, cedula'),
    c.from('entregas').select('id, alumno, practica, borrador, borrador_guardado, entrega, enviada_en, reabierta, devolucion_publicada, creada'),
    c.from('anulaciones').select('id, entrega, campo, veredicto_auto, veredicto_docente, comentario, docente, fecha').is('deshecha_en', null),
    c.from('devoluciones').select('entrega, comentario, items, nota, actualizada'),
  ]);
  for (const r of [pr, pa, pe, en, an, de]) if (r.error) throw r.error;
  const idPorCedula = new Map((pe.data as { id: string; cedula: string }[]).map((x) => [x.cedula, x.id]));
  return {
    practicos: (pr.data as PracticoConfig[]).filter((x) => definicion(x.id)),
    alumnos: (pa.data as Omit<AlumnoPadron, 'perfilId'>[]).map((a) => ({ ...a, perfilId: idPorCedula.get(a.cedula) ?? null })),
    filas: en.data as FilaEntrega[],
    anulaciones: an.data as Anulacion[],
    devoluciones: de.data as Devolucion[],
  };
}

export function estadoDocente(a: AlumnoPadron, pr: PracticoConfig, f: FilaEntrega | null, publicada: boolean, ahora = Date.now()): EstadoDocente {
  if (f?.entrega) return publicada ? 'devuelto' : 'entregado';
  if (!a.perfilId) return 'sin_cuenta';
  if (vencido(pr, ahora) && !f?.reabierta) return 'fuera_de_plazo';
  if (f?.borrador) return 'borrador';
  return 'pendiente';
}

/** Arma un renglón por alumno y práctico, con la corrección (motor + anulaciones). */
export function armarRenglones(d: DatosDocente, aj: Ajustes): Renglon[] {
  const filaDe = new Map(d.filas.map((f) => [`${f.alumno}:${f.practica}`, f]));
  const anDe = new Map<string, Anulacion[]>();
  for (const a of d.anulaciones) anDe.set(a.entrega, [...(anDe.get(a.entrega) ?? []), a]);
  const devDe = new Map(d.devoluciones.map((x) => [x.entrega, x]));
  const out: Renglon[] = [];
  for (const pr of d.practicos) {
    const p = definicion(pr.id)!;
    for (const a of d.alumnos) {
      const fila = a.perfilId ? filaDe.get(`${a.perfilId}:${pr.id}`) ?? null : null;
      if (!a.activo && !fila?.entrega) continue;
      const anulaciones = fila ? anDe.get(fila.id) ?? [] : [];
      const publicada = !!fila?.entrega && (pr.devolucion_publicada || fila.devolucion_publicada);
      let correccion: Correccion | null = null;
      let campos: CampoFinal[] = [];
      if (fila?.entrega) {
        const e = normalizarPlanilla(p, fila.entrega, { nombre: `${a.nombre} ${a.apellido}`.trim(), grupo: a.grupo });
        try {
          correccion = corregir(p, e, aj);
          campos = camposFinales(correccion, anulaciones);
        } catch {
          correccion = null;
        }
      }
      out.push({
        clave: `${a.cedula}:${pr.id}`,
        alumno: a,
        practico: pr,
        fila,
        estado: estadoDocente(a, pr, fila, publicada),
        correccion,
        campos,
        resumen: correccion ? resumenFinal(campos) : null,
        anulaciones,
        devolucion: fila ? devDe.get(fila.id) ?? null : null,
        publicada,
      });
    }
  }
  return out;
}

/* -------------------- acciones del docente -------------------- */

export async function anular(entrega: string, campo: string, auto: boolean | null, docente: boolean, comentario: string) {
  const { error } = await sb().rpc('anular', {
    p_entrega: entrega,
    p_campo: campo,
    p_veredicto_auto: auto,
    p_veredicto_docente: docente,
    p_comentario: comentario,
  });
  if (error) throw error;
}

export async function deshacerAnulacion(entrega: string, campo: string) {
  const { error } = await sb().rpc('deshacer_anulacion', { p_entrega: entrega, p_campo: campo });
  if (error) throw error;
}

/** Reabre (o vuelve a cerrar) la entrega de un alumno, aunque nunca haya abierto la planilla. */
export async function reabrir(alumno: string, practica: string, valor: boolean) {
  const { error } = await sb().rpc('reabrir_entrega', { p_alumno: alumno, p_practica: practica, p_valor: valor });
  if (error) throw error;
}

/** Guarda comentario general y la foto de la devolución (✓/✗ final, sin valores correctos). */
export async function guardarDevolucion(r: Renglon, comentario?: string) {
  if (!r.fila) return;
  const fila = {
    entrega: r.fila.id,
    comentario: comentario ?? r.devolucion?.comentario ?? '',
    items: r.correccion ? itemsDevolucion(r.campos) : null,
    nota: r.resumen?.pct ?? null,
  };
  const { error } = await sb().from('devoluciones').upsert(fila, { onConflict: 'entrega' });
  if (error) throw error;
}

export async function publicarEntrega(r: Renglon, valor: boolean) {
  if (!r.fila) return;
  if (valor) await guardarDevolucion(r);
  const { error } = await sb().from('entregas').update({ devolucion_publicada: valor }).eq('id', r.fila.id);
  if (error) throw error;
}

/** Publica (o despublica) la devolución de todo un práctico. Antes actualiza la foto de cada entrega. */
export async function publicarPractico(practica: string, renglones: Renglon[], valor: boolean) {
  if (valor) for (const r of renglones) if (r.practico.id === practica && r.fila?.entrega) await guardarDevolucion(r);
  const { error } = await sb().from('practicos').update({ devolucion_publicada: valor }).eq('id', practica);
  if (error) throw error;
}
