export default function Proximamente({ titulo, etapa, children }: { titulo: string; etapa: number; children?: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="card-title">{titulo}</h2>
      <p className="text-slate-600 dark:text-slate-400">
        Esta sección llega en la <strong>etapa {etapa}</strong>.
      </p>
      {children}
    </div>
  );
}
