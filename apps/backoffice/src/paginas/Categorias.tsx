import { LIMITES, type CategoriaComContagem, type IconeDaCategoria } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { mensagemDe, pedir, refrescar } from '../api';
import { ListaArrastavel } from '../arrastar';
import {
  Campo,
  DesenhoDaCategoria,
  EscolhaDoDesenho,
  Esqueleto,
  Folha,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { plural } from '../util';

export function Categorias() {
  const { data } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const [editar, setEditar] = useState<{
    id: number | null;
    nome: string;
    icone: IconeDaCategoria;
    parceiros: number;
  } | null>(null);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

  const reordenar = async (novas: CategoriaComContagem[]) => {
    try {
      await pedir('/api/bo/categorias/ordem', {
        metodo: 'POST',
        corpo: { ids: novas.map((k) => k.id) },
      });
      await refrescar();
    } catch (e) {
      avisar(mensagemDe(e), true);
      await refrescar();
    }
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Categorias</h1>
          <p className="subtitulo">Os filtros por cima dos parceiros, na app, por esta ordem.</p>
        </div>
        <button
          type="button"
          className="botao"
          onClick={() => setEditar({ id: null, nome: '', icone: 'outro', parceiros: 0 })}
        >
          <Icone nome="mais" tamanho={18} /> Nova categoria
        </button>
      </div>
      {!data ? (
        <Esqueleto />
      ) : !data.length ? (
        <div className="cartao">
          <Vazio titulo="Ainda sem categorias" />
        </div>
      ) : (
        <div className="cartao">
          <ListaArrastavel
            itens={data}
            chave={(k) => k.id}
            nome={(k) => k.nome}
            aoReordenar={reordenar}
            desenhar={(k, pega) => (
              <>
                {pega}
                <button
                  type="button"
                  className="linha"
                  aria-label={`Editar ${k.nome}`}
                  onClick={() =>
                    setEditar({ id: k.id, nome: k.nome, icone: k.icone, parceiros: k.parceiros })
                  }
                >
                  <span className="icone-categoria">
                    <DesenhoDaCategoria icone={k.icone} />
                  </span>
                  <div className="meio">
                    <div className="titulo-linha">{k.nome}</div>
                    <div className="detalhe">{plural(k.parceiros, 'parceiro', 'parceiros')}</div>
                  </div>
                  <span className="botao secundario pequeno so-largo" aria-hidden="true">
                    Editar
                  </span>
                </button>
              </>
            )}
          />
        </div>
      )}

      <Folha
        aberta={!!editar}
        fechar={() => setEditar(null)}
        titulo={editar?.id ? 'Editar a categoria' : 'Nova categoria'}
        pe={
          <>
            <button
              type="button"
              className="botao"
              disabled={!editar?.nome.trim() || aCorrer}
              onClick={() =>
                editar &&
                correr(async () => {
                  const corpo = { nome: editar.nome, icone: editar.icone };
                  if (editar.id)
                    await pedir(`/api/bo/categorias/${editar.id}`, { metodo: 'PATCH', corpo });
                  else await pedir('/api/bo/categorias', { metodo: 'POST', corpo });
                  await refrescar();
                  setEditar(null);
                }, 'Guardado')
              }
            >
              Guardar
            </button>
            {editar?.id && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (!editar?.id) return;
                  const { id, nome, parceiros } = editar;
                  if (
                    await confirmar(
                      `Apagar «${nome}»?`,
                      parceiros
                        ? `${plural(parceiros, 'parceiro fica', 'parceiros ficam')} sem categoria (continuam na app).`
                        : 'Nenhum parceiro a usa.',
                      'Apagar',
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/categorias/${id}`, { metodo: 'DELETE' });
                      await refrescar();
                      setEditar(null);
                    }, 'Categoria apagada');
                }}
              >
                Apagar
              </button>
            )}
          </>
        }
      >
        {editar && (
          <div className="formulario">
            <Campo
              rotulo="Nome"
              valor={editar.nome}
              mudar={(nome) => setEditar({ ...editar, nome })}
              max={LIMITES.categoria}
              obrigatorio
              autoFocus
            />
            <EscolhaDoDesenho
              valor={editar.icone}
              mudar={(icone) => setEditar({ ...editar, icone })}
            />
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
