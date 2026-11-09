import { naLingua, type CategoriaComContagem, type Parceiro } from '@nunos-lab/dominio';
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
import { useLingua } from '../lingua';
import { useTextos } from '../textos';
import { GavetaDasCategorias } from './Categorias';

type Filtro = 'todos' | 'app' | 'sem' | 'pausados' | 'exemplos';

export function Parceiros() {
  const t = useTextos();
  const lingua = useLingua();
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

  // O nome da categoria na língua do backoffice (em inglês, o inglês, se o houver).
  const nomeDaCategoria = (id: number | null) => {
    const k = categorias.data?.find((x) => x.id === id);
    return k && naLingua(lingua, k.nome, k.nomeEn);
  };
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
      <Logotipo nome={p.nome} cor={p.cor} logotipo={p.logotipo} ajuste={p.logotipoAjuste} />
      <div className="meio">
        <div className="titulo-linha">{p.nome}</div>
        <div className="detalhe">
          {[nomeDaCategoria(p.categoriaId), p.localidade].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <div className="lado">
        {p.exemplo && (
          <span className="so-largo">
            <Etiqueta semPonto>{t.parceiros.exemplo}</Etiqueta>
          </span>
        )}
        {!p.activo ? (
          <Etiqueta>{t.parceiros.pausado}</Etiqueta>
        ) : p.promocoesNaApp > 0 ? (
          <Etiqueta tom="bom">
            {t.parceiros.promocoes(p.promocoesNaApp)}
            <span className="so-largo">{t.parceiros.naApp}</span>
          </Etiqueta>
        ) : (
          <Etiqueta tom="mau">{t.parceiros.semPromocoes}</Etiqueta>
        )}
      </div>
    </a>
  );

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.parceiros}</h1>
          <p className="subtitulo">{parceiros.data ? t.parceiros.naAppPorEstaOrdem(naApp) : ' '}</p>
        </div>
        <a className="botao" href="#/parceiros/novo">
          <Icone nome="mais" tamanho={18} /> {t.parceiros.novoParceiro}
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
          <span>{t.parceiros.exemplos(exemplos)}</span>
          <button
            type="button"
            className="botao perigo pequeno"
            onClick={async () => {
              if (
                await confirmar(
                  t.parceiros.apagarOsExemplos.pergunta,
                  t.parceiros.apagarOsExemplos.texto,
                  t.parceiros.apagarOsExemplos.accao,
                )
              )
                await correr(async () => {
                  await pedir('/api/bo/exemplos/apagar', { metodo: 'POST' });
                  await refrescar();
                }, t.parceiros.apagarOsExemplos.feito);
            }}
          >
            {t.parceiros.apagarOsExemplos.accao}
          </button>
        </div>
      )}

      <div className="filtros">
        <Segmentado<Filtro>
          rotulo={t.parceiros.mostrar}
          valor={filtro}
          mudar={setFiltro}
          opcoes={[
            { valor: 'todos', nome: t.parceiros.filtros.todos },
            { valor: 'app', nome: t.parceiros.filtros.app },
            { valor: 'sem', nome: t.parceiros.filtros.sem },
            { valor: 'pausados', nome: t.parceiros.filtros.pausados },
            ...(exemplos
              ? [{ valor: 'exemplos' as const, nome: t.parceiros.filtros.exemplos }]
              : []),
          ]}
        />
        <input
          className="entrada procura"
          type="search"
          placeholder={t.parceiros.procurar}
          aria-label={t.parceiros.procurarParceiros}
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
      </div>

      {!parceiros.data ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <div className="cartao">
          <Vazio titulo={parceiros.data.length ? t.parceiros.nenhumAqui : t.parceiros.semParceiros}>
            {!parceiros.data.length && (
              <p>
                <a className="botao" href="#/parceiros/novo">
                  {t.parceiros.juntarOPrimeiro}
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
      <div className="gavetas depois-da-lista">
        <GavetaDasCategorias />
      </div>
      {dialogo}
    </>
  );
}
