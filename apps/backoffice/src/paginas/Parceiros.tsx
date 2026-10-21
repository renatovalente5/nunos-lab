import type { CategoriaComContagem, Parceiro } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { pedir, refrescar } from '../api';
import {
  Esqueleto,
  Etiqueta,
  Icone,
  Logotipo,
  Segmentado,
  useAccao,
  useConfirmar,
  Vazio,
} from '../pecas';
import { plural } from '../util';

type Filtro = 'todos' | 'app' | 'sem' | 'pausados' | 'exemplos';

export function Parceiros() {
  const parceiros = useQuery({
    queryKey: ['parceiros'],
    queryFn: () => pedir<Parceiro[]>('/api/bo/parceiros'),
  });
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [procura, setProcura] = useState('');
  const [ordem, setOrdem] = useState<number[] | null>(null);
  const { correr, aCorrer } = useAccao();
  const { confirmar, dialogo } = useConfirmar();

  const lista = useMemo(() => {
    const todos = parceiros.data ?? [];
    const termo = procura.trim().toLocaleLowerCase('pt-PT');
    return todos.filter((p) => {
      if (filtro === 'app' && !(p.activo && p.promocoesNaApp > 0)) return false;
      if (filtro === 'sem' && !(p.activo && p.promocoesNaApp === 0)) return false;
      if (filtro === 'pausados' && p.activo) return false;
      if (filtro === 'exemplos' && !p.exemplo) return false;
      return !termo || `${p.nome} ${p.localidade}`.toLocaleLowerCase('pt-PT').includes(termo);
    });
  }, [parceiros.data, filtro, procura]);

  const nomeDaCategoria = (id: number | null) => categorias.data?.find((k) => k.id === id)?.nome;
  const naApp = (parceiros.data ?? []).filter((p) => p.activo && p.promocoesNaApp > 0).length;
  const exemplos = (parceiros.data ?? []).filter((p) => p.exemplo).length;

  if (ordem) {
    const porId = new Map((parceiros.data ?? []).map((p) => [p.id, p]));
    const mover = (i: number, d: -1 | 1) => {
      const n = [...ordem];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      setOrdem(n);
    };
    return (
      <>
        <div className="cabecalho">
          <div>
            <h1>Ordenar parceiros</h1>
            <p className="subtitulo">É a ordem da lista na app.</p>
          </div>
          <div className="botoes">
            <button
              type="button"
              className="botao"
              disabled={aCorrer}
              onClick={() =>
                correr(async () => {
                  await pedir('/api/bo/parceiros/ordem', { metodo: 'POST', corpo: { ids: ordem } });
                  await refrescar();
                  setOrdem(null);
                }, 'Ordem guardada')
              }
            >
              Guardar a ordem
            </button>
            <button type="button" className="botao secundario" onClick={() => setOrdem(null)}>
              Cancelar
            </button>
          </div>
        </div>
        <div className="cartao">
          <ol className="lista">
            {ordem.map((id, i) => {
              const p = porId.get(id);
              if (!p) return null;
              return (
                <li key={id}>
                  <div className="linha">
                    <Logotipo nome={p.nome} cor={p.cor} logotipo={p.logotipo} />
                    <div className="meio titulo-linha">{p.nome}</div>
                    <div className="lado">
                      <button
                        type="button"
                        className="botao secundario icone"
                        aria-label={`Subir ${p.nome}`}
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        <Icone nome="subir" tamanho={18} />
                      </button>
                      <button
                        type="button"
                        className="botao secundario icone"
                        aria-label={`Descer ${p.nome}`}
                        disabled={i === ordem.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        <Icone nome="descer" tamanho={18} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Parceiros</h1>
          <p className="subtitulo">
            {parceiros.data ? `${plural(naApp, 'parceiro', 'parceiros')} na app` : ' '}
          </p>
        </div>
        <div className="botoes">
          <button
            type="button"
            className="botao secundario"
            disabled={!parceiros.data?.length}
            onClick={() => setOrdem((parceiros.data ?? []).map((p) => p.id))}
          >
            Ordenar
          </button>
          <a className="botao" href="#/parceiros/novo">
            <Icone nome="mais" tamanho={18} /> Novo parceiro
          </a>
        </div>
      </div>

      {exemplos > 0 && (
        <div
          className="caixa-aviso"
          style={{
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {plural(exemplos, 'parceiro é de exemplo', 'parceiros são de exemplo')}, inventados para
            a demonstração.
          </span>
          <button
            type="button"
            className="botao perigo pequeno"
            onClick={async () => {
              if (
                await confirmar(
                  'Apagar os exemplos?',
                  'Os parceiros de exemplo e as promoções deles saem da app. Não se desfaz.',
                  'Apagar os exemplos',
                )
              )
                await correr(async () => {
                  await pedir('/api/bo/exemplos/apagar', { metodo: 'POST' });
                  await refrescar();
                }, 'Exemplos apagados');
            }}
          >
            Apagar os exemplos
          </button>
        </div>
      )}

      <div className="filtros">
        <Segmentado<Filtro>
          rotulo="Mostrar"
          valor={filtro}
          mudar={setFiltro}
          opcoes={[
            { valor: 'todos', nome: 'Todos' },
            { valor: 'app', nome: 'Na app' },
            { valor: 'sem', nome: 'Sem promoções' },
            { valor: 'pausados', nome: 'Pausados' },
            ...(exemplos ? [{ valor: 'exemplos' as const, nome: 'Exemplos' }] : []),
          ]}
        />
        <input
          className="entrada procura"
          type="search"
          placeholder="Procurar"
          aria-label="Procurar parceiros"
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
      </div>

      {!parceiros.data ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <div className="cartao">
          <Vazio titulo={parceiros.data.length ? 'Nenhum parceiro aqui' : 'Ainda sem parceiros'}>
            {!parceiros.data.length && (
              <p>
                <a className="botao" href="#/parceiros/novo">
                  Juntar o primeiro
                </a>
              </p>
            )}
          </Vazio>
        </div>
      ) : (
        <div className="cartao">
          <ul className="lista">
            {lista.map((p) => (
              <li key={p.id}>
                <a className="linha" href={`#/parceiros/${p.id}`}>
                  <Logotipo nome={p.nome} cor={p.cor} logotipo={p.logotipo} />
                  <div className="meio">
                    <div className="titulo-linha">{p.nome}</div>
                    <div className="detalhe">
                      {[nomeDaCategoria(p.categoriaId), p.localidade].filter(Boolean).join(' · ') ||
                        '—'}
                    </div>
                  </div>
                  <div className="lado">
                    {p.exemplo && <Etiqueta semPonto>Exemplo</Etiqueta>}
                    {!p.activo ? (
                      <Etiqueta>Pausado</Etiqueta>
                    ) : p.promocoesNaApp > 0 ? (
                      <Etiqueta tom="bom">
                        {plural(p.promocoesNaApp, 'promoção na app', 'promoções na app')}
                      </Etiqueta>
                    ) : (
                      <Etiqueta tom="mau">Sem promoções</Etiqueta>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialogo}
    </>
  );
}
