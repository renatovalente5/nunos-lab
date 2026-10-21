import type { EntradaDoRegisto } from '@nunos-lab/dominio';
import { useInfiniteQuery } from '@tanstack/react-query';
import { pedir } from '../api';
import { Esqueleto, Vazio } from '../pecas';
import { ACCOES, haQuanto } from '../util';

export function Registo() {
  const q = useInfiniteQuery({
    queryKey: ['registo'],
    queryFn: ({ pageParam }) =>
      pedir<EntradaDoRegisto[]>(`/api/bo/registo${pageParam ? `?antes=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (ultima) =>
      ultima.length === 50 ? ultima[ultima.length - 1]!.id : undefined,
  });
  const entradas = q.data?.pages.flat() ?? [];
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Registo</h1>
          <p className="subtitulo">Quem mudou o quê, do mais recente para trás.</p>
        </div>
      </div>
      {!q.data ? (
        <Esqueleto />
      ) : !entradas.length ? (
        <div className="cartao">
          <Vazio titulo="Ainda nada no registo" />
        </div>
      ) : (
        <div className="cartao">
          <ul className="lista">
            {entradas.map((e) => (
              <li key={e.id}>
                <div className="linha">
                  <div className="meio">
                    <strong>{e.quem ?? 'Instalação'}</strong> {ACCOES[e.accao] ?? e.accao}{' '}
                    {e.alvo && <em style={{ fontStyle: 'normal', fontWeight: 700 }}>{e.alvo}</em>}
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
