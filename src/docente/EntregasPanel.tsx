/**
 * Pestaña "Entregas" del docente: todas las entregas con filtros
 * (práctico, grupo, alumno, estado, con errores). Al abrir una → corrección.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ajustes } from '../chem/practicos/tipos';
import { armarRenglones, cargarDatosDocente, ETIQUETA_ESTADO_DOCENTE, type EstadoDocente, type Renglon } from '../lib/docente';
import { obtenerAjustes } from '../lib/ajustes';
import { fechaHora } from '../lib/entregas';
import { formatearCedula } from '../lib/cedula';
import { mensajeError } from '../lib/supabase';
import { nombreCorto } from '../practicos/registro';
import DetalleEntrega from './DetalleEntrega';

const COLOR: Record<EstadoDocente, string> = {
  sin_cuenta: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  pendiente: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  borrador: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  fuera_de_plazo: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100',
  entregado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  devuelto: 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100',
};

export function ChipEstadoDocente({ estado }: { estado: EstadoDocente }) {
  return <span className={`chip whitespace-nowrap ${COLOR[estado]}`}>{ETIQUETA_ESTADO_DOCENTE[estado]}</span>;
}

export default function EntregasPanel() {
  const [renglones, setRenglones] = useState<Renglon[] | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [f, setF] = useState({ practico: '', grupo: '', texto: '', estado: '', conErrores: false });

  const cargar = useCallback(async () => {
    try {
      const [d, aj] = await Promise.all([cargarDatosDocente(), obtenerAjustes()]);
      const rs = armarRenglones(d, aj);
      setAjustes(aj);
      setRenglones(rs);
      setError(null);
      return rs;
    } catch (e) {
      setError(mensajeError(e));
      return undefined;
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const grupos = useMemo(() => [...new Set((renglones ?? []).map((r) => r.alumno.grupo).filter(Boolean))].sort(), [renglones]);
  const practicos = useMemo(() => [...new Set((renglones ?? []).map((r) => r.practico.id))], [renglones]);

  const visibles = useMemo(() => {
    const t = f.texto.trim().toLowerCase();
    return (renglones ?? [])
      .filter((r) => !f.practico || r.practico.id === f.practico)
      .filter((r) => !f.grupo || r.alumno.grupo === f.grupo)
      .filter((r) => !f.estado || r.estado === f.estado)
      .filter((r) => !f.conErrores || (r.resumen?.errores ?? 0) > 0)
      .filter((r) => !t || `${r.alumno.nombre} ${r.alumno.apellido} ${r.alumno.cedula}`.toLowerCase().includes(t))
      .sort((a, b) => a.practico.id.localeCompare(b.practico.id) || a.alumno.apellido.localeCompare(b.alumno.apellido, 'es'));
  }, [renglones, f]);

  const actual = abierto ? renglones?.find((r) => r.clave === abierto) : undefined;
  if (actual && ajustes)
    return (
      <DetalleEntrega
        key={actual.clave + (actual.fila?.id ?? '')}
        r={actual}
        ajustes={ajustes}
        onVolver={() => setAbierto(null)}
        onCambio={async () => (await cargar())?.find((x) => x.clave === actual.clave)}
      />
    );

  const enviadas = visibles.filter((r) => r.fila?.entrega).length;
  const conErr = visibles.filter((r) => (r.resumen?.errores ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title mb-0">Entregas</h2>
          <button className="btn" onClick={() => cargar()}>
            ⟳ Actualizar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className="input py-1.5" aria-label="Práctico" value={f.practico} onChange={(e) => setF({ ...f, practico: e.target.value })}>
            <option value="">Todos los prácticos</option>
            {practicos.map((p) => (
              <option key={p} value={p}>
                {nombreCorto(p).split(' · ')[0]}
              </option>
            ))}
          </select>
          <select className="input py-1.5" aria-label="Grupo" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value })}>
            <option value="">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select className="input py-1.5" aria-label="Estado" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {(Object.keys(ETIQUETA_ESTADO_DOCENTE) as EstadoDocente[]).map((k) => (
              <option key={k} value={k}>
                {ETIQUETA_ESTADO_DOCENTE[k]}
              </option>
            ))}
          </select>
          <input className="input col-span-2 py-1.5 sm:col-span-2" placeholder="Buscar alumno o cédula" aria-label="Buscar alumno" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          <label className="col-span-2 inline-flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.conErrores} onChange={(e) => setF({ ...f, conErrores: e.target.checked })} />
            Solo con errores
          </label>
        </div>
        {renglones && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {visibles.length} renglones · <strong>{enviadas}</strong> enviadas · <strong>{conErr}</strong> con errores
          </p>
        )}
        {error && <p className="aviso aviso-error">{error}</p>}
      </div>

      <div className="card overflow-x-auto p-0 sm:p-0">
        {!renglones ? (
          <p className="p-4 text-slate-500">Cargando…</p>
        ) : !visibles.length ? (
          <p className="p-4 text-slate-500">No hay entregas con esos filtros.</p>
        ) : (
          <table className="table-basic min-w-[48rem]">
            <thead>
              <tr>
                <th className="pl-4">Alumno</th>
                <th>Grupo</th>
                <th>Práctico</th>
                <th>Estado</th>
                <th>Enviada</th>
                <th className="text-right">Nota</th>
                <th className="text-right">Errores</th>
                <th className="text-right">✋</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.clave} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setAbierto(r.clave)}>
                  <td className="pl-4">
                    <div className="font-medium">
                      {r.alumno.apellido}, {r.alumno.nombre}
                    </div>
                    <div className="text-xs text-slate-500">CI {formatearCedula(r.alumno.cedula)}</div>
                  </td>
                  <td>{r.alumno.grupo || '—'}</td>
                  <td>{nombreCorto(r.practico.id).split(' · ')[0]}</td>
                  <td>
                    <ChipEstadoDocente estado={r.estado} />
                    {r.fila?.reabierta && <span className="ml-1" title="Reabierta">🔓</span>}
                  </td>
                  <td className="whitespace-nowrap text-xs">{r.fila?.enviada_en ? fechaHora(r.fila.enviada_en) : '—'}</td>
                  <td className="text-right font-mono">{r.resumen ? `${r.resumen.pct.toLocaleString('es-UY')} %` : '—'}</td>
                  <td className={`text-right font-mono ${r.resumen?.errores ? 'text-red-700 dark:text-red-400' : ''}`}>{r.resumen ? r.resumen.errores : '—'}</td>
                  <td className="text-right font-mono">{r.resumen?.anulados || ''}</td>
                  <td className="pr-4 text-right text-slate-400">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
