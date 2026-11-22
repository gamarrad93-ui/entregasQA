/**
 * Datos de la app. La URL y la clave "anon" (o "publishable") de Supabase son
 * públicas: pueden ir acá sin problema. La clave "service_role" / "secret"
 * NUNCA va en este archivo ni en ningún lugar del repositorio.
 */
const URL_PROYECTO = ''; // ej. 'https://abcdefgh.supabase.co'
const CLAVE_PUBLICA = ''; // la "anon public" o "publishable" (empieza con eyJ… o sb_publishable_…)

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || URL_PROYECTO;
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || CLAVE_PUBLICA;

/** Dominio del mail ficticio que usa Supabase Auth por dentro (<cedula>@entregas.local). */
export const DOMINIO_MAIL = 'entregas.local';

/** La sesión se cierra sola a los 7 días de haber entrado con la contraseña. */
export const DURACION_SESION_DIAS = 7;

export const CLAVE_MINIMA = 8;

export const APP_NAME = 'Entregas de prácticos';
export const COURSE = 'Química Analítica I · Tecnólogo Químico · LATU';
export const AUTHOR = 'Diego Gamarra';
