import { LIMITES, type PessoaComAcesso } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { guardarSessao, pedir, refrescar } from '../api';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { haQuanto } from '../util';

/** A ligação monta-se com a morada deste backoffice, onde quer que ele esteja publicado. */
function ligacaoDe(codigo: string): string {
  return `${location.origin}${location.pathname}#acesso=${codigo}`;
}

export function Acessos() {
  const { data } = useQuery({
    queryKey: ['acessos'],
    queryFn: () => pedir<PessoaComAcesso[]>('/api/bo/acessos'),
  });
  const [ligacao, setLigacao] = useState<{ para: string; url: string; ate: number } | null>(null);
  const [novaPessoa, setNovaPessoa] = useState<string | null>(null);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

  const criar = (corpo: { adminId: number } | { nome: string }, para: string) =>
    correr(async () => {
      const r = await pedir<{ codigo: string; expiraEm: number }>('/api/bo/acessos', {
        metodo: 'POST',
        corpo,
      });
      await refrescar();
      setNovaPessoa(null);
      setLigacao({ para, url: ligacaoDe(r.codigo), ate: r.expiraEm });
    });

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Acessos</h1>
          <p className="subtitulo">Quem entra no backoffice, e em que aparelhos.</p>
        </div>
        <button type="button" className="botao" onClick={() => setNovaPessoa('')}>
          <Icone nome="mais" tamanho={18} /> Dar acesso a alguém
        </button>
      </div>

      {!data ? (
        <Esqueleto />
      ) : (
        <div className="formulario">
          {data.map((p) => (
            <div key={p.id} className="cartao">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '18px 20px 8px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong style={{ fontSize: 17 }}>{p.nome}</strong>{' '}
                  {p.eu && <Etiqueta semPonto>Tu</Etiqueta>}
                </div>
                <div className="botoes">
                  <button
                    type="button"
                    className="botao secundario pequeno"
                    disabled={aCorrer}
                    onClick={() => criar({ adminId: p.id }, p.nome)}
                  >
                    Ligar outro aparelho
                  </button>
                  {!p.eu && (
                    <button
                      type="button"
                      className="botao perigo pequeno"
                      onClick={async () => {
                        if (
                          await confirmar(
                            `Tirar o acesso a ${p.nome}?`,
                            'Sai já de todos os aparelhos, e as ligações por usar deixam de entrar.',
                            'Tirar o acesso',
                          )
                        )
                          await correr(async () => {
                            await pedir(`/api/bo/pessoas/${p.id}`, { metodo: 'DELETE' });
                            await refrescar();
                          }, 'Acesso tirado');
                      }}
                    >
                      Tirar o acesso
                    </button>
                  )}
                </div>
              </div>
              <ul className="lista">
                {p.sessoes.map((s) => (
                  <li key={s.id}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {s.aparelho || 'Aparelho'}{' '}
                          {s.actual && <Etiqueta tom="bom">Este aparelho</Etiqueta>}
                        </div>
                        <div className="detalhe">
                          Entrou {haQuanto(s.criadaEm)} · usado {haQuanto(s.vistaEm)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="botao secundario pequeno"
                        onClick={async () => {
                          const texto = s.actual
                            ? 'Sais do backoffice neste aparelho.'
                            : `${p.nome} sai do backoffice nesse aparelho.`;
                          if (
                            await confirmar(
                              s.actual ? 'Sair deste aparelho?' : 'Terminar a sessão?',
                              texto,
                              s.actual ? 'Sair' : 'Terminar',
                            )
                          )
                            await correr(async () => {
                              await pedir(`/api/bo/sessoes/${s.id}`, { metodo: 'DELETE' });
                              if (s.actual) guardarSessao(null);
                              else await refrescar();
                            });
                        }}
                      >
                        {s.actual ? 'Sair' : 'Terminar'}
                      </button>
                    </div>
                  </li>
                ))}
                {p.ligacoes.map((l) => (
                  <li key={`l${l.id}`}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">Ligação por usar</div>
                        <div className="detalhe">
                          Vale até{' '}
                          {new Date(l.expiraEm * 1000).toLocaleDateString('pt-PT', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="botao secundario pequeno"
                        onClick={() =>
                          correr(async () => {
                            await pedir(`/api/bo/acessos/${l.id}`, { metodo: 'DELETE' });
                            await refrescar();
                          }, 'Ligação cancelada')
                        }
                      >
                        Cancelar
                      </button>
                    </div>
                  </li>
                ))}
                {!p.sessoes.length && !p.ligacoes.length && (
                  <li>
                    <div className="linha detalhe">Sem aparelhos.</div>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Folha
        aberta={novaPessoa !== null}
        fechar={() => setNovaPessoa(null)}
        titulo="Dar acesso a alguém"
        pe={
          <button
            type="button"
            className="botao"
            disabled={!novaPessoa?.trim() || aCorrer}
            onClick={() => novaPessoa && criar({ nome: novaPessoa.trim() }, novaPessoa.trim())}
          >
            Criar a ligação
          </button>
        }
      >
        <Campo
          rotulo="Nome"
          valor={novaPessoa ?? ''}
          mudar={setNovaPessoa}
          max={LIMITES.pessoa}
          placeholder="Nuno"
          autoFocus
        />
      </Folha>

      <Folha
        aberta={!!ligacao}
        fechar={() => setLigacao(null)}
        titulo={`A ligação para ${ligacao?.para ?? ''}`}
        pe={
          <>
            <button
              type="button"
              className="botao"
              onClick={async () => {
                if (!ligacao) return;
                try {
                  await navigator.clipboard.writeText(ligacao.url);
                  avisar('Copiada');
                } catch {
                  avisar('Não deu para copiar: selecciona e copia à mão.', true);
                }
              }}
            >
              <Icone nome="copiar" tamanho={17} /> Copiar
            </button>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                className="botao secundario"
                onClick={() =>
                  ligacao &&
                  navigator
                    .share({ title: "Backoffice do Nuno's Lab", url: ligacao.url })
                    .catch(() => {})
                }
              >
                <Icone nome="partilhar" tamanho={17} /> Partilhar
              </button>
            )}
          </>
        }
      >
        {ligacao && (
          <div className="formulario">
            <input
              className="entrada"
              readOnly
              value={ligacao.url}
              onFocus={(e) => e.target.select()}
              aria-label="Ligação de acesso"
            />
            <div className="caixa-aviso">
              Entra uma vez, num aparelho, até{' '}
              {new Date(ligacao.ate * 1000).toLocaleDateString('pt-PT', {
                day: 'numeric',
                month: 'long',
              })}
              . Manda-a só a {ligacao.para}: quem a abrir entra no backoffice.
            </div>
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
