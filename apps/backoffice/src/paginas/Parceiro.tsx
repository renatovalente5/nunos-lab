import {
  LIMITES,
  diaEmLisboa,
  type CategoriaComContagem,
  type DefinicoesDaBarbearia,
  type Parceiro as ParceiroDoContrato,
  type ParceiroComPromocoes,
  type Promocao,
} from '@nunos-lab/dominio';
import {
  naLingua,
  normalizarInstagram,
  normalizarSite,
  normalizarTelefone,
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
  Gaveta,
  GrupoEmIngles,
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
import { useLingua } from '../lingua';
import { useTextos } from '../textos';
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
  /** Em inglês: vazio, a app em inglês mostra o português. */
  horarioEn: string;
  descricaoEn: string;
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
  horarioEn: '',
  descricaoEn: '',
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
    horarioEn: p.horarioEn ?? '',
    descricaoEn: p.descricaoEn ?? '',
    cor: p.cor,
    logotipo: p.logotipo,
    capa: p.capa,
    activo: p.activo,
  };
}

const DOS_CONTACTOS = ['morada', 'telefone', 'instagram', 'site', 'horario'];

export function Parceiro({ id }: { id: string }) {
  const t = useTextos();
  const lingua = useLingua();
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
      avisar(t.parceiro.faltaONome, true);
      return;
    }
    // Os contactos conferem-se aqui, com as regras da API, para dizer o quê antes de enviar.
    const errados = [
      normalizarInstagram(f.instagram) === null && 'instagram',
      normalizarTelefone(f.telefone) === null && 'telefone',
      normalizarSite(f.site) === null && 'site',
    ].filter((x): x is string => typeof x === 'string');
    if (errados.length) {
      setErros(errados);
      avisar(t.parceiro.reveOsCampos, true);
      return;
    }
    try {
      if (novo) {
        const r = await pedir<{ id: number }>('/api/bo/parceiros', { metodo: 'POST', corpo: f });
        setOriginal(f);
        await refrescar();
        avisar(t.parceiro.criado);
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
        avisar(t.parceiro.guardado);
      }
    } catch (e) {
      // Uma imagem escolhida há dias já saiu da base: volta-se a escolher só ela.
      if (e instanceof ErroDaApi && e.codigo === 'referencia' && (f.logotipo || f.capa)) {
        setF((x) => (x ? { ...x, logotipo: null, capa: null } : x));
        setErros([f.logotipo && 'logotipo', f.capa && 'capa'].filter(Boolean) as string[]);
        avisar(t.parceiro.imagemCaducou, true);
        return;
      }
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
      p.activa ? t.parceiro.promocaoDesligada : t.parceiro.promocaoLigada,
    );
  const categoria = categorias.data?.find((k) => k.id === f.categoriaId);
  // O parceiro e a categoria, para a tradução escolher as palavras («Azeméis Motor — Carros»).
  const onde = categoria ? `${f.nome} — ${categoria.nome}` : f.nome;
  const primeira = promocoes.find((p) => p.estado === 'activa');
  // A pré-visualização na língua do backoffice: em inglês, os textos em inglês (ou o português).
  const naLinguaDoBackoffice = (pt: string, en: string | undefined) => naLingua(lingua, pt, en);

  return (
    <>
      <a className="voltar" href="#/parceiros">
        <Icone nome="voltar" tamanho={16} /> {t.geral.seccoes.parceiros}
      </a>
      <div className="cabecalho">
        <div>
          <h1>{novo ? t.parceiro.novo : f.nome || t.parceiro.parceiro}</h1>
          {!novo && dados.data && (
            <p className="subtitulo">
              {!f.activo ? (
                <Etiqueta>{t.parceiro.pausado}</Etiqueta>
              ) : dados.data.parceiro.promocoesNaApp > 0 ? (
                <Etiqueta tom="bom">{t.parceiro.naApp}</Etiqueta>
              ) : (
                <Etiqueta tom="mau">{t.parceiro.semPromocoes}</Etiqueta>
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
            <Icone nome="aberto" tamanho={18} /> {t.parceiro.verNaApp}
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
              rotulo={t.parceiro.nome}
              valor={f.nome}
              mudar={mudar('nome')}
              max={LIMITES.nome}
              obrigatorio
              erro={erros.includes('nome')}
              autoFocus={novo}
            />
            <div className="duas-colunas">
              <Seletor<number>
                rotulo={t.parceiro.categoria}
                valor={f.categoriaId}
                mudar={mudar('categoriaId')}
                vazio={t.parceiro.semCategoria}
                opcoes={(categorias.data ?? []).map((k) => ({ valor: k.id, nome: k.nome }))}
              />
              <Campo
                rotulo={t.parceiro.localidade}
                valor={f.localidade}
                mudar={mudar('localidade')}
                max={LIMITES.localidade}
                placeholder={t.parceiro.localidadeExemplo}
              />
            </div>
            {(barbearia.data?.lojas.length ?? 0) > 1 && (
              <div className="duas-colunas">
                <Seletor<number>
                  rotulo={t.parceiro.casa}
                  valor={f.lojaId}
                  mudar={mudar('lojaId')}
                  vazio={t.parceiro.todasAsCasas}
                  opcoes={(barbearia.data?.lojas ?? []).map((l) => ({ valor: l.id, nome: l.nome }))}
                  ajuda={t.parceiro.casaAjuda}
                />
              </div>
            )}
            <AreaDeTexto
              rotulo={t.parceiro.descricao}
              valor={f.descricao}
              mudar={mudar('descricao')}
              max={LIMITES.descricao}
              erro={erros.includes('descricao')}
            />
            <Cores valor={f.cor} mudar={mudar('cor')} />
            <div className="duas-colunas">
              <CampoDeImagem
                rotulo={t.parceiro.logotipo}
                valor={f.logotipo}
                mudar={mudar('logotipo')}
                modo="logotipo"
                ajuda={t.parceiro.logotipoAjuda}
                erro={erros.includes('logotipo')}
              />
              <CampoDeImagem
                rotulo={t.parceiro.capa}
                valor={f.capa}
                mudar={mudar('capa')}
                modo="capa"
                ajuda={t.parceiro.capaAjuda}
                erro={erros.includes('capa')}
              />
            </div>
            <Interruptor
              ligado={f.activo}
              mudar={mudar('activo')}
              rotulo={t.parceiro.mostrarNaApp}
              ajuda={t.parceiro.mostrarNaAppAjuda}
            />
          </div>

          <div className="gavetas">
            <Gaveta
              id="parceiro.contactos"
              titulo={t.parceiro.contactos}
              resumo={
                [
                  f.morada && t.parceiro.morada,
                  f.telefone && t.parceiro.telefone,
                  f.instagram && 'Instagram',
                  f.site && t.parceiro.site,
                  f.horario && t.parceiro.horario,
                ]
                  .filter(Boolean)
                  .join(' · ') || t.parceiro.porPreencher
              }
              erro={DOS_CONTACTOS.some((c) => erros.includes(c))}
            >
              <div className="formulario">
                <Campo
                  rotulo={t.parceiro.morada}
                  valor={f.morada}
                  mudar={mudar('morada')}
                  max={LIMITES.morada}
                  ajuda={t.parceiro.moradaAjuda}
                />
                <div className="duas-colunas">
                  <Campo
                    rotulo={t.parceiro.telefone}
                    tipo="tel"
                    valor={f.telefone}
                    mudar={mudar('telefone')}
                    max={LIMITES.telefone}
                    erro={erros.includes('telefone')}
                    erroTexto={t.parceiro.razoes.telefone}
                  />
                  <Campo
                    rotulo="Instagram"
                    valor={f.instagram}
                    mudar={mudar('instagram')}
                    max={200}
                    erro={erros.includes('instagram')}
                    erroTexto={t.parceiro.razoes.instagram}
                    placeholder={t.parceiro.conta}
                  />
                </div>
                <Campo
                  rotulo={t.parceiro.site}
                  tipo="url"
                  valor={f.site}
                  mudar={mudar('site')}
                  max={LIMITES.site}
                  erro={erros.includes('site')}
                  erroTexto={t.parceiro.razoes.site}
                  placeholder={t.parceiro.siteExemplo}
                />
                <Campo
                  rotulo={t.parceiro.horario}
                  valor={f.horario}
                  mudar={mudar('horario')}
                  max={LIMITES.horario}
                  placeholder={t.parceiro.horarioExemplo}
                />
              </div>
            </Gaveta>

            <GrupoEmIngles
              seccao
              pares={[
                { campo: 'descricao', pt: f.descricao, definir: mudar('descricaoEn'), onde },
                { campo: 'horario', pt: f.horario, definir: mudar('horarioEn'), onde },
              ]}
            >
              <AreaDeTexto
                rotulo={t.parceiro.descricao}
                valor={f.descricaoEn}
                mudar={mudar('descricaoEn')}
                max={LIMITES.descricao}
                erro={erros.includes('descricaoEn')}
              />
              <Campo
                rotulo={t.parceiro.horario}
                valor={f.horarioEn}
                mudar={mudar('horarioEn')}
                max={LIMITES.horario}
                placeholder={t.parceiro.horarioExemploEn}
              />
            </GrupoEmIngles>

            {!novo && (
              <Gaveta
                id="parceiro.promocoes"
                titulo={t.geral.seccoes.promocoes}
                resumo={t.parceiro.resumoDasPromocoes(
                  promocoes.length,
                  promocoes.filter((p) => p.estado === 'activa').length,
                )}
                lista
              >
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
                  <Vazio titulo={t.parceiro.aindaSemPromocoes}>
                    {t.parceiro.semPromocaoLigada}
                  </Vazio>
                )}
                <div className="pe-gaveta">
                  <button
                    type="button"
                    className="botao secundario"
                    onClick={() => setEditor({ promocao: null })}
                  >
                    <Icone nome="mais" tamanho={18} /> {t.parceiro.novaPromocao}
                  </button>
                </div>
              </Gaveta>
            )}
          </div>

          <div className="gravar">
            <button
              type="button"
              className="botao"
              disabled={!sujo || aCorrer}
              onClick={() => correr(guardar)}
            >
              {novo ? t.parceiro.criarParceiro : t.parceiro.guardar}
            </button>
            {sujo && <span className="estado">{t.parceiro.porGuardar}</span>}
            {!novo && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (
                    await confirmar(
                      t.parceiro.apagarPergunta(f.nome),
                      t.parceiro.apagarTexto(promocoes.length),
                      t.parceiro.apagar,
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/parceiros/${id}`, { metodo: 'DELETE' });
                      setOriginal(f);
                      await refrescar();
                      ir('parceiros');
                    }, t.parceiro.apagado);
                }}
              >
                {t.parceiro.apagarParceiro}
              </button>
            )}
          </div>
        </div>

        <aside style={{ position: 'sticky', top: 24 }} className="lado-previsao">
          <div className="previsao" aria-label={t.geral.previsao.rotulo}>
            <div className="rotulo-previsao">{t.geral.previsao.naApp}</div>
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
                {f.nome || t.parceiro.nomeDoParceiro}
              </div>
              <div style={{ color: '#aba69e', fontSize: 13, fontWeight: 600 }}>
                {[categoria && naLinguaDoBackoffice(categoria.nome, categoria.nomeEn), f.localidade]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {f.descricao && (
                <div style={{ color: '#aba69e', fontSize: 14, marginTop: 8 }}>
                  {naLinguaDoBackoffice(f.descricao, f.descricaoEn)}
                </div>
              )}
            </div>
            {primeira && (
              <div className="cartao-promocao">
                <div className="grande">
                  {naLinguaDoBackoffice(primeira.destaque, primeira.destaqueEn)}
                </div>
                <div className="titulo-previsao">
                  {naLinguaDoBackoffice(primeira.titulo, primeira.tituloEn)}
                </div>
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
