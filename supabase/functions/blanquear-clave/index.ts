// Edge Function "blanquear-clave"
// ---------------------------------------------------------------
// La llama la app cuando un DOCENTE aprieta "Blanquear contraseña" en el Padrón.
//  1. Lee quién la llama (con su sesión) — si no hay sesión, rechaza.
//  2. Pregunta a la base (función objetivo_blanqueo) si esa persona puede
//     blanquear esa cédula: docente → alumnos; admin → alumnos y docentes.
//  3. Genera una contraseña temporal, se la pone a la cuenta y la devuelve.
//     La persona tendrá que cambiarla al entrar.
// La clave service_role SOLO existe acá adentro (Supabase la pone sola):
// nunca va en la app ni en el repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Sin letras ni números que se confundan (0/O, 1/l/I)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function claveTemporal(largo = 10): string {
  const azar = crypto.getRandomValues(new Uint32Array(largo));
  return Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]).join('');
}

const MENSAJES: Record<string, string> = {
  SOLO_DOCENTE: 'Solo un docente puede blanquear contraseñas.',
  SIN_CUENTA: 'Esa cédula todavía no creó su cuenta: puede entrar con "Primera vez".',
  NO_PERMITIDO: 'No tenés permiso para blanquear la contraseña de esa persona.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Falta iniciar sesión.' }, 401);
  const { data: quien, error: errUser } = await admin.auth.getUser(token);
  if (errUser || !quien?.user) return json({ error: 'Sesión no válida. Volvé a entrar.' }, 401);

  let cedula = '';
  try {
    cedula = String((await req.json())?.cedula ?? '');
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  const { data: objetivo, error: errRpc } = await admin.rpc('objetivo_blanqueo', {
    p_solicitante: quien.user.id,
    p_cedula: cedula,
  });
  if (errRpc || !objetivo) {
    const codigo = Object.keys(MENSAJES).find((k) => errRpc?.message?.includes(k));
    return json({ error: codigo ? MENSAJES[codigo] : 'No se pudo blanquear la contraseña.' }, 403);
  }

  const clave = claveTemporal();
  const { error: errUpd } = await admin.auth.admin.updateUserById(objetivo as string, { password: clave });
  if (errUpd) return json({ error: 'No se pudo cambiar la contraseña: ' + errUpd.message }, 500);

  return json({ clave });
});
