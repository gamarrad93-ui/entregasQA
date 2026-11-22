/** Devolución publicada por el docente: ✓/✗ por valor y comentarios. Nunca el valor correcto. */
import { useEffect, useState } from 'react';
import { miDevolucion, type DevolucionAlumno } from '../lib/entregas';
import { mensajeError } from '../lib/supabase';
import Marca from '../ui/Marca';

export default function Devolucion({ entregaId }: { entregaId: string }) {
  const [d, setD] = useState<DevolucionAlumno | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    miDevolucion(entregaId)
      .then(setD)
      .catch((e) => setError(mensajeError(e)));
  }, [entregaId]);

  if (error) return <p className="aviso aviso-error">{error}</p>;
  if (d === undefined) return <p className="text-slate-500">Cargando devolución…</p>;
  if (!d) return null;
  const items = d.items ?? [];
  const porFila = items.filter((i) => i.fila != null);
  const resto = items.filter((i) => i.fila == null);
  const bien = items.filter((i) => i.ok).length;

  return (
    <section className="card space-y-3 border-2 border-brand-300 dark:border-brand-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title mb-0">📬 Devolución del docente</h3>
        {d.nota != null && (
          <span className="rounded-xl bg-brand-700 px-3 py-1 font-mono text-lg font-semibold text-white">
            {Number(d.nota).toLocaleString('es-UY')} %
          </span>
        )}
      </div>
      {d.comentario && <p className="whitespace-pre-wrap rounded-lg bg-brand-50 p-3 dark:bg-brand-950/40">{d.comentario}</p>}
      {items.length > 0 && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {bien} de {items.length} valores correctos.
          </p>
          <Lista titulo="Resultados" items={resto} />
          <Lista titulo="Por determinación" items={porFila} />
        </>
      )}
    </section>
  );
}

function Lista({ titulo, items }: { titulo: string; items: NonNullable<DevolucionAlumno['items']> }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{titulo}</h4>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((it, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              {it.fila != null && <span className="text-slate-500">#{it.fila + 1} </span>}
              {it.etiqueta} {it.unidad && <span className="text-slate-500">({it.unidad})</span>}
              <span className="ml-1 font-mono text-slate-700 dark:text-slate-300">= {it.alumno || '—'}</span>
              {it.comentario && <span className="block italic text-brand-800 dark:text-brand-300">“{it.comentario}”</span>}
            </span>
            <Marca ok={it.ok} chica />
          </li>
        ))}
      </ul>
    </div>
  );
}
