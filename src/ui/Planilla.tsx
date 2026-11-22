/**
 * Planilla de un práctico (como la de AnaliticAPP): datos, material, reactivos,
 * determinaciones, criterio de promediabilidad y resultados del alumno.
 * Es "controlada": recibe la planilla y avisa cada cambio. Solo valida formato
 * (nunca muestra valores correctos ni ✓/✗).
 */
import { useMemo } from 'react';
import { codigoCompleto, nombreTramo } from '../chem/practicos/material';
import type { PracticaDef } from '../chem/practicos/motor';
import type { Ajustes, Entrega } from '../chem/practicos/tipos';
import { aplicarCodigo, esBureta } from '../practicos/planilla';

export const NOMBRE_CRITERIO = { dixon: 'Q de Dixon (95 %)', grubbs: 'Test de Grubbs (95 %)', otro: 'Otro' } as const;

/** Campo de texto corto (números con coma o punto). */
export function Celda(props: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  placeholder?: string;
  ancho?: string;
  label: string;
  numerico?: boolean;
  list?: string;
}) {
  return (
    <input
      aria-label={props.label}
      inputMode={props.numerico === false ? undefined : 'decimal'}
      autoComplete="off"
      list={props.list}
      className={`input px-2 py-1.5 font-mono text-base sm:text-sm ${props.ancho ?? ''} ${props.error ? 'input-error' : ''}`}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      aria-invalid={props.error || undefined}
    />
  );
}

function Etiqueta({ texto, unidad }: { texto: string; unidad?: string }) {
  return (
    <label className="label text-xs">
      {texto} {unidad && <span className="font-normal text-slate-500">({unidad})</span>}
    </label>
  );
}

export default function Planilla(props: {
  p: PracticaDef;
  valor: Entrega;
  onChange: (f: (x: Entrega) => void) => void;
  ajustes: Ajustes;
  errores?: Map<string, string> | null;
  soloLectura?: boolean;
  /** completar V20 desde la tabla Lab QA al escribir el código (nunca para el alumno) */
  autocompletar?: boolean;
}) {
  const { p, valor: e, ajustes } = props;
  const upd = props.onChange;
  const er = (k: string) => !!props.errores?.has(k);

  const auto = !!props.autocompletar;
  const codigos = useMemo(() => {
    if (!auto) return { pipeta: [], matraz: [], bureta: [] };
    const by = (t: string) => ajustes.materiales.filter((m) => m.tipo === t).map((m) => codigoCompleto(m.codigo));
    return { pipeta: by('pipeta'), matraz: by('matraz'), bureta: by('bureta') };
  }, [ajustes.materiales, auto]);

  const esBuretaP1 = esBureta(e.materiales.material?.codigo);

  return (
    <fieldset disabled={!!props.soloLectura} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <datalist id="dl-pipeta">{codigos.pipeta.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dl-matraz">{codigos.matraz.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dl-bureta">{codigos.bureta.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dl-p1">{[...codigos.pipeta, ...codigos.bureta].map((c) => <option key={c} value={c} />)}</datalist>

      <section className="card space-y-3">
        <h3 className="card-title">👤 Datos</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="label">Nombre</span>
            <p className="py-1.5">{e.alumno.nombre}</p>
          </div>
          <div>
            <span className="label">Grupo</span>
            <p className="py-1.5">{e.alumno.grupo || '—'}</p>
          </div>
          <div>
            <label className="label" htmlFor="pl-fecha">
              Fecha del práctico
            </label>
            <input
              id="pl-fecha"
              type="date"
              className={`input px-2 py-1.5 ${er('fecha') ? 'input-error' : ''}`}
              value={e.alumno.fecha}
              onChange={(ev) => upd((x) => (x.alumno.fecha = ev.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="card-title">🧪 Material</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {auto
            ? 'Al escribir el código Lab QA se completan V nominal y V20 desde la tabla.'
            : 'Escribí el código del material (ej. PA1005-26), su volumen nominal, la tolerancia de la etiqueta y el V20 (para buretas, el V20 de cada tramo).'}
        </p>
        {p.materiales.map((s) => {
          const m = e.materiales[s.clave];
          const bur = esBureta(m.codigo) || (s.tipos.length === 1 && s.tipos[0] === 'bureta');
          const lista = p.id === 'p1' ? 'dl-p1' : `dl-${s.tipos[0]}`;
          return (
            <div key={s.clave} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="mb-2 font-semibold">{s.rol}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-1">
                  <Etiqueta texto="Código Lab QA" />
                  <Celda
                    numerico={false}
                    list={auto ? lista : undefined}
                    label={`${s.rol}: código`}
                    value={m.codigo}
                    error={er(`mat:${s.clave}:codigo`)}
                    onChange={(v) => upd((x) => aplicarCodigo(x, s.clave, v, ajustes, auto))}
                  />
                </div>
                <div>
                  <Etiqueta texto="V nominal" unidad="mL" />
                  <Celda label={`${s.rol}: V nominal`} value={m.vNominal} onChange={(v) => upd((x) => (x.materiales[s.clave].vNominal = v))} />
                </div>
                <div>
                  <Etiqueta texto="Tolerancia" unidad="± mL" />
                  <Celda label={`${s.rol}: tolerancia`} value={m.tolerancia} error={er(`mat:${s.clave}:tol`)} onChange={(v) => upd((x) => (x.materiales[s.clave].tolerancia = v))} />
                </div>
                {!bur && (
                  <div>
                    <Etiqueta texto="V20" unidad="mL" />
                    <Celda label={`${s.rol}: V20`} value={m.v20} error={er(`mat:${s.clave}:v20`)} onChange={(v) => upd((x) => (x.materiales[s.clave].v20 = v))} />
                  </div>
                )}
              </div>
              {bur && (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {m.tramos.map((t, i) => (
                    <div key={i}>
                      <Etiqueta texto={`V20 ${nombreTramo(i)}`} />
                      <Celda label={`V20 ${nombreTramo(i)}`} value={t} error={er(`mat:${s.clave}:tramo${i}`)} onChange={(v) => upd((x) => (x.materiales[s.clave].tramos[i] = v))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {p.reactivos.length > 0 && (
        <section className="card space-y-3">
          <h3 className="card-title">⚗️ Reactivos</h3>
          {p.reactivos.map((r) => {
            const x = e.reactivos[r.clave];
            return (
              <div key={r.clave} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="col-span-2 self-end pb-2 font-semibold sm:col-span-1">{r.nombre}</div>
                <div>
                  <Etiqueta texto="Lote" />
                  <Celda numerico={false} label={`${r.nombre}: lote`} value={x.lote} onChange={(v) => upd((y) => (y.reactivos[r.clave].lote = v))} />
                </div>
                {r.conAssay ? (
                  <div>
                    <Etiqueta texto="Assay" unidad="%" />
                    <Celda label={`${r.nombre}: assay`} value={x.assay} error={er(`rea:${r.clave}:assay`)} onChange={(v) => upd((y) => (y.reactivos[r.clave].assay = v))} />
                  </div>
                ) : (
                  <div />
                )}
                <div>
                  <Etiqueta texto="Preparación" />
                  <input type="date" aria-label={`${r.nombre}: fecha de preparación`} className="input px-2 py-1.5" value={x.fechaPreparacion} onChange={(ev) => upd((y) => (y.reactivos[r.clave].fechaPreparacion = ev.target.value))} />
                </div>
                <div>
                  <Etiqueta texto="Vencimiento" />
                  <input type="date" aria-label={`${r.nombre}: fecha de vencimiento`} className="input px-2 py-1.5" value={x.fechaVencimiento} onChange={(ev) => upd((y) => (y.reactivos[r.clave].fechaVencimiento = ev.target.value))} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card space-y-3">
        <h3 className="card-title">📋 Muestra y condiciones</h3>
        <div>
          <Etiqueta texto="Muestra" />
          <Celda numerico={false} label="Muestra" value={e.muestra} onChange={(v) => upd((x) => (x.muestra = v))} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {p.datos.map((d) => {
            if (p.id === 'p1' && d.clave === 'tramo' && !esBuretaP1) return null;
            return (
              <div key={d.clave}>
                <Etiqueta texto={d.etiqueta} unidad={d.unidad} />
                {d.opciones ? (
                  <select
                    aria-label={d.etiqueta}
                    className={`input px-2 py-1.5 ${er(`dato:${d.clave}`) ? 'input-error' : ''}`}
                    value={e.datos[d.clave] ?? ''}
                    onChange={(ev) => upd((x) => (x.datos[d.clave] = ev.target.value))}
                  >
                    <option value="">—</option>
                    {d.opciones.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Celda label={d.etiqueta} value={e.datos[d.clave] ?? ''} error={er(`dato:${d.clave}`)} onChange={(v) => upd((x) => (x.datos[d.clave] = v))} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="card-title">🔬 Determinaciones</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Datos medidos y, en la parte celeste, tus resultados de cada determinación. Marcá con <strong>(*)</strong> las promediables según tu criterio.
        </p>

        {/* Celular: una tarjeta por determinación */}
        <ol className="space-y-3 sm:hidden">
          {e.filas.map((f, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">Determinación {i + 1}</span>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-700"
                    checked={f.promediable}
                    onChange={(ev) => upd((x) => (x.filas[i].promediable = ev.target.checked))}
                  />
                  (*) promediable
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {p.columnas.map((c) => (
                  <div key={c.clave}>
                    <Etiqueta texto={c.etiqueta} unidad={c.unidad} />
                    <Celda label={`${c.etiqueta} ${i + 1}`} value={f.datos[c.clave] ?? ''} error={er(`fila:${i}:${c.clave}`)} onChange={(v) => upd((x) => (x.filas[i].datos[c.clave] = v))} />
                  </div>
                ))}
                {p.resultadosFila.map((r) => (
                  <div key={r.clave} className="rounded bg-brand-50 p-1 dark:bg-brand-950/40">
                    <Etiqueta texto={r.etiqueta} unidad={r.unidad} />
                    <Celda label={`${r.etiqueta} ${i + 1}`} value={f.resultados[r.clave] ?? ''} error={er(`res:${i}:${r.clave}`)} onChange={(v) => upd((x) => (x.filas[i].resultados[r.clave] = v))} />
                  </div>
                ))}
              </div>
              {!props.soloLectura && e.filas.length > p.filas.min && (
                <button className="btn mt-2 text-xs" onClick={() => upd((x) => void x.filas.splice(i, 1))}>
                  ✕ Quitar determinación {i + 1}
                </button>
              )}
            </li>
          ))}
        </ol>

        {/* Pantalla grande: tabla */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="table-basic">
            <thead>
              <tr>
                <th>#</th>
                {p.columnas.map((c) => (
                  <th key={c.clave}>
                    {c.etiqueta} {c.unidad && <span className="font-normal text-slate-500">({c.unidad})</span>}
                  </th>
                ))}
                {p.resultadosFila.map((r) => (
                  <th key={r.clave} className="bg-brand-50 dark:bg-brand-950/40">
                    {r.etiqueta} {r.unidad && <span className="font-normal text-slate-500">({r.unidad})</span>}
                  </th>
                ))}
                <th title="Promediable">(*)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {e.filas.map((f, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {p.columnas.map((c) => (
                    <td key={c.clave}>
                      <Celda ancho="w-28" label={`${c.etiqueta} ${i + 1}`} value={f.datos[c.clave] ?? ''} error={er(`fila:${i}:${c.clave}`)} onChange={(v) => upd((x) => (x.filas[i].datos[c.clave] = v))} />
                    </td>
                  ))}
                  {p.resultadosFila.map((r) => (
                    <td key={r.clave} className="bg-brand-50 dark:bg-brand-950/40">
                      <Celda ancho="w-28" label={`${r.etiqueta} ${i + 1}`} value={f.resultados[r.clave] ?? ''} error={er(`res:${i}:${r.clave}`)} onChange={(v) => upd((x) => (x.filas[i].resultados[r.clave] = v))} />
                    </td>
                  ))}
                  <td>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-700"
                      aria-label={`Determinación ${i + 1} promediable`}
                      checked={f.promediable}
                      onChange={(ev) => upd((x) => (x.filas[i].promediable = ev.target.checked))}
                    />
                  </td>
                  <td>
                    {!props.soloLectura && e.filas.length > p.filas.min && (
                      <button className="btn px-2 py-0.5 text-xs" aria-label={`Quitar determinación ${i + 1}`} onClick={() => upd((x) => void x.filas.splice(i, 1))}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!props.soloLectura && e.filas.length < p.filas.max && (
          <button className="btn" onClick={() => upd((x) => void x.filas.push({ datos: {}, promediable: true, resultados: {} }))}>
            + Agregar determinación
          </button>
        )}
        {er('prom') && <p className="text-sm text-red-600 dark:text-red-400">{props.errores?.get('prom')}</p>}
      </section>

      <section className="card space-y-3">
        <h3 className="card-title">📏 Criterio de promediabilidad</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
          {(['dixon', 'grubbs', 'otro'] as const).map((t) => (
            <label key={t} className="inline-flex items-center gap-2">
              <input type="radio" name="criterio" className="h-4 w-4 accent-brand-700" checked={e.criterio.tipo === t} onChange={() => upd((x) => (x.criterio.tipo = t))} />
              {NOMBRE_CRITERIO[t]}
            </label>
          ))}
        </div>
        {e.criterio.tipo === 'otro' && (
          <textarea
            aria-label="Describí el criterio"
            className={`input ${er('criterio') ? 'input-error' : ''}`}
            rows={2}
            placeholder="Describí el criterio que usaste"
            value={e.criterio.texto}
            onChange={(ev) => upd((x) => (x.criterio.texto = ev.target.value))}
          />
        )}
      </section>

      <section className="card space-y-3">
        <h3 className="card-title">🧮 Mis resultados</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[...p.resultadosIntermedios, ...p.resultadosResumen].map((r) => (
            <div key={r.clave} className={`flex flex-col justify-end ${r.tipo === 'cumple' || r.etiqueta.length > 28 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <Etiqueta texto={r.etiqueta} unidad={r.unidad} />
              {r.tipo === 'cumple' ? (
                <select
                  aria-label={r.etiqueta}
                  className={`input px-2 py-1.5 ${er(`res:${r.clave}`) ? 'input-error' : ''}`}
                  value={e.resultados[r.clave] ?? ''}
                  onChange={(ev) => upd((x) => (x.resultados[r.clave] = ev.target.value))}
                >
                  <option value="">—</option>
                  <option value="si">Cumple</option>
                  <option value="no">No cumple</option>
                </select>
              ) : (
                <Celda label={r.etiqueta} value={e.resultados[r.clave] ?? ''} error={er(`res:${r.clave}`)} onChange={(v) => upd((x) => (x.resultados[r.clave] = v))} />
              )}
            </div>
          ))}
        </div>
        <div>
          <Etiqueta texto="Observaciones" />
          <textarea aria-label="Observaciones" className="input" rows={3} value={e.observaciones} onChange={(ev) => upd((x) => (x.observaciones = ev.target.value))} />
        </div>
      </section>
    </fieldset>
  );
}
