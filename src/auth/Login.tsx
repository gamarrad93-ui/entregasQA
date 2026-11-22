/**
 * Pantalla de ingreso: "Entrar" (cédula + contraseña) y "Primera vez"
 * (verifica que la cédula esté en el padrón y crea la contraseña).
 */
import { useState, type FormEvent } from 'react';
import { CLAVE_MINIMA } from '../config';
import { cedulaValida, errorCedula, formatearCedula, mailDeCedula, normalizarCedula } from '../lib/cedula';
import { mensajeError, sb } from '../lib/supabase';
import { CampoCedula, CampoClave, errorClaveNueva } from './campos';

type Modo = 'entrar' | 'primera';

export default function Login({ aviso }: { aviso: string | null }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [cedula, setCedula] = useState('');
  return (
    <div className="mx-auto w-full max-w-md">
      {aviso && <p className="aviso aviso-info mb-3">{aviso}</p>}
      <div className="card">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(
            [
              ['entrar', 'Entrar'],
              ['primera', 'Primera vez'],
            ] as const
          ).map(([m, t]) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${modo === m ? 'bg-white text-brand-800 shadow dark:bg-slate-950 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}
              onClick={() => setModo(m)}
            >
              {t}
            </button>
          ))}
        </div>
        {modo === 'entrar' ? <Entrar cedula={cedula} setCedula={setCedula} /> : <PrimeraVez cedula={cedula} setCedula={setCedula} irAEntrar={() => setModo('entrar')} />}
      </div>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        ¿Te olvidaste la contraseña? Pedile a tu docente que la <strong>blanquee</strong>: te va a dar una contraseña temporal.
      </p>
    </div>
  );
}

function Entrar({ cedula, setCedula }: { cedula: string; setCedula: (v: string) => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const errC = errorCedula(cedula);
    if (errC) return setError(errC);
    if (!clave) return setError('Escribí tu contraseña.');
    setEnviando(true);
    setError(null);
    const { error } = await sb().auth.signInWithPassword({ email: mailDeCedula(cedula), password: clave });
    setEnviando(false);
    if (error) setError(mensajeError(error));
  }

  return (
    <form className="space-y-4" onSubmit={enviar} noValidate>
      <CampoCedula valor={cedula} onChange={setCedula} autoFocus />
      <CampoClave id="clave" etiqueta="Contraseña" valor={clave} onChange={setClave} />
      {error && <p className="aviso aviso-error">{error}</p>}
      <button className="btn btn-primary btn-lg w-full" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

function PrimeraVez({ cedula, setCedula, irAEntrar }: { cedula: string; setCedula: (v: string) => void; irAEntrar: () => void }) {
  const [paso, setPaso] = useState<'cedula' | 'clave'>('cedula');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function verificar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const errC = errorCedula(cedula);
    if (errC) return setError(errC);
    setEnviando(true);
    const { data, error } = await sb().rpc('estado_cedula', { p_cedula: normalizarCedula(cedula) });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    if (data === 'disponible') setPaso('clave');
    else if (data === 'registrada') setInfo('Esa cédula ya tiene cuenta. Entrá con tu contraseña (o pedile al docente que la blanquee).');
    else if (data === 'no_habilitada') setError('Esa cédula no está en el padrón del curso. Consultá con tu docente.');
    else setError('La cédula no es válida.');
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    const err = errorClaveNueva(clave, repetida, CLAVE_MINIMA);
    if (err) return setError(err);
    setEnviando(true);
    setError(null);
    const { data, error } = await sb().auth.signUp({ email: mailDeCedula(cedula), password: clave });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    if (!data.session) {
      // pasa si en Supabase quedó activado "Confirm email"
      setError('La cuenta se creó pero el servidor pide confirmar un mail. Avisale al docente (en Supabase hay que desactivar "Confirm email").');
    }
  }

  if (paso === 'cedula')
    return (
      <form className="space-y-4" onSubmit={verificar} noValidate>
        <p className="text-sm text-slate-600 dark:text-slate-400">Escribí tu cédula: vamos a ver si estás en el padrón del curso.</p>
        <CampoCedula valor={cedula} onChange={setCedula} autoFocus />
        {error && <p className="aviso aviso-error">{error}</p>}
        {info && (
          <p className="aviso aviso-info">
            {info}{' '}
            <button type="button" className="font-semibold underline" onClick={irAEntrar}>
              Ir a Entrar
            </button>
          </p>
        )}
        <button className="btn btn-primary btn-lg w-full" disabled={enviando}>
          {enviando ? 'Verificando…' : 'Continuar'}
        </button>
      </form>
    );

  return (
    <form className="space-y-4" onSubmit={crear} noValidate>
      <p className="aviso aviso-ok">
        ✓ La cédula {cedulaValida(cedula) ? formatearCedula(cedula) : cedula} está en el padrón. Creá tu contraseña (mínimo {CLAVE_MINIMA} caracteres).
      </p>
      <CampoClave id="nueva" etiqueta="Contraseña nueva" valor={clave} onChange={setClave} nueva autoFocus />
      <CampoClave id="repetida" etiqueta="Repetí la contraseña" valor={repetida} onChange={setRepetida} nueva />
      {error && <p className="aviso aviso-error">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-lg" onClick={() => setPaso('cedula')}>
          Atrás
        </button>
        <button className="btn btn-primary btn-lg flex-1" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear mi cuenta'}
        </button>
      </div>
    </form>
  );
}
