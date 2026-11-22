/**
 * Sesión y perfil del usuario.
 *  - La sesión se cierra sola a los 7 días de haber entrado con la contraseña
 *    (se usa last_sign_in_at, que guarda el servidor de Supabase).
 *  - Si el docente dio de baja a la persona, se cierra la sesión.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DURACION_SESION_DIAS } from '../config';
import { mensajeError, supabase } from '../lib/supabase';

export type Rol = 'alumno' | 'docente' | 'admin';

export interface Perfil {
  id: string;
  cedula: string;
  nombre: string;
  apellido: string;
  grupo: string;
  rol: Rol;
  debe_cambiar_clave: boolean;
  activo: boolean;
}

interface AuthCtx {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  aviso: string | null;
  recargarPerfil: () => Promise<void>;
  salir: (aviso?: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  cargando: true,
  session: null,
  perfil: null,
  aviso: null,
  recargarPerfil: async () => {},
  salir: async () => {},
});

const MS_SESION = DURACION_SESION_DIAS * 24 * 3600 * 1000;

export function sesionVencida(s: Session | null, ahora = Date.now()): boolean {
  const t = s?.user?.last_sign_in_at ? Date.parse(s.user.last_sign_in_at) : NaN;
  return Number.isFinite(t) && ahora - t > MS_SESION;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const salir = useCallback(async (msg?: string) => {
    setAviso(msg ?? null);
    setPerfil(null);
    await supabase?.auth.signOut();
  }, []);

  const cargarPerfil = useCallback(
    async (s: Session | null) => {
      if (!supabase || !s) {
        setPerfil(null);
        return;
      }
      if (sesionVencida(s)) {
        await salir(`Pasaron ${DURACION_SESION_DIAS} días desde que entraste: volvé a escribir tu contraseña.`);
        return;
      }
      const { data, error } = await supabase.rpc('mi_perfil');
      if (error) {
        setAviso(mensajeError(error));
        setPerfil(null);
        return;
      }
      const p = (data as Perfil[] | null)?.[0] ?? null;
      if (!p) {
        await salir('No se encontró tu perfil. Consultá con tu docente.');
        return;
      }
      if (!p.activo) {
        await salir('Tu cédula fue dada de baja del curso. Consultá con tu docente.');
        return;
      }
      setPerfil(p);
    },
    [salir],
  );

  useEffect(() => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // fuera del callback (recomendación de supabase-js)
        setTimeout(() => cargarPerfil(s), 0);
      }
    });
    // revisar cada hora si ya pasaron los 7 días
    const t = setInterval(() => {
      supabase!.auth.getSession().then(({ data }) => {
        if (sesionVencida(data.session)) salir(`Pasaron ${DURACION_SESION_DIAS} días desde que entraste: volvé a escribir tu contraseña.`);
      });
    }, 3600 * 1000);
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(t);
    };
  }, [cargarPerfil, salir]);

  const recargarPerfil = useCallback(() => cargarPerfil(session), [cargarPerfil, session]);

  return <Ctx.Provider value={{ cargando, session, perfil, aviso, recargarPerfil, salir }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const esDocente = (p: Perfil | null) => p?.rol === 'docente' || p?.rol === 'admin';
