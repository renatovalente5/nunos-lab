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
  GrupoEmIngles,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { useTextos } from '../textos';

export function Categorias() {
  const t = useTextos();
  const { data } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const [editar, setEditar] = useState<{
    id: number | null;
    nome: string;
    /** O nome em inglês (vazio: a app em inglês mostra o português). */
    nomeEn: string;
    icone: IconeDaCategoria;
    parceiros: number;
    /** O que estava gravado: o inglês fica por rever quando o português muda. */
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
          <h1>{t.geral.seccoes.categorias}</h1>
          <p className="subtitulo">{t.categorias.subtitulo}</p>
        </div>
        <button
          type="button"
          className="botao"
          onClick={() =>
            setEditar({
              id: null,
              nome: '',
              nomeEn: '',
              icone: 'outro',
              parceiros: 0,
            })
          }
        >
          <Icone nome="mais" tamanho={18} /> {t.categorias.nova}
        </button>
      </div>
      {!data ? (
        <Esqueleto />
      ) : !data.length ? (
        <div className="cartao">
          <Vazio titulo={t.categorias.vazio} />
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
                  aria-label={t.categorias.editarDe(k.nome)}
                  onClick={() =>
                    setEditar({
                      id: k.id,
                      nome: k.nome,
                      nomeEn: k.nomeEn ?? '',
                      icone: k.icone,
                      parceiros: k.parceiros,
                    })
                  }
                >
                  <span className="icone-categoria">
                    <DesenhoDaCategoria icone={k.icone} />
                  </span>
                  <div className="meio">
                    <div className="titulo-linha">{k.nome}</div>
                    <div className="detalhe">{t.categorias.parceiros(k.parceiros)}</div>
                  </div>
                  <span className="botao secundario pequeno so-largo" aria-hidden="true">
                    {t.categorias.editar}
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
        titulo={editar?.id ? t.categorias.editarACategoria : t.categorias.nova}
        pe={
          <>
            <button
              type="button"
              className="botao"
              disabled={!editar?.nome.trim() || aCorrer}
              onClick={() =>
                editar &&
                correr(async () => {
                  const corpo = { nome: editar.nome, nomeEn: editar.nomeEn, icone: editar.icone };
                  if (editar.id)
                    await pedir(`/api/bo/categorias/${editar.id}`, { metodo: 'PATCH', corpo });
                  else await pedir('/api/bo/categorias', { metodo: 'POST', corpo });
                  await refrescar();
                  setEditar(null);
                }, t.categorias.guardado)
              }
            >
              {t.categorias.guardar}
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
                      t.categorias.apagarPergunta(nome),
                      parceiros
                        ? t.categorias.ficamSemCategoria(parceiros)
                        : t.categorias.nenhumParceiro,
                      t.categorias.apagar,
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/categorias/${id}`, { metodo: 'DELETE' });
                      await refrescar();
                      setEditar(null);
                    }, t.categorias.apagada);
                }}
              >
                {t.categorias.apagar}
              </button>
            )}
          </>
        }
      >
        {editar && (
          <div className="formulario">
            <Campo
              rotulo={t.categorias.nome}
              valor={editar.nome}
              mudar={(nome) => setEditar({ ...editar, nome })}
              max={LIMITES.categoria}
              obrigatorio
              autoFocus
            />
            <GrupoEmIngles
              pares={[
                {
                  campo: 'categoria',
                  pt: editar.nome,
                  definir: (nomeEn) => setEditar((e) => (e ? { ...e, nomeEn } : e)),
                },
              ]}
            >
              <Campo
                rotulo={t.categorias.nome}
                valor={editar.nomeEn}
                mudar={(nomeEn) => setEditar({ ...editar, nomeEn })}
                max={LIMITES.categoria}
              />
            </GrupoEmIngles>
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
