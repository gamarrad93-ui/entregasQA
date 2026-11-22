/**
 * Cédula de identidad uruguaya.
 * Se guarda con 8 dígitos (ceros a la izquierda) y se valida el dígito verificador:
 * se multiplican los 7 primeros dígitos por 2, 9, 8, 7, 6, 3, 4, se suma, y
 * verificador = (10 − suma mod 10) mod 10.
 */
import { DOMINIO_MAIL } from '../config';

const PESOS = [2, 9, 8, 7, 6, 3, 4];

/** "1.234.567-2" → "12345672"; "123.456-7" → "01234567". Deja otros largos como están (inválidos). */
export function normalizarCedula(texto: string): string {
  const d = (texto ?? '').replace(/\D/g, '');
  return d.length === 7 || d.length === 8 ? d.padStart(8, '0') : d;
}

export function digitoVerificador(base7: string): number {
  const s = base7.padStart(7, '0');
  const suma = [...s].reduce((a, c, i) => a + Number(c) * PESOS[i], 0);
  return (10 - (suma % 10)) % 10;
}

export function cedulaValida(texto: string): boolean {
  const c = normalizarCedula(texto);
  if (!/^\d{8}$/.test(c) || /^0+$/.test(c)) return false;
  return digitoVerificador(c.slice(0, 7)) === Number(c[7]);
}

/** Mensaje amigable o null si está bien. */
export function errorCedula(texto: string): string | null {
  const d = (texto ?? '').replace(/\D/g, '');
  if (!d) return 'Escribí tu cédula.';
  if (d.length < 7 || d.length > 8) return 'La cédula tiene 7 u 8 números (con el dígito verificador).';
  if (!cedulaValida(texto)) return 'El dígito verificador no coincide: revisá la cédula.';
  return null;
}

/** "12345672" → "1.234.567-2" */
export function formatearCedula(texto: string): string {
  const c = normalizarCedula(texto);
  if (!/^\d{8}$/.test(c)) return texto;
  const n = String(Number(c.slice(0, 7))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n}-${c[7]}`;
}

/** Mail ficticio que usa Supabase Auth por dentro. El usuario nunca lo ve. */
export function mailDeCedula(texto: string): string {
  return `${normalizarCedula(texto)}@${DOMINIO_MAIL}`;
}
