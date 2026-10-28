import { dataCurta } from '@nunos-lab/dominio';
import { useEffect, useRef, useState } from 'react';

/** Um teto «redondo» para o eixo: 1, 2, 5, 10, 20, 50… */
function tetoRedondo(n: number): number {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= n) return m * p;
  return 10 * p;
}

/**
 * Uma contagem por dia: colunas finas (até 24 px), topo redondo de 4 px e base
 * direita, 2 px de ar entre colunas. Cada coluna mostra o valor ao passar o
 * rato; com o teclado, as setas andam de dia em dia. A tabela tem tudo.
 *
 * Os rótulos do eixo: «pontas» (início, meio e fim) ou «semanal» (de 7 em 7
 * dias a contar do fim, menos vezes quando não cabem).
 */
export function Grafico({
  dados,
  hoje,
  nome,
  rotulos = 'pontas',
}: {
  dados: { dia: string; n: number }[];
  hoje: string;
  /** O que se conta: «Aberturas da app», «Carimbos». */
  nome: string;
  rotulos?: 'pontas' | 'semanal';
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [activo, setActivo] = useState<number | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setLargura(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const altura = 220;
  const margem = { esquerda: 34, direita: 4, topo: 8, baixo: 26 };
  const util = {
    l: largura - margem.esquerda - margem.direita,
    a: altura - margem.topo - margem.baixo,
  };
  const teto = tetoRedondo(Math.max(0, ...dados.map((d) => d.n)));
  const fatia = util.l / Math.max(1, dados.length);
  // Com muitos dias (um ano), as colunas ficam com 1 px e sem ar: lê-se como uma área.
  const grossura = Math.max(1, Math.min(24, fatia - 2));
  const y = (n: number) => margem.topo + util.a - (n / teto) * util.a;
  const marcas = [0, teto / 2, teto];
  let rotulosX: number[];
  if (rotulos === 'semanal') {
    const base = dados.length <= 7 ? 1 : 7;
    const cabem = Math.max(2, Math.floor(util.l / 80));
    const passo = base * Math.max(1, Math.ceil(dados.length / base / cabem));
    // Do fim para trás; o primeiro dia só entra se não ficar colado ao rótulo seguinte.
    const minimo = passo === 1 ? 0 : passo / 2;
    rotulosX = [];
    for (let i = dados.length - 1; i >= minimo; i -= passo) rotulosX.unshift(i);
  } else rotulosX = [0, Math.floor((dados.length - 1) / 2), dados.length - 1];
  const sel = activo !== null ? dados[activo] : null;
  const total = dados.reduce((s, d) => s + d.n, 0);

  return (
    <div className="grafico" ref={caixa}>
      <svg
        width={largura}
        height={altura}
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label={`${nome} por dia: ${total} no total. Usa as setas para ver cada dia.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setActivo((a) => Math.min(dados.length - 1, (a ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setActivo((a) => Math.max(0, (a ?? dados.length) - 1));
          else return;
          e.preventDefault();
        }}
        onBlur={() => setActivo(null)}
        onPointerLeave={() => setActivo(null)}
      >
        {marcas.map((m) => (
          <g key={m}>
            <line
              className="grade"
              x1={margem.esquerda}
              x2={largura - margem.direita}
              y1={Math.round(y(m)) + 0.5}
              y2={Math.round(y(m)) + 0.5}
            />
            <text className="marca-eixo" x={margem.esquerda - 8} y={y(m) + 4} textAnchor="end">
              {m.toLocaleString('pt-PT')}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = margem.esquerda + i * fatia + (fatia - grossura) / 2;
          const h = (d.n / teto) * util.a;
          const r = Math.min(4, h, grossura / 2);
          const base = margem.topo + util.a;
          const caminho =
            h > 0
              ? `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + grossura - r} Q${x + grossura},${base - h} ${x + grossura},${base - h + r} V${base} Z`
              : '';
          return (
            <g key={d.dia}>
              <rect
                className="barra-alvo"
                x={margem.esquerda + i * fatia}
                y={margem.topo}
                width={fatia}
                height={util.a}
                onPointerEnter={() => setActivo(i)}
              />
              {caminho && (
                <path
                  className="barra"
                  d={caminho}
                  style={activo === i ? { fill: '#5e5a53' } : undefined}
                />
              )}
            </g>
          );
        })}
        {rotulosX.map((i) =>
          dados[i] ? (
            <text
              key={i}
              className="marca-eixo"
              x={margem.esquerda + i * fatia + fatia / 2}
              y={altura - 6}
              textAnchor={i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'}
            >
              {dataCurta(dados[i].dia, hoje)}
            </text>
          ) : null,
        )}
      </svg>
      {sel && activo !== null && (
        <div
          className="dica"
          style={{ left: margem.esquerda + activo * fatia + fatia / 2, top: y(sel.n) }}
          role="status"
        >
          <strong>{sel.n.toLocaleString('pt-PT')}</strong>
          {sel.dia === hoje ? 'hoje' : dataCurta(sel.dia, hoje)}
        </div>
      )}
      <details className="tabela">
        <summary>Ver em tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">{nome}</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.dia}>
                <td>{dataCurta(d.dia, hoje)}</td>
                <td>{d.n.toLocaleString('pt-PT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
