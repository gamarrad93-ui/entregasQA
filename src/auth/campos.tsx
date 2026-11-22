import { useState } from 'react';
import { errorCedula } from '../lib/cedula';

export function CampoCedula({ valor, onChange, autoFocus }: { valor: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [tocado, setTocado] = useState(false);
  const err = tocado ? errorCedula(valor) : null;
  return (
    <div>
      <label className="label" htmlFor="cedula">
        Cédula
      </label>
      <input
        id="cedula"
        className={`input ${err ? 'input-error' : ''}`}
        inputMode="numeric"
        autoComplete="username"
        placeholder="Ej. 1.234.567-2"
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTocado(true)}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Con el dígito verificador. Podés escribirla con o sin puntos y guion.</p>
      {err && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}

export function CampoClave({
  id,
  etiqueta,
  valor,
  onChange,
  nueva,
  autoFocus,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  nueva?: boolean;
  autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input"
          type={ver ? 'text' : 'password'}
          autoComplete={nueva ? 'new-password' : 'current-password'}
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn shrink-0" onClick={() => setVer(!ver)} aria-pressed={ver} title={ver ? 'Ocultar' : 'Mostrar'}>
          {ver ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

/** Reglas de la contraseña nueva. Devuelve un mensaje o null. */
export function errorClaveNueva(clave: string, repetida: string, minimo: number): string | null {
  if (clave.length < minimo) return `La contraseña tiene que tener al menos ${minimo} caracteres.`;
  if (clave !== repetida) return 'Las dos contraseñas no coinciden.';
  return null;
}
