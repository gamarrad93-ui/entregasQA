/** Planilla vacía, validación y autocompletado (sin React, se puede probar). */
import { parseNumber } from '../chem/numeric/format';
import { buscarMaterial, nombreTramo } from '../chem/practicos/material';
import type { PracticaDef } from '../chem/practicos/motor';
import type { Ajustes, Entrega, MaterialEntregado } from '../chem/practicos/tipos';

const vacioMat = (): MaterialEntregado => ({ codigo: '', vNominal: '', tolerancia: '', v20: '', tramos: ['', '', '', '', ''] });
export const hoy = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local

export function planillaVacia(p: PracticaDef, alumno: { nombre: string; grupo: string }): Entrega {
  return {
    id: '',
    practica: p.id,
    creada: '',
    alumno: { nombre: alumno.nombre, grupo: alumno.grupo, fecha: hoy() },
    materiales: Object.fromEntries(p.materiales.map((m) => [m.clave, vacioMat()])),
    reactivos: Object.fromEntries(p.reactivos.map((r) => [r.clave, { lote: '', assay: '', fechaPreparacion: '', fechaVencimiento: '' }])),
    muestra: '',
    datos: {},
    filas: Array.from({ length: p.filas.defecto }, () => ({ datos: {}, promediable: true, resultados: {} })),
    criterio: { tipo: 'dixon', texto: '' },
    resultados: {},
    observaciones: '',
  };
}

/**
 * Completa lo que falte en una planilla guardada (por si la definición del práctico
 * cambió desde que se guardó) y fija nombre y grupo del perfil.
 */
export function normalizarPlanilla(p: PracticaDef, x: Partial<Entrega> | null | undefined, alumno: { nombre: string; grupo: string }): Entrega {
  const base = planillaVacia(p, alumno);
  if (!x) return base;
  const e: Entrega = { ...base, ...x, practica: p.id } as Entrega;
  e.alumno = { nombre: alumno.nombre, grupo: alumno.grupo, fecha: x.alumno?.fecha || base.alumno.fecha };
  e.materiales = { ...base.materiales, ...(x.materiales ?? {}) };
  for (const k of Object.keys(e.materiales)) e.materiales[k] = { ...vacioMat(), ...e.materiales[k] };
  e.reactivos = { ...base.reactivos, ...(x.reactivos ?? {}) };
  e.datos = { ...(x.datos ?? {}) };
  e.resultados = { ...(x.resultados ?? {}) };
  e.filas = (x.filas?.length ? x.filas : base.filas).map((f) => ({ datos: { ...(f.datos ?? {}) }, promediable: f.promediable ?? true, resultados: { ...(f.resultados ?? {}) } }));
  e.criterio = x.criterio?.tipo ? { tipo: x.criterio.tipo, texto: x.criterio.texto ?? '' } : base.criterio;
  return e;
}

/** Al escribir un código Lab QA se completan V nominal y V20 desde la tabla. */
export function aplicarCodigo(x: Entrega, slot: string, codigo: string, aj: Ajustes): void {
  const m = x.materiales[slot];
  m.codigo = codigo;
  const ref = buscarMaterial(aj.materiales, codigo);
  if (!ref) return;
  m.vNominal = String(ref.nominal).replace('.', ',');
  if (ref.v20 != null) m.v20 = ref.v20.toFixed(2).replace('.', ',');
  if (ref.tramos) m.tramos = ref.tramos.map((v) => v.toFixed(2).replace('.', ','));
  // P1: n = 10 para pipetas, 6 para buretas (si la tabla todavía está vacía)
  if (x.practica === 'p1' && x.filas.every((f) => Object.values(f.datos).every((v) => !v))) {
    const n = ref.tipo === 'bureta' ? 6 : 10;
    x.filas = Array.from({ length: n }, () => ({ datos: {}, promediable: true, resultados: {} }));
  }
}

export const esBureta = (codigo: string | undefined) => /^B/i.test((codigo ?? '').trim());

/** Validación de formato y rango antes de enviar. Devuelve clave del campo → mensaje. */
export function validarPlanilla(p: PracticaDef, e: Entrega): Map<string, string> {
  const err = new Map<string, string>();
  const numero = (k: string, v: string | undefined, nombre: string, min?: number, max?: number) => {
    const s = (v ?? '').trim();
    if (!s) return void err.set(k, `${nombre}: falta completar.`);
    const x = parseNumber(s);
    if (x == null) err.set(k, `${nombre}: no es un número válido (usá coma o punto decimal).`);
    else if ((min != null && x < min) || (max != null && x > max))
      err.set(k, `${nombre}: fuera de rango (${String(min ?? '−∞').replace('.', ',')} a ${String(max ?? '∞').replace('.', ',')}).`);
  };
  if (!e.alumno.fecha) err.set('fecha', 'Indicá la fecha del práctico.');
  for (const s of p.materiales) {
    const m = e.materiales[s.clave];
    if (!m?.codigo.trim()) err.set(`mat:${s.clave}:codigo`, `${s.rol}: falta el código.`);
    numero(`mat:${s.clave}:tol`, m?.tolerancia, `${s.rol}: tolerancia`, 0, 5);
    const bur = esBureta(m?.codigo) || (s.tipos.length === 1 && s.tipos[0] === 'bureta');
    if (bur) m?.tramos.forEach((t, i) => numero(`mat:${s.clave}:tramo${i}`, t, `${s.rol}: V20 ${nombreTramo(i)}`, 0, 12));
    else numero(`mat:${s.clave}:v20`, m?.v20, `${s.rol}: V20`, 0, 2000);
  }
  for (const r of p.reactivos) if (r.conAssay) numero(`rea:${r.clave}:assay`, e.reactivos[r.clave]?.assay, `${r.nombre}: assay`, 50, 101);
  for (const d of p.datos) {
    if (d.opciones) {
      if (p.id === 'p1' && d.clave === 'tramo' && !esBureta(e.materiales.material?.codigo)) continue;
      if (!e.datos[d.clave]) err.set(`dato:${d.clave}`, `${d.etiqueta}: elegí una opción.`);
    } else numero(`dato:${d.clave}`, e.datos[d.clave], d.etiqueta, d.min, d.max);
  }
  if (e.filas.length < p.filas.min) err.set('filas', `Se necesitan al menos ${p.filas.min} determinaciones.`);
  e.filas.forEach((f, i) => {
    for (const c of p.columnas) numero(`fila:${i}:${c.clave}`, f.datos[c.clave], `Determinación ${i + 1}: ${c.etiqueta}`, c.min, c.max);
    for (const r of p.resultadosFila) numero(`res:${i}:${r.clave}`, f.resultados[r.clave], `Determinación ${i + 1}: ${r.etiqueta}`);
  });
  if (!e.filas.some((f) => f.promediable)) err.set('prom', 'Marcá con (*) los valores promediables.');
  if (e.criterio.tipo === 'otro' && !e.criterio.texto.trim()) err.set('criterio', 'Describí el criterio de promediabilidad.');
  for (const r of [...p.resultadosIntermedios, ...p.resultadosResumen]) {
    if (r.tipo === 'cumple') {
      if (!e.resultados[r.clave]) err.set(`res:${r.clave}`, `${r.etiqueta}: indicá si cumple.`);
    } else numero(`res:${r.clave}`, e.resultados[r.clave], r.etiqueta, r.tipo === 'entero' ? 1 : undefined);
  }
  return err;
}
