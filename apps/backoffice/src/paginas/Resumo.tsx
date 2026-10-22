import { dataCurta, type Resumo as DadosDoResumo } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { pedir, refrescar } from '../api';
import { Esqueleto, Etiqueta, Segmentado, useAccao, useConfirmar } from '../pecas';
import { plural } from '../util';

export function Resumo() {
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const { data: r } = useQuery({
    queryKey: ['resumo', dias],
    queryFn: () => pedir<DadosDoResumo>(`/api/bo/resumo?dias=${dias}`),
  });
  const { correr } = useAccao();
  const { confirmar, dialogo } = useConfirmar();

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Resumo</h1>
          <p className="subtitulo">O que está na app e o que os clientes fazem nela.</p>
        </div>
        <Segmentado
          rotulo="Período"
          valor={dias}
          mudar={setDias}
          opcoes={[
            { valor: 7, nome: '7 dias' },
            { valor: 30, nome: '30 dias' },
            { valor: 90, nome: '90 dias' },
          ]}
        />
      </div>

      {!r ? (
        <Esqueleto linhas={5} />
      ) : (
        <>
          <div className="grelha quatro">
            <Numero rotulo="Aberturas da app" valor={r.totais.aberturas} />
            <Numero rotulo="Parceiros vistos" valor={r.totais.parceiros} />
            <Numero
              rotulo="Contactos"
              valor={r.totais.contactos}
              nota="Ir, ligar, Instagram e site"
            />
            <Numero rotulo="Toques em «Marcar»" valor={r.totais.marcacoes} />
          </div>

          <div className="cartao recheado" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Aberturas da app por dia</div>
            <div
              className="ajuda"
              style={{ color: 'var(--tinta-3)', fontSize: 13, marginBottom: 14 }}
            >
              Últimos {dias} dias, até hoje
            </div>
            <Grafico dados={r.aberturas} hoje={r.hoje} />
          </div>

          <div className="grelha duas" style={{ marginTop: 14 }}>
            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Precisa de atenção</div>
              <ul className="lista">
                {r.aAcabar.map((p) => (
                  <li key={`a${p.id}`}>
                    <a className="linha" href={`#/promocoes?abrir=${p.id}`}>
                      <div className="meio">
                        <div className="titulo-linha">
                          {p.destaque} {p.titulo}
                        </div>
                        <div className="detalhe">{p.parceiro}</div>
                      </div>
                      <Etiqueta tom="atencao">Acaba a {dataCurta(p.fim, r.hoje)}</Etiqueta>
                    </a>
                  </li>
                ))}
                {r.semPromocoes.map((p) => (
                  <li key={`s${p.id}`}>
                    <a className="linha" href={`#/parceiros/${p.id}`}>
                      <div className="meio">
                        <div className="titulo-linha">{p.nome}</div>
                        <div className="detalhe">Não aparece na app</div>
                      </div>
                      <Etiqueta tom="mau">Sem promoções</Etiqueta>
                    </a>
                  </li>
                ))}
                {r.parceiros.exemplos > 0 && (
                  <li>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {plural(
                            r.parceiros.exemplos,
                            'parceiro de exemplo',
                            'parceiros de exemplo',
                          )}
                        </div>
                        <div className="detalhe">
                          Inventados para a demonstração. Apaga-os quando puseres os verdadeiros.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="botao perigo pequeno"
                        onClick={async () => {
                          if (
                            await confirmar(
                              'Apagar os exemplos?',
                              'Os parceiros de exemplo e as promoções deles saem da app e do backoffice. Não se desfaz.',
                              'Apagar os exemplos',
                            )
                          )
                            await correr(async () => {
                              await pedir('/api/bo/exemplos/apagar', { metodo: 'POST' });
                              await refrescar();
                            }, 'Exemplos apagados');
                        }}
                      >
                        Apagar
                      </button>
                    </div>
                  </li>
                )}
                {!r.aAcabar.length && !r.semPromocoes.length && !r.parceiros.exemplos && (
                  <li>
                    <div className="linha">
                      <div className="meio detalhe">Nada por agora.</div>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Na app agora</div>
              <ul className="lista">
                <LinhaDeConta href="#/parceiros" nome="Parceiros" valor={r.parceiros.naApp} />
                <LinhaDeConta href="#/promocoes" nome="Promoções" valor={r.promocoes.naApp} />
                <LinhaDeConta
                  href="#/promocoes"
                  nome="Agendadas"
                  valor={r.promocoes.agendadas}
                  detalhe="Entram sozinhas no dia de início"
                />
                <LinhaDeConta href="#/promocoes" nome="Pausadas" valor={r.promocoes.pausadas} />
                <LinhaDeConta
                  href="#/parceiros"
                  nome="Parceiros pausados"
                  valor={r.parceiros.pausados}
                />
              </ul>
            </div>
          </div>

          <div className="grelha duas" style={{ marginTop: 14 }}>
            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Parceiros mais vistos</div>
              {r.maisVistos.length ? (
                <ul className="lista">
                  {r.maisVistos.map((p, i) => (
                    <li key={p.id}>
                      <a className="linha" href={`#/parceiros/${p.id}`}>
                        <span style={{ width: 22, color: 'var(--tinta-3)', fontWeight: 800 }}>
                          {i + 1}
                        </span>
                        <div className="meio">
                          <div className="titulo-linha">{p.nome}</div>
                          <div className="detalhe">
                            {plural(p.contactos, 'contacto', 'contactos')}
                          </div>
                        </div>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {plural(p.vistas, 'vista', 'vistas')}
                        </strong>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detalhe" style={{ padding: '0 20px 18px', color: 'var(--tinta-2)' }}>
                  Ainda sem visitas neste período.
                </p>
              )}
            </div>
            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                Toques em «Marcar», por loja
              </div>
              <ul className="lista">
                {r.marcacoes.map((l) => (
                  <li key={l.id}>
                    <div className="linha">
                      <div className="meio titulo-linha">{l.nome}</div>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {l.n.toLocaleString('pt-PT')}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
      {dialogo}
    </>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div className="cartao numero">
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{valor.toLocaleString('pt-PT')}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  );
}

function LinhaDeConta({
  href,
  nome,
  valor,
  detalhe,
}: {
  href: string;
  nome: string;
  valor: number;
  detalhe?: string;
}) {
  return (
    <li>
      <a className="linha" href={href}>
        <div className="meio">
          <div className="titulo-linha">{nome}</div>
          {detalhe && <div className="detalhe">{detalhe}</div>}
        </div>
        <strong style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
          {valor.toLocaleString('pt-PT')}
        </strong>
      </a>
    </li>
  );
}

/** Um teto «redondo» para o eixo: 1, 2, 5, 10, 20, 50… */
function tetoRedondo(n: number): number {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= n) return m * p;
  return 10 * p;
}

/**
 * As aberturas por dia: colunas finas (até 24 px), topo redondo de 4 px e base
 * direita, 2 px de ar entre colunas. Cada coluna mostra o valor ao passar o
 * rato; com o teclado, as setas andam de dia em dia. A tabela tem tudo.
 */
function Grafico({ dados, hoje }: { dados: { dia: string; n: number }[]; hoje: string }) {
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
  const fatia = util.l / dados.length;
  const grossura = Math.max(2, Math.min(24, fatia - 2));
  const y = (n: number) => margem.topo + util.a - (n / teto) * util.a;
  const marcas = [0, teto / 2, teto];
  const rotulosX = [0, Math.floor((dados.length - 1) / 2), dados.length - 1];
  const sel = activo !== null ? dados[activo] : null;
  const total = dados.reduce((s, d) => s + d.n, 0);

  return (
    <div className="grafico" ref={caixa}>
      <svg
        width={largura}
        height={altura}
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label={`Aberturas da app por dia: ${total} no total. Usa as setas para ver cada dia.`}
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
              <th scope="col">Aberturas</th>
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
