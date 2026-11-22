/** Vista del docente: pestañas. La pestaña activa queda en la URL (#docentes). */
import { useEffect, useRef, useState } from 'react';
import type { Perfil } from '../auth/AuthProvider';
import Proximamente from '../ui/Proximamente';
import BlanquearClave from './BlanquearClave';
import DocentesPanel from './DocentesPanel';

const PESTANAS = [
  { id: 'entregas', label: 'Entregas', icon: '📥' },
  { id: 'tendencias', label: 'Tendencias', icon: '📊' },
  { id: 'practicos', label: 'Prácticos', icon: '🧪' },
  { id: 'padron', label: 'Padrón', icon: '👥' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
  { id: 'exportar', label: 'Exportar', icon: '📤' },
  { id: 'docentes', label: 'Docentes', icon: '🎓', soloAdmin: true },
] as const;
type Id = (typeof PESTANAS)[number]['id'];

function desdeHash(): Id {
  const h = window.location.hash.replace('#', '');
  return (PESTANAS.find((p) => p.id === h)?.id ?? 'entregas') as Id;
}

export default function DocenteHome({ perfil }: { perfil: Perfil }) {
  const visibles = PESTANAS.filter((p) => !('soloAdmin' in p) || perfil.rol === 'admin');
  const [tab, setTab] = useState<Id>(desdeHash);
  useEffect(() => {
    const on = () => setTab(desdeHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [tab]);
  const activa = visibles.some((p) => p.id === tab) ? tab : 'entregas';

  return (
    <div>
      <nav ref={navRef} className="-mx-4 mb-4 overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-800" aria-label="Secciones">
        <ul className="flex gap-1 whitespace-nowrap">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  window.location.hash = p.id;
                  setTab(p.id);
                }}
                aria-current={activa === p.id ? 'page' : undefined}
                className={`border-b-4 px-3 py-2 text-sm font-semibold ${activa === p.id ? 'border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-300' : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                <span aria-hidden>{p.icon}</span> {p.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {activa === 'entregas' && <Proximamente titulo="Entregas y corrección" etapa={3} />}
      {activa === 'tendencias' && <Proximamente titulo="Tendencias" etapa={4} />}
      {activa === 'practicos' && <Proximamente titulo="Prácticos" etapa={2} />}
      {activa === 'padron' && (
        <div className="space-y-4">
          <Proximamente titulo="Padrón" etapa={5}>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Mientras tanto, los alumnos se cargan desde Supabase (ver README). Ya podés blanquear contraseñas acá abajo.
            </p>
          </Proximamente>
          <BlanquearClave />
        </div>
      )}
      {activa === 'ajustes' && <Proximamente titulo="Ajustes" etapa={5} />}
      {activa === 'exportar' && <Proximamente titulo="Exportar" etapa={5} />}
      {activa === 'docentes' && perfil.rol === 'admin' && <DocentesPanel />}
    </div>
  );
}
