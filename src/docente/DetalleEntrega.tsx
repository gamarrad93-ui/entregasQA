/**
 * Detalle de una entrega para el docente:
 * valor del alumno vs. recalculado (✓/✗ automático), error probable, procedimiento,
 * anulación manual por ítem (con comentario y "deshacer"), reabrir y devolución.
 */
import { useState } from 'react';
import { fmtSig } from '../chem/numeric/format';
import type { Ajustes } from '../chem/practicos/tipos';
import type { CampoFinal } from '../correccion/final';
import { anular, deshacerAnulacion, guardarDevolucion, publicarEntrega, reabrir, type Renglon } from '../lib/docente';
import { fechaHora, vencido } from '../lib/entregas';
import { formatearCedula } from '../lib/cedula';
import { mensajeError } from '../lib/supabase';
import { normalizarPlanilla } from '../practicos/planilla';
import { definicion, nombreCorto } from '../practicos/registro';
import Marca from '../ui/Marca';
import Pasos from '../ui/Pasos';
import Planilla from '../ui/Planilla';
import { ChipEstadoDocente } from './EntregasPanel';

const NOMBRE_CRITERIO: Record<string, string> = { dixon: 'Q de Dixon (95 %)', grubbs: 'Grubbs (95 %)', otro: 'Otro' };
const SECCIONES: { id: CampoFinal['seccion']; titulo: string }[] = [
  { id: 'fila', titulo: 'Por determinación' },
  { id: 'intermedio', titulo: 'Intermedios' },
  { id: 'resumen', titulo: 'Resultados' },
  { id: 'promediables', titulo: 'Criterio de promediabilidad' },
];

function valorMotor(c: CampoFinal): string {
  const v = c.correcto;
  if (typeof v === 'boolean') return v ? 'Cumple' : 'No cumple';
  if (typeof v === 'string') return v;
  if (v == null || !Number.isFinite(v)) return '—';
  if (c.tipo === 'entero') return String(v);
  return fmtSig(v, c.tipo === 'dispersion' ? 3 : 5);
}
const valorAlumno = (c: CampoFinal) => (c.tipo === 'cumple' ? (c.alumno === 'si' ? 'Cumple' : c.alumno === 'no' ? 'No cumple' : c.alumno) : c.alumno) || '—';

export default function DetalleEntrega({ r, ajustes, onVolver, onCambio }: { r: Renglon; ajustes: Ajustes; onVolver: () => void; onCambio: () => Promise<Renglon | undefined> }) {
  const p = definicion(r.practico.id)!;
  const [verPlanilla, setVerPlanilla] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [comentarioItem, setComentarioItem] = useState('');
  const [comentario, setComentario] = useState(r.devolucion?.comentario ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const fila = r.fila;
  const cr = r.correccion;
  const res = r.resumen;

  /** Corre una acción, recarga y, si la devolución ya está publicada, actualiza la foto que ve el alumno. */
  async function accion(f: () => Promise<void>, msg?: string) {
    setOcupado(true);
    setError(null);
    setOk(null);
    try {
      await f();
      const nuevo = await onCambio();
      if (nuevo?.publicada) await guardarDevolucion(nuevo);
      if (msg) setOk(msg);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  /** Si ya estaba anulado, solo se edita el comentario (el veredicto se revierte con "Deshacer"). */
  const cambiarVeredicto = (c: CampoFinal) => {
    const nuevo = c.anulacion ? c.anulacion.veredicto_docente : !(c.final ?? false);
    return accion(async () => {
      await anular(fila!.id, c.campo, c.auto, nuevo, comentarioItem.trim());
      setEditando(null);
      setComentarioItem('');
    });
  };

  const planilla = fila?.entrega ? normalizarPlanilla(p, fila.entrega, { nombre: `${r.alumno.nombre} ${r.alumno.apellido}`, grupo: r.alumno.grupo }) : null;
  const cerrado = vencido(r.practico) || !r.practico.activo;

  return (
    <div className="space-y-4">
      <button className="btn" onClick={onVolver}>
        ← Todas las entregas
      </button>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-titulo text-xl text-brand-700 dark:text-brand-300">
              {r.alumno.apellido}, {r.alumno.nombre}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              CI {formatearCedula(r.alumno.cedula)} · Grupo {r.alumno.grupo || '—'} · {nombreCorto(r.practico.id)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enviada: <strong>{fechaHora(fila?.enviada_en ?? null)}</strong>
              {planilla && (
                <>
                  {' '}
                  · Criterio: <strong>{NOMBRE_CRITERIO[planilla.criterio.tipo]}</strong>
                  {planilla.criterio.tipo === 'otro' && ` («${planilla.criterio.texto}»)`}
                </>
              )}
            </p>
          </div>
          <ChipEstadoDocente estado={r.estado} />
        </div>

        {res && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato titulo="Nota final" valor={`${res.pct.toLocaleString('es-UY')} %`} detalle={`${res.aciertos} de ${res.total} campos`} fuerte />
            <Dato titulo="Corrección automática" valor={`${res.total ? Math.round((1000 * res.aciertosAuto) / res.total) / 10 : 0} %`} detalle={`${res.aciertosAuto} ✓`} />
            <Dato titulo="Con error (final)" valor={String(res.errores)} detalle={res.sinDato ? `${res.sinDato} sin completar` : ' '} />
            <Dato titulo="Anulados a mano" valor={String(res.anulados)} detalle={res.anulados ? '✋ ver marcas' : ' '} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {r.alumno.perfilId && (
            <button
              className="btn"
              disabled={ocupado}
              onClick={() =>
                accion(
                  () => reabrir(r.alumno.perfilId!, r.practico.id, !fila?.reabierta),
                  fila?.reabierta ? 'Entrega cerrada de nuevo.' : 'Entrega reabierta: el alumno puede modificarla y volver a enviarla.',
                )
              }
            >
              {fila?.reabierta ? '🔒 Volver a cerrar' : '🔓 Reabrir para el alumno'}
            </button>
          )}
          {fila?.entrega && !r.practico.devolucion_publicada && (
            <button
              className={`btn ${fila.devolucion_publicada ? '' : 'btn-primary'}`}
              disabled={ocupado}
              onClick={() =>
                accion(
                  () => publicarEntrega(r, !fila.devolucion_publicada),
                  fila.devolucion_publicada ? 'Devolución oculta para el alumno.' : 'Devolución publicada: el alumno ya la ve.',
                )
              }
            >
              {fila.devolucion_publicada ? '🙈 Ocultar devolución' : '📬 Publicar devolución'}
            </button>
          )}
          {r.practico.devolucion_publicada && <span className="aviso aviso-info py-1">Devolución publicada para todo el práctico (pestaña Prácticos).</span>}
          {fila?.entrega && (
            <button className={`btn ${verPlanilla ? 'btn-primary' : ''}`} onClick={() => setVerPlanilla(!verPlanilla)} aria-pressed={verPlanilla}>
              👁️ {verPlanilla ? 'Volver a la corrección' : 'Ver planilla del alumno'}
            </button>
          )}
        </div>
        {fila?.reabierta && <p className="text-sm text-amber-700 dark:text-amber-400">🔓 Reabierta: el alumno puede editarla {cerrado ? 'aunque el plazo cerró' : ''}.</p>}
        {error && <p className="aviso aviso-error">{error}</p>}
        {ok && <p className="aviso aviso-ok">{ok}</p>}
      </div>

      {!fila?.entrega && <p className="aviso aviso-info">Este alumno todavía no envió la entrega.</p>}

      {verPlanilla && planilla ? (
        <div className="rounded-2xl border-2 border-brand-200 p-2 dark:border-brand-900">
          <Planilla p={p} valor={planilla} onChange={() => {}} ajustes={ajustes} soloLectura />
        </div>
      ) : (
        cr && (
          <>
            {(cr.diagnosticos.length > 0 || cr.calculo.errores.length > 0 || cr.calculo.avisos.length > 0) && (
              <div className="card space-y-2">
                {cr.diagnosticos.length > 0 && (
                  <div>
                    <h3 className="font-semibold">🔎 Errores probables (diagnóstico del motor)</h3>
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {cr.diagnosticos.map((d) => (
                        <li key={d.etiqueta}>
                          {d.etiqueta} <span className="text-slate-500">({d.campos} campo{d.campos === 1 ? '' : 's'})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {cr.calculo.errores.length > 0 && (
                  <div className="aviso aviso-error">
                    <strong>Datos que faltan o no son válidos:</strong> {cr.calculo.errores.join(' ')}
                  </div>
                )}
                {cr.calculo.avisos.length > 0 && <div className="aviso aviso-info">{cr.calculo.avisos.join(' ')}</div>}
              </div>
            )}

            <div className="card space-y-4">
              <h3 className="card-title">Corrección</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                “Auto” es lo que decidió el motor y nunca se modifica. Para cambiar el veredicto tocá <strong>Cambiar</strong>: queda marcado ✋ y la nota usa tu
                veredicto. <strong>Deshacer</strong> vuelve al automático.
              </p>
              {SECCIONES.map((s) => {
                const lista = r.campos.filter((c) => c.seccion === s.id);
                if (!lista.length) return null;
                const conFila = s.id === 'fila';
                return (
                  <div key={s.id} className="overflow-x-auto">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{s.titulo}</h4>
                    <table className="table-basic min-w-[44rem]">
                      <thead>
                        <tr>
                          {conFila && <th>#</th>}
                          <th>Campo</th>
                          <th>Alumno</th>
                          <th>Motor</th>
                          <th>Auto</th>
                          <th>Final</th>
                          <th>Error probable / comentario</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((c) => {
                          const anulado = !!c.anulacion;
                          return (
                            <FilaCampo
                              key={c.campo}
                              c={c}
                              conFila={conFila}
                              anulado={anulado}
                              editando={editando === c.campo}
                              comentario={comentarioItem}
                              ocupado={ocupado}
                              onComentario={setComentarioItem}
                              onEditar={() => {
                                setEditando(editando === c.campo ? null : c.campo);
                                setComentarioItem(c.anulacion?.comentario ?? '');
                              }}
                              onConfirmar={() => cambiarVeredicto(c)}
                              onDeshacer={() => accion(() => deshacerAnulacion(fila!.id, c.campo), 'Se volvió al veredicto automático.')}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            <div className="card space-y-2">
              <h3 className="card-title">💬 Comentario para el alumno</h3>
              <textarea className="input" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Lo ve el alumno cuando publicás la devolución." />
              <button className="btn btn-primary" disabled={ocupado || comentario === (r.devolucion?.comentario ?? '')} onClick={() => accion(() => guardarDevolucion(r, comentario), 'Comentario guardado.')}>
                Guardar comentario
              </button>
            </div>

            <Pasos pasos={cr.calculo.pasos} />
          </>
        )
      )}
    </div>
  );
}

function Dato({ titulo, valor, detalle, fuerte }: { titulo: string; valor: string; detalle?: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${fuerte ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
      <div className={`text-xs font-medium ${fuerte ? 'text-brand-100' : 'text-slate-600 dark:text-slate-400'}`}>{titulo}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{valor}</div>
      {detalle && <div className={`text-xs ${fuerte ? 'text-brand-100' : 'text-slate-500'}`}>{detalle}</div>}
    </div>
  );
}

function FilaCampo(props: {
  c: CampoFinal;
  conFila: boolean;
  anulado: boolean;
  editando: boolean;
  comentario: string;
  ocupado: boolean;
  onComentario: (v: string) => void;
  onEditar: () => void;
  onConfirmar: () => void;
  onDeshacer: () => void;
}) {
  const { c } = props;
  const fondo = props.anulado ? 'bg-amber-50 dark:bg-amber-950/30' : c.final === false ? 'bg-red-50/60 dark:bg-red-950/30' : '';
  const nuevo = props.anulado ? !!c.final : !(c.final ?? false);
  return (
    <>
      <tr className={fondo}>
        {props.conFila && <td>{c.fila != null ? c.fila + 1 : ''}</td>}
        <td>
          {c.etiqueta} {c.unidad && <span className="text-slate-500">({c.unidad})</span>}
        </td>
        <td className="font-mono">{valorAlumno(c)}</td>
        <td className="font-mono">{valorMotor(c)}</td>
        <td>
          <Marca ok={c.auto} chica />
        </td>
        <td className="whitespace-nowrap">
          <Marca ok={c.final} chica />
          {props.anulado && (
            <span className="chip ml-1 bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100" title="Veredicto cambiado a mano por el docente">
              ✋ anulado
            </span>
          )}
        </td>
        <td className="text-xs">
          {c.diagnosticos.join(' · ')}
          {c.anulacion?.comentario && <div className="mt-0.5 italic text-amber-800 dark:text-amber-300">“{c.anulacion.comentario}”</div>}
        </td>
        <td className="whitespace-nowrap text-right">
          <button className="btn px-2 py-0.5 text-xs" disabled={props.ocupado} onClick={props.onEditar}>
            {props.anulado ? 'Comentario' : 'Cambiar'}
          </button>
          {props.anulado && (
            <button className="btn ml-1 px-2 py-0.5 text-xs" disabled={props.ocupado} onClick={props.onDeshacer} title="Volver al veredicto automático">
              ↩ Deshacer
            </button>
          )}
        </td>
      </tr>
      {props.editando && (
        <tr className="bg-amber-50 dark:bg-amber-950/30">
          <td colSpan={props.conFila ? 8 : 7}>
            <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
              <span className="text-sm">
                {props.anulado ? (
                  <>Comentario del ítem (queda <Marca ok={nuevo} chica />)</>
                ) : (
                  <>
                    Poner <Marca ok={nuevo} chica /> en lugar de <Marca ok={c.final} chica />
                  </>
                )}
              </span>
              <input
                className="input flex-1 py-1 text-sm"
                placeholder="Comentario (opcional, lo ve el alumno en la devolución)"
                value={props.comentario}
                onChange={(e) => props.onComentario(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary text-xs" disabled={props.ocupado} onClick={props.onConfirmar}>
                Guardar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
