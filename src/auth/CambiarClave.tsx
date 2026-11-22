/**
 * Cambio de contraseña. Si `obligatorio`, es la pantalla que aparece después
 * de que el docente blanqueó la contraseña (no se puede seguir sin cambiarla).
 */
import { useState, type FormEvent } from 'react';
import { CLAVE_MINIMA } from '../config';
import { mensajeError, sb } from '../lib/supabase';
import { CampoClave, errorClaveNueva } from './campos';

export default function CambiarClave({ obligatorio, alTerminar }: { obligatorio?: boolean; alTerminar: () => void }) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const err = errorClaveNueva(clave, repetida, CLAVE_MINIMA);
    if (err) return setError(err);
    setEnviando(true);
    setError(null);
    const { error } = await sb().auth.updateUser({ password: clave });
    if (error) {
      setEnviando(false);
      return setError(mensajeError(error));
    }
    const { error: e2 } = await sb().rpc('marcar_clave_cambiada');
    setEnviando(false);
    if (e2) return setError(mensajeError(e2));
    setOk(true);
    setTimeout(alTerminar, 900);
  }

  return (
    <div className="mx-auto w-full max-w-md card">
      <h2 className="card-title">{obligatorio ? 'Creá una contraseña nueva' : 'Cambiar contraseña'}</h2>
      {obligatorio && <p className="aviso aviso-info mb-4">Entraste con una contraseña temporal. Para seguir, elegí una contraseña nueva (mínimo {CLAVE_MINIMA} caracteres).</p>}
      <form className="space-y-4" onSubmit={enviar} noValidate>
        <CampoClave id="nueva" etiqueta="Contraseña nueva" valor={clave} onChange={setClave} nueva autoFocus />
        <CampoClave id="repetida" etiqueta="Repetí la contraseña" valor={repetida} onChange={setRepetida} nueva />
        {error && <p className="aviso aviso-error">{error}</p>}
        {ok && <p className="aviso aviso-ok">✓ Contraseña cambiada.</p>}
        <div className="flex gap-2">
          {!obligatorio && (
            <button type="button" className="btn btn-lg" onClick={alTerminar}>
              Cancelar
            </button>
          )}
          <button className="btn btn-primary btn-lg flex-1" disabled={enviando || ok}>
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}
