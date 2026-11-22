import { useState } from 'react';
import AlumnoHome from './alumno/AlumnoHome';
import { esDocente, useAuth } from './auth/AuthProvider';
import CambiarClave from './auth/CambiarClave';
import Login from './auth/Login';
import { APP_NAME, AUTHOR, COURSE } from './config';
import DocenteHome from './docente/DocenteHome';
import { formatearCedula } from './lib/cedula';
import { supabase } from './lib/supabase';
import { useDisplay } from './ui/display';

export default function App() {
  const { cargando, session, perfil, aviso, salir, recargarPerfil } = useAuth();
  const [cambiando, setCambiando] = useState(false);

  let contenido: React.ReactNode;
  if (!supabase) contenido = <SinConfigurar />;
  else if (cargando) contenido = <p className="p-8 text-center text-slate-500">Cargando…</p>;
  else if (!session || !perfil) contenido = <Login aviso={aviso} />;
  else if (perfil.debe_cambiar_clave) contenido = <CambiarClave obligatorio alTerminar={recargarPerfil} />;
  else if (cambiando) contenido = <CambiarClave alTerminar={() => setCambiando(false)} />;
  else if (esDocente(perfil)) contenido = <DocenteHome perfil={perfil} />;
  else contenido = <AlumnoHome perfil={perfil} />;

  return (
    <div className="flex min-h-screen flex-col">
      <Encabezado
        usuario={
          session && perfil
            ? { nombre: `${perfil.nombre} ${perfil.apellido}`.trim(), cedula: perfil.cedula, rol: perfil.rol, onCambiarClave: () => setCambiando(true), onSalir: () => salir() }
            : null
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">{contenido}</main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Hecho con IA (Claude) por {AUTHOR}
      </footer>
    </div>
  );
}

interface Usuario {
  nombre: string;
  cedula: string;
  rol: string;
  onCambiarClave: () => void;
  onSalir: () => void;
}

function Encabezado({ usuario }: { usuario: Usuario | null }) {
  const { dark, setDark } = useDisplay();
  const [menu, setMenu] = useState(false);
  return (
    <header className="relative z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="h-1 bg-gradient-to-r from-brand-700 via-celeste to-turquesa" aria-hidden />
      <div className="relative overflow-hidden">
        {/* Bandas diagonales en azules, como la plantilla de los teóricos del curso */}
        <svg aria-hidden className="pointer-events-none absolute right-0 top-0 hidden h-full w-96 opacity-90 sm:block" viewBox="0 0 400 100" preserveAspectRatio="none">
          <polygon points="250,0 400,0 400,100 190,100" fill="#b0d1f1" opacity="0.55" />
          <polygon points="300,0 400,0 400,100 250,100" fill="#4a92d4" opacity="0.7" />
          <polygon points="340,0 400,0 400,100 300,100" fill="#0f6fc6" />
          <polygon points="372,0 400,0 400,100 352,100" fill="#009dd9" />
        </svg>
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <h1 className="font-titulo text-xl text-brand-700 dark:text-brand-300 sm:text-2xl">⚗️ {APP_NAME}</h1>
            <p className="truncate text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400 sm:text-xs">{COURSE}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setDark(!dark)} aria-pressed={dark} title="Cambiar tema claro/oscuro">
              {dark ? '☀️' : '🌙'}
            </button>
            {usuario && (
              <div className="relative">
                <button className="btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
                  👤 <span className="hidden max-w-[12rem] truncate sm:inline">{usuario.nombre}</span> ▾
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900" onClick={() => setMenu(false)}>
                    <div className="px-2 pb-2 text-sm">
                      <div className="font-semibold">{usuario.nombre}</div>
                      <div className="text-slate-500">
                        CI {formatearCedula(usuario.cedula)} · {usuario.rol}
                      </div>
                    </div>
                    <button role="menuitem" className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={usuario.onCambiarClave}>
                      🔑 Cambiar contraseña
                    </button>
                    <button role="menuitem" className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-700 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-800" onClick={usuario.onSalir}>
                      🚪 Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function SinConfigurar() {
  return (
    <div className="mx-auto max-w-xl card">
      <h2 className="card-title">Falta conectar Supabase</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Todavía no se pegaron la URL del proyecto y la clave pública en <code>src/config.ts</code>. Seguí los pasos del README (sección “Crear el proyecto de
        Supabase”).
      </p>
    </div>
  );
}
