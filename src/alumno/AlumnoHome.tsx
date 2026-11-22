/** Vista del alumno: lista de prácticos con su estado → planilla. */
import { useCallback, useEffect, useState } from 'react';
import type { Perfil } from '../auth/AuthProvider';
import {
  cambiosSinEnviar,
  estadoAlumno,
  ETIQUETA_ESTADO,
  fechaHora,
  listarPracticos,
  misEntregas,
  type Estado,
  type FilaEntrega,
  type PracticoConfig,
} from '../lib/entregas';
import { mensajeError } from '../lib/supabase';
import { definicion, nombreCorto } from '../practicos/registro';
import PantallaEntrega from './PantallaEntrega';

const COLOR: Record<Estado, string> = {
  pendiente: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  entregado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  fuera_de_plazo: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100',
  devuelto: 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100',
};

export function ChipEstado({ estado }: { estado: Estado }) {
  return <span className={`chip ${COLOR[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

export default function AlumnoHome({ perfil }: { perfil: Perfil }) {
  const [practicos, setPracticos] = useState<PracticoConfig[] | null>(null);
  const [filas, setFilas] = useState<FilaEntrega[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [pr, en] = await Promise.all([listarPracticos(), misEntregas()]);
      setPracticos(pr.filter((x) => x.activo && definicion(x.id)));
      setFilas(en);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const filaDe = (id: string) => filas.find((f) => f.practica === id) ?? null;
  const actual = abierto ? practicos?.find((x) => x.id === abierto) : undefined;
  const def = abierto ? definicion(abierto) : undefined;

  if (actual && def)
    return (
      <PantallaEntrega
        key={actual.id}
        perfil={perfil}
        p={def}
        config={actual}
        fila={filaDe(actual.id)}
        onFila={(f) => setFilas((prev) => [...prev.filter((x) => x.practica !== f.practica), f])}
        onVolver={() => {
          setAbierto(null);
          cargar();
        }}
      />
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <h2 className="card-title">Hola, {perfil.nombre}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Grupo <strong>{perfil.grupo || '—'}</strong>. Tocá un práctico para completar la planilla. Se guarda sola mientras escribís; cuando termines, tocá{' '}
          <strong>Enviar entrega</strong>.
        </p>
      </div>
      {error && <p className="aviso aviso-error">{error}</p>}
      <div className="card">
        <h2 className="card-title">Mis prácticos</h2>
        {!practicos ? (
          <p className="text-slate-500">Cargando…</p>
        ) : !practicos.length ? (
          <p className="text-slate-500">Todavía no hay prácticos habilitados para entregar.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {practicos.map((pr) => {
              const f = filaDe(pr.id);
              const est = estadoAlumno(pr, f);
              return (
                <li key={pr.id}>
                  <button className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setAbierto(pr.id)}>
                    <span className="min-w-0">
                      <span className="block font-medium">{nombreCorto(pr.id)}</span>
                      <span className="block text-xs text-slate-500">
                        {pr.fecha_limite ? `Fecha límite: ${fechaHora(pr.fecha_limite)}` : 'Sin fecha límite'}
                        {f?.enviada_en && ` · Enviada: ${fechaHora(f.enviada_en)}`}
                        {cambiosSinEnviar(f) && ' · cambios sin enviar'}
                        {!f?.entrega && f?.borrador && ' · borrador guardado'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ChipEstado estado={est} />
                      <span aria-hidden className="text-slate-400">
                        ›
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
