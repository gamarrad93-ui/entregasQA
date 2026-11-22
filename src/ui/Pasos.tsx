/** Panel "Ver procedimiento": pasos del motor con ecuaciones, textos y tablas. */
import { useState } from 'react';
import type { Paso } from '../chem/practicos/motor';
import { Tex } from './Tex';

export default function Pasos({ pasos, titulo = 'Ver procedimiento' }: { pasos: Paso[]; titulo?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
      <button className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-brand-900 dark:text-brand-200" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>📐 {titulo}</span>
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol className="space-y-3 px-4 pb-4">
          {pasos.map((s, i) => (
            <li key={i} className="rounded-lg bg-white p-3 text-sm dark:bg-slate-900">
              <div className="mb-1 font-semibold">
                {i + 1}. {s.titulo}
              </div>
              {s.texto && <div className="mb-1 text-slate-700 dark:text-slate-300">{s.texto}</div>}
              {s.tex?.map((t, j) => (
                <Tex key={j} block>
                  {t}
                </Tex>
              ))}
              {s.tabla && (
                <div className="mt-2 overflow-x-auto">
                  <table className="table-basic">
                    <thead>
                      <tr>
                        {s.tabla.cabecera.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.tabla.filas.map((f, k) => (
                        <tr key={k}>
                          {f.map((c, m) => (
                            <td key={m} className="font-mono">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
