/** Vista del alumno. En la etapa 2 se agregan la planilla y la entrega. */
import type { Perfil } from '../auth/AuthProvider';
import { nombrePractica, PRACTICAS } from '../chem/practicos/practicas';

export default function AlumnoHome({ perfil }: { perfil: Perfil }) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="card-title">Hola, {perfil.nombre}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Grupo: <strong>{perfil.grupo || '—'}</strong>
        </p>
      </div>
      <div className="card">
        <h2 className="card-title">Mis prácticos</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {PRACTICAS.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-3">
              <span>{nombrePractica(p)}</span>
              <span className="chip bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">próximamente</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">La planilla para completar y entregar llega en la etapa 2.</p>
      </div>
    </div>
  );
}
