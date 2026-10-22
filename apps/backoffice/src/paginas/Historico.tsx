import type { EntradaDoRegisto } from '@nunos-lab/dominio';
import { useInfiniteQuery } from '@tanstack/react-query';
import { pedir } from '../api';
import { Esqueleto, Vazio } from '../pecas';
import { ACCOES, haQuanto } from '../util';

/** «Hoje», «Ontem», ou o dia («20 out»), para separar o histórico por dias. */
function diaDe(segundos: number): string {
  const d = new Date(segundos * 1000);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

export function Historico() {
  const q = useInfiniteQuery({
    queryKey: ['registo'],
    queryFn: ({ pageParam }) =>
      pedir<EntradaDoRegisto[]>(`/api/bo/registo${pageParam ? `?antes=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (ultima) =>
      ultima.length === 50 ? ultima[ultima.length - 1]!.id : undefined,
  });
  const entradas = q.data?.pages.flat() ?? [];
  const dias: { dia: string; entradas: EntradaDoRegisto[] }[] = [];
  for (const e of entradas) {
    const dia = diaDe(e.quando);
    if (dias.at(-1)?.dia === dia) dias.at(-1)!.entradas.push(e);
    else dias.push({ dia, entradas: [e] });
  }
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Histórico</h1>
          <p className="subtitulo">Quem mudou o quê, do mais recente para trás.</p>
        </div>
      </div>
      {!q.data ? (
        <Esqueleto />
      ) : !entradas.length ? (
        <div className="cartao">
          <Vazio titulo="Ainda nada no histórico" />
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
                        <strong>{e.quem ?? 'Instalação'}</strong> {ACCOES[e.accao] ?? e.accao}{' '}
                        {e.alvo && <span style={{ fontWeight: 700 }}>{e.alvo}</span>}
                      </div>
                      <span
                        className="detalhe"
                        style={{ whiteSpace: 'nowrap' }}
                        title={new Date(e.quando * 1000).toLocaleString('pt-PT')}
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
            Ver mais antigos
          </button>
        </div>
      )}
    </>
  );
}
