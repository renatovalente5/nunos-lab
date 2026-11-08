import { LIMITES_DO_PROGRAMA, type Programa } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { Campo, Esqueleto, GrupoEmIngles, useAccao, useAvisar } from '../pecas';
import { useTextos } from '../textos';
import { useAvisoAoSair } from '../util';

/** O programa como se escreve: os números ficam em texto enquanto se editam. */
type Formulario = {
  objectivo: string;
  recompensa: string;
  porDia: string;
  aniversario: string;
  /** Em inglês: vazio, a app em inglês traduz os prémios comuns («Free haircut») ou mostra o português. */
  recompensaEn: string;
  aniversarioEn: string;
};

function formularioDe(p: Programa): Formulario {
  return {
    objectivo: String(p.objectivo),
    recompensa: p.recompensa,
    porDia: String(p.porDia),
    aniversario: p.aniversario,
    recompensaEn: p.recompensaEn ?? '',
    aniversarioEn: p.aniversarioEn ?? '',
  };
}

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function Fidelidade() {
  const t = useTextos();
  const programa = useQuery({
    queryKey: ['programa'],
    queryFn: () => pedir<Programa>('/api/bo/programa'),
  });
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();

  useEffect(() => {
    if (programa.data && !original) {
      const inicial = formularioDe(programa.data);
      setOriginal(inicial);
      setF(inicial);
    }
  }, [programa.data, original]);
  const sujo = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);
  useAvisoAoSair(sujo);
  if (!f) return <Esqueleto linhas={6} />;

  const mudar =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) => {
      setF((x) => (x ? { ...x, [k]: v } : x));
      setErros((e) => e.filter((c) => c !== k));
    };

  async function guardar() {
    if (!f) return;
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
    const faltam = [
      objectivo === null && 'objectivo',
      porDia === null && 'porDia',
      !f.recompensa.trim() && 'recompensa',
    ].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(t.fidelidade.camposPorCorrigir, true);
      return;
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
        },
      });
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      await refrescar();
      avisar(t.fidelidade.guardado);
      setErros([]);
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.fidelidade}</h1>
          <p className="subtitulo">{t.fidelidade.subtitulo}</p>
        </div>
      </div>

      <h2 className="seccao" style={{ marginTop: 0 }}>
        {t.fidelidade.programa}
      </h2>
      <div className="cartao recheado formulario">
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
      </div>

      <GrupoEmIngles
        seccao
        pares={[
          { campo: 'recompensa', pt: f.recompensa, definir: mudar('recompensaEn') },
          { campo: 'aniversario', pt: f.aniversario, definir: mudar('aniversarioEn') },
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
      </GrupoEmIngles>

      <div className="gravar">
        <button
          type="button"
          className="botao"
          disabled={!sujo || aCorrer}
          onClick={() => correr(guardar)}
        >
          {t.fidelidade.guardar}
        </button>
        {sujo && <span className="estado">{t.fidelidade.porGuardar}</span>}
      </div>
    </>
  );
}
