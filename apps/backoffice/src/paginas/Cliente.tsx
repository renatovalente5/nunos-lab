import {
  LIMITES_DO_PROGRAMA,
  LIMITES_DO_SALDO,
  diaEmLisboa,
  euros,
  eurosComSinal,
  recompensaNaLingua,
  type DefinicoesDaBarbearia,
  type FichaDoCliente,
  type Lingua,
  type SaldoDoBackoffice,
} from '@nunos-lab/dominio';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { DiasDoHistorico, NomeDeCliente, diaDe, horaDe, type Acontecimento } from '../historico';
import { useLingua } from '../lingua';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Gaveta,
  Icone,
  Segmentado,
  Seletor,
  Vazio,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { useTextos, type Textos } from '../textos';
import { numero } from '../util';
import { Formas } from './Clientes';

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
  const [aAcertar, setAAcertar] = useState(false);
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
                        {k.meio && (
                          <div className="detalhe">
                            {t.cliente.cartoes.meio(
                              lingua === 'en' && k.meio.recompensaEn
                                ? k.meio.recompensaEn
                                : k.meio.recompensa,
                              k.meio.carimbos,
                            )}
                            {k.meio.ganhoEm !== null &&
                              ` · ${t.cliente.cartoes.meioGanhoA(diaDe(k.meio.ganhoEm, hoje, lingua))}`}
                            {k.meio.usadoEm !== null
                              ? ` · ${t.cliente.cartoes.usadoA(diaDe(k.meio.usadoEm, hoje, lingua), k.meio.usadoLoja, k.meio.usadoPor)}`
                              : k.meio.ganhoEm !== null &&
                                ` · ${t.cliente.cartoes.meioPorEntregar}`}
                          </div>
                        )}
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

        {/* Falta nas respostas da API de antes do saldo (10 nov 2026). */}
        {c.saldo && (
          <GavetaDoSaldo saldo={c.saldo} acertar={c.apagado ? null : () => setAAcertar(true)} />
        )}

        <GavetaDoHistorico
          ficha={c}
          anular={c.apagado ? null : (h) => anular(h)}
          aCorrer={aCorrer}
        />
      </div>

      {/* Fora das gavetas, como a folha do «Editar»: lá dentro, a margem entre gavetas
          (`.gavetas > * + *`) apanhava também o diálogo. */}
      {aAcertar && c.saldo && (
        <FolhaDoAcerto
          id={id}
          saldo={c.saldo.valor}
          guardarFicha={guardarFicha}
          fechar={() => setAAcertar(false)}
        />
      )}

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

// ——— o saldo e os convites (o Renato, 10 nov 2026) ———

/**
 * O saldo e os convites de um cliente: o saldo em grande (com o código dele e quem o convidou) e quem
 * ele convidou, com o estado de cada um (o prémio recebido, já foi, ainda não foi). Os movimentos estão
 * no histórico, com o resto.
 */
function GavetaDoSaldo({
  saldo,
  acertar,
}: {
  saldo: SaldoDoBackoffice;
  /** Abre a folha do acerto; null numa conta apagada (a API já não a acerta). */
  acertar: (() => void) | null;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const hoje = diaEmLisboa();
  const s = t.cliente.saldo;
  return (
    <Gaveta
      id="cliente.saldo"
      titulo={s.titulo}
      resumo={s.resumo(euros(saldo.valor, lingua), saldo.convites.length)}
      lista
    >
      <div className="saldo-da-ficha">
        <div>
          <div className="valor">{euros(saldo.valor, lingua)}</div>
          {saldo.codigoDoConvite && (
            <div className="detalhe">
              {s.codigo} <code className="codigo">{saldo.codigoDoConvite}</code>
            </div>
          )}
          {saldo.convidadoPor && (
            <div className="detalhe">
              {s.convidadoPor}{' '}
              <NomeDeCliente
                id={saldo.convidadoPor.clienteId}
                nome={saldo.convidadoPor.nome}
                apagado={saldo.convidadoPor.apagado}
              />{' '}
              · {diaDe(saldo.convidadoPor.criadoEm, hoje, lingua)}
            </div>
          )}
        </div>
        {acertar && (
          <button type="button" className="botao secundario" onClick={acertar}>
            {s.acertar}
          </button>
        )}
      </div>

      {saldo.convites.length > 0 && (
        <section className="seccao-da-gaveta">
          <h3>{s.convidou}</h3>
          <ul className="lista">
            {saldo.convites.map((v) => (
              <li key={v.clienteId}>
                <a className="linha" href={`#/clientes/${v.clienteId}`}>
                  <div className="meio">
                    <div className="titulo-linha">
                      {v.apagado ? t.cliente.contaApagada : v.nome || t.cliente.semNome}
                    </div>
                    <div className="detalhe">
                      {s.conviteDe(diaDe(v.criadoEm, hoje, lingua))}
                      {v.visitouEm !== null && ` · ${s.foiA(diaDe(v.visitouEm, hoje, lingua))}`}
                    </div>
                  </div>
                  <div className="lado">
                    {/* O prémio recebido pela visita (o que vale); sem ele, se já foi ou não. */}
                    {v.premioEm ? (
                      <span className="valor-do-movimento entra">
                        {eurosComSinal(v.premio, lingua)}
                      </span>
                    ) : v.visitouEm !== null ? (
                      <Etiqueta tom="bom">{s.jaFoi}</Etiqueta>
                    ) : (
                      <Etiqueta semPonto>{s.aindaNaoFoi}</Etiqueta>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Gaveta>
  );
}

// ——— o histórico (o Renato, 11 nov 2026): tudo o que aconteceu a este cliente, por dias ———

type CarimboDaFicha = FichaDoCliente['historico'][number];

/** Uma linha do histórico do cliente: com o carimbo, para o «Anular». */
type AcontecimentoDoCliente = Acontecimento & { carimbo?: CarimboDaFicha };

/** Tudo o que aconteceu a um cliente, do mais recente para o mais antigo. */
function acontecimentosDe(c: FichaDoCliente, t: Textos, lingua: Lingua): AcontecimentoDoCliente[] {
  const h = t.cliente.historico;
  const lista: AcontecimentoDoCliente[] = [];
  for (const x of c.historico)
    lista.push({
      chave: `carimbo-${x.id}`,
      quando: x.quando,
      ordem: 2,
      titulo: h.carimbo,
      onde: [x.loja, x.pessoa],
      semLeitura: x.semLeitura,
      repetido: x.repetido,
      anulado: x.anuladoEm !== null ? { em: x.anuladoEm, por: x.anuladoPor } : undefined,
      carimbo: x,
    });
  // Os prémios entregues: os do cartão e os a meio, com onde e quem os deu.
  for (const k of c.cartoes) {
    if (k.usadoEm !== null)
      lista.push({
        chave: `premio-${k.id}`,
        quando: k.usadoEm,
        ordem: 3,
        titulo: h.premioEntregue(
          lingua === 'en' && k.recompensaEn
            ? k.recompensaEn
            : recompensaNaLingua(k.recompensa, lingua),
        ),
        onde: [k.usadoLoja, k.usadoPor],
      });
    if (k.meio && k.meio.usadoEm !== null)
      lista.push({
        chave: `meio-${k.id}`,
        quando: k.meio.usadoEm,
        ordem: 3,
        titulo: h.meioEntregue(
          lingua === 'en' && k.meio.recompensaEn ? k.meio.recompensaEn : k.meio.recompensa,
        ),
        onde: [k.meio.usadoLoja, k.meio.usadoPor],
      });
  }
  const saldo = c.saldo;
  if (saldo) {
    for (const m of saldo.movimentos) {
      const base = {
        chave: `saldo-${m.id}`,
        quando: m.criadoEm,
        ordem: m.tipo === 'convidado' ? 1 : m.tipo === 'convite' ? 3 : 4,
        valor: m.valor,
        anulado: m.anulado ? { em: m.anuladoEm ?? null, por: m.anuladoPor ?? null } : undefined,
      };
      const outro = <NomeDeCliente id={m.quemId} nome={m.quem} apagado={m.quemApagado} />;
      switch (m.tipo) {
        case 'uso':
          lista.push({ ...base, titulo: h.usou, onde: [m.loja, m.por], semLeitura: m.semLeitura });
          break;
        case 'acerto':
          lista.push({ ...base, titulo: h.acerto(m.nota), onde: [m.por] });
          break;
        case 'convidado':
          lista.push({
            ...base,
            titulo: (
              <>
                {h.boasVindasDe}
                {outro}
              </>
            ),
          });
          break;
        case 'convite':
          lista.push({
            ...base,
            titulo: (
              <>
                {outro}
                {h.foiABarbearia}
              </>
            ),
          });
          break;
      }
    }
    for (const v of saldo.convites)
      lista.push({
        chave: `aceitou-${v.clienteId}`,
        quando: v.criadoEm,
        ordem: 0,
        titulo: (
          <>
            <NomeDeCliente id={v.clienteId} nome={v.nome} apagado={v.apagado} />
            {h.aceitouOConvite}
          </>
        ),
      });
    // Aceitou um convite sem boas-vindas (a zero euros): o convite fica dito na mesma.
    const por = saldo.convidadoPor;
    if (por && !saldo.movimentos.some((m) => m.tipo === 'convidado'))
      lista.push({
        chave: 'aceitou',
        quando: por.criadoEm,
        ordem: 0,
        titulo: (
          <>
            {h.aceitouDe}
            <NomeDeCliente id={por.clienteId} nome={por.nome} apagado={por.apagado} />
          </>
        ),
      });
  }
  return lista.sort((a, b) => b.quando - a.quando || b.ordem - a.ordem);
}

/** Quantas linhas o histórico mostra de cada vez. */
const LINHAS_DO_HISTORICO = 40;

/**
 * O histórico de um cliente, por dias: os carimbos, o saldo (boas-vindas, prémios, usos e acertos), os
 * convites aceites e os prémios entregues; cada linha com a hora, a casa e quem fez, «Sem leitura» e
 * «Repetido» como nos carimbos, e o que foi anulado riscado, com quem o anulou e quando.
 */
function GavetaDoHistorico({
  ficha: c,
  anular,
  aCorrer,
}: {
  ficha: FichaDoCliente;
  /** Anula um carimbo; null numa conta apagada. */
  anular: ((carimbo: CarimboDaFicha) => void) | null;
  aCorrer: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const hoje = diaEmLisboa();
  const [quantas, setQuantas] = useState(LINHAS_DO_HISTORICO);
  const h = t.cliente.historico;
  const todos = acontecimentosDe(c, t, lingua);
  const anulados = todos.filter((a) => a.anulado).length;
  const visiveis: Acontecimento[] = todos.slice(0, quantas).map((a) =>
    a.carimbo && !a.anulado && anular
      ? {
          ...a,
          accao: (
            <button
              type="button"
              className="botao secundario pequeno"
              disabled={aCorrer}
              onClick={() => anular(a.carimbo!)}
            >
              {h.anular}
            </button>
          ),
        }
      : a,
  );
  return (
    <Gaveta
      id="cliente.historico"
      titulo={h.titulo}
      resumo={todos.length ? h.resumo(diaDe(todos[0]!.quando, hoje, lingua), anulados) : h.vazio}
      lista
    >
      {todos.length ? (
        <>
          <DiasDoHistorico acontecimentos={visiveis} />
          {todos.length > quantas && (
            <div className="pe-gaveta">
              <button
                type="button"
                className="botao secundario"
                onClick={() => setQuantas((n) => n + LINHAS_DO_HISTORICO)}
              >
                {h.verMais}
              </button>
            </div>
          )}
        </>
      ) : (
        <Vazio titulo={h.vazio} />
      )}
    </Gaveta>
  );
}

/** Um acerto vai de 1 € a 500 €, em euros inteiros (os limites do domínio estão em cêntimos). */
const MAXIMO_DO_ACERTO = LIMITES_DO_SALDO.movimento.max / 100;

function eurosDoAcerto(texto: string): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= 1 && n <= MAXIMO_DO_ACERTO ? n : null;
}

/**
 * O que está mal no acerto: o valor, a nota ou o pedido (a rede, uma conta que entretanto se apagou).
 * Guarda-se a falha e não a frase, para mudar de língua mudar também o erro à vista.
 */
type ErroDoAcerto = { campo: 'valor' | 'nota' | null; falha?: unknown };

/**
 * Acertar o saldo: dar ou tirar euros inteiros, com uma nota que o cliente vê na carteira. Tirar mais
 * do que há diz-se logo; se a ficha estiver para trás (um uso ao balcão entretanto), a API recusa
 * (`saldo_insuficiente`) e a ficha relê-se.
 */
function FolhaDoAcerto({
  id,
  saldo,
  guardarFicha,
  fechar,
}: {
  id: string;
  /** O saldo de agora, em cêntimos. */
  saldo: number;
  guardarFicha: (f: FichaDoCliente) => void;
  fechar: () => void;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const consultas = useQueryClient();
  const avisar = useAvisar();
  const { correr, aCorrer } = useAccao();
  const [sentido, setSentido] = useState<'dar' | 'tirar'>('dar');
  const [escrito, setEscrito] = useState('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<ErroDoAcerto | null>(null);
  // Uma chave por folha aberta: se a resposta se perder e o Nuno carregar outra vez, o acerto conta uma.
  const [chave] = useState(() => crypto.randomUUID().replace(/-/g, ''));
  // O saldo de agora (a ficha pode estar aberta há muito): o «Fica X €» e o «não chega» contam com ele.
  useEffect(() => {
    void consultas.invalidateQueries({ queryKey: ['cliente', id] });
  }, [consultas, id]);
  const s = t.cliente.saldo;

  const inteiros = eurosDoAcerto(escrito);
  // Em cêntimos, negativo para tirar; null enquanto o valor escrito não servir.
  const valor = inteiros === null ? null : (sentido === 'tirar' ? -100 : 100) * inteiros;
  const depois = valor === null ? null : saldo + valor;
  // Só o tirar tem de caber no saldo (dar pode sempre, como na API).
  const naoChega = sentido === 'tirar' && depois !== null && depois < 0;
  const quanto = inteiros === null ? null : euros(inteiros * 100, lingua);
  const rotuloDoBotao =
    sentido === 'tirar'
      ? quanto
        ? s.tirarValor(quanto)
        : s.tirar
      : quanto
        ? s.darValor(quanto)
        : s.dar;
  const textoDoValor = naoChega
    ? t.geral.erros.saldo_insuficiente
    : erro?.falha !== undefined
      ? mensagemDe(erro.falha)
      : s.valorErrado(euros(LIMITES_DO_SALDO.movimento.max, lingua));

  async function acertar() {
    if (valor === null) {
      setErro({ campo: 'valor' });
      return;
    }
    if (!nota.trim()) {
      setErro({ campo: 'nota' });
      return;
    }
    try {
      guardarFicha(
        await pedir<FichaDoCliente>(`/api/bo/clientes/${id}/saldo`, {
          metodo: 'POST',
          corpo: { valor, nota: nota.trim(), chave },
        }),
      );
      fechar();
      await refrescar();
      avisar(s.acertado);
    } catch (e) {
      const campos = e instanceof ErroDaApi ? e.campos : [];
      if (e instanceof ErroDaApi && e.codigo === 'saldo_insuficiente') {
        setErro({ campo: 'valor', falha: e });
        void consultas.invalidateQueries({ queryKey: ['cliente', id] });
      } else if (campos.includes('valor')) setErro({ campo: 'valor' });
      else if (campos.includes('nota')) setErro({ campo: 'nota' });
      else setErro({ campo: null, falha: e });
    }
  }

  return (
    <Folha
      aberta
      fechar={fechar}
      titulo={s.acertar}
      sujo={!!(escrito.trim() || nota.trim())}
      pe={
        <>
          <button
            type="button"
            className="botao"
            disabled={aCorrer || naoChega || !escrito.trim() || !nota.trim()}
            onClick={() => correr(acertar)}
          >
            {rotuloDoBotao}
          </button>
          {depois !== null && !naoChega && (
            <span className="estado">{s.fica(euros(depois, lingua))}</span>
          )}
        </>
      }
    >
      <div className="formulario">
        <Segmentado<'dar' | 'tirar'>
          cheio
          rotulo={s.darOuTirar}
          valor={sentido}
          mudar={(v) => {
            setSentido(v);
            setErro(null);
          }}
          opcoes={[
            { valor: 'dar', nome: s.dar },
            { valor: 'tirar', nome: s.tirar },
          ]}
        />
        <Campo
          rotulo={s.valor}
          tipo="number"
          modoDeTeclado="numeric"
          minimo={1}
          maximo={MAXIMO_DO_ACERTO}
          passo={1}
          valor={escrito}
          mudar={(v) => {
            setEscrito(v);
            setErro(null);
          }}
          erro={naoChega || erro?.campo === 'valor'}
          erroTexto={textoDoValor}
          obrigatorio
          autoFocus
        />
        <Campo
          rotulo={s.nota}
          valor={nota}
          mudar={(v) => {
            setNota(v);
            setErro(null);
          }}
          max={LIMITES_DO_SALDO.nota}
          erro={erro?.campo === 'nota'}
          ajuda={s.notaAjuda}
          obrigatorio
        />
        {erro && erro.campo === null && (
          <div className="caixa-aviso mau" role="alert">
            {mensagemDe(erro.falha)}
          </div>
        )}
      </div>
    </Folha>
  );
}
