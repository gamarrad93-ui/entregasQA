import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/** null si todavía no se pegaron la URL y la clave pública en src/config.ts */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'entregas-latu-sesion' },
      })
    : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

/** Traduce los errores de Supabase / de nuestras funciones SQL a castellano simple. */
export function mensajeError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  const tabla: [RegExp, string][] = [
    [/Invalid login credentials/i, 'Cédula o contraseña incorrecta.'],
    [/CEDULA_NO_HABILITADA|Database error saving new user/i, 'Esa cédula no está en el padrón del curso. Consultá con tu docente.'],
    [/User already registered/i, 'Esa cédula ya tiene cuenta. Entrá con tu contraseña.'],
    [/Password should be at least/i, 'La contraseña es demasiado corta.'],
    [/same_password|should be different/i, 'La contraseña nueva tiene que ser distinta de la anterior.'],
    [/SOLO_ADMIN/, 'Solo el administrador puede hacer esto.'],
    [/NO_SE_PUEDE_CAMBIAR_ADMIN/, 'Al administrador no se le puede cambiar el rol desde la app.'],
    [/CEDULA_INVALIDA/, 'La cédula no es válida.'],
    [/FALTA_NOMBRE/, 'Esa cédula no está en el padrón: escribí también el nombre.'],
    [/rate limit|too many/i, 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.'],
    [/Failed to fetch|NetworkError/i, 'No hay conexión con el servidor. Revisá internet.'],
  ];
  for (const [re, txt] of tabla) if (re.test(m)) return txt;
  return m || 'Ocurrió un error inesperado.';
}
