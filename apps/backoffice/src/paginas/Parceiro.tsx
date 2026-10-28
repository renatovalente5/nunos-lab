import {
  LIMITES,
  diaEmLisboa,
  type CategoriaComContagem,
  type DefinicoesDaBarbearia,
  type Parceiro as ParceiroDoContrato,
  type ParceiroComPromocoes,
  type Promocao,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import {
  AreaDeTexto,
  Campo,
  CampoDeImagem,
  Cores,
  Esqueleto,
  Etiqueta,
  fundoDaCapa,
  Icone,
  Interruptor,
  Logotipo,
  Seletor,
  urlDaImagem,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { ListaArrastavel } from '../arrastar';
import { ir, parametro, useAvisoAoSair } from '../util';
import { ConteudoDaPromocao, EditorDePromocao } from './Promocoes';

/** A app do cliente (para «Ver na app»). */
const APP = (import.meta.env.VITE_APP as string).replace(/\/$/, '');

type Formulario = {
  nome: string;
  categoriaId: number | null;
  lojaId: number | null;
  localidade: string;
  morada: string;
  telefone: string;
  instagram: string;
  site: string;
  horario: string;
  descricao: string;
  cor: string;
  logotipo: string | null;
  capa: string | null;
  activo: boolean;
};

const VAZIO: Formulario = {
  nome: '',
  categoriaId: null,
  lojaId: null,
  localidade: '',
  morada: '',
  telefone: '',
  instagram: '',
  site: '',
  horario: '',
  descricao: '',
  cor: '#5C544C',
  logotipo: null,
  capa: null,
  activo: true,
};

function doParceiro(p: ParceiroDoContrato): Formulario {
  return {
    nome: p.nome,
    categoriaId: p.categoriaId,
    lojaId: p.lojaId,
    localidade: p.localidade,
    morada: p.morada,
    telefone: p.telefone,
    instagram: p.instagram,
    site: p.site,
    horario: p.horario,
    descricao: p.descricao,
    cor: p.cor,
    logotipo: p.logotipo,
    capa: p.capa,
    activo: p.activo,
  };
}

export function Parceiro({ id }: { id: string }) {
  const novo = id === 'novo';
  const dados = useQuery({
    queryKey: ['parceiro', id],
    queryFn: () => pedir<ParceiroComPromocoes>(`/api/bo/parceiros/${id}`),
    enabled: !novo,
  });
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const [original, setOriginal] = useState<Formulario | null>(novo ? VAZIO : null);
  const [f, setF] = useState<Formulario | null>(novo ? VAZIO : null);
  const [erros, setErros] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ promocao: Promocao | null } | null>(null);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();
  const hoje = diaEmLisboa();

  useEffect(() => {
    if (dados.data && original === null) {
      const inicial = doParceiro(dados.data.parceiro);
      setOriginal(inicial);
      setF(inicial);
    }
  }, [dados.data, original]);

  useEffect(() => {
    if (dados.data && parametro('nova') === 'promocao') {
      history.replaceState(null, '', `#/parceiros/${id}`);
      setEditor({ promocao: null });
    }
  }, [dados.data, id]);

  const sujo = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);
  useAvisoAoSair(sujo);

  if (dados.error) return <Vazio titulo={mensagemDe(dados.error)} />;
  if (!f) return <Esqueleto linhas={6} />;

  const mudar =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) => {
      setF((x) => (x ? { ...x, [k]: v } : x));
      setErros((e) => e.filter((c) => c !== k));
    };

  async function guardar() {
    if (!f) return;
    if (!f.nome.trim()) {
      setErros(['nome']);
      avisar('Falta o nome.', true);
      return;
    }
    try {
      if (novo) {
        const r = await pedir<{ id: number }>('/api/bo/parceiros', { metodo: 'POST', corpo: f });
        setOriginal(f);
        await refrescar();
        avisar('Parceiro criado. Agora, a primeira promoção.');
        history.replaceState(null, '', `#/parceiros/${r.id}?nova=promocao`);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        const enviado = f;
        const guardado = await pedir<ParceiroDoContrato>(`/api/bo/parceiros/${id}`, {
          metodo: 'PATCH',
          corpo: f,
        });
        // O formulário fica com o que ficou gravado (o servidor arruma os contactos:
        // «instagram.com/conta/» fica «conta»), menos o que se escreveu entretanto.
        const novoFormulario = doParceiro(guardado);
        setOriginal(novoFormulario);
        setF((agora) => (agora === enviado ? novoFormulario : agora));
        await refrescar();
        avisar('Guardado');
      }
    } catch (e) {
      if (e instanceof ErroDaApi && e.campos.length) setErros(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  const promocoes = dados.data?.promocoes ?? [];
  const naApp = !novo && f.activo && (dados.data?.parceiro.promocoesNaApp ?? 0) > 0;

  const reordenarPromocoes = async (novas: Promocao[]) => {
    try {
      await pedir('/api/bo/promocoes/ordem', {
        metodo: 'POST',
        corpo: { ids: novas.map((p) => p.id) },
      });
      await refrescar();
    } catch (e) {
      avisar(mensagemDe(e), true);
      await refrescar();
    }
  };
  const ligarPromocao = (p: Promocao) =>
    correr(
      async () => {
        await pedir(`/api/bo/promocoes/${p.id}`, { metodo: 'PATCH', corpo: { activa: !p.activa } });
        await refrescar();
      },
      p.activa ? 'Promoção desligada' : 'Promoção ligada',
    );
  const categoria = categorias.data?.find((k) => k.id === f.categoriaId);
  const primeira = promocoes.find((p) => p.estado === 'activa');

  return (
    <>
      <a className="voltar" href="#/parceiros">
        <Icone nome="voltar" tamanho={16} /> Parceiros
      </a>
      <div className="cabecalho">
        <div>
          <h1>{novo ? 'Novo parceiro' : f.nome || 'Parceiro'}</h1>
          {!novo && dados.data && (
            <p className="subtitulo">
              {!f.activo ? (
                <Etiqueta>Pausado: não aparece na app</Etiqueta>
              ) : dados.data.parceiro.promocoesNaApp > 0 ? (
                <Etiqueta tom="bom">Na app</Etiqueta>
              ) : (
                <Etiqueta tom="mau">Sem promoções: não aparece na app</Etiqueta>
              )}
            </p>
          )}
        </div>
        {naApp && (
          <a
            className="botao secundario"
            href={`${APP}/parceiro/${id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icone nome="aberto" tamanho={18} /> Ver na app
          </a>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 22,
          alignItems: 'start',
        }}
        className="editor-parceiro"
      >
        <div className="formulario">
          <div className="cartao recheado formulario">
            <Campo
              rotulo="Nome"
              valor={f.nome}
              mudar={mudar('nome')}
              max={LIMITES.nome}
              obrigatorio
              erro={erros.includes('nome')}
              autoFocus={novo}
            />
            <div className="duas-colunas">
              <Seletor<number>
                rotulo="Categoria"
                valor={f.categoriaId}
                mudar={mudar('categoriaId')}
                vazio="Sem categoria"
                opcoes={(categorias.data ?? []).map((k) => ({ valor: k.id, nome: k.nome }))}
              />
              <Campo
                rotulo="Localidade"
                valor={f.localidade}
                mudar={mudar('localidade')}
                max={LIMITES.localidade}
                placeholder="ex.: Oliveira de Azeméis"
              />
            </div>
            {(barbearia.data?.lojas.length ?? 0) > 1 && (
              <div className="duas-colunas">
                <Seletor<number>
                  rotulo="Casa"
                  valor={f.lojaId}
                  mudar={mudar('lojaId')}
                  vazio="Todas as casas"
                  opcoes={(barbearia.data?.lojas ?? []).map((l) => ({ valor: l.id, nome: l.nome }))}
                  ajuda="A app filtra os parceiros pela casa do cliente."
                />
              </div>
            )}
            <AreaDeTexto
              rotulo="Uma frase sobre o parceiro"
              valor={f.descricao}
              mudar={mudar('descricao')}
              max={LIMITES.descricao}
              erro={erros.includes('descricao')}
            />
            <Cores valor={f.cor} mudar={mudar('cor')} />
            <div className="duas-colunas">
              <CampoDeImagem
                rotulo="Logótipo"
                valor={f.logotipo}
                mudar={mudar('logotipo')}
                modo="logotipo"
                ajuda="Aparece num círculo branco."
              />
              <CampoDeImagem
                rotulo="Fotografia de capa"
                valor={f.capa}
                mudar={mudar('capa')}
                modo="capa"
                ajuda="Na horizontal. Sem capa, usa a cor."
              />
            </div>
          </div>

          <h2 className="seccao">Contactos</h2>
          <div className="cartao recheado formulario">
            <Campo
              rotulo="Morada"
              valor={f.morada}
              mudar={mudar('morada')}
              max={LIMITES.morada}
              ajuda="O botão «Ir» abre o mapa nesta morada."
            />
            <div className="duas-colunas">
              <Campo
                rotulo="Telefone"
                tipo="tel"
                valor={f.telefone}
                mudar={mudar('telefone')}
                max={LIMITES.telefone}
                erro={erros.includes('telefone')}
              />
              <Campo
                rotulo="Instagram"
                valor={f.instagram}
                mudar={mudar('instagram')}
                max={200}
                erro={erros.includes('instagram')}
                placeholder="@conta"
              />
            </div>
            <Campo
              rotulo="Site"
              tipo="url"
              valor={f.site}
              mudar={mudar('site')}
              max={LIMITES.site}
              erro={erros.includes('site')}
              placeholder="exemplo.pt"
            />
            <Campo
              rotulo="Horário"
              valor={f.horario}
              mudar={mudar('horario')}
              max={LIMITES.horario}
              placeholder="ex.: Seg a sáb · 9:00–19:00"
            />
          </div>

          <h2 className="seccao">Na app</h2>
          <div className="cartao recheado">
            <Interruptor
              ligado={f.activo}
              mudar={mudar('activo')}
              rotulo="Mostrar na app"
              ajuda="Desligado, o parceiro e as promoções dele saem da app."
            />
          </div>

          {!novo && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <h2 className="seccao">Promoções</h2>
                <button
                  type="button"
                  className="botao secundario pequeno"
                  onClick={() => setEditor({ promocao: null })}
                >
                  <Icone nome="mais" tamanho={16} /> Nova promoção
                </button>
              </div>
              <div className="cartao">
                {promocoes.length ? (
                  <ListaArrastavel
                    itens={promocoes}
                    chave={(p) => p.id}
                    nome={(p) => `${p.destaque} ${p.titulo}`}
                    aoReordenar={reordenarPromocoes}
                    desenhar={(p, pega) => (
                      <>
                        {promocoes.length > 1 && pega}
                        <button
                          type="button"
                          className="linha"
                          onClick={() => setEditor({ promocao: p })}
                        >
                          <ConteudoDaPromocao p={p} hoje={hoje} />
                        </button>
                        <button
                          type="button"
                          role="switch"
                          className="interruptor"
                          style={{ margin: '0 18px 0 4px' }}
                          aria-checked={p.activa}
                          aria-label={`${p.destaque} ${p.titulo}`}
                          onClick={() => ligarPromocao(p)}
                        />
                      </>
                    )}
                  />
                ) : (
                  <Vazio titulo="Ainda sem promoções">
                    Sem uma promoção ligada, o parceiro não aparece na app.
                  </Vazio>
                )}
              </div>
            </>
          )}

          <div className="gravar">
            <button
              type="button"
              className="botao"
              disabled={!sujo || aCorrer}
              onClick={() => correr(guardar)}
            >
              {novo ? 'Criar parceiro' : 'Guardar'}
            </button>
            {sujo && <span className="estado">Alterações por guardar</span>}
            {!novo && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (
                    await confirmar(
                      `Apagar ${f.nome}?`,
                      `O parceiro e ${promocoes.length === 1 ? 'a promoção dele saem' : `as ${promocoes.length} promoções dele saem`} da app e do backoffice. Não se desfaz. Para tirar só por uns tempos, desliga «Mostrar na app».`,
                      'Apagar',
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/parceiros/${id}`, { metodo: 'DELETE' });
                      setOriginal(f);
                      await refrescar();
                      ir('parceiros');
                    }, 'Parceiro apagado');
                }}
              >
                Apagar parceiro
              </button>
            )}
          </div>
        </div>

        <aside style={{ position: 'sticky', top: 24 }} className="lado-previsao">
          <div className="previsao" aria-label="Como fica na app">
            <div className="rotulo-previsao">Na app</div>
            <div
              className="capa-previsao"
              style={{ aspectRatio: '16 / 10', background: fundoDaCapa(f.cor) }}
            >
              {f.capa && <img className="fundo" src={urlDaImagem(f.capa)} alt="" />}
            </div>
            <div style={{ marginTop: -30, position: 'relative', paddingLeft: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: '50%',
                  border: '3px solid #0a0a0a',
                }}
              >
                <Logotipo nome={f.nome || '?'} cor={f.cor} logotipo={f.logotipo} tamanho={58} />
              </span>
              <div
                style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}
              >
                {f.nome || 'Nome do parceiro'}
              </div>
              <div style={{ color: '#aba69e', fontSize: 13, fontWeight: 600 }}>
                {[categoria?.nome, f.localidade].filter(Boolean).join(' · ')}
              </div>
              {f.descricao && (
                <div style={{ color: '#aba69e', fontSize: 14, marginTop: 8 }}>{f.descricao}</div>
              )}
            </div>
            {primeira && (
              <div className="cartao-promocao">
                <div className="grande">{primeira.destaque}</div>
                <div className="titulo-previsao">{primeira.titulo}</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {editor && !novo && dados.data && (
        <EditorDePromocao
          promocao={editor.promocao}
          parceiroFixo={dados.data.parceiro}
          fechar={() => setEditor(null)}
        />
      )}
      {dialogo}
    </>
  );
}
