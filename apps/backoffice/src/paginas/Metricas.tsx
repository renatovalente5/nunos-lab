import {
  dataCurta,
  diaEmLisboa,
  somarDias,
  type DefinicoesDaBarbearia,
  type Metricas as DadosDasMetricas,
} from '@nunos-lab/dominio';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { pedir } from '../api';
import { Grafico } from '../grafico';
import { Esqueleto, Numero, Segmentado, Vazio } from '../pecas';
import { euros, haQuanto, mesPorExtenso, percentagem, plural } from '../util';

type Periodo = 7 | 30 | 90 | 365;

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** «▲ 12 %» a verde, «▼ 8 %» a vermelho, ou «igual», contra o período anterior. */
function Variacao({
  actual,
  anterior,
  curta,
}: {
  actual: number;
  anterior: number;
  curta?: boolean;
}) {
  const resto = curta ? '' : ' vs. período anterior';
  if (actual === anterior) return <span>igual{curta ? '' : ' ao período anterior'}</span>;
  if (anterior === 0) return <span className="sobe">▲ antes 0</span>;
  const p = Math.round(((actual - anterior) / anterior) * 100);
  return (
    <span className={p > 0 ? 'sobe' : 'desce'}>
      {p > 0 ? '▲' : '▼'} {Math.abs(p)}
      {' '}%{resto}
    </span>
  );
}

/** Barras horizontais: o nome, a barra à escala do maior, o valor. */
function Barras({
  linhas,
}: {
  linhas: { chave: string | number; nome: string; detalhe?: ReactNode; n: number }[];
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <div className="barras">
      {linhas.map((l) => (
        <div key={l.chave} className="fila">
          <div className="meio">
            <div className="titulo-linha">{l.nome}</div>
            {l.detalhe && <div className="detalhe">{l.detalhe}</div>}
          </div>
          <div className="pista" aria-hidden="true">
            <div className="cheio" style={{ width: `${(l.n / maior) * 100}%` }} />
          </div>
          <strong className="valor">{l.n.toLocaleString('pt-PT')}</strong>
        </div>
      ))}
    </div>
  );
}

/** Os números da fidelidade: um período, uma casa ou todas, e o período anterior ao lado. */
export function Metricas() {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const hoje = diaEmLisboa();
  const de = somarDias(hoje, -(periodo - 1));
  const { data: m } = useQuery({
    queryKey: ['metricas', de, hoje, lojaId],
    queryFn: () =>
      pedir<DadosDasMetricas>(
        `/api/bo/metricas?de=${de}&ate=${hoje}${lojaId ? `&lojaId=${lojaId}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const lojas = barbearia.data?.lojas ?? [];

  const totalDoMapa = m ? m.mapaDeCalor.flat().reduce((s, n) => s + n, 0) : 0;
  const maiorDoMapa = m ? Math.max(1, ...m.mapaDeCalor.flat()) : 1;
  const coortesComGente = m ? m.coortes.some((k) => k.clientes > 0) : false;
  const temPorCasa = m ? m.parcerias.porCasa.some((c) => c.n > 0) : false;
  // Só os parceiros com validações agora ou no período anterior; os outros vão na lista «sem validações».
  const porParceiro = m ? m.parcerias.porParceiro.filter((p) => p.n > 0 || p.anterior > 0) : [];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Métricas</h1>
          <p className="subtitulo">
            {m ? `De ${dataCurta(m.de, hoje)} a ${dataCurta(m.ate, hoje)}` : ' '}
          </p>
        </div>
      </div>

      <div className="filtros">
        <Segmentado<Periodo>
          rotulo="Período"
          valor={periodo}
          mudar={setPeriodo}
          opcoes={[
            { valor: 7, nome: '7 dias' },
            { valor: 30, nome: '30 dias' },
            { valor: 90, nome: '90 dias' },
            { valor: 365, nome: '12 meses' },
          ]}
        />
        {lojas.length > 1 && (
          <select
            className="entrada"
            style={{ maxWidth: 280 }}
            aria-label="Casa"
            value={lojaId ?? ''}
            onChange={(e) => setLojaId(Number(e.target.value) || null)}
          >
            <option value="">Todas as casas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {!m ? (
        <Esqueleto linhas={6} />
      ) : (
        <>
          <div className="grelha quatro">
            <Numero
              rotulo="Carimbos"
              valor={m.totais.carimbos}
              nota={<Variacao actual={m.totais.carimbos} anterior={m.totais.carimbosAnterior} />}
            />
            <Numero
              rotulo="Clientes novos"
              valor={m.totais.clientesNovos}
              nota={
                <Variacao
                  actual={m.totais.clientesNovos}
                  anterior={m.totais.clientesNovosAnterior}
                />
              }
            />
            <Numero rotulo="Clientes activos" valor={m.totais.clientesActivos} nota="no período" />
            <Numero
              rotulo="Recompensas ganhas"
              valor={m.totais.recompensasGanhas}
              nota={`${m.totais.recompensasUsadas} usadas · ${m.totais.recompensasPorUsar} por usar`}
            />
          </div>
          <div className="grelha duas" style={{ marginTop: 14 }}>
            <div className="cartao numero" style={{ gridColumn: '1 / -1' }}>
              <div className="numeros-pequenos">
                <div>
                  <div className="rotulo">Anulados</div>
                  <div className="valor">{m.totais.anulados.toLocaleString('pt-PT')}</div>
                </div>
                <div>
                  <div className="rotulo">Repetidos</div>
                  <div className="valor">{m.totais.repetidos.toLocaleString('pt-PT')}</div>
                </div>
                <div>
                  <div className="rotulo">Sem leitura</div>
                  <div className="valor">{m.totais.semLeitura.toLocaleString('pt-PT')}</div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="seccao">Movimento</h2>
          <div className="cartao recheado">
            {m.totais.carimbos > 0 ? (
              <Grafico dados={m.porDia} hoje={hoje} nome="Carimbos" rotulos="semanal" />
            ) : (
              <Vazio titulo="Sem carimbos neste período" />
            )}
          </div>

          {m.porLoja.length > 0 && (
            <>
              <h2 className="seccao">Por casa</h2>
              <div className="cartao">
                {m.porLoja.length ? (
                  <Barras
                    linhas={m.porLoja.map((l) => ({
                      chave: l.id,
                      nome: l.nome,
                      n: l.n,
                      detalhe: (
                        <>
                          {plural(l.clientes, 'cliente', 'clientes')} ·{' '}
                          <Variacao actual={l.n} anterior={l.anterior} curta />
                        </>
                      ),
                    }))}
                  />
                ) : null}
              </div>
            </>
          )}

          {totalDoMapa > 0 && (
            <>
              <h2 className="seccao">Mapa de calor</h2>
              <div className="cartao recheado">
                {totalDoMapa > 0 ? (
                  <div className="calor" role="img" aria-label="Carimbos por dia da semana e hora">
                    <div />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="hora">
                        {h % 3 === 0 ? `${h}h` : ''}
                      </div>
                    ))}
                    {m.mapaDeCalor.map((horas, d) => (
                      <div key={d} style={{ display: 'contents' }}>
                        <div className="dia">{DIAS[d]}</div>
                        {horas.map((n, h) => (
                          <div
                            key={h}
                            className={`celula${n ? '' : ' vazia'}`}
                            style={n ? { opacity: 0.12 + 0.88 * (n / maiorDoMapa) } : undefined}
                            title={`${DIAS[d]} · ${h}h: ${plural(n, 'carimbo', 'carimbos')}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}

          {m.porPessoa.length > 0 && (
            <>
              <h2 className="seccao">Equipa</h2>
              <div className="cartao">
                {m.porPessoa.length ? (
                  <div className="rola">
                    <table className="quadro">
                      <thead>
                        <tr>
                          <th scope="col">Nome</th>
                          <th scope="col">Casa</th>
                          <th scope="col" className="num">
                            Carimbos
                          </th>
                          <th scope="col" className="num">
                            Anulados
                          </th>
                          <th scope="col" className="num">
                            Repetidos
                          </th>
                          <th scope="col" className="num">
                            Sem leitura
                          </th>
                          <th scope="col" className="num">
                            Recompensas
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.porPessoa.map((p) => (
                          <tr key={p.id}>
                            <td className="forte">{p.nome}</td>
                            <td>{p.loja ?? 'Todas as casas'}</td>
                            <td className="num forte">{p.n.toLocaleString('pt-PT')}</td>
                            <td className="num">{p.anulados.toLocaleString('pt-PT')}</td>
                            <td className="num">{p.repetidos.toLocaleString('pt-PT')}</td>
                            <td className="num">{p.semLeitura.toLocaleString('pt-PT')}</td>
                            <td className="num">{p.recompensas.toLocaleString('pt-PT')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </>
          )}

          <h2 className="seccao">Parcerias</h2>
          <div className="grelha tres">
            <Numero
              rotulo="Validações"
              valor={m.parcerias.validacoes}
              nota={
                <Variacao
                  actual={m.parcerias.validacoes}
                  anterior={m.parcerias.validacoesAnterior}
                />
              }
            />
            <Numero rotulo="Clientes únicos" valor={m.parcerias.clientesUnicos} nota="no período" />
            <Numero
              rotulo="Com parcerias"
              valor={
                m.clientes.total > 0
                  ? percentagem(m.parcerias.clientesComParcerias / m.clientes.total)
                  : '—'
              }
              nota={`${m.parcerias.clientesComParcerias.toLocaleString('pt-PT')} de ${m.clientes.total.toLocaleString('pt-PT')} clientes, desde sempre`}
            />
            {m.parcerias.cupoesSaidos > 0 && (
              <>
                <Numero rotulo="Cupões saídos" valor={m.parcerias.cupoesSaidos} nota="no período" />
                <Numero rotulo="Cupões usados" valor={m.parcerias.cupoesUsados} nota="no período" />
              </>
            )}
          </div>
          {(porParceiro.length > 0 || temPorCasa) && (
            <div className="grelha duas" style={{ marginTop: 14, alignItems: 'start' }}>
              {porParceiro.length > 0 && (
                <div className="cartao">
                  <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Por parceiro</div>
                  {porParceiro.length ? (
                    <Barras
                      linhas={porParceiro.map((p) => ({
                        chave: p.id,
                        nome: p.nome,
                        n: p.n,
                        detalhe: (
                          <>
                            {plural(p.clientes, 'cliente', 'clientes')} ·{' '}
                            <Variacao actual={p.n} anterior={p.anterior} curta />
                          </>
                        ),
                      }))}
                    />
                  ) : null}
                  {m.parcerias.semValidacoes.length > 0 && (
                    <p
                      className="detalhe"
                      style={{
                        margin: 0,
                        padding: '4px 20px 18px',
                        color: 'var(--tinta-3)',
                        fontSize: 13.5,
                      }}
                    >
                      Sem validações: {m.parcerias.semValidacoes.map((p) => p.nome).join(', ')}.
                    </p>
                  )}
                </div>
              )}
              {temPorCasa && (
                <div className="cartao">
                  <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                    Pela casa do cliente
                  </div>
                  {m.parcerias.porCasa.some((c) => c.n > 0) ? (
                    <Barras
                      linhas={m.parcerias.porCasa.map((c) => ({
                        chave: c.id,
                        nome: c.nome,
                        n: c.n,
                      }))}
                    />
                  ) : null}
                </div>
              )}
            </div>
          )}
          {m.parcerias.porPromocao.length > 0 && (
            <div className="cartao" style={{ marginTop: 14 }}>
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Por vantagem</div>
              {m.parcerias.porPromocao.length ? (
                <div className="rola">
                  <table className="quadro">
                    <thead>
                      <tr>
                        <th scope="col">Parceiro</th>
                        <th scope="col">Vantagem</th>
                        <th scope="col" className="num">
                          No período
                        </th>
                        <th scope="col" className="num">
                          Total
                        </th>
                        <th scope="col" className="num">
                          Limite
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.parcerias.porPromocao.map((p) => (
                        <tr key={p.id}>
                          <td className="forte">{p.parceiro}</td>
                          <td>
                            <span className="forte">{p.destaque}</span> {p.titulo}
                          </td>
                          <td className="num forte">{p.n.toLocaleString('pt-PT')}</td>
                          <td className="num">{p.total.toLocaleString('pt-PT')}</td>
                          <td className="num">
                            {p.limiteTotal === null
                              ? '—'
                              : `${p.total.toLocaleString('pt-PT')} de ${p.limiteTotal.toLocaleString('pt-PT')}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          <h2 className="seccao">Clientes</h2>
          <div className="grelha quatro">
            <Numero
              rotulo="Clientes"
              valor={m.clientes.total}
              nota={`${m.clientes.variasCasas.toLocaleString('pt-PT')} em várias casas`}
            />
            <Numero rotulo="Activos · 30 dias" valor={m.clientes.activos30} />
            <Numero rotulo="Activos · 90 dias" valor={m.clientes.activos90} />
            <Numero rotulo="Activos · 365 dias" valor={m.clientes.activos365} />
            <Numero
              rotulo="Frequência"
              valor={m.clientes.frequencia === null ? '—' : m.clientes.frequencia}
              nota={m.clientes.frequencia === null ? 'ainda sem dados' : 'dias entre visitas'}
            />
            <Numero
              rotulo="Retorno"
              valor={m.clientes.retorno === null ? '—' : percentagem(m.clientes.retorno)}
              nota={m.clientes.retorno === null ? 'ainda sem dados' : 'voltam em 60 dias'}
            />
            <Numero rotulo="Em risco" valor={m.clientes.emRisco} />
            <Numero rotulo="Perdidos" valor={m.clientes.perdidos} nota="sem vir há 180 dias" />
          </div>
          {m.clientes.total > 0 && (
            <div className="grelha duas" style={{ marginTop: 14, alignItems: 'start' }}>
              <div className="cartao">
                <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Distribuição</div>
                {m.clientes.total > 0 ? (
                  <Barras
                    linhas={m.clientes.distribuicao.map((d) => ({
                      chave: d.faixa,
                      nome: `${d.faixa} ${d.faixa === '1' ? 'corte' : 'cortes'}`,
                      n: d.n,
                    }))}
                  />
                ) : null}
              </div>
              {m.clientes.top.length > 0 && (
                <div className="cartao">
                  <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>Top 10</div>
                  {m.clientes.top.length ? (
                    <ul className="lista">
                      {m.clientes.top.map((k, i) => (
                        <li key={k.id}>
                          <a className="linha" href={`#/clientes/${k.id}`}>
                            <span style={{ width: 22, color: 'var(--tinta-3)', fontWeight: 800 }}>
                              {i + 1}
                            </span>
                            <div className="meio">
                              <div className="titulo-linha">{k.nome}</div>
                              <div className="detalhe">Último {haQuanto(k.ultimo)}</div>
                            </div>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {plural(k.cortes, 'corte', 'cortes')}
                            </strong>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {coortesComGente && (
            <>
              <h2 className="seccao">Coortes</h2>
              <div className="cartao">
                {coortesComGente ? (
                  <div className="rola">
                    <table className="quadro coortes">
                      <thead>
                        <tr>
                          <th scope="col">1.º corte</th>
                          <th scope="col" className="num">
                            Clientes
                          </th>
                          {[1, 2, 3, 4, 5, 6].map((k) => (
                            <th key={k} scope="col" className="num">
                              +{k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.coortes
                          .filter((k) => k.clientes > 0)
                          .map((k) => (
                            <tr key={k.mes}>
                              <td className="forte">{mesPorExtenso(k.mes)}</td>
                              <td className="num">{k.clientes.toLocaleString('pt-PT')}</td>
                              {[0, 1, 2, 3, 4, 5].map((i) => {
                                const v = k.voltaram[i];
                                const p = k.clientes > 0 && v !== undefined ? v / k.clientes : null;
                                return (
                                  <td
                                    key={i}
                                    className="num"
                                    style={
                                      p !== null
                                        ? { background: `rgba(20, 20, 20, ${0.03 + p * 0.17})` }
                                        : undefined
                                    }
                                  >
                                    {p !== null ? percentagem(p) : ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </>
          )}

          <h2 className="seccao">Contas</h2>
          <div className="grelha quatro">
            <Numero rotulo="Apple" valor={m.contas.apple} pequeno />
            <Numero rotulo="Google" valor={m.contas.google} pequeno />
            <Numero rotulo="Email" valor={m.contas.email} pequeno />
            <Numero rotulo="Só balcão" valor={m.contas.soBalcao} pequeno nota="sem app" />
          </div>
        </>
      )}
    </>
  );
}
