import { LIMITES, normalizarEmail, type PessoaComAcesso } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroDaApi, guardarSessao, mensagemDe, pedir, refrescar } from '../api';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Gaveta,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { useTextos } from '../textos';
import { haQuanto, nomeDoAparelho, useRota } from '../util';

/**
 * Quem entra no backoffice, simples e directo (o Renato, 8 nov): uma linha por pessoa, com o nome e
 * o email da conta Google com que entra. Os aparelhos e tirar o acesso ficam dentro do «Editar». As
 * ligações de acesso saíram: toda a gente entra com o Google.
 */
export function GavetaDosAcessos() {
  const t = useTextos();
  const rota = useRota();
  const { data } = useQuery({
    queryKey: ['acessos'],
    queryFn: () => pedir<PessoaComAcesso[]>('/api/bo/acessos'),
  });
  // A folha: uma pessoa nova (sem id) ou uma que já entra.
  const [f, setF] = useState<{ id: number | null; nome: string; email: string } | null>(null);
  const [erroDoEmail, setErroDoEmail] = useState(false);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();
  const pessoa = f?.id ? data?.find((p) => p.id === f.id) : undefined;

  const abrir = (p: PessoaComAcesso | null) => {
    setErroDoEmail(false);
    setF(p ? { id: p.id, nome: p.nome, email: p.email ?? '' } : { id: null, nome: '', email: '' });
  };

  async function guardar() {
    if (!f) return;
    const email = normalizarEmail(f.email);
    if (!email) {
      setErroDoEmail(true);
      return;
    }
    try {
      if (f.id) await pedir(`/api/bo/pessoas/${f.id}`, { metodo: 'PATCH', corpo: { email } });
      else
        await pedir('/api/bo/pessoas', { metodo: 'POST', corpo: { nome: f.nome.trim(), email } });
      await refrescar();
      avisar(f.id ? t.acessos.emailGuardado : t.acessos.jaPodeEntrar(f.nome.trim()));
      setF(null);
    } catch (e) {
      avisar(
        e instanceof ErroDaApi && e.codigo === 'repetido'
          ? f.id
            ? t.acessos.emailDeOutraPessoa
            : t.acessos.emailJaTemAcesso
          : mensagemDe(e),
        true,
      );
    }
  }

  return (
    <>
      <Gaveta
        id="equipa.backoffice"
        titulo={t.acessos.titulo}
        resumo={data?.map((p) => p.nome).join(' · ')}
        abertaDeInicio={rota[0] === 'acessos'}
        lista
      >
        {!data ? (
          <Esqueleto />
        ) : (
          <ul className="lista">
            {data.map((p) => (
              <li key={p.id}>
                <div className="linha">
                  <div className="meio">
                    <div className="titulo-linha">
                      {p.nome} {p.eu && <Etiqueta semPonto>{t.acessos.tu}</Etiqueta>}
                    </div>
                    <div className="detalhe" style={{ overflowWrap: 'anywhere' }}>
                      {p.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="botao secundario pequeno"
                    onClick={() => abrir(p)}
                  >
                    {t.acessos.editar}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="pe-gaveta">
          <button type="button" className="botao secundario" onClick={() => abrir(null)}>
            <Icone nome="mais" tamanho={18} /> {t.acessos.darAcessoAAlguem}
          </button>
        </div>
      </Gaveta>

      <Folha
        aberta={f !== null}
        fechar={() => setF(null)}
        titulo={f?.id ? t.acessos.editarPessoa(f.nome) : t.acessos.darAcessoAAlguem}
        pe={
          <button
            type="button"
            className="botao"
            disabled={(!f?.id && !f?.nome.trim()) || !f?.email.trim() || aCorrer}
            onClick={() => correr(guardar)}
          >
            {f?.id ? t.acessos.guardar : t.acessos.darAcesso}
          </button>
        }
      >
        {f && (
          <div className="formulario">
            {!f.id && (
              <Campo
                rotulo={t.acessos.nome}
                valor={f.nome}
                mudar={(nome) => setF({ ...f, nome })}
                max={LIMITES.pessoa}
                placeholder={t.acessos.exemploDeNome}
                obrigatorio
                autoFocus
              />
            )}
            <Campo
              rotulo={t.acessos.emailDaConta}
              valor={f.email}
              mudar={(email) => {
                setErroDoEmail(false);
                setF({ ...f, email });
              }}
              max={254}
              erro={erroDoEmail}
              placeholder={t.acessos.exemploDeEmail}
              ajuda={t.acessos.ajudaDoEmail}
              obrigatorio
            />
            {pessoa && (
              <div className="campo">
                <span className="rotulo-campo">{t.acessos.aparelhos}</span>
                {pessoa.sessoes.length ? (
                  <ul className="lista">
                    {pessoa.sessoes.map((s) => (
                      <li key={s.id}>
                        <div className="linha" style={{ padding: '10px 0', minHeight: 0 }}>
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
                              if (
                                await confirmar(
                                  s.actual
                                    ? t.acessos.sairDesteAparelho
                                    : t.acessos.terminarASessao,
                                  s.actual
                                    ? t.acessos.saisNesteAparelho
                                    : t.acessos.saiNesseAparelho(pessoa.nome),
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
                  </ul>
                ) : (
                  <div className="ajuda">{t.acessos.aindaNaoEntrou}</div>
                )}
              </div>
            )}
            {pessoa && !pessoa.eu && (
              <div className="botoes">
                <button
                  type="button"
                  className="botao perigo pequeno"
                  onClick={async () => {
                    if (
                      await confirmar(
                        t.acessos.tirarOAcessoA(pessoa.nome),
                        t.acessos.tirarOAcessoTexto,
                        t.acessos.tirarOAcesso,
                      )
                    )
                      await correr(async () => {
                        await pedir(`/api/bo/pessoas/${pessoa.id}`, { metodo: 'DELETE' });
                        await refrescar();
                        setF(null);
                      }, t.acessos.acessoTirado);
                  }}
                >
                  {t.acessos.tirarOAcesso}
                </button>
              </div>
            )}
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
