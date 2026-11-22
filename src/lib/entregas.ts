/** Acceso a prácticos y entregas en Supabase + estado de cada práctico para el alumno. */
import type { Entrega } from '../chem/practicos/tipos';
import { sb } from './supabase';

export interface PracticoConfig {
  id: string;
  activo: boolean;
  fecha_limite: string | null;
  devolucion_publicada: boolean;
}

export interface FilaEntrega {
  id: string;
  alumno: string;
  practica: string;
  borrador: Entrega | null;
  borrador_guardado: string | null;
  entrega: Entrega | null;
  enviada_en: string | null;
  reabierta: boolean;
  devolucion_publicada: boolean;
  creada: string;
}

export type Estado = 'pendiente' | 'entregado' | 'fuera_de_plazo' | 'devuelto';

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  fuera_de_plazo: 'Fuera de plazo',
  devuelto: 'Devuelto',
};

export function vencido(pr: PracticoConfig, ahora = Date.now()): boolean {
  return !!pr.fecha_limite && ahora > Date.parse(pr.fecha_limite);
}

/** ¿El alumno puede editar? (mismo criterio que la regla del servidor) */
export function editable(pr: PracticoConfig, fila: FilaEntrega | null, ahora = Date.now()): boolean {
  return pr.activo && (!vencido(pr, ahora) || !!fila?.reabierta);
}

export function estadoAlumno(pr: PracticoConfig, fila: FilaEntrega | null, ahora = Date.now()): Estado {
  if (fila?.entrega && (pr.devolucion_publicada || fila.devolucion_publicada)) return 'devuelto';
  if (fila?.entrega) return 'entregado';
  if (vencido(pr, ahora) && !fila?.reabierta) return 'fuera_de_plazo';
  return 'pendiente';
}

/** ¿Hay cambios en el borrador que todavía no se enviaron? */
export function cambiosSinEnviar(fila: FilaEntrega | null): boolean {
  if (!fila?.entrega || !fila.borrador) return false;
  return JSON.stringify(fila.borrador) !== JSON.stringify(fila.entrega);
}

export function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-UY', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* -------------------- Supabase -------------------- */

const COLUMNAS = 'id, alumno, practica, borrador, borrador_guardado, entrega, enviada_en, reabierta, devolucion_publicada, creada';

export async function listarPracticos(): Promise<PracticoConfig[]> {
  const { data, error } = await sb().from('practicos').select('id, activo, fecha_limite, devolucion_publicada').order('id');
  if (error) throw error;
  return data as PracticoConfig[];
}

export async function misEntregas(): Promise<FilaEntrega[]> {
  const { data, error } = await sb().from('entregas').select(COLUMNAS);
  if (error) throw error;
  return data as FilaEntrega[];
}

/** Guarda el borrador (crea la fila la primera vez). Devuelve la fila actualizada. */
export async function guardarBorrador(practica: string, borrador: Entrega, filaId: string | null): Promise<FilaEntrega> {
  const q = filaId
    ? sb().from('entregas').update({ borrador }).eq('id', filaId).select(COLUMNAS)
    : sb().from('entregas').insert({ practica, borrador }).select(COLUMNAS);
  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) throw new Error('CERRADA');
  return data[0] as FilaEntrega;
}

/** Envía: la entrega pasa a ser una copia del borrador. */
export async function enviarEntrega(practica: string, planilla: Entrega, filaId: string | null): Promise<FilaEntrega> {
  const q = filaId
    ? sb().from('entregas').update({ borrador: planilla, entrega: planilla }).eq('id', filaId).select(COLUMNAS)
    : sb().from('entregas').insert({ practica, borrador: planilla, entrega: planilla }).select(COLUMNAS);
  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) throw new Error('CERRADA');
  return data[0] as FilaEntrega;
}

export async function actualizarPractico(id: string, cambios: Partial<Omit<PracticoConfig, 'id'>>): Promise<void> {
  const { error } = await sb().from('practicos').update(cambios).eq('id', id);
  if (error) throw error;
}
