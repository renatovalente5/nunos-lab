import {
  diaEmLisboa,
  euros,
  recompensaNaLingua,
  type AcontecimentoDaPessoa,
  type HistoricoDaPessoa,
  type Lingua,
} from '@nunos-lab/dominio';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { mensagemDe, pedir } from '../api';
import { DiasDoHistorico, NomeDeCliente, diaDe, horaDe, type Acontecimento } from '../historico';
import { useLingua } from '../lingua';
import { Esqueleto, Etiqueta, Gaveta, Icone, Vazio } from '../pecas';
import { useTextos, type Textos } from '../textos';
import { numero } from '../util';
import { FolhaDaPessoa, useEquipa } from './Equipa';

/** Uma coisa que a pessoa fez, no desenho do histórico (o mesmo da ficha do cliente). */
function acontecimento(
  a: AcontecimentoDaPessoa,
  t: Textos,
  lingua: Lingua,
  hoje: string,
): Acontecimento {
  const p = t.equipa.pessoa;
  const h = t.cliente.historico;
  const comCliente = (antes: string) => (
    <>
      {antes}
      <NomeDeCliente
        id={a.cliente?.id}
        nome={a.cliente?.nome ?? null}
        apagado={a.cliente?.apagado}
      />
    </>
  );
  const recompensa =
    a.recompensa === null
      ? ''
      : lingua === 'en' && a.recompensaEn
        ? a.recompensaEn
        : a.tipo === 'premio'
          ? recompensaNaLingua(a.recompensa, lingua)
          : a.recompensa;
  const base = {
    chave: `${a.tipo}-${a.id}`,
    quando: a.quando,
    ordem: 0,
    onde: [a.loja],
    anulado: a.anulado ?? undefined,
  };
  switch (a.tipo) {
    case 'carimbo':
      return {
        ...base,
        titulo: comCliente(p.carimbo),
        semLeitura: a.semLeitura,
        repetido: a.repetido,
      };
    case 'uso':
      return {
        ...base,
        titulo: comCliente(p.usou),
        semLeitura: a.semLeitura,
        valor: a.valor ?? undefined,
      };
    case 'premio':
      return { ...base, titulo: comCliente(p.premio(recompensa)) };
    case 'meio':
      return { ...base, titulo: comCliente(p.meio(recompensa)) };
    case 'anulou-carimbo':
    case 'anulou-uso': {
      // De quem era e quando: «de Bruno Costa às 10:28» (no mesmo dia), «… a 10 nov» (noutro).
      const de =
        a.de &&
        p.de(
          a.de.pessoa,
          diaEmLisboa(a.de.quando * 1000) === diaEmLisboa(a.quando * 1000)
            ? h.aHora(horaDe(a.de.quando))
            : h.aDia(diaDe(a.de.quando, hoje, lingua)),
        );
      return {
        ...base,
        titulo: comCliente(
          a.tipo === 'anulou-carimbo'
            ? p.anulouCarimbo
            : p.anulouUso(euros(-(a.valor ?? 0), lingua)),
        ),
        onde: [a.loja, de],
      };
    }
  }
}

/**
 * A página de uma pessoa da equipa (o Renato, 11 nov 2026): os números dos últimos 30 dias (os carimbos,
 * o saldo que usou, o que lhe anularam, o que fez sem ler o cartão) e o histórico de tudo o que fez, por
 * dias, com cada cliente a abrir a ficha dele. O «Editar» abre a mesma folha da Equipa.
 */
export function Pessoa({ id }: { id: string }) {
  const t = useTextos();
  const lingua = useLingua();
  const equipa = useEquipa();
  const [aEditar, setAEditar] = useState(false);
  const historico = useInfiniteQuery({
    queryKey: ['equipa', id, 'historico'],
    queryFn: ({ pageParam }) =>
      pedir<HistoricoDaPessoa>(
        `/api/bo/equipa/${id}/historico${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (ultima) => ultima.seguinte ?? undefined,
  });
  const hoje = diaEmLisboa();
  const p = t.equipa.pessoa;
  const voltar = (
    <a className="voltar" href="#/equipa">
      <Icone nome="voltar" tamanho={16} /> {t.geral.seccoes.equipa}
    </a>
  );
  const pessoa = equipa.data?.find((x) => String(x.id) === id);
  if (equipa.data && !pessoa)
    return (
      <>
        {voltar}
        <div className="cartao">
          <Vazio titulo={p.naoEsta} />
        </div>
      </>
    );
  if (!pessoa)
    return (
      <>
        {voltar}
        <Esqueleto linhas={6} />
      </>
    );
  const paginas = historico.data?.pages ?? [];
  const numeros = paginas[0]?.numeros ?? null;
  const lista = paginas
    .flatMap((x) => x.acontecimentos)
    .map((a) => acontecimento(a, t, lingua, hoje));
  const valor = (n: number | undefined) => (numeros && n !== undefined ? numero(n) : '—');

  return (
    <>
      {voltar}
      <div className="cabecalho">
        <div>
          <h1>{pessoa.nome}</h1>
          <p className="subtitulo">
            {[
              t.equipa.papeis[pessoa.papel],
              pessoa.papel === 'barbeiro' && (pessoa.loja ?? t.equipa.todasAsCasas),
            ]
              .filter(Boolean)
              .join(' · ')}
            {!pessoa.activo && (
              <>
                {' '}
                <Etiqueta semPonto>{t.equipa.desligado}</Etiqueta>
              </>
            )}
          </p>
        </div>
        <button type="button" className="botao secundario" onClick={() => setAEditar(true)}>
          {t.equipa.editar}
        </button>
      </div>

      <div className="cartao recheado">
        <div className="titulo-do-cartao">{p.ultimos30}</div>
        <dl className="detalhes quatro">
          <div>
            <dt>{p.carimbos}</dt>
            <dd>{valor(numeros?.carimbos)}</dd>
          </div>
          <div>
            <dt>{p.saldoUsado}</dt>
            <dd>{numeros ? euros(numeros.saldoUsado, lingua) : '—'}</dd>
          </div>
          <div>
            <dt>{p.anulados}</dt>
            <dd>{valor(numeros?.anulados)}</dd>
          </div>
          <div>
            <dt>{p.semLeitura}</dt>
            <dd>{valor(numeros?.semLeitura)}</dd>
          </div>
        </dl>
      </div>

      <div className="gavetas" style={{ marginTop: 28 }}>
        <Gaveta
          id="pessoa.historico"
          titulo={p.historico}
          resumo={
            historico.data &&
            (lista.length ? p.resumo(diaDe(lista[0]!.quando, hoje, lingua)) : p.vazio)
          }
          abertaDeInicio
          lista
        >
          {historico.error ? (
            <Vazio titulo={mensagemDe(historico.error)} />
          ) : !historico.data ? (
            <Esqueleto linhas={4} />
          ) : lista.length ? (
            <>
              <DiasDoHistorico acontecimentos={lista} />
              {historico.hasNextPage && (
                <div className="pe-gaveta">
                  <button
                    type="button"
                    className="botao secundario"
                    disabled={historico.isFetchingNextPage}
                    onClick={() => historico.fetchNextPage()}
                  >
                    {p.verMais}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Vazio titulo={p.vazio} />
          )}
        </Gaveta>
      </div>

      {aEditar && <FolhaDaPessoa pessoa={pessoa} fechar={() => setAEditar(false)} />}
    </>
  );
}
