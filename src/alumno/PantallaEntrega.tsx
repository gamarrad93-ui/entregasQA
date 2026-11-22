/**
 * Planilla de un práctico para el alumno, con borrador automático:
 *  - cada cambio se guarda en el celular al instante y en el servidor ~1,5 s después;
 *  - "Enviar" copia el borrador como entrega (la que corrige el docente);
 *  - se puede editar y volver a enviar hasta la fecha límite.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Perfil } from '../auth/AuthProvider';
import { ajustesPorDefecto } from '../chem/practicos/datos';
import type { PracticaDef } from '../chem/practicos/motor';
import type { Entrega } from '../chem/practicos/tipos';
import {
  cambiosSinEnviar,
  editable,
  enviarEntrega,
  estadoAlumno,
  ETIQUETA_ESTADO,
  fechaHora,
  guardarBorrador,
  type FilaEntrega,
  type PracticoConfig,
} from '../lib/entregas';
import { mensajeError } from '../lib/supabase';
import { normalizarPlanilla, validarPlanilla } from '../practicos/planilla';
import { nombreCorto } from '../practicos/registro';
import Planilla from '../ui/Planilla';
import { ChipEstado } from './AlumnoHome';
import Devolucion from './Devolucion';

type Guardado = 'guardado' | 'pendiente' | 'guardando' | 'local' | 'cerrada';

const AJUSTES = ajustesPorDefecto(); // en la etapa 5 vienen de la base (pestaña Ajustes)
const claveLocal = (uid: string, pr: string) => `entregas-borrador:${uid}:${pr}`;

function leerLocal(uid: string, pr: string): { t: number; planilla: Entrega } | null {
  try {
    const s = localStorage.getItem(claveLocal(uid, pr));
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function escribirLocal(uid: string, pr: string, planilla: Entrega | null) {
  try {
    if (planilla) localStorage.setItem(claveLocal(uid, pr), JSON.stringify({ t: Date.now(), planilla }));
    else localStorage.removeItem(claveLocal(uid, pr));
  } catch {
    /* sin almacenamiento local: se guarda solo en el servidor */
  }
}

export default function PantallaEntrega(props: {
  perfil: Perfil;
  p: PracticaDef;
  config: PracticoConfig;
  fila: FilaEntrega | null;
  onFila: (f: FilaEntrega) => void;
  onVolver: () => void;
}) {
  const { perfil, p, config } = props;
  const alumno = { nombre: `${perfil.nombre} ${perfil.apellido}`.trim(), grupo: perfil.grupo };

  const [fila, setFila] = useState<FilaEntrega | null>(props.fila);
  const [planilla, setPlanilla] = useState<Entrega>(() => {
    const local = leerLocal(perfil.id, p.id);
    const servidor = props.fila?.borrador ?? props.fila?.entrega ?? null;
    const tServidor = props.fila?.borrador_guardado ? Date.parse(props.fila.borrador_guardado) : 0;
    const usarLocal = local && local.t > tServidor + 1000;
    return normalizarPlanilla(p, usarLocal ? local.planilla : servidor, alumno);
  });
  const [guardado, setGuardado] = useState<Guardado>('guardado');
  const [errores, setErrores] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recienEnviada, setRecienEnviada] = useState(false);

  const puedeEditar = editable(config, fila);
  const estado = estadoAlumno(config, fila);

  // ---------- guardado automático ----------
  const filaRef = useRef(fila);
  filaRef.current = fila;
  const ultimo = useRef<Entrega>(planilla);
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const temporizador = useRef<number | undefined>(undefined);
  const sucio = useRef(false);
  const onFilaRef = useRef(props.onFila);
  onFilaRef.current = props.onFila;

  const guardarAhora = useCallback(() => {
    window.clearTimeout(temporizador.current);
    if (!sucio.current) return cola.current;
    sucio.current = false;
    const copia = structuredClone(ultimo.current);
    setGuardado('guardando');
    cola.current = cola.current.then(async () => {
      try {
        const nueva = await guardarBorrador(p.id, copia, filaRef.current?.id ?? null);
        filaRef.current = nueva;
        setFila(nueva);
        onFilaRef.current(nueva);
        setGuardado(sucio.current ? 'pendiente' : 'guardado');
      } catch (e) {
        if (String((e as Error)?.message) === 'CERRADA') setGuardado('cerrada');
        else {
          sucio.current = true; // se reintenta con el próximo cambio o al volver la conexión
          setGuardado('local');
        }
      }
    });
    return cola.current;
  }, [p.id]);

  const cambiar = (f: (x: Entrega) => void) => {
    if (!puedeEditar) return;
    setPlanilla((prev) => {
      const x = structuredClone(prev);
      f(x);
      ultimo.current = x;
      escribirLocal(perfil.id, p.id, x);
      return x;
    });
    sucio.current = true;
    setGuardado('pendiente');
    setRecienEnviada(false);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(guardarAhora, 1500);
  };

  // si se cierra la pestaña o se sale de la pantalla, guardar lo pendiente
  useEffect(() => {
    const antes = () => void guardarAhora();
    window.addEventListener('pagehide', antes);
    window.addEventListener('online', antes);
    document.addEventListener('visibilitychange', antes);
    return () => {
      window.removeEventListener('pagehide', antes);
      window.removeEventListener('online', antes);
      document.removeEventListener('visibilitychange', antes);
      void guardarAhora();
    };
  }, [guardarAhora]);

  // ---------- envío ----------
  async function enviar() {
    setError(null);
    const err = validarPlanilla(p, planilla);
    setErrores(err);
    if (err.size) {
      setTimeout(() => document.getElementById('errores-planilla')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    const reenvio = !!fila?.entrega;
    if (!confirm(reenvio ? '¿Reemplazar tu entrega anterior por esta versión?' : '¿Enviar la entrega? Vas a poder modificarla hasta la fecha límite.')) return;
    setEnviando(true);
    try {
      await cola.current;
      window.clearTimeout(temporizador.current);
      sucio.current = false;
      const nueva = await enviarEntrega(p.id, planilla, filaRef.current?.id ?? null);
      setFila(nueva);
      onFilaRef.current(nueva);
      escribirLocal(perfil.id, p.id, null);
      setGuardado('guardado');
      setRecienEnviada(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(String((e as Error)?.message) === 'CERRADA' ? 'El plazo de entrega ya cerró. Consultá con tu docente.' : mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const sinEnviar = fila?.entrega ? cambiosSinEnviar({ ...fila, borrador: planilla }) : false;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button
          className="btn"
          onClick={async () => {
            await guardarAhora();
            props.onVolver();
          }}
        >
          ← Mis prácticos
        </button>
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-titulo text-xl text-brand-700 dark:text-brand-300">{nombreCorto(p.id)}</h2>
          <ChipEstado estado={estado} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Fecha límite: <strong>{config.fecha_limite ? fechaHora(config.fecha_limite) : 'sin fecha límite'}</strong>
          {fila?.enviada_en && (
            <>
              {' '}
              · Enviada: <strong>{fechaHora(fila.enviada_en)}</strong>
            </>
          )}
        </p>
        {recienEnviada && <p className="aviso aviso-ok">📨 ¡Entrega recibida! Podés modificarla y volver a enviarla hasta la fecha límite.</p>}
        {!puedeEditar && <p className="aviso aviso-info">🔒 El plazo cerró: la planilla ya no se puede modificar. Si necesitás cambiar algo, hablá con tu docente.</p>}
        {puedeEditar && sinEnviar && !recienEnviada && (
          <p className="aviso aviso-info">✏️ Tenés cambios que todavía <strong>no enviaste</strong>. Tu docente ve la versión que enviaste antes.</p>
        )}
      </div>

      {estado === 'devuelto' && fila && <Devolucion entregaId={fila.id} />}

      <Planilla p={p} valor={planilla} onChange={cambiar} ajustes={AJUSTES} errores={errores} soloLectura={!puedeEditar} />

      {errores && errores.size > 0 && (
        <div id="errores-planilla" className="aviso aviso-error">
          <strong>Revisá estos campos antes de enviar:</strong>
          <ul className="mt-1 list-disc pl-5">
            {[...errores.values()].slice(0, 12).map((m) => (
              <li key={m}>{m}</li>
            ))}
            {errores.size > 12 && <li>… y {errores.size - 12} más.</li>}
          </ul>
        </div>
      )}
      {error && <p className="aviso aviso-error">{error}</p>}

      {puedeEditar && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <EstadoGuardado g={guardado} />
            <button className="btn btn-primary btn-lg" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : fila?.entrega ? '📨 Volver a enviar' : '📨 Enviar entrega'}
            </button>
          </div>
        </div>
      )}
      <p className="sr-only">{ETIQUETA_ESTADO[estado]}</p>
    </div>
  );
}

function EstadoGuardado({ g }: { g: Guardado }) {
  const t: Record<Guardado, string> = {
    guardado: '✓ Borrador guardado',
    pendiente: '… Cambios sin guardar',
    guardando: '⟳ Guardando…',
    local: '⚠️ Sin conexión: guardado solo en este dispositivo',
    cerrada: '🔒 El plazo cerró: no se guardó',
  };
  return <span className={`text-xs sm:text-sm ${g === 'local' || g === 'cerrada' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>{t[g]}</span>;
}
