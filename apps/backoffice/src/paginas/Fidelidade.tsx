import { LIMITES_DO_PROGRAMA, type Programa, type Servico } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { ListaArrastavel } from '../arrastar';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Icone,
  Interruptor,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { euros, useAvisoAoSair } from '../util';

/** O programa como se escreve: os números ficam em texto enquanto se editam. */
type Formulario = {
  objectivo: string;
  recompensa: string;
  porDia: string;
  servicos: boolean;
  aniversario: string;
};

function formularioDe(p: Programa): Formulario {
  return {
    objectivo: String(p.objectivo),
    recompensa: p.recompensa,
    porDia: String(p.porDia),
    servicos: p.servicos,
    aniversario: p.aniversario,
  };
}

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const n = Number(texto.trim());
  return texto.trim() && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** O preço escreve-se em euros («15» ou «12.5»); grava-se em cêntimos. */
function centimosDe(texto: string): number | null | undefined {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return undefined;
  return Math.round(n * 100);
}

type ServicoNoEditor = { id: number | null; nome: string; preco: string; activo: boolean };

export function Fidelidade() {
  const programa = useQuery({
    queryKey: ['programa'],
    queryFn: () => pedir<Programa>('/api/bo/programa'),
  });
  const servicos = useQuery({
    queryKey: ['servicos'],
    queryFn: () => pedir<Servico[]>('/api/bo/servicos'),
  });
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [editor, setEditor] = useState<ServicoNoEditor | null>(null);
  const [erroDoServico, setErroDoServico] = useState<string[]>([]);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

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
          servicos: f.servicos,
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

  const lista = servicos.data ?? [];

  const reordenar = async (novos: Servico[]) => {
    try {
      await pedir('/api/bo/servicos/ordem', {
        metodo: 'PUT',
        corpo: { ids: novos.map((s) => s.id) },
      });
      await refrescar();
    } catch (e) {
      avisar(mensagemDe(e), true);
      await refrescar();
    }
  };

  const ligar = (s: Servico) =>
    correr(
      async () => {
        await pedir(`/api/bo/servicos/${s.id}`, { metodo: 'PATCH', corpo: { activo: !s.activo } });
        await refrescar();
      },
      s.activo ? 'Serviço desligado' : 'Serviço ligado',
    );

  async function guardarServico() {
    if (!editor) return;
    const preco = centimosDe(editor.preco);
    const faltam = [!editor.nome.trim() && 'nome', preco === undefined && 'preco'].filter(
      Boolean,
    ) as string[];
    if (faltam.length) {
      setErroDoServico(faltam);
      avisar('Há campos por corrigir.', true);
      return;
    }
    const corpo = { nome: editor.nome.trim(), preco };
    try {
      if (editor.id) await pedir(`/api/bo/servicos/${editor.id}`, { metodo: 'PATCH', corpo });
      else await pedir('/api/bo/servicos', { metodo: 'POST', corpo });
      await refrescar();
      avisar(editor.id ? 'Guardado' : 'Serviço criado');
      setEditor(null);
    } catch (e) {
      if (e instanceof ErroDaApi && e.campos.length) setErroDoServico(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  const abrirEditor = (s: Servico | null) => {
    setErroDoServico([]);
    setEditor(
      s
        ? {
            id: s.id,
            nome: s.nome,
            preco: s.preco === null ? '' : String(s.preco / 100),
            activo: s.activo,
          }
        : { id: null, nome: '', preco: '', activo: true },
    );
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Fidelidade</h1>
          <p className="subtitulo">O cartão de carimbos e os serviços que a Balcão pergunta.</p>
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
            ajuda="Por cliente. Acima disto, a Balcão avisa."
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
        <Interruptor
          ligado={f.servicos}
          mudar={mudar('servicos')}
          rotulo="Perguntar o serviço ao carimbar"
          ajuda="Corte, barba… para a receita estimada."
        />
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

      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h2 className="seccao">Serviços</h2>
        <button
          type="button"
          className="botao secundario pequeno"
          onClick={() => abrirEditor(null)}
        >
          <Icone nome="mais" tamanho={16} /> Adicionar serviço
        </button>
      </div>
      <div className="cartao">
        {!servicos.data ? (
          <Esqueleto />
        ) : !lista.length ? (
          <Vazio titulo="Ainda sem serviços" />
        ) : (
          <ListaArrastavel
            itens={lista}
            chave={(s) => s.id}
            nome={(s) => s.nome}
            aoReordenar={reordenar}
            desenhar={(s, pega) => (
              <>
                {lista.length > 1 && pega}
                <button
                  type="button"
                  className="linha"
                  aria-label={`Editar ${s.nome}`}
                  onClick={() => abrirEditor(s)}
                >
                  <div className="meio">
                    <div className="titulo-linha">
                      {s.nome} {!s.activo && <Etiqueta>Desligado</Etiqueta>}
                    </div>
                    <div className="detalhe">{s.preco === null ? 'Sem preço' : euros(s.preco)}</div>
                  </div>
                  <span className="botao secundario pequeno so-largo" aria-hidden="true">
                    Editar
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  className="interruptor"
                  style={{ margin: '0 18px 0 4px' }}
                  aria-checked={s.activo}
                  aria-label={s.nome}
                  onClick={() => ligar(s)}
                />
              </>
            )}
          />
        )}
      </div>

      <Folha
        aberta={!!editor}
        fechar={() => setEditor(null)}
        titulo={editor?.id ? 'Serviço' : 'Novo serviço'}
        pe={
          <>
            <button
              type="button"
              className="botao"
              disabled={!editor?.nome.trim() || aCorrer}
              onClick={() => correr(guardarServico)}
            >
              {editor?.id ? 'Guardar' : 'Criar'}
            </button>
            {editor?.id && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (!editor?.id) return;
                  const { id, nome } = editor;
                  if (
                    await confirmar(
                      `Apagar «${nome}»?`,
                      'Com carimbos atrás, fica só desligado.',
                      'Apagar',
                    )
                  )
                    await correr(async () => {
                      const depois = await pedir<Servico[]>(`/api/bo/servicos/${id}`, {
                        metodo: 'DELETE',
                      });
                      await refrescar();
                      setEditor(null);
                      avisar(
                        depois.some((s) => s.id === id)
                          ? 'Tem carimbos: ficou desligado'
                          : 'Serviço apagado',
                      );
                    });
                }}
              >
                Apagar
              </button>
            )}
          </>
        }
      >
        {editor && (
          <div className="formulario">
            <Campo
              rotulo="Nome"
              valor={editor.nome}
              mudar={(nome) => {
                setErroDoServico((e) => e.filter((c) => c !== 'nome'));
                setEditor({ ...editor, nome });
              }}
              max={LIMITES_DO_PROGRAMA.servico}
              erro={erroDoServico.includes('nome')}
              placeholder="ex.: Corte"
              obrigatorio
              autoFocus
            />
            <div className="duas-colunas">
              <Campo
                rotulo="Preço"
                tipo="number"
                modoDeTeclado="decimal"
                minimo={0}
                maximo={1000}
                passo={0.5}
                valor={editor.preco}
                mudar={(preco) => {
                  setErroDoServico((e) => e.filter((c) => c !== 'preco'));
                  setEditor({ ...editor, preco });
                }}
                erro={erroDoServico.includes('preco')}
                placeholder="ex.: 15"
                ajuda="Em euros. Vazio: sem preço."
              />
            </div>
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
