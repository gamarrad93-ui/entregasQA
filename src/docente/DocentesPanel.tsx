/**
 * Pantalla "Docentes" (solo admin): poner o sacar el rol docente a una cédula.
 * La seguridad real está en la función SQL asignar_docente (rechaza a quien no es admin).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorCedula, formatearCedula, normalizarCedula } from '../lib/cedula';
import { mensajeError, sb } from '../lib/supabase';

interface Fila {
  cedula: string;
  nombre: string;
  apellido: string;
  rol: 'alumno' | 'docente' | 'admin';
  tiene_cuenta: boolean;
}

export default function DocentesPanel() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cedula, setCedula] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await sb().rpc('listar_docentes');
    if (error) setError(mensajeError(error));
    else setFilas((data ?? []) as Fila[]);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function asignar(ced: string, esDocente: boolean, nom?: string, ape?: string) {
    setOcupado(true);
    setError(null);
    setOk(null);
    const { error } = await sb().rpc('asignar_docente', { p_cedula: ced, p_es_docente: esDocente, p_nombre: nom ?? null, p_apellido: ape ?? null });
    setOcupado(false);
    if (error) {
      setError(mensajeError(error));
      return false;
    }
    setOk(esDocente ? `✓ ${formatearCedula(ced)} ahora es docente.` : `✓ ${formatearCedula(ced)} ya no es docente (queda como alumno).`);
    await cargar();
    return true;
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const err = errorCedula(cedula);
    if (err) return setError(err);
    if (await asignar(normalizarCedula(cedula), true, nombre, apellido)) {
      setCedula('');
      setNombre('');
      setApellido('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="card-title">Docentes</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Los docentes ven todas las entregas, corrigen, cargan el padrón y blanquean contraseñas de alumnos. Si la persona todavía no tiene cuenta, después
          entra con <strong>“Primera vez”</strong> y su cédula.
        </p>
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={agregar} noValidate>
          <div>
            <label className="label" htmlFor="d-ced">
              Cédula
            </label>
            <input id="d-ced" className="input" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="1.234.567-2" />
          </div>
          <div>
            <label className="label" htmlFor="d-nom">
              Nombre
            </label>
            <input id="d-nom" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-ape">
              Apellido
            </label>
            <input id="d-ape" className="input" value={apellido} onChange={(e) => setApellido(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full py-2" disabled={ocupado}>
              Hacer docente
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">Si la cédula ya está en el padrón (por ejemplo, era alumno), alcanza con la cédula.</p>
        {error && <p className="aviso aviso-error mt-3">{error}</p>}
        {ok && <p className="aviso aviso-ok mt-3">{ok}</p>}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-basic">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Rol</th>
              <th>Cuenta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.cedula}>
                <td>
                  {f.apellido}, {f.nombre}
                </td>
                <td className="whitespace-nowrap">{formatearCedula(f.cedula)}</td>
                <td>
                  <span className={`chip ${f.rol === 'admin' ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100'}`}>{f.rol}</span>
                </td>
                <td>{f.tiene_cuenta ? '✓ creada' : 'todavía no'}</td>
                <td className="text-right">
                  {f.rol === 'docente' && (
                    <button className="btn" disabled={ocupado} onClick={() => confirm(`¿Sacarle el rol docente a ${f.nombre} ${f.apellido}?`) && asignar(f.cedula, false)}>
                      Sacar rol docente
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  Todavía no hay docentes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
