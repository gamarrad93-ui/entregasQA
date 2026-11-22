import { describe, expect, it } from 'vitest';
import { cedulaValida, digitoVerificador, errorCedula, formatearCedula, mailDeCedula, normalizarCedula } from './cedula';

describe('Cédula uruguaya', () => {
  it('calcula el dígito verificador', () => {
    // 1.234.567: 1·2+2·9+3·8+4·7+5·6+6·3+7·4 = 148 → (10 − 8) mod 10 = 2
    expect(digitoVerificador('1234567')).toBe(2);
    // 4.444.444: 4·39 = 156 → 4
    expect(digitoVerificador('4444444')).toBe(4);
    // suma múltiplo de 10 → 0  (1.000.004: 2 + 16 = 18 → 2; 5.000.000: 10 → 0)
    expect(digitoVerificador('5000000')).toBe(0);
  });

  it('acepta puntos, guiones y espacios; rechaza un verificador equivocado', () => {
    expect(cedulaValida('1.234.567-2')).toBe(true);
    expect(cedulaValida('1234567 2')).toBe(true);
    expect(cedulaValida('1.234.567-3')).toBe(false);
    expect(cedulaValida('123')).toBe(false);
    expect(cedulaValida('00000000')).toBe(false);
  });

  it('cédulas viejas de 6 + 1 dígitos se completan con un cero', () => {
    expect(normalizarCedula('123.456-?'.replace('?', String(digitoVerificador('0123456'))))).toBe('0123456' + digitoVerificador('0123456'));
    expect(cedulaValida('0123456' + digitoVerificador('0123456'))).toBe(true);
  });

  it('formatea y arma el mail ficticio', () => {
    expect(formatearCedula('12345672')).toBe('1.234.567-2');
    expect(mailDeCedula('1.234.567-2')).toBe('12345672@entregas.local');
  });

  it('mensajes de error en castellano', () => {
    expect(errorCedula('')).toMatch(/Escribí/);
    expect(errorCedula('12')).toMatch(/7 u 8/);
    expect(errorCedula('12345673')).toMatch(/verificador/);
    expect(errorCedula('12345672')).toBeNull();
  });
});
