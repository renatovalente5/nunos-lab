import { dataCurta, type Resumo as DadosDoResumo } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { pedir, refrescar } from '../api';
import { Grafico } from '../grafico';
import { Esqueleto, Etiqueta, Numero, Segmentado, useAccao, useConfirmar } from '../pecas';
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
            <Grafico dados={r.aberturas} hoje={r.hoje} nome="Aberturas da app" />
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
