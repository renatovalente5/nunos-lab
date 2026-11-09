import {
  LIMITES_DO_PROGRAMA,
  dataCurta,
  diaEmLisboa,
  recompensaNaLingua,
  type DefinicoesDaBarbearia,
  type FichaDoCliente,
  type Lingua,
} from '@nunos-lab/dominio';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { etiquetaDaLingua, useLingua } from '../lingua';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Gaveta,
  Icone,
  Seletor,
  Vazio,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { useTextos } from '../textos';
import { numero } from '../util';
import { Formas } from './Clientes';

/** «12 out» («12 Oct») de um instante. */
function diaDe(segundos: number, hoje: string, lingua: Lingua): string {
  return dataCurta(diaEmLisboa(segundos * 1000), hoje, lingua);
}

/** «15:30» de um instante, em Lisboa. */
function horaDe(segundos: number): string {
  return new Date(segundos * 1000).toLocaleTimeString(etiquetaDaLingua(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  });
}

/** A data escreve-se como se diz («25/06»); a API guarda «MM-DD». */
const aniversarioEmTexto = (a: string | null) => (a ? `${a.slice(3, 5)}/${a.slice(0, 2)}` : '');
/** «25/06» → «06-25»; vazio → null; outra coisa → undefined. */
function aniversarioDoTexto(t: string): string | null | undefined {
  const s = t.trim();
  if (!s) return null;
  const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})$/.exec(s);
  if (!m) return undefined;
  return `${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

type Edicao = { nome: string; email: string; aniversario: string; lojaId: number | null };

/** A ficha de um cliente: quem é, os cartões, e cada carimbo; editar, apagar e anular um carimbo. */
export function Cliente({ id }: { id: string }) {
  const t = useTextos();
  const lingua = useLingua();
  const consultas = useQueryClient();
  const ficha = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => pedir<FichaDoCliente>(`/api/bo/clientes/${id}`),
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const hoje = diaEmLisboa();
  const avisar = useAvisar();
  const { correr, aCorrer } = useAccao();
  const { confirmar, dialogo } = useConfirmar();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const voltar = (
    <a className="voltar" href="#/clientes">
      <Icone nome="voltar" tamanho={16} /> {t.geral.seccoes.clientes}
    </a>
  );
  if (ficha.error)
    return (
      <>
        {voltar}
        <div className="cartao">
          <Vazio titulo={mensagemDe(ficha.error)} />
        </div>
      </>
    );
  const c = ficha.data;
  if (!c)
    return (
      <>
        {voltar}
        <Esqueleto linhas={6} />
      </>
    );
  // O cartão de agora (o de número mais alto), para o resumo da gaveta fechada.
  const cartaoActual = c.cartoes.reduce<(typeof c.cartoes)[number] | null>(
    (a, k) => (!a || k.numero > a.numero ? k : a),
    null,
  );
  const casa = barbearia.data?.lojas.find((l) => l.id === c.lojaId)?.nome;
  const guardarFicha = (f: FichaDoCliente) => consultas.setQueryData(['cliente', id], f);

  async function guardar() {
    if (!edicao || !c) return;
    const aniversario = aniversarioDoTexto(edicao.aniversario);
    if (aniversario === undefined) {
      setErros(['aniversario']);
      avisar(t.cliente.edicao.aniversarioErrado, true);
      return;
    }
    // Só vai o que mudou: a API regista o quê.
    const corpo: Record<string, unknown> = {};
    if (edicao.nome.trim() !== c.nome) corpo.nome = edicao.nome.trim();
    if ((edicao.email.trim() || null) !== c.email) corpo.email = edicao.email.trim() || null;
    if (aniversario !== c.aniversario) corpo.aniversario = aniversario;
    if (edicao.lojaId !== c.lojaId) corpo.lojaId = edicao.lojaId;
    if (!Object.keys(corpo).length) {
      setEdicao(null);
      return;
    }
    try {
      const f = await pedir<FichaDoCliente>(`/api/bo/clientes/${id}`, { metodo: 'PATCH', corpo });
      guardarFicha(f);
      setEdicao(null);
      setErros([]);
      await refrescar();
      avisar(t.cliente.edicao.guardado);
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  async function apagar() {
    if (!c) return;
    if (
      !(await confirmar(
        t.cliente.apagar.pergunta(c.nome),
        t.cliente.apagar.texto,
        t.cliente.apagar.accao,
      ))
    )
      return;
    await correr(async () => {
      await pedir(`/api/bo/clientes/${id}`, { metodo: 'DELETE' });
      await refrescar();
      location.hash = '#/clientes';
    }, t.cliente.apagar.feito);
  }

  async function anular(h: FichaDoCliente['historico'][number]) {
    if (
      !(await confirmar(
        t.cliente.anular.pergunta(diaDe(h.quando, hoje, lingua), horaDe(h.quando)),
        t.cliente.anular.texto,
        t.cliente.anular.accao,
      ))
    )
      return;
    await correr(async () => {
      guardarFicha(
        await pedir<FichaDoCliente>(`/api/bo/carimbos/${h.id}/anular`, { metodo: 'POST' }),
      );
      await refrescar();
    }, t.cliente.anular.feito);
  }

  return (
    <>
      {voltar}
      <div className="cabecalho">
        <div>
          <h1>{c.apagado ? t.cliente.contaApagada : c.nome || t.cliente.semNome}</h1>
          <p className="subtitulo">
            <code className="codigo">{c.codigo}</code>
            {c.apagado && (
              <>
                {' '}
                <Etiqueta tom="mau" semPonto>
                  {t.cliente.apagada}
                </Etiqueta>
              </>
            )}
            {c.exemplo && (
              <>
                {' '}
                <Etiqueta semPonto>{t.cliente.exemplo}</Etiqueta>
              </>
            )}
          </p>
        </div>
        {!c.apagado && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="botao secundario"
              onClick={() => {
                setErros([]);
                setEdicao({
                  nome: c.nome,
                  email: c.email ?? '',
                  aniversario: aniversarioEmTexto(c.aniversario),
                  lojaId: c.lojaId,
                });
              }}
            >
              {t.cliente.editar}
            </button>
            <button type="button" className="botao perigo" disabled={aCorrer} onClick={apagar}>
              {t.cliente.apagarAConta}
            </button>
          </div>
        )}
      </div>

      <div className="cartao recheado">
        <dl className="detalhes">
          <div className="largo">
            <dt>{t.cliente.email}</dt>
            <dd>
              {c.email ??
                (c.emailOculto ? (
                  <span className="email-oculto">{t.clientes.emailOculto}</span>
                ) : (
                  '—'
                ))}
            </dd>
          </div>
          <div>
            <dt>{t.cliente.aniversario}</dt>
            <dd>{aniversarioEmTexto(c.aniversario) || '—'}</dd>
          </div>
          <div>
            <dt>{t.cliente.casa}</dt>
            <dd>{casa ?? (barbearia.data ? t.cliente.semCasa : '—')}</dd>
          </div>
          <div>
            <dt>{t.cliente.desde}</dt>
            <dd>{diaDe(c.criadoEm, hoje, lingua)}</dd>
          </div>
          <div>
            <dt>{t.cliente.cortes}</dt>
            <dd>{numero(c.cortes)}</dd>
          </div>
          <div>
            <dt>{t.cliente.cartoesCompletos}</dt>
            <dd>{numero(c.cartoes.filter((k) => k.completoEm).length)}</dd>
          </div>
          <div>
            <dt>{t.cliente.entraCom}</dt>
            <dd>
              <Formas formas={c.formas} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="gavetas" style={{ marginTop: 28 }}>
        <Gaveta
          id="cliente.cartoes"
          titulo={t.cliente.cartoes.titulo}
          resumo={
            cartaoActual
              ? `${t.cliente.cartoes.cartao(cartaoActual.numero)} · ${t.cliente.cartoes.carimbosDe(cartaoActual.carimbos, cartaoActual.objectivo)}`
              : t.cliente.cartoes.vazio
          }
          lista
        >
          {c.cartoes.length ? (
            <ul className="lista">
              {c.cartoes.map((k) => {
                const usado = k.usadoEm !== null;
                const completo = k.completoEm !== null;
                return (
                  <li key={k.id}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {t.cliente.cartoes.cartao(k.numero)}
                          <span style={{ fontWeight: 600, color: 'var(--tinta-2)' }}>
                            {' '}
                            · {t.cliente.cartoes.carimbosDe(k.carimbos, k.objectivo)}
                          </span>
                        </div>
                        <div className="detalhe">
                          {lingua === 'en' && k.recompensaEn
                            ? k.recompensaEn
                            : recompensaNaLingua(k.recompensa, lingua)}{' '}
                          · {t.cliente.cartoes.desde(diaDe(k.iniciadoEm, hoje, lingua))}
                          {completo &&
                            ` · ${t.cliente.cartoes.completoA(diaDe(k.completoEm!, hoje, lingua))}`}
                          {usado &&
                            ` · ${t.cliente.cartoes.usadoA(diaDe(k.usadoEm!, hoje, lingua), k.usadoLoja, k.usadoPor)}`}
                        </div>
                      </div>
                      {usado ? (
                        <Etiqueta>{t.cliente.cartoes.usado}</Etiqueta>
                      ) : completo ? (
                        <Etiqueta tom="bom">{t.cliente.cartoes.porUsar}</Etiqueta>
                      ) : (
                        <Etiqueta semPonto>{t.cliente.cartoes.emCurso}</Etiqueta>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio titulo={t.cliente.cartoes.vazio} />
          )}
        </Gaveta>

        <Gaveta
          id="cliente.historico"
          titulo={t.cliente.historico.titulo}
          resumo={
            c.historico.length
              ? t.cliente.historico.resumo(
                  c.historico.length,
                  diaDe(Math.max(...c.historico.map((h) => h.quando)), hoje, lingua),
                )
              : t.cliente.historico.vazio
          }
          lista
        >
          {c.historico.length ? (
            <ul className="lista">
              {c.historico.map((h) => (
                <li key={h.id}>
                  <div className="linha">
                    <div className="meio">
                      <div className="titulo-linha">
                        {diaDe(h.quando, hoje, lingua)} · {horaDe(h.quando)}
                      </div>
                      <div className="detalhe">
                        {[h.loja, h.pessoa, t.cliente.cartoes.cartao(h.cartaoNumero)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="lado">
                      {h.anuladoEm !== null && (
                        <Etiqueta tom="mau">{t.cliente.historico.anulado(h.anuladoPor)}</Etiqueta>
                      )}
                      {h.repetido && (
                        <Etiqueta tom="atencao">{t.cliente.historico.repetido}</Etiqueta>
                      )}
                      {h.semLeitura && <Etiqueta>{t.cliente.historico.semLeitura}</Etiqueta>}
                      {h.anuladoEm === null && !c.apagado && (
                        <button
                          type="button"
                          className="botao secundario pequeno"
                          disabled={aCorrer}
                          onClick={() => anular(h)}
                        >
                          {t.cliente.historico.anular}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio titulo={t.cliente.historico.vazio} />
          )}
        </Gaveta>
      </div>

      <Folha
        aberta={!!edicao}
        fechar={() => setEdicao(null)}
        titulo={t.cliente.edicao.titulo}
        pe={
          <button
            type="button"
            className="botao"
            disabled={!edicao?.nome.trim() || aCorrer}
            onClick={() => correr(guardar)}
          >
            {t.cliente.edicao.guardar}
          </button>
        }
      >
        {edicao && (
          <div className="formulario">
            <Campo
              rotulo={t.cliente.nome}
              valor={edicao.nome}
              mudar={(nome) => setEdicao({ ...edicao, nome })}
              max={LIMITES_DO_PROGRAMA.nomeDoCliente}
              erro={erros.includes('nome')}
              obrigatorio
              autoFocus
            />
            <Campo
              rotulo={t.cliente.email}
              valor={edicao.email}
              mudar={(email) => setEdicao({ ...edicao, email })}
              max={254}
              erro={erros.includes('email')}
              placeholder={t.cliente.edicao.exemploDeEmail}
              ajuda={t.cliente.edicao.ajudaDoEmail}
            />
            <div className="duas-colunas">
              <Campo
                rotulo={t.cliente.aniversario}
                valor={edicao.aniversario}
                mudar={(aniversario) => setEdicao({ ...edicao, aniversario })}
                max={5}
                erro={erros.includes('aniversario')}
                erroTexto={t.cliente.edicao.diaEMes}
                placeholder="25/06"
                ajuda={t.cliente.edicao.ajudaDoAniversario}
              />
              <Seletor
                rotulo={t.cliente.casa}
                valor={edicao.lojaId}
                mudar={(lojaId) => setEdicao({ ...edicao, lojaId })}
                opcoes={(barbearia.data?.lojas ?? []).map((l) => ({ valor: l.id, nome: l.nome }))}
                vazio={t.cliente.semCasa}
              />
            </div>
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
