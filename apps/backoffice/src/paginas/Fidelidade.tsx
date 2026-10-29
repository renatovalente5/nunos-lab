import { LIMITES_DO_PROGRAMA, type Programa } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { Campo, Esqueleto, useAccao, useAvisar } from '../pecas';
import { useAvisoAoSair } from '../util';

/** O programa como se escreve: os números ficam em texto enquanto se editam. */
type Formulario = {
  objectivo: string;
  recompensa: string;
  porDia: string;
  aniversario: string;
};

function formularioDe(p: Programa): Formulario {
  return {
    objectivo: String(p.objectivo),
    recompensa: p.recompensa,
    porDia: String(p.porDia),
    aniversario: p.aniversario,
  };
}

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function Fidelidade() {
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
      avisar('Há campos por corrigir.', true);
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
        },
      });
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      await refrescar();
      avisar('Guardado');
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
          <h1>Fidelidade</h1>
          <p className="subtitulo">O cartão de carimbos e a recompensa.</p>
        </div>
      </div>

      <h2 className="seccao" style={{ marginTop: 0 }}>
        Programa
      </h2>
      <div className="cartao recheado formulario">
        <div className="duas-colunas">
          <Campo
            rotulo="Carimbos para a recompensa"
            tipo="number"
            modoDeTeclado="numeric"
            minimo={LIMITES_DO_PROGRAMA.objectivo.min}
            maximo={LIMITES_DO_PROGRAMA.objectivo.max}
            passo={1}
            valor={f.objectivo}
            mudar={mudar('objectivo')}
            erro={erros.includes('objectivo')}
            obrigatorio
          />
          <Campo
            rotulo="Recompensa"
            valor={f.recompensa}
            mudar={mudar('recompensa')}
            max={LIMITES_DO_PROGRAMA.recompensa}
            erro={erros.includes('recompensa')}
            placeholder="ex.: Corte grátis"
            obrigatorio
          />
        </div>
        <div className="duas-colunas">
          <Campo
            rotulo="Carimbos por dia"
            tipo="number"
            modoDeTeclado="numeric"
            minimo={LIMITES_DO_PROGRAMA.porDia.min}
            maximo={LIMITES_DO_PROGRAMA.porDia.max}
            passo={1}
            valor={f.porDia}
            mudar={mudar('porDia')}
            erro={erros.includes('porDia')}
            ajuda="Por cliente. Acima disto, a app for partners avisa."
            obrigatorio
          />
          <Campo
            rotulo="Prenda de anos"
            valor={f.aniversario}
            mudar={mudar('aniversario')}
            max={LIMITES_DO_PROGRAMA.aniversario}
            erro={erros.includes('aniversario')}
            placeholder="ex.: Barba grátis"
            ajuda="Vazio: não há."
          />
        </div>
      </div>

      <div className="gravar">
        <button
          type="button"
          className="botao"
          disabled={!sujo || aCorrer}
          onClick={() => correr(guardar)}
        >
          Guardar
        </button>
        {sujo && <span className="estado">Alterações por guardar</span>}
      </div>
    </>
  );
}
