import type { CategoriaComContagem, Parceiro } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { mensagemDe, pedir, refrescar } from '../api';
import { ListaArrastavel } from '../arrastar';
import {
  Esqueleto,
  Etiqueta,
  Icone,
  Logotipo,
  Segmentado,
  useAccao,
  useAvisar,
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
  const { correr } = useAccao();
  const avisar = useAvisar();
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
  // A ordem é a da lista inteira: só se arrasta com tudo à vista (sem filtro nem procura).
  const ordenavel = filtro === 'todos' && !procura.trim() && lista.length > 1;

  const reordenar = async (novos: Parceiro[]) => {
    try {
      await pedir('/api/bo/parceiros/ordem', {
        metodo: 'POST',
        corpo: { ids: novos.map((p) => p.id) },
      });
      await refrescar();
    } catch (e) {
      avisar(mensagemDe(e), true);
      await refrescar();
    }
  };

  const linha = (p: Parceiro) => (
    <a className="linha" href={`#/parceiros/${p.id}`}>
      <Logotipo nome={p.nome} cor={p.cor} logotipo={p.logotipo} />
      <div className="meio">
        <div className="titulo-linha">{p.nome}</div>
        <div className="detalhe">
          {[nomeDaCategoria(p.categoriaId), p.localidade].filter(Boolean).join(' · ') || '—'}
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
  );

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Parceiros</h1>
          <p className="subtitulo">
            {parceiros.data
              ? `${plural(naApp, 'parceiro', 'parceiros')} na app, por esta ordem`
              : ' '}
          </p>
        </div>
        <a className="botao" href="#/parceiros/novo">
          <Icone nome="mais" tamanho={18} /> Novo parceiro
        </a>
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
      ) : ordenavel ? (
        <div className="cartao">
          <ListaArrastavel
            itens={lista}
            chave={(p) => p.id}
            nome={(p) => p.nome}
            aoReordenar={reordenar}
            desenhar={(p, pega) => (
              <>
                {pega}
                {linha(p)}
              </>
            )}
          />
        </div>
      ) : (
        <div className="cartao">
          <ul className="lista">
            {lista.map((p) => (
              <li key={p.id}>{linha(p)}</li>
            ))}
          </ul>
        </div>
      )}
      {dialogo}
    </>
  );
}
