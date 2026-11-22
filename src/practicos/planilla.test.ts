import { describe, expect, it } from 'vitest';
import { ajustesPorDefecto } from '../chem/practicos/datos';
import { generarEjemplos } from '../chem/practicos/ejemplos';
import { practica } from '../chem/practicos/practicas';
import { cambiosSinEnviar, editable, estadoAlumno, type FilaEntrega, type PracticoConfig } from '../lib/entregas';
import { aplicarCodigo, normalizarPlanilla, planillaVacia, validarPlanilla } from './planilla';
import { definicion, PRACTICOS_HABILITADOS } from './registro';

const aj = ajustesPorDefecto();
const p1 = practica('p1')!;
const alumno = { nombre: 'Ana Pérez', grupo: 'G1' };

describe('Planilla del alumno', () => {
  it('por ahora solo P1 está habilitado', () => {
    expect(PRACTICOS_HABILITADOS).toEqual(['p1']);
    expect(definicion('p1')?.id).toBe('p1');
    expect(definicion('p2')).toBeUndefined();
  });

  it('una planilla vacía no se puede enviar', () => {
    const err = validarPlanilla(p1, planillaVacia(p1, alumno));
    expect(err.get('mat:material:codigo')).toMatch(/falta el código/);
    expect(err.get('dato:T')).toMatch(/falta completar/);
    expect(err.size).toBeGreaterThan(10);
  });

  it('las entregas de ejemplo de P1 (completas) pasan la validación', () => {
    for (const e of generarEjemplos(aj).filter((x) => x.practica === 'p1')) {
      expect([...validarPlanilla(p1, e).values()]).toEqual([]);
    }
  });

  it('detecta números mal escritos y fuera de rango', () => {
    const e = generarEjemplos(aj).find((x) => x.practica === 'p1')!;
    e.datos.T = '22,o';
    e.datos.P = '50';
    const err = validarPlanilla(p1, e);
    expect(err.get('dato:T')).toMatch(/no es un número/);
    expect(err.get('dato:P')).toMatch(/fuera de rango/);
  });

  it('al alumno NO se le completa el V20 desde la tabla; al docente sí', () => {
    const e = planillaVacia(p1, alumno);
    aplicarCodigo(e, 'material', 'PA1005-26', aj);
    expect(e.materiales.material.v20).toBe('');
    expect(e.materiales.material.vNominal).toBe('');
    expect(e.filas).toHaveLength(10);
    aplicarCodigo(e, 'material', 'B1003-26', aj);
    expect(e.materiales.material.tramos).toEqual(['', '', '', '', '']);
    expect(e.filas).toHaveLength(6); // bureta: 6 determinaciones
    aplicarCodigo(e, 'material', 'pa1005-26', aj, true);
    expect(e.materiales.material.v20).toBe('10,02');
  });

  it('normalizar respeta lo guardado y fija nombre y grupo del perfil', () => {
    const guardada = { ...planillaVacia(p1, { nombre: 'Otro', grupo: 'G9' }), muestra: 'agua' };
    const e = normalizarPlanilla(p1, guardada, alumno);
    expect(e.muestra).toBe('agua');
    expect(e.alumno.nombre).toBe('Ana Pérez');
    expect(e.alumno.grupo).toBe('G1');
    expect(normalizarPlanilla(p1, null, alumno).filas).toHaveLength(p1.filas.defecto);
  });
});

describe('Estado de cada práctico para el alumno', () => {
  const pr = (x: Partial<PracticoConfig> = {}): PracticoConfig => ({ id: 'p1', activo: true, fecha_limite: null, devolucion_publicada: false, ...x });
  const fila = (x: Partial<FilaEntrega> = {}): FilaEntrega => ({
    id: '1', alumno: 'a', practica: 'p1', borrador: null, borrador_guardado: null, entrega: null, enviada_en: null,
    reabierta: false, devolucion_publicada: false, creada: '', ...x,
  });
  const e = planillaVacia(p1, alumno);
  const ahora = Date.parse('2026-05-10T12:00:00Z');

  it('pendiente / entregado / fuera de plazo / devuelto', () => {
    expect(estadoAlumno(pr(), null, ahora)).toBe('pendiente');
    expect(estadoAlumno(pr(), fila({ borrador: e }), ahora)).toBe('pendiente');
    expect(estadoAlumno(pr(), fila({ entrega: e }), ahora)).toBe('entregado');
    expect(estadoAlumno(pr({ fecha_limite: '2026-05-01T00:00:00Z' }), null, ahora)).toBe('fuera_de_plazo');
    expect(estadoAlumno(pr({ fecha_limite: '2026-05-01T00:00:00Z' }), fila({ reabierta: true }), ahora)).toBe('pendiente');
    expect(estadoAlumno(pr({ devolucion_publicada: true }), fila({ entrega: e }), ahora)).toBe('devuelto');
    expect(estadoAlumno(pr(), fila({ entrega: e, devolucion_publicada: true }), ahora)).toBe('devuelto');
  });

  it('se puede editar hasta la fecha límite, o si el docente la reabrió', () => {
    expect(editable(pr({ fecha_limite: '2026-05-20T00:00:00Z' }), null, ahora)).toBe(true);
    expect(editable(pr({ fecha_limite: '2026-05-01T00:00:00Z' }), fila(), ahora)).toBe(false);
    expect(editable(pr({ fecha_limite: '2026-05-01T00:00:00Z' }), fila({ reabierta: true }), ahora)).toBe(true);
    expect(editable(pr({ activo: false }), null, ahora)).toBe(false);
  });

  it('avisa si hay cambios sin enviar', () => {
    const otro = { ...e, muestra: 'x' };
    expect(cambiosSinEnviar(fila({ entrega: e, borrador: e }))).toBe(false);
    expect(cambiosSinEnviar(fila({ entrega: e, borrador: otro }))).toBe(true);
  });
});
