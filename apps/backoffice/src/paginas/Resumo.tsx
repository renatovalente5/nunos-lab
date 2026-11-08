import {
  dataCurta,
  diaEmLisboa,
  somarDias,
  type DefinicoesDaBarbearia,
  type Metricas,
} from '@nunos-lab/dominio';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { pedir } from '../api';
import { useLingua } from '../lingua';
import { Esqueleto, Numero, Segmentado, Vazio } from '../pecas';
import { useTextos } from '../textos';
import { numero } from '../util';

type Periodo = 7 | 30 | 90 | 365;

/** «▲ 12 %» a verde, «▼ 8 %» a vermelho, ou «igual», contra o período anterior. */
function Variacao({ actual, anterior }: { actual: number; anterior: number }) {
  const t = useTextos();
  if (actual === anterior) return <span>{t.resumo.igualAoAnterior}</span>;
  if (anterior === 0) return <span className="sobe">▲ {t.resumo.antesZero}</span>;
  const p = Math.round(((actual - anterior) / anterior) * 100);
  return (
    <span className={p > 0 ? 'sobe' : 'desce'}>
      {p > 0 ? '▲' : '▼'} {t.resumo.percentagem(numero(Math.abs(p)))} {t.resumo.vsAnterior}
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

/**
 * O que o Nuno quer saber, e só isso (o Renato, 8 nov: «ele quer saber muito pouca coisa»): os
 * carimbos, as recompensas ganhas, os clientes novos e quem carimbou, num período e numa casa. Os
 * números da app (aberturas, toques em «Marcar», parceiros vistos) e as métricas a fundo saíram.
 */
export function Resumo() {
  const t = useTextos();
  const lingua = useLingua();
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const hoje = diaEmLisboa();
  const de = somarDias(hoje, -(periodo - 1));
  const { data: m } = useQuery({
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

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.resumo}</h1>
          <p className="subtitulo">
            {m
              ? t.resumo.intervalo(dataCurta(m.de, hoje, lingua), dataCurta(m.ate, hoje, lingua))
              : ' '}
          </p>
        </div>
      </div>

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
        <>
          <div className="grelha tres essencial">
            <Numero
              rotulo={t.resumo.carimbos}
              valor={m.totais.carimbos}
              nota={<Variacao actual={m.totais.carimbos} anterior={m.totais.carimbosAnterior} />}
            />
            <Numero
              rotulo={t.resumo.recompensasGanhas}
              valor={m.totais.recompensasGanhas}
              nota={t.resumo.entregues(m.totais.recompensasUsadas)}
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

          <h2 className="seccao">{t.resumo.quemCarimbou}</h2>
          <div className="cartao">
            {quem.length ? (
              <Barras
                linhas={quem.map((p) => ({
                  chave: p.id,
                  nome: p.nome,
                  detalhe: [
                    p.loja ?? t.resumo.todasAsCasas,
                    p.recompensas > 0 && t.resumo.entregou(p.recompensas),
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  n: p.n,
                }))}
              />
            ) : (
              <Vazio titulo={t.resumo.semCarimbos} />
            )}
          </div>

          {!lojaId && m.porLoja.length > 1 && (
            <>
              <h2 className="seccao">{t.resumo.porCasa}</h2>
              <div className="cartao">
                <Barras linhas={m.porLoja.map((l) => ({ chave: l.id, nome: l.nome, n: l.n }))} />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
