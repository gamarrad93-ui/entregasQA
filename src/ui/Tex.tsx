/** Renderiza LaTeX con KaTeX (ecuaciones de "Ver procedimiento"). */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: block, throwOnError: false, strict: false });
    } catch {
      return children;
    }
  }, [children, block]);
  return <span className={block ? 'block overflow-x-auto py-1' : ''} dangerouslySetInnerHTML={{ __html: html }} />;
}
