import {
  dataCurta,
  diaEmLisboa,
  somarDias,
  type EntradaDoRegisto,
  type Lingua,
} from '@nunos-lab/dominio';
import { useInfiniteQuery } from '@tanstack/react-query';
import { pedir } from '../api';
import { etiquetaDaLingua, useLingua } from '../lingua';
import { Esqueleto, Gaveta, Vazio } from '../pecas';
import { useTextos, type Textos } from '../textos';
import { accao, alvoDoRegisto, haQuanto } from '../util';

/**
 * «Hoje», «Ontem», ou o dia («20 out»), em Lisboa e na língua de agora, para separar o histórico
 * por dias.
 */
function diaDe(segundos: number, hoje: string, t: Textos, lingua: Lingua): string {
  const dia = diaEmLisboa(segundos * 1000);
  if (dia === hoje) return t.historico.hoje;
  if (dia === somarDias(hoje, -1)) return t.historico.ontem;
  return dataCurta(dia, hoje, lingua);
}

export function Historico() {
  const t = useTextos();
  const lingua = useLingua();
  const q = useInfiniteQuery({
    queryKey: ['registo'],
    queryFn: ({ pageParam }) =>
      pedir<EntradaDoRegisto[]>(`/api/bo/registo${pageParam ? `?antes=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (ultima) =>
      ultima.length === 50 ? ultima[ultima.length - 1]!.id : undefined,
  });
  const hoje = diaEmLisboa();
  const entradas = q.data?.pages.flat() ?? [];
  const dias: { dia: string; entradas: EntradaDoRegisto[] }[] = [];
  for (const e of entradas) {
    const dia = diaDe(e.quando, hoje, t, lingua);
    if (dias.at(-1)?.dia === dia) dias.at(-1)!.entradas.push(e);
    else dias.push({ dia, entradas: [e] });
  }
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.historico}</h1>
          <p className="subtitulo">{t.historico.subtitulo}</p>
        </div>
      </div>
      {!q.data ? (
        <Esqueleto />
      ) : !entradas.length ? (
        <div className="cartao">
          <Vazio titulo={t.historico.vazio} />
        </div>
      ) : (
        <div className="gavetas">
          {dias.map(({ dia, entradas: doDia }, i) => (
            // Cada dia numa gaveta: o mais recente aberto, os outros com quantas alterações e quem.
            <Gaveta
              key={dia}
              titulo={dia}
              resumo={[
                t.historico.alteracoes(doDia.length),
                [...new Set(doDia.map((e) => e.quem ?? t.historico.instalacao))].join(', '),
              ].join(' · ')}
              abertaDeInicio={i === 0}
              lista
            >
              <ul className="lista">
                {doDia.map((e) => (
                  <li key={e.id}>
                    <div className="linha">
                      <div className="meio">
                        <strong>{e.quem ?? t.historico.instalacao}</strong>{' '}
                        {accao(e.accao) ?? e.accao}{' '}
                        {e.alvo && (
                          <span style={{ fontWeight: 700 }}>{alvoDoRegisto(e.accao, e.alvo)}</span>
                        )}
                      </div>
                      <span
                        className="detalhe"
                        style={{ whiteSpace: 'nowrap' }}
                        title={new Date(e.quando * 1000).toLocaleString(etiquetaDaLingua(), {
                          timeZone: 'Europe/Lisbon',
                        })}
                      >
                        {haQuanto(e.quando)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Gaveta>
          ))}
        </div>
      )}
      {q.hasNextPage && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="botao secundario"
            disabled={q.isFetchingNextPage}
            onClick={() => q.fetchNextPage()}
          >
            {t.historico.verMaisAntigos}
          </button>
        </div>
      )}
    </>
  );
}
