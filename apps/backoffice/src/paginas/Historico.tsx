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
import { Esqueleto, Vazio } from '../pecas';
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
        dias.map(({ dia, entradas: doDia }, i) => (
          <section key={dia} aria-labelledby={`dia-${i}`}>
            <h2 className="seccao" id={`dia-${i}`} style={i === 0 ? { marginTop: 0 } : undefined}>
              {dia}
            </h2>
            <div className="cartao">
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
            </div>
          </section>
        ))
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
