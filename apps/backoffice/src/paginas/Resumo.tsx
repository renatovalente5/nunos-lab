import {
  dataCurta,
  diaEmLisboa,
  diasEntre,
  nomeDoMes,
  oQueFaltaFazer,
  somarDias,
  type CoisaPorFazer,
  type DefinicoesDaBarbearia,
  type Lingua,
  type Metricas,
  type Parceiro,
  type PessoaDaEquipaNoBackoffice,
  type Promocao,
} from '@nunos-lab/dominio';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { pedir } from '../api';
import { useLingua } from '../lingua';
import { Esqueleto, Icone, Numero, Segmentado, type NomeDoIcone } from '../pecas';
import { useTextos } from '../textos';
import { numero } from '../util';

type Periodo = 7 | 30 | 90 | 365;

/** «▲ 12 %» a verde, «▼ 8 %» a vermelho, ou «igual», contra o período anterior. */
function Variacao({ actual, anterior }: { actual: number; anterior: number }) {
  const t = useTextos();
  if (actual === anterior) return <span>{t.resumo.igualAoAnterior}</span>;
  const sobe = actual > anterior;
  // Sem nada antes, uma percentagem não quer dizer nada: vai a diferença.
  const quanto =
    anterior === 0
      ? numero(Math.abs(actual - anterior))
      : t.resumo.percentagem(numero(Math.abs(Math.round(((actual - anterior) / anterior) * 100))));
  return (
    <>
      <span className={sobe ? 'sobe' : 'desce'}>
        {sobe ? '▲' : '▼'} {quanto}
      </span>{' '}
      {t.resumo.vsAnterior}
    </>
  );
}

// ——— o que falta fazer ———

const ICONE_DO_QUE_FALTA: Record<CoisaPorFazer['tipo'], NomeDoIcone> = {
  sem_quem_valide: 'equipa',
  nao_entrou: 'acessos',
  fora_da_app: 'parceiros',
  a_acabar: 'registo',
  parceiro_incompleto: 'parceiros',
};

/** Onde se resolve: a página certa, com a gaveta certa aberta. */
function ondeSeResolve(c: CoisaPorFazer): string {
  switch (c.tipo) {
    case 'sem_quem_valide':
    case 'nao_entrou':
      return `#/parceiros/${c.parceiroId}?abrir=quem-valida`;
    case 'fora_da_app':
    case 'parceiro_incompleto':
      return `#/parceiros/${c.parceiroId}`;
    case 'a_acabar':
      return `#/promocoes?abrir=${c.promocaoId}`;
  }
}

function FraseDoQueFalta({ c }: { c: CoisaPorFazer }) {
  const t = useTextos();
  const lingua = useLingua();
  switch (c.tipo) {
    case 'sem_quem_valide':
      return (
        <>
          <strong>{c.parceiro}</strong> {t.resumo.semQuemValide}
        </>
      );
    case 'nao_entrou':
      return (
        <>
          <strong>{c.pessoa}</strong> {t.resumo.naoEntrou(c.parceiro)}
        </>
      );
    case 'fora_da_app':
      return (
        <>
          <strong>{c.parceiro}</strong> {t.resumo.foraDaApp}
        </>
      );
    case 'a_acabar':
      return (
        <>
          <strong>{c.promocao}</strong>{' '}
          {t.resumo.aAcabar(c.parceiro, c.dias, dataCurta(c.fim, diaEmLisboa(), lingua))}
        </>
      );
    case 'parceiro_incompleto':
      return (
        <>
          <strong>{c.parceiro}</strong>:{' '}
          {t.resumo.falta(c.falta.map((f) => t.resumo.faltaNoParceiro[f]))}
        </>
      );
  }
}

/**
 * O que falta fazer para a app estar inteira (o Renato, 9 nov: «deve dar para o Nuno ver se falta
 * alguma coisa fazer»). Não depende do período nem da barbearia: fica antes dos filtros.
 */
function PorFazer() {
  const t = useTextos();
  const parceiros = useQuery({
    queryKey: ['parceiros'],
    queryFn: () => pedir<Parceiro[]>('/api/bo/parceiros'),
  });
  const equipa = useQuery({
    queryKey: ['equipa'],
    queryFn: () => pedir<PessoaDaEquipaNoBackoffice[]>('/api/bo/equipa'),
  });
  const promocoes = useQuery({
    queryKey: ['promocoes'],
    queryFn: () => pedir<Promocao[]>('/api/bo/promocoes'),
  });
  if (!parceiros.data || !equipa.data || !promocoes.data) return null;
  const lista = oQueFaltaFazer({
    parceiros: parceiros.data,
    equipa: equipa.data,
    promocoes: promocoes.data,
    hoje: diaEmLisboa(),
  });
  if (!lista.length)
    return (
      <p className="em-dia" role="status">
        <span className="circulo" aria-hidden="true">
          <Icone nome="certo" tamanho={14} espessura={2.6} />
        </span>
        {t.resumo.tudoEmDia}
      </p>
    );
  return (
    <section className="cartao por-fazer" aria-labelledby="por-fazer">
      <h2 id="por-fazer">
        {t.resumo.porFazer} <span className="quantos">{lista.length}</span>
      </h2>
      <ul>
        {lista.map((c, i) => (
          <li key={i}>
            <a href={ondeSeResolve(c)}>
              <span className="circulo" aria-hidden="true">
                <Icone nome={ICONE_DO_QUE_FALTA[c.tipo]} tamanho={17} />
              </span>
              <span className="frase">
                <FraseDoQueFalta c={c} />
              </span>
              <Icone nome="seguinte" tamanho={16} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ——— o gráfico dos carimbos ———

type Coluna = { chave: string; quando: string; n: number };

/** Por dia até 30 dias; por semana em 90; por mês num ano (as colunas ficam largas o bastante). */
function colunasDoPeriodo(m: Metricas, lingua: Lingua, quandoDaSemana: (dia: string) => string) {
  const hoje = diaEmLisboa();
  const porDia = new Map(m.porDia.map((d) => [d.dia, d.n]));
  const dias = Array.from({ length: diasEntre(m.de, m.ate) + 1 }, (_, i) => somarDias(m.de, i));
  if (dias.length <= 31)
    return dias.map((d) => ({ chave: d, quando: dataCurta(d, hoje, lingua), n: porDia.get(d) ?? 0 }));
  if (dias.length <= 120) {
    const semanas: Coluna[] = [];
    for (let i = 0; i < dias.length; i += 7) {
      const semana = dias.slice(i, i + 7);
      semanas.push({
        chave: semana[0]!,
        quando: quandoDaSemana(dataCurta(semana[0]!, hoje, lingua)),
        n: semana.reduce((s, d) => s + (porDia.get(d) ?? 0), 0),
      });
    }
    return semanas;
  }
  const meses = new Map<string, number>();
  for (const d of dias) meses.set(d.slice(0, 7), (meses.get(d.slice(0, 7)) ?? 0) + (porDia.get(d) ?? 0));
  return [...meses].map(([mes, n]) => ({
    chave: mes,
    quando: `${nomeDoMes(Number(mes.slice(5)) - 1, lingua)} ${mes.slice(0, 4)}`,
    n,
  }));
}

/** O topo da escala, redondo: 3 fica 3; 37 fica 40; 180 fica 200. */
function topoDaEscala(maior: number): number {
  if (maior <= 5) return Math.max(1, maior);
  const p = 10 ** Math.floor(Math.log10(maior));
  return ([1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= maior) ?? 10 * p);
}

/**
 * Os carimbos ao longo do período: colunas finas de uma cor só (sem legenda, o título diz o que é),
 * o valor de cada uma ao passar o rato ou com as setas, e a tabela para quem lê o ecrã.
 */
function GraficoDosCarimbos({ colunas, total }: { colunas: Coluna[]; total: number }) {
  const t = useTextos();
  const [activa, setActiva] = useState<number | null>(null);
  const topo = topoDaEscala(Math.max(...colunas.map((c) => c.n)));
  const vista = activa === null ? null : colunas[activa]!;
  const tecla = (e: KeyboardEvent) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (passo) {
      e.preventDefault();
      setActiva((a) => Math.min(colunas.length - 1, Math.max(0, (a ?? colunas.length - 1) + passo)));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActiva(e.key === 'Home' ? 0 : colunas.length - 1);
    }
  };
  // A dica junto da coluna, sem sair do cartão nas pontas.
  const onde = activa === null ? 0 : (activa + 0.5) / colunas.length;
  const ancora = onde < 0.15 ? 'esquerda' : onde > 0.85 ? 'direita' : 'meio';
  return (
    <div className="grafico">
      <div
        className="area"
        tabIndex={0}
        role="group"
        aria-label={t.resumo.grafico(numero(total))}
        onKeyDown={tecla}
        onFocus={() => setActiva((a) => a ?? colunas.length - 1)}
        onBlur={() => setActiva(null)}
        onPointerLeave={() => setActiva(null)}
      >
        <span className="topo" aria-hidden="true">
          {numero(topo)}
        </span>
        <div
          className="colunas"
          style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
        >
          {colunas.map((c, i) => (
            <div
              key={c.chave}
              className={i === activa ? 'coluna activa' : 'coluna'}
              onPointerEnter={() => setActiva(i)}
            >
              <div
                className="barra"
                style={{ height: c.n ? `max(2px, ${(c.n / topo) * 100}%)` : 0 }}
              />
            </div>
          ))}
        </div>
        {vista && (
          <div className={`dica ${ancora}`} style={{ left: `${onde * 100}%` }} aria-hidden="true">
            <strong>{t.resumo.carimbosN(numero(vista.n), vista.n === 1)}</strong>
            <span>{vista.quando}</span>
          </div>
        )}
      </div>
      <div className="eixo" aria-hidden="true">
        <span>{colunas[0]!.quando}</span>
        <span>{colunas.at(-1)!.quando}</span>
      </div>
      <p className="so-leitor" aria-live="polite">
        {vista ? `${vista.quando}: ${t.resumo.carimbosN(numero(vista.n), vista.n === 1)}` : ''}
      </p>
      {/* Numa div: uma tabela não encolhe a 1 px (ignora a altura) e esticava a página para baixo. */}
      <div className="so-leitor">
        <table>
          <caption>{t.resumo.tabela}</caption>
          <tbody>
            {colunas.map((c) => (
              <tr key={c.chave}>
                <th scope="row">{c.quando}</th>
                <td>{c.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ——— quem carimbou, e onde ———

/** As duas primeiras letras do nome («Renato Valente» → «RV»). */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** Uma lista do maior para o menor: o nome e o número numa linha, a barra fina por baixo. */
function Ordem({
  linhas,
}: {
  linhas: { chave: string | number; nome: string; detalhe?: ReactNode; n: number; pessoa?: boolean }[];
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <ul className="ordem">
      {linhas.map((l) => (
        <li key={l.chave}>
          {l.pessoa && (
            <span className="iniciais" aria-hidden="true">
              {iniciais(l.nome)}
            </span>
          )}
          <div className="meio">
            <div className="cima">
              <span className="nome">{l.nome}</span>
              <strong className="valor">{numero(l.n)}</strong>
            </div>
            {l.detalhe && <div className="detalhe">{l.detalhe}</div>}
            <div className="pista" aria-hidden="true">
              <div className="cheio" style={{ width: `${(l.n / maior) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * O que o Nuno quer saber, e só isso (o Renato, 8 nov: «ele quer saber muito pouca coisa»): o que
 * falta fazer, os carimbos ao longo do período, as recompensas, os clientes novos, quem carimbou e
 * onde. Os números da app (aberturas, toques em «Marcar», parceiros vistos) ficam de fora.
 */
export function Resumo() {
  const t = useTextos();
  const lingua = useLingua();
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const hoje = diaEmLisboa();
  const de = somarDias(hoje, -(periodo - 1));
  const { data: m, isPlaceholderData } = useQuery({
    queryKey: ['metricas', de, hoje, lojaId],
    queryFn: () =>
      pedir<Metricas>(`/api/bo/metricas?de=${de}&ate=${hoje}${lojaId ? `&lojaId=${lojaId}` : ''}`),
    placeholderData: keepPreviousData,
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const lojas = barbearia.data?.lojas ?? [];
  const quem = m ? m.porPessoa.filter((p) => p.n > 0 || p.recompensas > 0) : [];
  const porCasa = !lojaId && m && m.porLoja.length > 1 ? m.porLoja : [];

  return (
    <>
      <div className="cabecalho">
        <h1>{t.geral.seccoes.resumo}</h1>
      </div>

      <PorFazer />

      <div className="filtros">
        <Segmentado<Periodo>
          rotulo={t.resumo.periodo}
          valor={periodo}
          mudar={setPeriodo}
          opcoes={[
            { valor: 7, nome: t.resumo.dias(7) },
            { valor: 30, nome: t.resumo.dias(30) },
            { valor: 90, nome: t.resumo.dias(90) },
            { valor: 365, nome: t.resumo.meses(12) },
          ]}
        />
        {lojas.length > 1 && (
          <select
            className="entrada"
            style={{ maxWidth: 280 }}
            aria-label={t.resumo.casa}
            value={lojaId ?? ''}
            onChange={(e) => setLojaId(Number(e.target.value) || null)}
          >
            <option value="">{t.resumo.todasAsCasas}</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {!m ? (
        <Esqueleto linhas={4} />
      ) : (
        // Ao mudar de período, o de antes fica a meia-luz até chegar o novo (sem saltar).
        <div className={isPlaceholderData ? 'painel-resumo a-actualizar' : 'painel-resumo'}>
          <section className="cartao numero heroi">
            <div className="rotulo">
              {t.resumo.carimbos}
              <span className="intervalo">
                {t.resumo.intervalo(dataCurta(m.de, hoje, lingua), dataCurta(m.ate, hoje, lingua))}
              </span>
            </div>
            <div className="valor">{numero(m.totais.carimbos)}</div>
            <div className="nota">
              <Variacao actual={m.totais.carimbos} anterior={m.totais.carimbosAnterior} />
            </div>
            {m.totais.carimbos > 0 && (
              <GraficoDosCarimbos
                colunas={colunasDoPeriodo(m, lingua, t.resumo.semanaDe)}
                total={m.totais.carimbos}
              />
            )}
          </section>

          <div className="grelha duas">
            <Numero
              rotulo={t.resumo.recompensasGanhas}
              valor={m.totais.recompensasGanhas}
              nota={[
                t.resumo.entregues(m.totais.recompensasUsadas),
                m.totais.recompensasPorUsar > 0 && t.resumo.porEntregar(m.totais.recompensasPorUsar),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <Numero
              rotulo={t.resumo.clientesNovos}
              valor={m.totais.clientesNovos}
              nota={
                <Variacao
                  actual={m.totais.clientesNovos}
                  anterior={m.totais.clientesNovosAnterior}
                />
              }
            />
          </div>

          {(quem.length > 0 || porCasa.length > 0) && (
            <div className={quem.length > 0 && porCasa.length > 0 ? 'grelha duas' : undefined}>
              {quem.length > 0 && (
                <section className="cartao lista-do-resumo" aria-labelledby="quem-carimbou">
                  <h2 id="quem-carimbou">{t.resumo.quemCarimbou}</h2>
                  <Ordem
                    linhas={quem.map((p) => ({
                      chave: p.id,
                      nome: p.nome,
                      pessoa: true,
                      detalhe:
                        [p.loja, p.recompensas > 0 && t.resumo.entregou(p.recompensas)]
                          .filter(Boolean)
                          .join(' · ') || undefined,
                      n: p.n,
                    }))}
                  />
                </section>
              )}
              {porCasa.length > 0 && (
                <section className="cartao lista-do-resumo" aria-labelledby="por-casa">
                  <h2 id="por-casa">{t.resumo.porCasa}</h2>
                  <Ordem linhas={porCasa.map((l) => ({ chave: l.id, nome: l.nome, n: l.n }))} />
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
