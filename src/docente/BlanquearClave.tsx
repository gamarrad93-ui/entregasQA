/**
 * Blanquear la contraseña de un alumno (o de un docente, si quien lo hace es admin).
 * Llama a la Edge Function "blanquear-clave", que es la única que usa la service_role.
 */
import { useState, type FormEvent } from 'react';
import { errorCedula, formatearCedula, normalizarCedula } from '../lib/cedula';
import { mensajeError, sb } from '../lib/supabase';

export async function blanquearClave(cedula: string): Promise<{ clave?: string; error?: string }> {
  const { data, error } = await sb().functions.invoke('blanquear-clave', { body: { cedula: normalizarCedula(cedula) } });
  if (error) {
    // el cuerpo de la respuesta trae el mensaje en castellano
    try {
      const cuerpo = await (error as { context?: Response }).context?.json();
      if (cuerpo?.error) return { error: cuerpo.error };
    } catch {
      /* sin cuerpo */
    }
    return { error: mensajeError(error) };
  }
  return { clave: (data as { clave?: string })?.clave };
}

export function ResultadoBlanqueo({ cedula, clave }: { cedula: string; clave: string }) {
  return (
    <div className="aviso aviso-ok mt-3">
      <p>
        Contraseña temporal de <strong>{formatearCedula(cedula)}</strong>:
      </p>
      <p className="my-2 select-all rounded bg-white px-3 py-2 text-center font-mono text-2xl tracking-wider text-slate-900 dark:bg-slate-900 dark:text-white">{clave}</p>
      <p className="text-xs">Dásela a la persona. Al entrar con esta contraseña, la app le va a pedir que elija una nueva. No se vuelve a mostrar.</p>
    </div>
  );
}

export default function BlanquearClave() {
  const [cedula, setCedula] = useState('');
  const [res, setRes] = useState<{ cedula: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setRes(null);
    const err = errorCedula(cedula);
    if (err) return setError(err);
    if (!confirm(`¿Blanquear la contraseña de ${formatearCedula(cedula)}? La contraseña actual deja de funcionar.`)) return;
    setOcupado(true);
    setError(null);
    const r = await blanquearClave(cedula);
    setOcupado(false);
    if (r.error || !r.clave) setError(r.error ?? 'No se pudo blanquear.');
    else setRes({ cedula: normalizarCedula(cedula), clave: r.clave });
  }

  return (
    <div className="card">
      <h2 className="card-title">Blanquear contraseña</h2>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={enviar} noValidate>
        <div className="flex-1">
          <label className="label" htmlFor="b-ced">
            Cédula
          </label>
          <input id="b-ced" className="input" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="1.234.567-2" />
        </div>
        <button className="btn btn-primary py-2" disabled={ocupado}>
          {ocupado ? 'Blanqueando…' : 'Blanquear'}
        </button>
      </form>
      {error && <p className="aviso aviso-error mt-3">{error}</p>}
      {res && <ResultadoBlanqueo {...res} />}
    </div>
  );
}
