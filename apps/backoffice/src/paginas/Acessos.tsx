import {
  LIMITES,
  dataCurta,
  diaEmLisboa,
  normalizarEmail,
  type PessoaComAcesso,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroDaApi, guardarSessao, mensagemDe, pedir, refrescar } from '../api';
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

/**
 * Quem entra no backoffice. Cada pessoa entra com a conta Google do email que
 * aqui está; a ligação de acesso fica para quem não tiver conta Google.
 */
export function Acessos() {
  const { data } = useQuery({
    queryKey: ['acessos'],
    queryFn: () => pedir<PessoaComAcesso[]>('/api/bo/acessos'),
  });
  const [ligacao, setLigacao] = useState<{ para: string; url: string; ate: number } | null>(null);
  const [nova, setNova] = useState<{ nome: string; email: string } | null>(null);
  const [mudarEmail, setMudarEmail] = useState<{
    id: number;
    nome: string;
    email: string;
    eu: boolean;
  } | null>(null);
  const [erroDoEmail, setErroDoEmail] = useState(false);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

  const criarLigacao = (adminId: number, para: string) =>
    correr(async () => {
      const r = await pedir<{ codigo: string; expiraEm: number }>('/api/bo/acessos', {
        metodo: 'POST',
        corpo: { adminId },
      });
      await refrescar();
      setLigacao({ para, url: ligacaoDe(r.codigo), ate: r.expiraEm });
    });

  const darAcesso = async () => {
    if (!nova) return;
    const email = normalizarEmail(nova.email);
    if (!nova.nome.trim() || !email) {
      setErroDoEmail(!email);
      return;
    }
    try {
      await pedir('/api/bo/pessoas', { metodo: 'POST', corpo: { nome: nova.nome.trim(), email } });
      await refrescar();
      avisar(`${nova.nome.trim()} já pode entrar com o Google`);
      setNova(null);
    } catch (e) {
      avisar(
        e instanceof ErroDaApi && e.codigo === 'repetido'
          ? 'Esse email já tem acesso.'
          : mensagemDe(e),
        true,
      );
    }
  };

  const guardarEmail = async () => {
    if (!mudarEmail) return;
    const email = mudarEmail.email.trim() ? normalizarEmail(mudarEmail.email) : null;
    if (mudarEmail.email.trim() && !email) {
      setErroDoEmail(true);
      return;
    }
    try {
      await pedir(`/api/bo/pessoas/${mudarEmail.id}`, { metodo: 'PATCH', corpo: { email } });
      await refrescar();
      avisar('Email guardado');
      setMudarEmail(null);
    } catch (e) {
      avisar(
        e instanceof ErroDaApi && e.codigo === 'repetido'
          ? 'Esse email já é de outra pessoa.'
          : mensagemDe(e),
        true,
      );
    }
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Acessos</h1>
          <p className="subtitulo">Quem entra no backoffice, e em que aparelhos.</p>
        </div>
        <button
          type="button"
          className="botao"
          onClick={() => {
            setErroDoEmail(false);
            setNova({ nome: '', email: '' });
          }}
        >
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
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '18px 20px 8px',
                  flexWrap: 'nowrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 17 }}>{p.nome}</strong>{' '}
                  {p.eu && <Etiqueta semPonto>Tu</Etiqueta>}
                  <div
                    className="detalhe"
                    style={{
                      color: 'var(--tinta-2)',
                      fontSize: 14,
                      marginTop: 2,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {p.email ?? 'Só entra por ligação'}
                  </div>
                </div>
                <button
                  type="button"
                  className="botao secundario pequeno"
                  onClick={() => {
                    setErroDoEmail(false);
                    setMudarEmail({ id: p.id, nome: p.nome, email: p.email ?? '', eu: p.eu });
                  }}
                >
                  Editar
                </button>
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
                        disabled={aCorrer}
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
                          Vale até {dataCurta(diaEmLisboa(l.expiraEm * 1000), diaEmLisboa())}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="botao secundario pequeno"
                        disabled={aCorrer}
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
                    <div className="linha detalhe">Ainda não entrou.</div>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Folha
        aberta={nova !== null}
        fechar={() => setNova(null)}
        titulo="Dar acesso a alguém"
        pe={
          <button
            type="button"
            className="botao"
            disabled={!nova?.nome.trim() || !nova?.email.trim() || aCorrer}
            onClick={() => correr(darAcesso)}
          >
            Dar acesso
          </button>
        }
      >
        {nova && (
          <div className="formulario">
            <Campo
              rotulo="Nome"
              valor={nova.nome}
              mudar={(nome) => setNova({ ...nova, nome })}
              max={LIMITES.pessoa}
              placeholder="ex.: Nuno"
              autoFocus
            />
            <Campo
              rotulo="Email da conta Google"
              valor={nova.email}
              mudar={(email) => {
                setErroDoEmail(false);
                setNova({ ...nova, email });
              }}
              max={254}
              erro={erroDoEmail}
              placeholder="nome@gmail.com"
              ajuda="Entra no backoffice com o botão do Google, com esta conta."
            />
          </div>
        )}
      </Folha>

      <Folha
        aberta={mudarEmail !== null}
        fechar={() => setMudarEmail(null)}
        titulo={`Editar ${mudarEmail?.nome ?? ''}`}
        pe={
          <button
            type="button"
            className="botao"
            disabled={aCorrer}
            onClick={() => correr(guardarEmail)}
          >
            Guardar
          </button>
        }
      >
        {mudarEmail && (
          <div className="formulario">
            <Campo
              rotulo="Email da conta Google"
              valor={mudarEmail.email}
              mudar={(email) => {
                setErroDoEmail(false);
                setMudarEmail({ ...mudarEmail, email });
              }}
              max={254}
              erro={erroDoEmail}
              placeholder="nome@gmail.com"
              ajuda="Vazio: deixa de entrar com o Google."
            />
            <div className="botoes">
              <button
                type="button"
                className="botao secundario pequeno"
                disabled={aCorrer}
                onClick={() => {
                  const { id, nome } = mudarEmail;
                  setMudarEmail(null);
                  criarLigacao(id, nome);
                }}
              >
                Criar ligação de acesso
              </button>
              {!mudarEmail.eu && (
                <button
                  type="button"
                  className="botao perigo pequeno"
                  onClick={async () => {
                    const { id, nome } = mudarEmail;
                    if (
                      await confirmar(
                        `Tirar o acesso a ${nome}?`,
                        'Sai já de todos os aparelhos, e deixa de conseguir entrar.',
                        'Tirar o acesso',
                      )
                    )
                      await correr(async () => {
                        await pedir(`/api/bo/pessoas/${id}`, { metodo: 'DELETE' });
                        await refrescar();
                        setMudarEmail(null);
                      }, 'Acesso tirado');
                  }}
                >
                  Tirar o acesso
                </button>
              )}
            </div>
          </div>
        )}
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
