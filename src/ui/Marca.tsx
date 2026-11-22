/** ✓ / ✗ / sin dato */
export default function Marca({ ok, chica }: { ok: boolean | null; chica?: boolean }) {
  const t = chica ? 'px-1.5' : '';
  if (ok == null) return <span className={`chip ${t} bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}>sin dato</span>;
  return ok ? (
    <span className={`chip ${t} bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200`} aria-label="correcto">
      ✓
    </span>
  ) : (
    <span className={`chip ${t} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`} aria-label="incorrecto">
      ✗
    </span>
  );
}
