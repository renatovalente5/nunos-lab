import { dataCurta, type Resumo as DadosDoResumo } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { pedir, refrescar } from '../api';
import { Grafico } from '../grafico';
import { useLingua } from '../lingua';
import { Esqueleto, Etiqueta, Numero, Segmentado, useAccao, useConfirmar } from '../pecas';
import { useTextos } from '../textos';
import { numero } from '../util';

export function Resumo() {
  const t = useTextos();
  const lingua = useLingua();
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const { data: r } = useQuery({
    queryKey: ['resumo', dias],
    queryFn: () => pedir<DadosDoResumo>(`/api/bo/resumo?dias=${dias}`),
  });
  const { correr } = useAccao();
  const { confirmar, dialogo } = useConfirmar();
  // Tudo a zero (ainda sem parceiros nem promoções): o cartão «Na app agora» não diz nada.
  const algoNaApp =
    !!r &&
    r.parceiros.naApp +
      r.promocoes.naApp +
      r.promocoes.agendadas +
      r.promocoes.pausadas +
      r.parceiros.pausados >
      0;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.resumo}</h1>
          <p className="subtitulo">{t.resumo.subtitulo}</p>
        </div>
        <Segmentado
          rotulo={t.resumo.periodo}
          valor={dias}
          mudar={setDias}
          opcoes={[
            { valor: 7, nome: t.resumo.dias(7) },
            { valor: 30, nome: t.resumo.dias(30) },
            { valor: 90, nome: t.resumo.dias(90) },
          ]}
        />
      </div>

      {!r ? (
        <Esqueleto linhas={5} />
      ) : (
        <>
          <div className="grelha quatro">
            <Numero rotulo={t.resumo.aberturasDaApp} valor={r.totais.aberturas} />
            <Numero rotulo={t.resumo.parceirosVistos} valor={r.totais.parceiros} />
            <Numero
              rotulo={t.resumo.contactos}
              valor={r.totais.contactos}
              nota={t.resumo.notaDosContactos}
            />
            <Numero rotulo={t.resumo.toquesEmMarcar} valor={r.totais.marcacoes} />
          </div>

          <div className="cartao recheado" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.resumo.aberturasPorDia}</div>
            <div
              className="ajuda"
              style={{ color: 'var(--tinta-3)', fontSize: 13, marginBottom: 14 }}
            >
              {t.resumo.ultimosDias(dias)}
            </div>
            <Grafico dados={r.aberturas} hoje={r.hoje} nome={t.resumo.aberturasDaApp} />
          </div>

          <div className="grelha duas" style={{ marginTop: 14 }}>
            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                {t.resumo.precisaDeAtencao}
              </div>
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
                      <Etiqueta tom="atencao">
                        {t.resumo.acabaA(dataCurta(p.fim, r.hoje, lingua))}
                      </Etiqueta>
                    </a>
                  </li>
                ))}
                {r.semPromocoes.map((p) => (
                  <li key={`s${p.id}`}>
                    <a className="linha" href={`#/parceiros/${p.id}`}>
                      <div className="meio">
                        <div className="titulo-linha">{p.nome}</div>
                        <div className="detalhe">{t.resumo.naoApareceNaApp}</div>
                      </div>
                      <Etiqueta tom="mau">{t.resumo.semPromocoes}</Etiqueta>
                    </a>
                  </li>
                ))}
                {r.parceiros.exemplos > 0 && (
                  <li>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {t.resumo.parceirosDeExemplo(r.parceiros.exemplos)}
                        </div>
                        <div className="detalhe">{t.resumo.inventados}</div>
                      </div>
                      <button
                        type="button"
                        className="botao perigo pequeno"
                        onClick={async () => {
                          if (
                            await confirmar(
                              t.resumo.apagarOsExemplos.pergunta,
                              t.resumo.apagarOsExemplos.texto,
                              t.resumo.apagarOsExemplos.accao,
                            )
                          )
                            await correr(async () => {
                              await pedir('/api/bo/exemplos/apagar', { metodo: 'POST' });
                              await refrescar();
                            }, t.resumo.apagarOsExemplos.feito);
                        }}
                      >
                        {t.resumo.apagar}
                      </button>
                    </div>
                  </li>
                )}
                {!r.aAcabar.length && !r.semPromocoes.length && !r.parceiros.exemplos && (
                  <li>
                    <div className="linha">
                      <div className="meio detalhe">{t.resumo.nadaPorAgora}</div>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {algoNaApp && (
              <div className="cartao">
                <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                  {t.resumo.naAppAgora}
                </div>
                <ul className="lista">
                  <LinhaDeConta
                    href="#/parceiros"
                    nome={t.geral.seccoes.parceiros}
                    valor={r.parceiros.naApp}
                  />
                  <LinhaDeConta
                    href="#/promocoes"
                    nome={t.geral.seccoes.promocoes}
                    valor={r.promocoes.naApp}
                  />
                  <LinhaDeConta
                    href="#/promocoes"
                    nome={t.resumo.agendadas}
                    valor={r.promocoes.agendadas}
                    detalhe={t.resumo.entramSozinhas}
                  />
                  <LinhaDeConta
                    href="#/promocoes"
                    nome={t.resumo.pausadas}
                    valor={r.promocoes.pausadas}
                  />
                  <LinhaDeConta
                    href="#/parceiros"
                    nome={t.resumo.parceirosPausados}
                    valor={r.parceiros.pausados}
                  />
                </ul>
              </div>
            )}

            {r.maisVistos.length > 0 && (
              <div className="cartao">
                <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                  {t.resumo.maisVistos}
                </div>
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
                            <div className="detalhe">{t.resumo.contactosDe(p.contactos)}</div>
                          </div>
                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {t.resumo.vistas(p.vistas)}
                          </strong>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <div className="cartao">
              <div style={{ padding: '18px 20px 6px', fontWeight: 800 }}>
                {t.resumo.toquesPorLoja}
              </div>
              <ul className="lista">
                {r.marcacoes.map((l) => (
                  <li key={l.id}>
                    <div className="linha">
                      <div className="meio titulo-linha">{l.nome}</div>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{numero(l.n)}</strong>
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
          {numero(valor)}
        </strong>
      </a>
    </li>
  );
}
