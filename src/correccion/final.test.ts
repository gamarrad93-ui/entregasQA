import { describe, expect, it } from 'vitest';
import { corregir } from '../chem/practicos/correccion';
import { ajustesPorDefecto } from '../chem/practicos/datos';
import { generarEjemplos } from '../chem/practicos/ejemplos';
import { practica } from '../chem/practicos/practicas';
import { camposFinales, claveCampo, itemsDevolucion, resumenFinal, type Anulacion } from './final';

const aj = ajustesPorDefecto();
const p1 = practica('p1')!;
const ejemplos = generarEjemplos(aj).filter((e) => e.practica === 'p1');
const an = (campo: string, veredicto: boolean, comentario = ''): Anulacion => ({
  id: campo, entrega: 'e', campo, veredicto_auto: null, veredicto_docente: veredicto, comentario, docente: 'd', fecha: '',
});

describe('Veredicto final con anulaciones', () => {
  it('sin anulaciones, el final es el automático', () => {
    const cr = corregir(p1, ejemplos[0], aj);
    const r = resumenFinal(camposFinales(cr, []));
    expect(r.aciertos).toBe(cr.aciertos);
    expect(r.aciertosAuto).toBe(cr.aciertos);
    expect(r.anulados).toBe(0);
  });

  it('el docente cambia ✗ → ✓ y la nota sube; el automático no se toca', () => {
    // ejemplo 2 de P1: usó el Z a 20 °C → tiene errores
    const cr = corregir(p1, ejemplos[1], aj);
    const malos = cr.campos.filter((c) => c.ok === false);
    expect(malos.length).toBeGreaterThan(0);
    const antes = resumenFinal(camposFinales(cr, []));
    const campos = camposFinales(cr, [an(claveCampo(malos[0]), true, 'Acepto el redondeo')]);
    const despues = resumenFinal(campos);
    expect(despues.aciertos).toBe(antes.aciertos + 1);
    expect(despues.aciertosAuto).toBe(antes.aciertosAuto);
    expect(despues.anulados).toBe(1);
    const c = campos.find((x) => x.campo === claveCampo(malos[0]))!;
    expect(c.auto).toBe(false);
    expect(c.final).toBe(true);
    expect(cr.campos.find((x) => claveCampo(x) === c.campo)!.ok).toBe(false);
  });

  it('el docente cambia ✓ → ✗ y la nota baja', () => {
    const cr = corregir(p1, ejemplos[0], aj);
    const bueno = cr.campos.find((c) => c.ok)!;
    const r = resumenFinal(camposFinales(cr, [an(claveCampo(bueno), false)]));
    expect(r.aciertos).toBe(cr.aciertos - 1);
    expect(r.pct).toBeCloseTo((100 * (cr.aciertos - 1)) / cr.total, 1);
  });

  it('la devolución del alumno NO trae el valor correcto ni el diagnóstico', () => {
    const cr = corregir(p1, ejemplos[1], aj);
    const items = itemsDevolucion(camposFinales(cr, [an(claveCampo(cr.campos[0]), true, 'ok')]));
    expect(items).toHaveLength(cr.campos.length);
    expect(items[0].comentario).toBe('ok');
    for (const it of items) {
      expect(Object.keys(it).sort()).toEqual(expect.arrayContaining(['alumno', 'etiqueta', 'ok']));
      expect(it).not.toHaveProperty('correcto');
      expect(it).not.toHaveProperty('diagnosticos');
    }
  });

  it('las claves de los campos son únicas', () => {
    const cr = corregir(p1, ejemplos[0], aj);
    const claves = cr.campos.map(claveCampo);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
