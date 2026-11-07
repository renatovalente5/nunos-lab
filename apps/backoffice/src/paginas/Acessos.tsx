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
import { etiquetaDaLingua, useLingua } from '../lingua';
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
import { useTextos } from '../textos';
import { haQuanto, nomeDoAparelho } from '../util';

/** A ligação monta-se com a morada deste backoffice, onde quer que ele esteja publicado. */
function ligacaoDe(codigo: string): string {
  return `${location.origin}${location.pathname}#acesso=${codigo}`;
}

/**
 * Quem entra no backoffice. Cada pessoa entra com a conta Google do email que
 * aqui está; a ligação de acesso fica para quem não tiver conta Google.
 */
export function Acessos() {
  const t = useTextos();
  const lingua = useLingua();
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
      avisar(t.acessos.jaPodeEntrar(nova.nome.trim()));
      setNova(null);
    } catch (e) {
      avisar(
        e instanceof ErroDaApi && e.codigo === 'repetido'
          ? t.acessos.emailJaTemAcesso
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
      avisar(t.acessos.emailGuardado);
      setMudarEmail(null);
    } catch (e) {
      avisar(
        e instanceof ErroDaApi && e.codigo === 'repetido'
          ? t.acessos.emailDeOutraPessoa
          : mensagemDe(e),
        true,
      );
    }
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.acessos}</h1>
          <p className="subtitulo">{t.acessos.subtitulo}</p>
        </div>
        <button
          type="button"
          className="botao"
          onClick={() => {
            setErroDoEmail(false);
            setNova({ nome: '', email: '' });
          }}
        >
          <Icone nome="mais" tamanho={18} /> {t.acessos.darAcessoAAlguem}
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
                  {p.eu && <Etiqueta semPonto>{t.acessos.tu}</Etiqueta>}
                  <div
                    className="detalhe"
                    style={{
                      color: 'var(--tinta-2)',
                      fontSize: 14,
                      marginTop: 2,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {p.email ?? t.acessos.soPorLigacao}
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
                  {t.acessos.editar}
                </button>
              </div>
              <ul className="lista">
                {p.sessoes.map((s) => (
                  <li key={s.id}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {nomeDoAparelho(s.aparelho, t.acessos.aparelho)}{' '}
                          {s.actual && <Etiqueta tom="bom">{t.acessos.esteAparelho}</Etiqueta>}
                        </div>
                        <div className="detalhe">
                          {t.acessos.entrouEUsado(haQuanto(s.criadaEm), haQuanto(s.vistaEm))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="botao secundario pequeno"
                        disabled={aCorrer}
                        onClick={async () => {
                          const texto = s.actual
                            ? t.acessos.saisNesteAparelho
                            : t.acessos.saiNesseAparelho(p.nome);
                          if (
                            await confirmar(
                              s.actual ? t.acessos.sairDesteAparelho : t.acessos.terminarASessao,
                              texto,
                              s.actual ? t.geral.sair : t.acessos.terminar,
                            )
                          )
                            await correr(async () => {
                              await pedir(`/api/bo/sessoes/${s.id}`, { metodo: 'DELETE' });
                              if (s.actual) guardarSessao(null);
                              else await refrescar();
                            });
                        }}
                      >
                        {s.actual ? t.geral.sair : t.acessos.terminar}
                      </button>
                    </div>
                  </li>
                ))}
                {p.ligacoes.map((l) => (
                  <li key={`l${l.id}`}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">{t.acessos.ligacaoPorUsar}</div>
                        <div className="detalhe">
                          {t.acessos.valeAte(
                            dataCurta(diaEmLisboa(l.expiraEm * 1000), diaEmLisboa(), lingua),
                          )}
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
                          }, t.acessos.ligacaoCancelada)
                        }
                      >
                        {t.geral.cancelar}
                      </button>
                    </div>
                  </li>
                ))}
                {!p.sessoes.length && !p.ligacoes.length && (
                  <li>
                    <div className="linha detalhe">{t.acessos.aindaNaoEntrou}</div>
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
        titulo={t.acessos.darAcessoAAlguem}
        pe={
          <button
            type="button"
            className="botao"
            disabled={!nova?.nome.trim() || !nova?.email.trim() || aCorrer}
            onClick={() => correr(darAcesso)}
          >
            {t.acessos.darAcesso}
          </button>
        }
      >
        {nova && (
          <div className="formulario">
            <Campo
              rotulo={t.acessos.nome}
              valor={nova.nome}
              mudar={(nome) => setNova({ ...nova, nome })}
              max={LIMITES.pessoa}
              placeholder={t.acessos.exemploDeNome}
              autoFocus
            />
            <Campo
              rotulo={t.acessos.emailDaConta}
              valor={nova.email}
              mudar={(email) => {
                setErroDoEmail(false);
                setNova({ ...nova, email });
              }}
              max={254}
              erro={erroDoEmail}
              placeholder={t.acessos.exemploDeEmail}
              ajuda={t.acessos.ajudaDoEmail}
            />
          </div>
        )}
      </Folha>

      <Folha
        aberta={mudarEmail !== null}
        fechar={() => setMudarEmail(null)}
        titulo={t.acessos.editarPessoa(mudarEmail?.nome ?? '')}
        pe={
          <button
            type="button"
            className="botao"
            disabled={aCorrer}
            onClick={() => correr(guardarEmail)}
          >
            {t.acessos.guardar}
          </button>
        }
      >
        {mudarEmail && (
          <div className="formulario">
            <Campo
              rotulo={t.acessos.emailDaConta}
              valor={mudarEmail.email}
              mudar={(email) => {
                setErroDoEmail(false);
                setMudarEmail({ ...mudarEmail, email });
              }}
              max={254}
              erro={erroDoEmail}
              placeholder={t.acessos.exemploDeEmail}
              ajuda={t.acessos.ajudaDoEmailVazio}
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
                {t.acessos.criarLigacao}
              </button>
              {!mudarEmail.eu && (
                <button
                  type="button"
                  className="botao perigo pequeno"
                  onClick={async () => {
                    const { id, nome } = mudarEmail;
                    if (
                      await confirmar(
                        t.acessos.tirarOAcessoA(nome),
                        t.acessos.tirarOAcessoTexto,
                        t.acessos.tirarOAcesso,
                      )
                    )
                      await correr(async () => {
                        await pedir(`/api/bo/pessoas/${id}`, { metodo: 'DELETE' });
                        await refrescar();
                        setMudarEmail(null);
                      }, t.acessos.acessoTirado);
                  }}
                >
                  {t.acessos.tirarOAcesso}
                </button>
              )}
            </div>
          </div>
        )}
      </Folha>

      <Folha
        aberta={!!ligacao}
        fechar={() => setLigacao(null)}
        titulo={t.acessos.ligacaoPara(ligacao?.para ?? '')}
        pe={
          <>
            <button
              type="button"
              className="botao"
              onClick={async () => {
                if (!ligacao) return;
                try {
                  await navigator.clipboard.writeText(ligacao.url);
                  avisar(t.acessos.copiada);
                } catch {
                  avisar(t.acessos.naoDeuParaCopiar, true);
                }
              }}
            >
              <Icone nome="copiar" tamanho={17} /> {t.acessos.copiar}
            </button>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                className="botao secundario"
                onClick={() =>
                  ligacao &&
                  navigator
                    .share({ title: t.acessos.tituloDaPartilha, url: ligacao.url })
                    .catch(() => {})
                }
              >
                <Icone nome="partilhar" tamanho={17} /> {t.acessos.partilhar}
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
              aria-label={t.acessos.ligacaoDeAcesso}
            />
            <div className="caixa-aviso">
              {t.acessos.entraUmaVez(
                new Date(ligacao.ate * 1000).toLocaleDateString(etiquetaDaLingua(), {
                  day: 'numeric',
                  month: 'long',
                }),
                ligacao.para,
              )}
            </div>
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
