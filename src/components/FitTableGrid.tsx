import React, { useLayoutEffect, useRef, useState } from 'react';

interface FitTableGridProps {
  tables: number[];
  gap?: number;
  maxCell?: number;
  /** cell = lado (px) do quadrado da mesa; compact = célula pequena (esconde textos secundários). */
  renderCell: (tableNum: number, cell: number, compact: boolean) => React.ReactNode;
  className?: string;
}

/**
 * V9 ULTRA PLUS — grade de mesas que SEMPRE cabe na tela.
 * Mede o espaço disponível e escolhe colunas/linhas e o tamanho da célula para
 * mostrar TODAS as mesas centralizadas, sem corte e SEM rolagem (nem vertical,
 * nem horizontal). Recalcula ao girar o aparelho, redimensionar a janela ou
 * mudar o filtro/quantidade de mesas.
 */
export const FitTableGrid: React.FC<FitTableGridProps> = ({ tables, gap = 10, maxCell = 150, renderCell, className = '' }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const count = tables.length;
  let cols = 1;
  let cell = 0;
  if (count > 0 && size.w > 0 && size.h > 0) {
    let best = -1;
    for (let c = 1; c <= count; c += 1) {
      const r = Math.ceil(count / c);
      const cw = (size.w - gap * (c - 1)) / c;
      const ch = (size.h - gap * (r - 1)) / r;
      const fit = Math.min(cw, ch);
      if (fit > best) {
        best = fit;
        cols = c;
      }
    }
    cell = Math.max(28, Math.min(maxCell, Math.floor(best)));
  }
  const rows = Math.max(1, Math.ceil(count / cols));
  const compact = cell < 84;

  return (
    <div ref={boxRef} className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden ${className}`}>
      {cell > 0 && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
            gridTemplateRows: `repeat(${rows}, ${cell}px)`,
            gap,
            justifyContent: 'center',
            alignContent: 'center',
          }}
        >
          {tables.map((n) => (
            <React.Fragment key={n}>{renderCell(n, cell, compact)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
