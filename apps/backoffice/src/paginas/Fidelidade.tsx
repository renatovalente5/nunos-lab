import {
  LIMITES_DO_PROGRAMA,
  recompensaNaLingua,
  type Lingua,
  type Programa,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir } from '../api';
import { Campo, GrupoEmIngles, useAvisar } from '../pecas';
import { useTextos, type Textos } from '../textos';

/** O programa como se escreve: os números ficam em texto enquanto se editam. */
type Formulario = {
  objectivo: string;
  recompensa: string;
  porDia: string;
  aniversario: string;
  /** Em inglês: vazio, a app em inglês traduz os prémios comuns («Free haircut») ou mostra o português. */
  recompensaEn: string;
  aniversarioEn: string;
  /** O prémio a meio (vazio: não há) e o carimbo em que se ganha. */
  meioRecompensa: string;
  meio: string;
  meioRecompensaEn: string;
};

function formularioDe(p: Programa): Formulario {
  return {
    objectivo: String(p.objectivo),
    recompensa: p.recompensa,
    porDia: String(p.porDia),
    aniversario: p.aniversario,
    recompensaEn: p.recompensaEn ?? '',
    aniversarioEn: p.aniversarioEn ?? '',
    meioRecompensa: p.meioRecompensa ?? '',
    meio: String(p.meio ?? 5),
    meioRecompensaEn: p.meioRecompensaEn ?? '',
  };
}

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * O cartão de fidelidade: era uma página («Fidelidade») e passou a gaveta da Barbearia (8 nov),
 * que o guarda com o resto no mesmo «Guardar». `guardar` diz se correu bem; o «Guardado» é da página.
 */
export function usePrograma() {
  const t = useTextos();
  const programa = useQuery({
    queryKey: ['programa'],
    queryFn: () => pedir<Programa>('/api/bo/programa'),
  });
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const avisar = useAvisar();

  useEffect(() => {
    if (programa.data && !original) {
      const inicial = formularioDe(programa.data);
      setOriginal(inicial);
      setF(inicial);
    }
  }, [programa.data, original]);
  const sujo = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);

  const mudar =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) => {
      setF((x) => (x ? { ...x, [k]: v } : x));
      setErros((e) => e.filter((c) => c !== k));
    };

  async function guardar(): Promise<boolean> {
    if (!f) return false;
    const objectivo = inteiroEntre(
      f.objectivo,
      LIMITES_DO_PROGRAMA.objectivo.min,
      LIMITES_DO_PROGRAMA.objectivo.max,
    );
    const porDia = inteiroEntre(
      f.porDia,
      LIMITES_DO_PROGRAMA.porDia.min,
      LIMITES_DO_PROGRAMA.porDia.max,
    );
    // O prémio a meio fica antes do último carimbo; sem prémio, o número fica como estiver.
    const meio = inteiroEntre(
      f.meio,
      LIMITES_DO_PROGRAMA.meio.min,
      Math.min(LIMITES_DO_PROGRAMA.meio.max, (objectivo ?? LIMITES_DO_PROGRAMA.objectivo.max) - 1),
    );
    const faltam = [
      objectivo === null && 'objectivo',
      porDia === null && 'porDia',
      !f.recompensa.trim() && 'recompensa',
      f.meioRecompensa.trim() && meio === null && 'meio',
    ].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(t.fidelidade.camposPorCorrigir, true);
      return false;
    }
    const enviado = f;
    try {
      const guardado = await pedir<Programa>('/api/bo/programa', {
        metodo: 'PUT',
        corpo: {
          objectivo,
          recompensa: f.recompensa.trim(),
          porDia,
          aniversario: f.aniversario.trim(),
          recompensaEn: f.recompensaEn.trim(),
          aniversarioEn: f.aniversarioEn.trim(),
          meioRecompensa: f.meioRecompensa.trim(),
          ...(meio !== null ? { meio } : {}),
          meioRecompensaEn: f.meioRecompensaEn.trim(),
        },
      });
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      setErros([]);
      return true;
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos);
      avisar(mensagemDe(e), true);
      return false;
    }
  }

  return { f, mudar, erros, sujo, guardar };
}

export type ProgramaNoFormulario = ReturnType<typeof usePrograma>;

/** «10 carimbos · 50% de desconto», para a gaveta fechada; em inglês, o prémio em inglês. */
export function resumoDoPrograma(f: Formulario, t: Textos, lingua: Lingua): string {
  const recompensa =
    lingua === 'en'
      ? f.recompensaEn.trim() || recompensaNaLingua(f.recompensa, 'en')
      : f.recompensa.trim();
  const meio =
    lingua === 'en'
      ? f.meioRecompensaEn.trim() || f.meioRecompensa.trim()
      : f.meioRecompensa.trim();
  return [
    t.fidelidade.carimbos(Number(f.objectivo) || 0),
    recompensa,
    meio && t.fidelidade.meioNoResumo(meio, Number(f.meio) || 0),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function CamposDoPrograma({ programa }: { programa: ProgramaNoFormulario }) {
  const t = useTextos();
  const { f, mudar, erros } = programa;
  if (!f) return null;
  return (
    <div className="formulario">
      <div className="duas-colunas">
        <Campo
          rotulo={t.fidelidade.objectivo}
          tipo="number"
          modoDeTeclado="numeric"
          minimo={LIMITES_DO_PROGRAMA.objectivo.min}
          maximo={LIMITES_DO_PROGRAMA.objectivo.max}
          passo={1}
          valor={f.objectivo}
          mudar={mudar('objectivo')}
          erro={erros.includes('objectivo')}
          ajuda={t.fidelidade.objectivoAjuda}
          obrigatorio
        />
        <Campo
          rotulo={t.fidelidade.recompensa}
          valor={f.recompensa}
          mudar={mudar('recompensa')}
          max={LIMITES_DO_PROGRAMA.recompensa}
          erro={erros.includes('recompensa')}
          placeholder={t.fidelidade.recompensaExemplo}
          ajuda={t.fidelidade.recompensaAjuda}
          obrigatorio
        />
      </div>
      <div className="duas-colunas">
        <Campo
          rotulo={t.fidelidade.meioRecompensa}
          valor={f.meioRecompensa}
          mudar={mudar('meioRecompensa')}
          max={LIMITES_DO_PROGRAMA.recompensa}
          erro={erros.includes('meioRecompensa')}
          placeholder={t.fidelidade.meioRecompensaExemplo}
          ajuda={t.fidelidade.meioRecompensaAjuda}
        />
        <Campo
          rotulo={t.fidelidade.meio}
          tipo="number"
          modoDeTeclado="numeric"
          minimo={LIMITES_DO_PROGRAMA.meio.min}
          maximo={Math.max(LIMITES_DO_PROGRAMA.meio.min, (Number(f.objectivo) || 2) - 1)}
          passo={1}
          valor={f.meio}
          mudar={mudar('meio')}
          erro={erros.includes('meio')}
          ajuda={t.fidelidade.meioAjuda}
        />
      </div>
      <div className="duas-colunas">
        <Campo
          rotulo={t.fidelidade.porDia}
          tipo="number"
          modoDeTeclado="numeric"
          minimo={LIMITES_DO_PROGRAMA.porDia.min}
          maximo={LIMITES_DO_PROGRAMA.porDia.max}
          passo={1}
          valor={f.porDia}
          mudar={mudar('porDia')}
          erro={erros.includes('porDia')}
          ajuda={t.fidelidade.porDiaAjuda}
          obrigatorio
        />
        <Campo
          rotulo={t.fidelidade.aniversario}
          valor={f.aniversario}
          mudar={mudar('aniversario')}
          max={LIMITES_DO_PROGRAMA.aniversario}
          erro={erros.includes('aniversario')}
          placeholder={t.fidelidade.aniversarioExemplo}
          ajuda={t.fidelidade.aniversarioAjuda}
        />
      </div>
      <GrupoEmIngles
        pares={[
          { campo: 'recompensa', pt: f.recompensa, definir: mudar('recompensaEn') },
          { campo: 'aniversario', pt: f.aniversario, definir: mudar('aniversarioEn') },
          { campo: 'meio', pt: f.meioRecompensa, definir: mudar('meioRecompensaEn') },
        ]}
      >
        <div className="duas-colunas">
          <Campo
            rotulo={t.fidelidade.recompensa}
            valor={f.recompensaEn}
            mudar={mudar('recompensaEn')}
            max={LIMITES_DO_PROGRAMA.recompensa}
            erro={erros.includes('recompensaEn')}
            placeholder={t.fidelidade.recompensaExemploEn}
          />
          <Campo
            rotulo={t.fidelidade.aniversario}
            valor={f.aniversarioEn}
            mudar={mudar('aniversarioEn')}
            max={LIMITES_DO_PROGRAMA.aniversario}
            erro={erros.includes('aniversarioEn')}
            placeholder={t.fidelidade.aniversarioExemploEn}
          />
        </div>
        <div className="duas-colunas">
          <Campo
            rotulo={t.fidelidade.meioRecompensa}
            valor={f.meioRecompensaEn}
            mudar={mudar('meioRecompensaEn')}
            max={LIMITES_DO_PROGRAMA.recompensa}
            erro={erros.includes('meioRecompensaEn')}
            placeholder={t.fidelidade.meioRecompensaExemploEn}
          />
        </div>
      </GrupoEmIngles>
    </div>
  );
}
