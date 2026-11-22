/**
 * Pestaña "Prácticos" del docente: activar/desactivar y fecha límite.
 * (Reabrir entregas y publicar devoluciones llegan en la etapa 3.)
 */
import { useCallback, useEffect, useState } from 'react';
import { actualizarPractico, fechaHora, listarPracticos, type PracticoConfig } from '../lib/entregas';
import { mensajeError } from '../lib/supabase';
import { definicion, nombreCorto } from '../practicos/registro';

/** ISO → valor de <input type="datetime-local"> en hora local */
function aLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

export default function PracticosPanel() {
  const [lista, setLista] = useState<PracticoConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLista((await listarPracticos()).filter((x) => definicion(x.id)));
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiar(id: string, cambios: Partial<PracticoConfig>, msg: string) {
    setError(null);
    setOk(null);
    try {
      await actualizarPractico(id, cambios);
      setOk(msg);
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="card-title">Prácticos</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Los alumnos solo ven los prácticos <strong>activos</strong>. Pueden editar su entrega hasta la fecha límite; después queda cerrada.
        </p>
        {error && <p className="aviso aviso-error mt-3">{error}</p>}
        {ok && <p className="aviso aviso-ok mt-3">{ok}</p>}
      </div>
      {lista.map((pr) => (
        <div key={pr.id} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{nombreCorto(pr.id)}</h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-700"
                checked={pr.activo}
                onChange={(e) => cambiar(pr.id, { activo: e.target.checked }, e.target.checked ? 'Práctico activado.' : 'Práctico desactivado.')}
              />
              Activo (visible para los alumnos)
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label className="label" htmlFor={`fl-${pr.id}`}>
                Fecha límite
              </label>
              <input
                id={`fl-${pr.id}`}
                type="datetime-local"
                className="input"
                defaultValue={aLocal(pr.fecha_limite)}
                key={pr.fecha_limite ?? 'sin'}
                onBlur={(e) => {
                  const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                  if (v !== pr.fecha_limite) cambiar(pr.id, { fecha_limite: v }, v ? `Fecha límite: ${fechaHora(v)}.` : 'Sin fecha límite.');
                }}
              />
            </div>
            {pr.fecha_limite && (
              <button className="btn py-2" onClick={() => cambiar(pr.id, { fecha_limite: null }, 'Sin fecha límite.')}>
                Quitar fecha límite
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
