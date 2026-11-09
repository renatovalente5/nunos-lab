import {
  aHora,
  estadoDoHorario,
  nomeDoDiaDoHorario,
  semPartir,
  type HorarioDaSemana,
} from '@nunos-lab/dominio';
import { cor, Grupo, Icone, letra, T, useLingua } from '@nunos-lab/ui';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useTextos } from '../textos';

/** Agora, de meio em meio minuto e logo ao voltar à app: «Aberto» passa a «Fechado» na página. */
function useAgora(): number {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    const tic = setInterval(() => setAgora(Date.now()), 30_000);
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setAgora(Date.now());
    });
    return () => {
      clearInterval(tic);
      ouvinte.remove();
    };
  }, []);
  return agora;
}

/**
 * O horário na página do parceiro: em cima, aberto ou fechado agora, pela hora de Lisboa (o Renato,
 * 9 nov 2026); por baixo, os dias e as horas. Sem o horário por dias (os dados de antes), só o texto.
 */
export function HorarioDoParceiro({
  texto,
  semana,
}: {
  texto: string;
  semana: HorarioDaSemana | null;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const agora = useAgora();
  const estado = semana ? estadoDoHorario(semana, agora) : null;
  const linha = !estado
    ? null
    : estado.tipo === 'aberto'
      ? {
          palavra: t.parceiro.aberto,
          cor: cor.aberto,
          resto: t.parceiro.fechaAs(aHora(estado.fecha, lingua)),
        }
      : estado.tipo === 'feriado'
        ? { palavra: t.parceiro.feriado, cor: cor.atencao, resto: t.parceiro.podeEstarFechado }
        : {
            palavra: t.parceiro.fechado,
            cor: cor.perigo,
            resto: !estado.abre
              ? null
              : estado.abre.daquiA === 0
                ? t.parceiro.abreAs(aHora(estado.abre.hora, lingua))
                : estado.abre.daquiA === 1
                  ? t.parceiro.abreAmanha(aHora(estado.abre.hora, lingua))
                  : t.parceiro.abreNoDia(
                      nomeDoDiaDoHorario(estado.abre.dia, lingua),
                      aHora(estado.abre.hora, lingua),
                    ),
          };
  return (
    <Grupo style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start' }}>
        <Icone nome="relogio" tamanho={20} cor={cor.texto2} />
        <View style={{ flex: 1, gap: 2 }}>
          {linha && (
            <T v="corpo" style={{ color: cor.texto2 }}>
              <T v="corpo" style={{ color: linha.cor, fontFamily: letra.forte }}>
                {linha.palavra}
              </T>
              {linha.resto ? ` · ${linha.resto}` : ''}
            </T>
          )}
          <T v="corpo">{semPartir(texto)}</T>
        </View>
      </View>
    </Grupo>
  );
}
