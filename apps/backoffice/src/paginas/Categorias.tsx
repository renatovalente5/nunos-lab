import {
  ICONES_DAS_CATEGORIAS,
  LIMITES,
  type CategoriaComContagem,
  type IconeDaCategoria,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { pedir, refrescar } from '../api';
import { Esqueleto, Folha, Icone, Campo, Seletor, useAccao, useConfirmar, Vazio } from '../pecas';
import { plural } from '../util';

const NOMES_DOS_ICONES: Record<IconeDaCategoria, string> = {
  comer: 'Garfo e faca',
  cafe: 'Chávena',
  carro: 'Carro',
  treino: 'Haltere',
  beleza: 'Brilho',
  saude: 'Coração',
  compras: 'Saco',
  casa: 'Casa',
  lazer: 'Estrela',
  outro: 'Pontos',
};

export function Categorias() {
  const { data } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const [editar, setEditar] = useState<{
    id: number | null;
    nome: string;
    icone: IconeDaCategoria;
  } | null>(null);
  const { correr, aCorrer } = useAccao();
  const { confirmar, dialogo } = useConfirmar();

  const mover = (i: number, d: -1 | 1) => {
    if (!data) return;
    const ids = data.map((k) => k.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    return correr(async () => {
      await pedir('/api/bo/categorias/ordem', { metodo: 'POST', corpo: { ids } });
      await refrescar();
    });
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Categorias</h1>
          <p className="subtitulo">
            Os filtros por cima da lista de parceiros. Só aparecem as que têm parceiros na app.
          </p>
        </div>
        <button
          type="button"
          className="botao"
          onClick={() => setEditar({ id: null, nome: '', icone: 'outro' })}
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
          <ol className="lista">
            {data.map((k, i) => (
              <li key={k.id}>
                <div className="linha">
                  <div className="meio">
                    <div className="titulo-linha">{k.nome}</div>
                    <div className="detalhe">
                      {NOMES_DOS_ICONES[k.icone]} · {plural(k.parceiros, 'parceiro', 'parceiros')}
                    </div>
                  </div>
                  <div className="lado">
                    <button
                      type="button"
                      className="botao secundario icone"
                      aria-label={`Subir ${k.nome}`}
                      disabled={i === 0 || aCorrer}
                      onClick={() => mover(i, -1)}
                    >
                      <Icone nome="subir" tamanho={18} />
                    </button>
                    <button
                      type="button"
                      className="botao secundario icone"
                      aria-label={`Descer ${k.nome}`}
                      disabled={i === data.length - 1 || aCorrer}
                      onClick={() => mover(i, 1)}
                    >
                      <Icone nome="descer" tamanho={18} />
                    </button>
                    <button
                      type="button"
                      className="botao secundario pequeno"
                      onClick={() => setEditar({ id: k.id, nome: k.nome, icone: k.icone })}
                    >
                      Mudar
                    </button>
                    <button
                      type="button"
                      className="botao perigo pequeno"
                      onClick={async () => {
                        if (
                          await confirmar(
                            `Apagar «${k.nome}»?`,
                            k.parceiros
                              ? `${plural(k.parceiros, 'parceiro fica', 'parceiros ficam')} sem categoria (continuam na app).`
                              : 'Nenhum parceiro a usa.',
                            'Apagar',
                          )
                        )
                          await correr(async () => {
                            await pedir(`/api/bo/categorias/${k.id}`, { metodo: 'DELETE' });
                            await refrescar();
                          }, 'Categoria apagada');
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Folha
        aberta={!!editar}
        fechar={() => setEditar(null)}
        titulo={editar?.id ? 'Mudar a categoria' : 'Nova categoria'}
        pe={
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
            <Seletor<IconeDaCategoria>
              rotulo="Desenho"
              valor={editar.icone}
              mudar={(icone) => icone && setEditar({ ...editar, icone })}
              opcoes={ICONES_DAS_CATEGORIAS.map((i) => ({ valor: i, nome: NOMES_DOS_ICONES[i] }))}
            />
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
