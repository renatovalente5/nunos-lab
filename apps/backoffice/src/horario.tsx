import {
  DIAS_CURTOS,
  DIAS_DO_HORARIO,
  eHora,
  eHorarioValido,
  horaDosMinutos,
  minutosDe,
  nomeDoDiaDoHorario,
  textoDoHorario,
  type DiasComHoras,
  type Hora,
  type HorarioDaSemana,
  type Intervalo,
} from '@nunos-lab/dominio';
import { useId } from 'react';
import { useLingua } from './lingua';
import { Icone } from './pecas';
import { useTextos } from './textos';

/**
 * As horas que se escolhem, de 15 em 15 minutos e sempre em 24 h: o campo de horas do browser segue
 * o relógio do computador e, num Mac em inglês, aparecia «09:00 AM» (visto a 9 nov).
 */
const HORAS_DO_DIA = Array.from({ length: 96 }, (_, i) => horaDosMinutos(i * 15));

/** O primeiro horário de um parceiro, para se mudar: de segunda a sexta, das 9h às 19h. */
const PRIMEIRO: DiasComHoras = { dias: [1, 2, 3, 4, 5], horas: [['09:00', '19:00']] };

/** A pausa do almoço, das 13h às 14h, se couber; senão, um segundo intervalo por preencher. */
function comPausa([abre, fecha]: Intervalo): Intervalo[] {
  if (eHora(abre) && eHora(fecha) && minutosDe(abre) < 13 * 60 && minutosDe(fecha) > 14 * 60)
    return [
      [abre, '13:00'],
      ['14:00', fecha],
    ];
  return [
    [abre, fecha],
    ['', ''],
  ];
}

/**
 * O horário de um parceiro (o Renato, 9 nov 2026): em cada grupo, os dias em botões e as horas,
 * com a pausa do almoço; outros dias com outras horas são outro grupo. Por baixo, o texto que vai
 * para a app, escrito disto (igual em todos os parceiros e já em inglês).
 */
export function CampoDoHorario({
  valor,
  mudar,
  antigo,
  erro,
}: {
  valor: HorarioDaSemana | null;
  mudar: (v: HorarioDaSemana | null) => void;
  /** O texto livre de antes, enquanto não houver dias e horas. */
  antigo?: string;
  erro?: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const id = useId();
  const grupos = valor ?? [];
  const livre = DIAS_DO_HORARIO.find((d) => !grupos.some((g) => g.dias.includes(d)));
  const mudarGrupo = (i: number, g: DiasComHoras) => mudar(grupos.map((x, j) => (j === i ? g : x)));
  const tirarGrupo = (i: number) => {
    const resto = grupos.filter((_, j) => j !== i);
    mudar(resto.length ? resto : null);
  };
  return (
    <div
      className={`campo campo-do-horario${erro ? ' erro' : ''}`}
      role="group"
      aria-labelledby={`${id}-r`}
      aria-describedby={erro ? `${id}-e` : undefined}
    >
      <span className="rotulo-campo" id={`${id}-r`}>
        {t.parceiro.horario}
      </span>
      {grupos.map((g, i) => (
        <GrupoDoHorario
          key={i}
          grupo={g}
          mudar={(novo) => mudarGrupo(i, novo)}
          tirar={() => tirarGrupo(i)}
          noutros={new Set(grupos.flatMap((x, j) => (j === i ? [] : x.dias)))}
        />
      ))}
      {!grupos.length ? (
        <>
          {antigo && <div className="ajuda">{t.parceiro.horarioAntigo(antigo)}</div>}
          <button
            type="button"
            className="botao secundario pequeno"
            onClick={() => mudar([PRIMEIRO])}
          >
            <Icone nome="mais" tamanho={16} /> {t.parceiro.porHorario}
          </button>
        </>
      ) : (
        livre !== undefined && (
          <button
            type="button"
            className="botao secundario pequeno"
            // Os dias que faltam começam no primeiro livre (o sábado de quem abre à semana), com
            // as horas do grupo de cima, para se mudarem.
            onClick={() =>
              mudar([
                ...grupos,
                {
                  dias: [livre],
                  horas: (grupos.at(-1)?.horas ?? PRIMEIRO.horas).map(([a, b]): Intervalo => [
                    a,
                    b,
                  ]),
                },
              ])
            }
          >
            <Icone nome="mais" tamanho={16} /> {t.parceiro.outrosDias}
          </button>
        )
      )}
      {erro ? (
        <div className="mensagem-erro" id={`${id}-e`}>
          {t.parceiro.razoes.horario}
        </div>
      ) : (
        eHorarioValido(grupos) && (
          <div className="ajuda previsao-do-horario">
            {t.parceiro.naApp}: <b>{textoDoHorario(grupos, lingua)}</b>
          </div>
        )
      )}
    </div>
  );
}

/** Um grupo de dias: os dias em botões e as horas, com ou sem a pausa. */
function GrupoDoHorario({
  grupo,
  mudar,
  tirar,
  noutros,
}: {
  grupo: DiasComHoras;
  mudar: (g: DiasComHoras) => void;
  tirar: () => void;
  /** Os dias que já estão noutro grupo: aqui não se escolhem. */
  noutros: Set<number>;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const [manha = ['', ''], tarde] = grupo.horas;
  const horas = (h: Intervalo[]) => mudar({ ...grupo, horas: h });
  return (
    <div className="grupo-do-horario">
      <div className="dias-do-horario">
        {DIAS_DO_HORARIO.map((d) => {
          const sim = grupo.dias.includes(d);
          return (
            <button
              key={d}
              type="button"
              className="dia-do-horario"
              aria-pressed={sim}
              aria-label={nomeDoDiaDoHorario(d, lingua)}
              disabled={!sim && noutros.has(d)}
              onClick={() =>
                mudar({
                  ...grupo,
                  dias: sim
                    ? grupo.dias.filter((x) => x !== d)
                    : [...grupo.dias, d].sort((a, b) => a - b),
                })
              }
            >
              {DIAS_CURTOS[lingua][d - 1]}
            </button>
          );
        })}
      </div>
      <div className="horas-do-horario">
        <IntervaloDoHorario
          valor={manha}
          mudar={(v) => horas(tarde ? [v, tarde] : [v])}
          rotulos={[t.parceiro.abre, t.parceiro.fecha]}
        />
        {tarde ? (
          // Depois da pausa, junto com o «e» e o botão de a tirar: se não couber, passa tudo
          // para a linha de baixo.
          <span className="depois-da-pausa">
            <span className="e-do-horario">{t.parceiro.e}</span>
            <IntervaloDoHorario
              valor={tarde}
              mudar={(v) => horas([manha, v])}
              rotulos={[t.parceiro.abreDepois, t.parceiro.fechaDepois]}
            />
            <button
              type="button"
              className="tirar-pausa"
              aria-label={t.parceiro.tirarPausa}
              title={t.parceiro.tirarPausa}
              onClick={() => horas([[manha[0], tarde[1]]])}
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="botao secundario pequeno"
            onClick={() => horas(comPausa(manha))}
          >
            <Icone nome="mais" tamanho={16} /> {t.parceiro.pausa}
          </button>
        )}
        <button
          type="button"
          className="botao secundario pequeno tirar-dias"
          aria-label={t.parceiro.tirarDias}
          onClick={tirar}
        >
          {t.parceiro.tirar}
        </button>
      </div>
    </div>
  );
}

/** Abre e fecha. */
function IntervaloDoHorario({
  valor: [abre, fecha],
  mudar,
  rotulos,
}: {
  valor: Intervalo;
  mudar: (v: Intervalo) => void;
  rotulos: [string, string];
}) {
  return (
    <span className="intervalo-do-horario">
      <EscolhaDaHora valor={abre} mudar={(h) => mudar([h, fecha])} rotulo={rotulos[0]} />
      <span aria-hidden="true">–</span>
      <EscolhaDaHora valor={fecha} mudar={(h) => mudar([abre, h])} rotulo={rotulos[1]} />
    </span>
  );
}

/** Uma hora: «09:00» a «23:45» (no iPhone, a roda). Uma hora de fora da lista, guardada antes, fica. */
function EscolhaDaHora({
  valor,
  mudar,
  rotulo,
}: {
  valor: Hora;
  mudar: (h: Hora) => void;
  rotulo: string;
}) {
  const horas =
    !valor || HORAS_DO_DIA.includes(valor) ? HORAS_DO_DIA : [...HORAS_DO_DIA, valor].sort();
  return (
    <select
      className="entrada hora-do-horario"
      value={valor}
      required
      aria-label={rotulo}
      onChange={(e) => mudar(e.target.value)}
    >
      {!valor && <option value="">--:--</option>}
      {horas.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
