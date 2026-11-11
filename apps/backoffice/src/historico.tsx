/**
 * O histórico por dias (o Renato, 11 nov 2026): o mesmo desenho na ficha de um cliente (tudo o que lhe
 * aconteceu) e na página de uma pessoa da equipa (tudo o que ela fez). Cada linha com a hora, onde e quem,
 * «Sem leitura» e «Repetido», o dinheiro à direita, e o que foi anulado riscado, com quem o anulou e quando.
 */
import { dataCurta, diaEmLisboa, eurosComSinal, somarDias, type Lingua } from '@nunos-lab/dominio';
import type { ReactNode } from 'react';
import { etiquetaDaLingua, useLingua } from './lingua';
import { Etiqueta } from './pecas';
import { useTextos } from './textos';

/** «12 out» («12 Oct») de um instante. */
export function diaDe(segundos: number, hoje: string, lingua: Lingua): string {
  return dataCurta(diaEmLisboa(segundos * 1000), hoje, lingua);
}

/** «15:30» de um instante, em Lisboa. */
export function horaDe(segundos: number): string {
  return new Date(segundos * 1000).toLocaleTimeString(etiquetaDaLingua(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  });
}

/**
 * O nome de um cliente, a abrir a ficha dele; «Conta apagada» se já a apagou (a ficha continua, com o
 * que lá ficou).
 */
export function NomeDeCliente({
  id,
  nome,
  apagado,
}: {
  id: number | null | undefined;
  nome: string | null;
  apagado?: boolean;
}) {
  const t = useTextos();
  const texto = apagado ? t.cliente.contaApagada : nome || t.cliente.semNome;
  return id ? (
    <a className="ligacao-nome" href={`#/clientes/${id}`}>
      {texto}
    </a>
  ) : (
    <>{texto}</>
  );
}

/** Uma linha do histórico. */
export type Acontecimento = {
  chave: string;
  quando: number;
  /**
   * A sequência no mesmo segundo (a lista vai do mais recente): aceitar (0), as boas-vindas (1), o
   * carimbo (2), o que ele dá — o prémio do convite e o do cartão (3) —, e o uso e o acerto (4).
   */
  ordem: number;
  titulo: ReactNode;
  /** Onde e quem, a seguir à hora. */
  onde?: (string | null | undefined)[];
  semLeitura?: boolean;
  repetido?: boolean;
  /** Quando e quem anulou (null: o backoffice; o quando falta nas respostas de antes). */
  anulado?: { em: number | null; por: string | null };
  /** Em cêntimos, nas linhas do dinheiro. */
  valor?: number;
  /** Um botão no fim da linha (o «Anular» de um carimbo). */
  accao?: ReactNode;
};

/** Os acontecimentos já ordenados, do mais recente, separados por dias («Hoje», «Ontem», «12 nov»). */
export function DiasDoHistorico({ acontecimentos }: { acontecimentos: Acontecimento[] }) {
  const t = useTextos();
  const lingua = useLingua();
  const hoje = diaEmLisboa();
  const h = t.cliente.historico;
  const dias: { dia: string; lista: Acontecimento[] }[] = [];
  for (const a of acontecimentos) {
    const dia = diaEmLisboa(a.quando * 1000);
    if (dias.at(-1)?.dia === dia) dias.at(-1)!.lista.push(a);
    else dias.push({ dia, lista: [a] });
  }
  const nomeDoDia = (dia: string) =>
    dia === hoje
      ? t.historico.hoje
      : dia === somarDias(hoje, -1)
        ? t.historico.ontem
        : dataCurta(dia, hoje, lingua);
  // «às 14:05» no mesmo dia do que se anulou; «a 13 nov» noutro.
  const quandoAnulou = (a: Acontecimento, em: number) =>
    diaEmLisboa(em * 1000) === diaEmLisboa(a.quando * 1000)
      ? h.aHora(horaDe(em))
      : h.aDia(diaDe(em, hoje, lingua));
  return (
    <>
      {dias.map(({ dia, lista }) => (
        <section key={dia} className="seccao-da-gaveta dia-do-historico">
          <h3>{nomeDoDia(dia)}</h3>
          <ul className="lista">
            {lista.map((a) => (
              <li key={a.chave}>
                <div className={`linha${a.anulado ? ' anulada' : ''}`}>
                  <div className="meio">
                    <div className="titulo-linha">{a.titulo}</div>
                    <div className="detalhe">
                      {[horaDe(a.quando), ...(a.onde ?? [])].filter(Boolean).join(' · ')}
                    </div>
                    {a.anulado && (
                      <div className="detalhe quem-anulou">
                        {a.anulado.em === null
                          ? h.anulado(a.anulado.por)
                          : h.anuladoA(a.anulado.por, quandoAnulou(a, a.anulado.em))}
                      </div>
                    )}
                  </div>
                  <div className="lado">
                    {a.semLeitura && <Etiqueta>{h.semLeitura}</Etiqueta>}
                    {a.repetido && <Etiqueta tom="atencao">{h.repetido}</Etiqueta>}
                    {/* O dinheiro: anulado, riscado, e não conta para o saldo. */}
                    {a.valor !== undefined &&
                      (a.anulado ? (
                        <>
                          <s className="valor-do-movimento anulado">
                            {eurosComSinal(a.valor, lingua)}
                          </s>
                          <span className="so-leitor"> {t.cliente.saldo.anulado}</span>
                        </>
                      ) : (
                        <span className={`valor-do-movimento${a.valor > 0 ? ' entra' : ''}`}>
                          {eurosComSinal(a.valor, lingua)}
                        </span>
                      ))}
                    {a.accao}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
