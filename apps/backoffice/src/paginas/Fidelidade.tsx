import {
  CONVITES_PREDEFINIDOS,
  LIMITES_DO_PROGRAMA,
  LIMITES_DO_SALDO,
  euros,
  recompensaNaLingua,
  type Lingua,
  type ProgramaDoBackoffice,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir } from '../api';
import { useLingua } from '../lingua';
import { Campo, Contador, GrupoEmIngles, Interruptor, useAvisar } from '../pecas';
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
  /**
   * Os convites (o Renato, 10 nov 2026): os prémios em euros inteiros, como o barbeiro os usa ao
   * balcão (a API guarda cêntimos); o limite vazio é «sem limite».
   */
  convitesLigados: boolean;
  valorPadrinho: string;
  valorConvidado: string;
  limiteDeConvites: string;
};

/** O prémio de cada lado de um convite, em euros: os limites do domínio estão em cêntimos. */
const EUROS_DO_PREMIO = {
  min: LIMITES_DO_SALDO.premio.min / 100,
  max: LIMITES_DO_SALDO.premio.max / 100,
};

/** Os campos dos convites como a API os aponta num erro («convites.limite») e como se chamam aqui. */
const CAMPOS_DOS_CONVITES: Record<string, keyof Formulario> = {
  'convites.ligado': 'convitesLigados',
  'convites.valorPadrinho': 'valorPadrinho',
  'convites.valorConvidado': 'valorConvidado',
  'convites.limite': 'limiteDeConvites',
};

function formularioDe(p: ProgramaDoBackoffice): Formulario {
  // A API de antes dos convites não os manda: ficam as predefinições, em vez de a página cair.
  const convites = p.convites ?? CONVITES_PREDEFINIDOS;
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
    convitesLigados: convites.ligado,
    valorPadrinho: String(convites.valorPadrinho / 100),
    valorConvidado: String(convites.valorConvidado / 100),
    limiteDeConvites: convites.limite === null ? '' : String(convites.limite),
  };
}

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Os euros de um campo em cêntimos, para o resumo (um campo a meio conta como 0). */
const centimosDoCampo = (texto: string) => Math.round((Number(texto.trim()) || 0) * 100);

/**
 * O cartão de fidelidade: era uma página («Fidelidade») e passou a gaveta da Barbearia (8 nov),
 * que o guarda com o resto no mesmo «Guardar». `guardar` diz se correu bem; o «Guardado» é da página.
 */
export function usePrograma() {
  const t = useTextos();
  const programa = useQuery({
    queryKey: ['programa'],
    queryFn: () => pedir<ProgramaDoBackoffice>('/api/bo/programa'),
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
    // Os convites conferem-se também desligados: os valores ficam guardados para quando se ligarem.
    const valorPadrinho = inteiroEntre(f.valorPadrinho, EUROS_DO_PREMIO.min, EUROS_DO_PREMIO.max);
    const valorConvidado = inteiroEntre(f.valorConvidado, EUROS_DO_PREMIO.min, EUROS_DO_PREMIO.max);
    const limiteDeConvites = f.limiteDeConvites.trim()
      ? inteiroEntre(
          f.limiteDeConvites,
          LIMITES_DO_SALDO.convites.min,
          LIMITES_DO_SALDO.convites.max,
        )
      : null;
    const faltam = [
      objectivo === null && 'objectivo',
      porDia === null && 'porDia',
      !f.recompensa.trim() && 'recompensa',
      f.meioRecompensa.trim() && meio === null && 'meio',
      valorPadrinho === null && 'valorPadrinho',
      valorConvidado === null && 'valorConvidado',
      f.limiteDeConvites.trim() && limiteDeConvites === null && 'limiteDeConvites',
    ].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(t.fidelidade.camposPorCorrigir, true);
      return false;
    }
    const enviado = f;
    try {
      const guardado = await pedir<ProgramaDoBackoffice>('/api/bo/programa', {
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
          // Conferidos acima (sem eles, `faltam` não estava vazio).
          convites: {
            ligado: f.convitesLigados,
            valorPadrinho: valorPadrinho! * 100,
            valorConvidado: valorConvidado! * 100,
            limite: limiteDeConvites,
          },
        },
      });
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      setErros([]);
      return true;
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos.map((c) => CAMPOS_DOS_CONVITES[c] ?? c));
      avisar(mensagemDe(e), true);
      return false;
    }
  }

  return { f, mudar, erros, sujo, guardar };
}

export type ProgramaNoFormulario = ReturnType<typeof usePrograma>;

/**
 * «10 carimbos · 50% de desconto · convites 1 € / 1 €», para a gaveta fechada; em inglês, o prémio em
 * inglês.
 */
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
    f.convitesLigados
      ? t.fidelidade.convitesNoResumo(
          euros(centimosDoCampo(f.valorPadrinho), lingua),
          euros(centimosDoCampo(f.valorConvidado), lingua),
        )
      : t.fidelidade.semConvites,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function CamposDoPrograma({ programa }: { programa: ProgramaNoFormulario }) {
  const t = useTextos();
  const lingua = useLingua();
  const { f, mudar, erros } = programa;
  if (!f) return null;
  const eurosErrados = t.fidelidade.eurosErrados(euros(LIMITES_DO_SALDO.premio.max, lingua));
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
      {/* Os convites (o Renato, 10 nov 2026): à parte, depois do inglês, que é só dos textos do
          cartão. Desligados, os valores ficam à vista e guardam-se para quando se ligarem. */}
      <div className="cartao recheado formulario">
        <Interruptor
          ligado={f.convitesLigados}
          mudar={mudar('convitesLigados')}
          rotulo={t.fidelidade.convitesLigados}
          ajuda={t.fidelidade.convitesAjuda}
        />
        <div className="tres-colunas">
          <Campo
            rotulo={t.fidelidade.valorPadrinho}
            tipo="number"
            modoDeTeclado="numeric"
            minimo={EUROS_DO_PREMIO.min}
            maximo={EUROS_DO_PREMIO.max}
            passo={1}
            valor={f.valorPadrinho}
            mudar={mudar('valorPadrinho')}
            erro={erros.includes('valorPadrinho')}
            erroTexto={eurosErrados}
            obrigatorio
          />
          <Campo
            rotulo={t.fidelidade.valorConvidado}
            tipo="number"
            modoDeTeclado="numeric"
            minimo={EUROS_DO_PREMIO.min}
            maximo={EUROS_DO_PREMIO.max}
            passo={1}
            valor={f.valorConvidado}
            mudar={mudar('valorConvidado')}
            erro={erros.includes('valorConvidado')}
            erroTexto={eurosErrados}
            obrigatorio
          />
          <Contador
            rotulo={t.fidelidade.limiteDeConvites}
            valor={f.limiteDeConvites}
            mudar={mudar('limiteDeConvites')}
            minimo={LIMITES_DO_SALDO.convites.min}
            maximo={LIMITES_DO_SALDO.convites.max}
            vazio={t.fidelidade.semLimite}
            erro={erros.includes('limiteDeConvites')}
          />
        </div>
      </div>
    </div>
  );
}
