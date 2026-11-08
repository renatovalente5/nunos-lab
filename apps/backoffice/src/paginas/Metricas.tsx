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
import { useLingua } from '../lingua';
import { Esqueleto, Gaveta, Numero, Segmentado, Vazio } from '../pecas';
import { useTextos } from '../textos';
import { euros, haQuanto, mesPorExtenso, numero, percentagem, plural } from '../util';

type Periodo = 7 | 30 | 90 | 365;

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
  const t = useTextos();
  const resto = curta ? '' : ` ${t.metricas.vsAnterior}`;
  if (actual === anterior)
    return <span>{curta ? t.metricas.igual : t.metricas.igualAoAnterior}</span>;
  if (anterior === 0) return <span className="sobe">▲ {t.metricas.antesZero}</span>;
  const p = Math.round(((actual - anterior) / anterior) * 100);
  return (
    <span className={p > 0 ? 'sobe' : 'desce'}>
      {p > 0 ? '▲' : '▼'} {t.metricas.percentagem(numero(Math.abs(p)))}
      {resto}
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
          <strong className="valor">{numero(l.n)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Os números da fidelidade: um período, uma casa ou todas, e o período anterior ao lado. */
export function Metricas() {
  const t = useTextos();
  const lingua = useLingua();
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
  // A hora com mais carimbos, para o resumo do mapa de calor fechado.
  const pico = (m?.mapaDeCalor ?? [])
    .flatMap((horas, d) => horas.map((n, h) => ({ n, d, h })))
    .reduce((a, b) => (b.n > a.n ? b : a), { n: 0, d: 0, h: 0 });

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.metricas}</h1>
          <p className="subtitulo">
            {m
              ? t.metricas.intervalo(dataCurta(m.de, hoje, lingua), dataCurta(m.ate, hoje, lingua))
              : ' '}
          </p>
        </div>
      </div>

      <div className="filtros">
        <Segmentado<Periodo>
          rotulo={t.metricas.periodo}
          valor={periodo}
          mudar={setPeriodo}
          opcoes={[
            { valor: 7, nome: t.metricas.dias(7) },
            { valor: 30, nome: t.metricas.dias(30) },
            { valor: 90, nome: t.metricas.dias(90) },
            { valor: 365, nome: t.metricas.meses(12) },
          ]}
        />
        {lojas.length > 1 && (
          <select
            className="entrada"
            style={{ maxWidth: 280 }}
            aria-label={t.metricas.casa}
            value={lojaId ?? ''}
            onChange={(e) => setLojaId(Number(e.target.value) || null)}
          >
            <option value="">{t.metricas.todasAsCasas}</option>
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
              rotulo={t.metricas.carimbos}
              valor={m.totais.carimbos}
              nota={<Variacao actual={m.totais.carimbos} anterior={m.totais.carimbosAnterior} />}
            />
            <Numero
              rotulo={t.metricas.clientesNovos}
              valor={m.totais.clientesNovos}
              nota={
                <Variacao
                  actual={m.totais.clientesNovos}
                  anterior={m.totais.clientesNovosAnterior}
                />
              }
            />
            <Numero
              rotulo={t.metricas.clientesActivos}
              valor={m.totais.clientesActivos}
              nota={t.metricas.noPeriodo}
            />
            <Numero
              rotulo={t.metricas.recompensasGanhas}
              valor={m.totais.recompensasGanhas}
              nota={t.metricas.recompensasNota(
                plural(
                  m.totais.recompensasUsadas,
                  t.metricas.palavras.usada,
                  t.metricas.palavras.usadas,
                ),
                numero(m.totais.recompensasPorUsar),
              )}
            />
          </div>
          <div className="grelha duas" style={{ marginTop: 14 }}>
            <div className="cartao numero" style={{ gridColumn: '1 / -1' }}>
              <div className="numeros-pequenos">
                <div>
                  <div className="rotulo">{t.metricas.anulados}</div>
                  <div className="valor">{numero(m.totais.anulados)}</div>
                </div>
                <div>
                  <div className="rotulo">{t.metricas.repetidos}</div>
                  <div className="valor">{numero(m.totais.repetidos)}</div>
                </div>
                <div>
                  <div className="rotulo">{t.metricas.semLeitura}</div>
                  <div className="valor">{numero(m.totais.semLeitura)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="gavetas" style={{ marginTop: 28 }}>
            <Gaveta
              id="metricas.movimento"
              titulo={t.metricas.movimento}
              resumo={plural(
                m.totais.carimbos,
                t.metricas.palavras.carimbo,
                t.metricas.palavras.carimbos,
              )}
            >
              {m.totais.carimbos > 0 ? (
                <Grafico
                  dados={m.porDia}
                  hoje={hoje}
                  nome={t.metricas.carimbos}
                  rotulos="semanal"
                />
              ) : (
                <Vazio titulo={t.metricas.semCarimbos} />
              )}
            </Gaveta>

            {m.porLoja.length > 0 && (
              <Gaveta
                id="metricas.porCasa"
                titulo={t.metricas.porCasa}
                resumo={m.porLoja.map((l) => `${l.nome} ${numero(l.n)}`).join(' · ')}
                lista
              >
                {m.porLoja.length ? (
                  <Barras
                    linhas={m.porLoja.map((l) => ({
                      chave: l.id,
                      nome: l.nome,
                      n: l.n,
                      detalhe: (
                        <>
                          {plural(
                            l.clientes,
                            t.metricas.palavras.cliente,
                            t.metricas.palavras.clientes,
                          )}{' '}
                          · <Variacao actual={l.n} anterior={l.anterior} curta />
                        </>
                      ),
                    }))}
                  />
                ) : null}
              </Gaveta>
            )}

            {totalDoMapa > 0 && (
              <Gaveta
                id="metricas.mapaDeCalor"
                titulo={t.metricas.mapaDeCalor}
                resumo={
                  pico.n > 0
                    ? t.metricas.pico(
                        t.metricas.diasDaSemana[pico.d] ?? '',
                        t.metricas.hora(pico.h),
                      )
                    : undefined
                }
              >
                {totalDoMapa > 0 ? (
                  <div className="calor" role="img" aria-label={t.metricas.mapaDeCalorRotulo}>
                    <div />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="hora">
                        {h % 3 === 0 ? t.metricas.hora(h) : ''}
                      </div>
                    ))}
                    {m.mapaDeCalor.map((horas, d) => (
                      <div key={d} style={{ display: 'contents' }}>
                        <div className="dia">{t.metricas.diasDaSemana[d]}</div>
                        {horas.map((n, h) => (
                          <div
                            key={h}
                            className={`celula${n ? '' : ' vazia'}`}
                            style={n ? { opacity: 0.12 + 0.88 * (n / maiorDoMapa) } : undefined}
                            title={t.metricas.celula(
                              t.metricas.diasDaSemana[d] ?? '',
                              h,
                              plural(n, t.metricas.palavras.carimbo, t.metricas.palavras.carimbos),
                            )}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Gaveta>
            )}

            {m.porPessoa.length > 0 && (
              <Gaveta
                id="metricas.equipa"
                titulo={t.geral.seccoes.equipa}
                resumo={m.porPessoa
                  .filter((p) => p.n > 0)
                  .slice(0, 3)
                  .map((p) => `${p.nome} ${numero(p.n)}`)
                  .join(' · ')}
                lista
              >
                {m.porPessoa.length ? (
                  <div className="rola">
                    <table className="quadro">
                      <thead>
                        <tr>
                          <th scope="col">{t.metricas.nome}</th>
                          <th scope="col">{t.metricas.casa}</th>
                          <th scope="col" className="num">
                            {t.metricas.carimbos}
                          </th>
                          <th scope="col" className="num">
                            {t.metricas.anulados}
                          </th>
                          <th scope="col" className="num">
                            {t.metricas.repetidos}
                          </th>
                          <th scope="col" className="num">
                            {t.metricas.semLeitura}
                          </th>
                          <th scope="col" className="num">
                            {t.metricas.recompensas}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.porPessoa.map((p) => (
                          <tr key={p.id}>
                            <td className="forte">{p.nome}</td>
                            <td>{p.loja ?? t.metricas.todasAsCasas}</td>
                            <td className="num forte">{numero(p.n)}</td>
                            <td className="num">{numero(p.anulados)}</td>
                            <td className="num">{numero(p.repetidos)}</td>
                            <td className="num">{numero(p.semLeitura)}</td>
                            <td className="num">{numero(p.recompensas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Gaveta>
            )}

            <Gaveta
              id="metricas.parcerias"
              titulo={t.metricas.parcerias}
              resumo={[
                plural(
                  m.parcerias.validacoes,
                  t.metricas.palavras.validacao,
                  t.metricas.palavras.validacoes,
                ),
                plural(
                  m.parcerias.clientesUnicos,
                  t.metricas.palavras.cliente,
                  t.metricas.palavras.clientes,
                ),
              ].join(' · ')}
            >
              <div className="grelha tres">
                <Numero
                  rotulo={t.metricas.validacoes}
                  valor={m.parcerias.validacoes}
                  nota={
                    <Variacao
                      actual={m.parcerias.validacoes}
                      anterior={m.parcerias.validacoesAnterior}
                    />
                  }
                />
                <Numero
                  rotulo={t.metricas.clientesUnicos}
                  valor={m.parcerias.clientesUnicos}
                  nota={t.metricas.noPeriodo}
                />
                <Numero
                  rotulo={t.metricas.comParcerias}
                  valor={
                    m.clientes.total > 0
                      ? percentagem(m.parcerias.clientesComParcerias / m.clientes.total)
                      : '—'
                  }
                  nota={t.metricas.comParceriasNota(
                    numero(m.parcerias.clientesComParcerias),
                    plural(
                      m.clientes.total,
                      t.metricas.palavras.cliente,
                      t.metricas.palavras.clientes,
                    ),
                  )}
                />
                {m.parcerias.cupoesSaidos > 0 && (
                  <>
                    <Numero
                      rotulo={t.metricas.cupoesSaidos}
                      valor={m.parcerias.cupoesSaidos}
                      nota={t.metricas.noPeriodo}
                    />
                    <Numero
                      rotulo={t.metricas.cupoesUsados}
                      valor={m.parcerias.cupoesUsados}
                      nota={t.metricas.noPeriodo}
                    />
                  </>
                )}
              </div>
              {(porParceiro.length > 0 || temPorCasa) && (
                <div className="grelha duas" style={{ marginTop: 14, alignItems: 'start' }}>
                  {porParceiro.length > 0 && (
                    <div className="cartao">
                      <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                        {t.metricas.porParceiro}
                      </div>
                      {porParceiro.length ? (
                        <Barras
                          linhas={porParceiro.map((p) => ({
                            chave: p.id,
                            nome: p.nome,
                            n: p.n,
                            detalhe: (
                              <>
                                {plural(
                                  p.clientes,
                                  t.metricas.palavras.cliente,
                                  t.metricas.palavras.clientes,
                                )}{' '}
                                · <Variacao actual={p.n} anterior={p.anterior} curta />
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
                          {t.metricas.semValidacoes(
                            m.parcerias.semValidacoes.map((p) => p.nome).join(', '),
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  {temPorCasa && (
                    <div className="cartao">
                      <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                        {t.metricas.pelaCasaDoCliente}
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
                  <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                    {t.metricas.porVantagem}
                  </div>
                  {m.parcerias.porPromocao.length ? (
                    <div className="rola">
                      <table className="quadro">
                        <thead>
                          <tr>
                            <th scope="col">{t.metricas.parceiro}</th>
                            <th scope="col">{t.metricas.vantagem}</th>
                            <th scope="col" className="num">
                              {t.metricas.colunaNoPeriodo}
                            </th>
                            <th scope="col" className="num">
                              {t.metricas.total}
                            </th>
                            <th scope="col" className="num">
                              {t.metricas.limite}
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
                              <td className="num forte">{numero(p.n)}</td>
                              <td className="num">{numero(p.total)}</td>
                              <td className="num">
                                {p.limiteTotal === null
                                  ? '—'
                                  : t.metricas.deTotal(numero(p.total), numero(p.limiteTotal))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </Gaveta>
            <Gaveta
              id="metricas.clientes"
              titulo={t.geral.seccoes.clientes}
              resumo={[
                plural(m.clientes.total, t.metricas.palavras.cliente, t.metricas.palavras.clientes),
                t.metricas.activosEm30(numero(m.clientes.activos30)),
              ].join(' · ')}
            >
              <div className="grelha quatro">
                <Numero
                  rotulo={t.geral.seccoes.clientes}
                  valor={m.clientes.total}
                  nota={t.metricas.emVariasCasas(numero(m.clientes.variasCasas))}
                />
                <Numero
                  rotulo={t.metricas.activos(t.metricas.dias(30))}
                  valor={m.clientes.activos30}
                />
                <Numero
                  rotulo={t.metricas.activos(t.metricas.dias(90))}
                  valor={m.clientes.activos90}
                />
                <Numero
                  rotulo={t.metricas.activos(t.metricas.dias(365))}
                  valor={m.clientes.activos365}
                />
                <Numero
                  rotulo={t.metricas.frequencia}
                  valor={m.clientes.frequencia === null ? '—' : m.clientes.frequencia}
                  nota={
                    m.clientes.frequencia === null
                      ? t.metricas.aindaSemDados
                      : t.metricas.diasEntreVisitas
                  }
                />
                <Numero
                  rotulo={t.metricas.retorno}
                  valor={m.clientes.retorno === null ? '—' : percentagem(m.clientes.retorno)}
                  nota={
                    m.clientes.retorno === null
                      ? t.metricas.aindaSemDados
                      : t.metricas.voltamEm60Dias
                  }
                />
                <Numero rotulo={t.metricas.emRisco} valor={m.clientes.emRisco} />
                <Numero
                  rotulo={t.metricas.perdidos}
                  valor={m.clientes.perdidos}
                  nota={t.metricas.semVirHa180Dias}
                />
              </div>
              {m.clientes.total > 0 && (
                <div className="grelha duas" style={{ marginTop: 14, alignItems: 'start' }}>
                  <div className="cartao">
                    <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                      {t.metricas.distribuicao}
                    </div>
                    {m.clientes.total > 0 ? (
                      <Barras
                        linhas={m.clientes.distribuicao.map((d) => ({
                          chave: d.faixa,
                          nome: t.metricas.cortesNaFaixa(d.faixa),
                          n: d.n,
                        }))}
                      />
                    ) : null}
                  </div>
                  {m.clientes.top.length > 0 && (
                    <div className="cartao">
                      <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                        {t.metricas.top10}
                      </div>
                      {m.clientes.top.length ? (
                        <ul className="lista">
                          {m.clientes.top.map((k, i) => (
                            <li key={k.id}>
                              <a className="linha" href={`#/clientes/${k.id}`}>
                                <span
                                  style={{ width: 22, color: 'var(--tinta-3)', fontWeight: 800 }}
                                >
                                  {i + 1}
                                </span>
                                <div className="meio">
                                  <div className="titulo-linha">{k.nome}</div>
                                  <div className="detalhe">
                                    {t.metricas.ultimo(haQuanto(k.ultimo))}
                                  </div>
                                </div>
                                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {plural(
                                    k.cortes,
                                    t.metricas.palavras.corte,
                                    t.metricas.palavras.cortes,
                                  )}
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
            </Gaveta>

            {coortesComGente && (
              <Gaveta id="metricas.coortes" titulo={t.metricas.coortes} lista>
                {coortesComGente ? (
                  <div className="rola">
                    <table className="quadro coortes">
                      <thead>
                        <tr>
                          <th scope="col">{t.metricas.primeiroCorte}</th>
                          <th scope="col" className="num">
                            {t.geral.seccoes.clientes}
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
                              <td className="num">{numero(k.clientes)}</td>
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
              </Gaveta>
            )}

            <Gaveta
              id="metricas.contas"
              titulo={t.metricas.contas}
              resumo={`Apple ${numero(m.contas.apple)} · Google ${numero(m.contas.google)} · ${t.metricas.email} ${numero(m.contas.email)}`}
            >
              <div className="grelha quatro">
                <Numero rotulo="Apple" valor={m.contas.apple} pequeno />
                <Numero rotulo="Google" valor={m.contas.google} pequeno />
                <Numero rotulo={t.metricas.email} valor={m.contas.email} pequeno />
                <Numero
                  rotulo={t.metricas.soBalcao}
                  valor={m.contas.soBalcao}
                  pequeno
                  nota={t.metricas.semApp}
                />
              </div>
            </Gaveta>
          </div>
        </>
      )}
    </>
  );
}
