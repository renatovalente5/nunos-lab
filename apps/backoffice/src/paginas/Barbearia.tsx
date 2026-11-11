import {
  LIMITES,
  dataCurta,
  diaEmLisboa,
  lerCoordenadas,
  type DefinicoesDaBarbearia,
  type Rede,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { ListaArrastavel } from '../arrastar';
import { linguaActual } from '../lingua';
import {
  Campo,
  Esqueleto,
  Gaveta,
  GrupoEmIngles,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { useTextos } from '../textos';
import { useAvisoAoSair, useRota } from '../util';
import { CamposDoPrograma, resumoDoPrograma, usePrograma } from './Fidelidade';

type LojaNoFormulario = {
  id?: number;
  chave: string;
  nome: string;
  morada: string;
  telefone: string;
  marcar: string;
  /** «40.884, -8.452»: latitude e longitude, como o Google Maps as dá. */
  coordenadas: string;
};
type Formulario = Omit<DefinicoesDaBarbearia, 'lojas' | 'avisoAte'> & {
  lojas: LojaNoFormulario[];
  avisoAte: string;
};

function formularioDe(d: DefinicoesDaBarbearia): Formulario {
  return {
    ...d,
    avisoEn: d.avisoEn ?? '',
    avisoAte: d.avisoAte ?? '',
    lojas: d.lojas.map((l) => ({
      id: l.id,
      chave: String(l.id),
      nome: l.nome,
      morada: l.morada,
      telefone: l.telefone,
      marcar: l.marcar,
      coordenadas: l.lat !== null && l.lng !== null ? `${l.lat}, ${l.lng}` : '',
    })),
  };
}

/** «40.884, -8.452» (ou uma ligação do Google Maps que as traga) → { lat, lng }; vazio → sem
 *  coordenadas; outra coisa → null. O mesmo leitor das coordenadas dos parceiros. */
const coordenadasDe = lerCoordenadas;

const DO_AVISO = ['aviso', 'avisoEn', 'avisoAte'];
const DAS_REDES = ['instagram', 'tiktok', 'whatsapp', 'site'];

/**
 * A barbearia na app, em gavetas que abrem e fecham (8 nov): o aviso, o cartão de fidelidade (que
 * era uma página à parte), as lojas uma a uma e as redes. Fechadas, cabem num ecrã com um resumo
 * cada; um «Guardar» só grava o que mudou.
 */
export function Barbearia() {
  const t = useTextos();
  const rota = useRota();
  const { data } = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const programa = usePrograma();
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

  useEffect(() => {
    if (data && !original) {
      const inicial = formularioDe(data);
      setOriginal(inicial);
      setF(inicial);
    }
  }, [data, original]);
  const sujoDaBarbearia = useMemo(
    () => JSON.stringify(f) !== JSON.stringify(original),
    [f, original],
  );
  const sujo = sujoDaBarbearia || programa.sujo;
  useAvisoAoSair(sujo);
  if (!f || !programa.f) return <Esqueleto linhas={6} />;

  const mudarLoja = (chave: string, campo: keyof LojaNoFormulario, valor: string) =>
    setF({ ...f, lojas: f.lojas.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)) });

  async function guardarBarbearia(): Promise<boolean> {
    if (!f) return false;
    const semNome = f.lojas.flatMap((l, i) => (l.nome.trim() ? [] : [`lojas.${i}.nome`]));
    if (semNome.length) {
      setErros(semNome);
      avisar(t.barbearia.lojaSemNome, true);
      return false;
    }
    const malEscritas = f.lojas.flatMap((l, i) =>
      coordenadasDe(l.coordenadas) ? [] : [`lojas.${i}.coordenadas`],
    );
    if (malEscritas.length) {
      setErros(malEscritas);
      avisar(t.barbearia.coordenadasErradas, true);
      return false;
    }
    const enviado = f;
    try {
      const guardado = await pedir<DefinicoesDaBarbearia>('/api/bo/barbearia', {
        metodo: 'PUT',
        corpo: {
          ...f,
          avisoAte: f.avisoAte || null,
          lojas: f.lojas.map(({ id, nome, morada, telefone, marcar, coordenadas }) => ({
            ...(id ? { id } : {}),
            nome,
            morada,
            telefone,
            marcar,
            ...coordenadasDe(coordenadas),
          })),
        },
      });
      // O formulário fica com o que a API diz que gravou (as lojas novas já com o
      // id), menos o que se escreveu enquanto gravava: isso fica por guardar.
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      setErros([]);
      return true;
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos);
      avisar(mensagemDe(e), true);
      return false;
    }
  }

  async function guardar() {
    if (programa.sujo && !(await programa.guardar())) return;
    if (sujoDaBarbearia && !(await guardarBarbearia())) return;
    await refrescar();
    avisar(t.barbearia.guardado);
  }

  const resumoDoAviso = f.aviso.trim()
    ? [
        f.aviso.trim(),
        f.avisoAte && t.barbearia.ateCurto(dataCurta(f.avisoAte, diaEmLisboa(), linguaActual())),
      ]
        .filter(Boolean)
        .join(' · ')
    : t.barbearia.semAviso;
  const nomeDaRede = (r: Rede) =>
    r === 'whatsapp'
      ? 'WhatsApp'
      : r === 'instagram'
        ? 'Instagram'
        : r === 'tiktok'
          ? 'TikTok'
          : t.barbearia.site;
  const resumoDasRedes =
    f.redes
      .filter((r) => f[r])
      .map(nomeDaRede)
      .join(' · ') || t.barbearia.porPreencher;
  // Cada rede é um campo; a ordem da lista é a da app (o Nuno arrasta-as, 8 nov).
  const campoDaRede = (r: Rede) =>
    r === 'instagram' ? (
      <Campo
        rotulo="Instagram"
        valor={f.instagram}
        mudar={(instagram) => setF({ ...f, instagram })}
        max={200}
        erro={erros.includes('instagram')}
        erroTexto={t.barbearia.instagramErrado}
        placeholder={t.barbearia.conta}
      />
    ) : r === 'tiktok' ? (
      <Campo
        rotulo="TikTok"
        tipo="url"
        valor={f.tiktok}
        mudar={(tiktok) => setF({ ...f, tiktok })}
        max={200}
        erro={erros.includes('tiktok')}
        erroTexto={t.barbearia.tiktokErrado}
        placeholder="https://www.tiktok.com/@…"
      />
    ) : r === 'whatsapp' ? (
      <Campo
        rotulo={t.barbearia.whatsapp}
        tipo="url"
        valor={f.whatsapp}
        mudar={(whatsapp) => setF({ ...f, whatsapp })}
        max={200}
        erro={erros.includes('whatsapp')}
        erroTexto={t.barbearia.whatsappErrado}
        placeholder="https://wa.link/…"
      />
    ) : (
      <Campo
        rotulo={t.barbearia.site}
        tipo="url"
        valor={f.site}
        mudar={(site) => setF({ ...f, site })}
        max={LIMITES.site}
        erro={erros.includes('site')}
        erroTexto={t.barbearia.siteErrado}
      />
    );

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.barbearia}</h1>
          <p className="subtitulo">{t.barbearia.subtitulo}</p>
        </div>
      </div>

      <div className="gavetas">
        <Gaveta
          id="barbearia.aviso"
          titulo={t.barbearia.aviso}
          resumo={resumoDoAviso}
          erro={erros.some((e) => DO_AVISO.includes(e))}
        >
          <div className="formulario">
            <Campo
              rotulo={t.barbearia.texto}
              valor={f.aviso}
              mudar={(aviso) => setF({ ...f, aviso })}
              max={LIMITES.aviso}
              erro={erros.includes('aviso')}
              placeholder={t.barbearia.avisoExemplo}
              ajuda={t.barbearia.avisoVazio}
            />
            <GrupoEmIngles
              pares={[
                {
                  campo: 'aviso',
                  pt: f.aviso,
                  definir: (avisoEn) => setF((x) => (x ? { ...x, avisoEn } : x)),
                },
              ]}
            >
              <Campo
                rotulo={t.barbearia.texto}
                valor={f.avisoEn}
                mudar={(avisoEn) => setF({ ...f, avisoEn })}
                max={LIMITES.aviso}
                erro={erros.includes('avisoEn')}
                placeholder={t.barbearia.avisoExemploEn}
              />
            </GrupoEmIngles>
            <div className="duas-colunas">
              <Campo
                rotulo={t.barbearia.ate}
                tipo="date"
                valor={f.avisoAte}
                mudar={(avisoAte) => setF({ ...f, avisoAte })}
                erro={erros.includes('avisoAte')}
                ajuda={t.barbearia.ateVazio}
              />
            </div>
          </div>
        </Gaveta>

        <Gaveta
          id="barbearia.cartao"
          titulo={t.barbearia.cartao}
          resumo={resumoDoPrograma(programa.f, t, linguaActual())}
          erro={programa.erros.length > 0}
          abertaDeInicio={rota[0] === 'fidelidade'}
        >
          <CamposDoPrograma programa={programa} />
        </Gaveta>

        <Gaveta
          id="barbearia.lojas"
          titulo={t.barbearia.lojas}
          resumo={f.lojas.map((l) => l.nome || t.barbearia.lojaNova).join(' · ')}
          erro={erros.some((e) => e.startsWith('lojas.'))}
        >
          <div className="formulario">
            <ListaArrastavel
              como="div"
              className="linhas-de-gavetas"
              itens={f.lojas}
              chave={(l) => l.chave}
              nome={(l) => l.nome || t.barbearia.lojaNova}
              aoReordenar={(lojas) => setF({ ...f, lojas })}
              desenhar={(l, pega) => {
                const i = f.lojas.findIndex((x) => x.chave === l.chave);
                const errado = (campo: string) => erros.includes(`lojas.${i}.${campo}`);
                return (
                  <div className="com-pega">
                    {pega}
                    <Gaveta
                      interior
                      titulo={l.nome || t.barbearia.lojaNova}
                      resumo={l.morada || t.barbearia.semMorada}
                      erro={erros.some((e) => e.startsWith(`lojas.${i}.`))}
                      abertaDeInicio={!l.id}
                    >
                      <div className="formulario">
                        <div className="duas-colunas">
                          <Campo
                            rotulo={t.barbearia.nome}
                            valor={l.nome}
                            mudar={(v) => mudarLoja(l.chave, 'nome', v)}
                            max={LIMITES.loja}
                            erro={errado('nome')}
                            obrigatorio
                          />
                          <Campo
                            rotulo={t.barbearia.telefone}
                            tipo="tel"
                            valor={l.telefone}
                            mudar={(v) => mudarLoja(l.chave, 'telefone', v)}
                            max={LIMITES.telefone}
                            erro={errado('telefone')}
                            erroTexto={t.barbearia.telefoneErrado}
                          />
                        </div>
                        <Campo
                          rotulo={t.barbearia.morada}
                          valor={l.morada}
                          mudar={(v) => mudarLoja(l.chave, 'morada', v)}
                          max={LIMITES.morada}
                          erro={errado('morada')}
                        />
                        <Campo
                          rotulo={t.barbearia.coordenadas}
                          valor={l.coordenadas}
                          mudar={(v) => mudarLoja(l.chave, 'coordenadas', v)}
                          max={40}
                          erro={errado('coordenadas')}
                          placeholder="40.884, -8.452"
                          ajuda={t.barbearia.coordenadasAjuda}
                        />
                        <Campo
                          rotulo={t.barbearia.marcacao}
                          tipo="url"
                          valor={l.marcar}
                          mudar={(v) => mudarLoja(l.chave, 'marcar', v)}
                          max={500}
                          erro={errado('marcar')}
                          erroTexto={t.barbearia.marcacaoErrada}
                          ajuda={t.barbearia.marcacaoAjuda}
                        />
                        <div>
                          <button
                            type="button"
                            className="botao perigo pequeno"
                            onClick={async () => {
                              // Uma loja que já existe leva coisas com ela: pergunta-se primeiro.
                              if (
                                l.id &&
                                !(await confirmar(
                                  t.barbearia.tirarPergunta(l.nome),
                                  t.barbearia.tirarTexto,
                                  t.barbearia.tirar,
                                ))
                              )
                                return;
                              setF((x) =>
                                x ? { ...x, lojas: x.lojas.filter((y) => y.chave !== l.chave) } : x,
                              );
                            }}
                          >
                            {t.barbearia.tirarEstaLoja}
                          </button>
                        </div>
                      </div>
                    </Gaveta>
                  </div>
                );
              }}
            />
            <div>
              <button
                type="button"
                className="botao secundario"
                onClick={() =>
                  setF({
                    ...f,
                    lojas: [
                      ...f.lojas,
                      {
                        chave: `nova-${Date.now()}`,
                        nome: '',
                        morada: '',
                        telefone: '',
                        marcar: '',
                        coordenadas: '',
                      },
                    ],
                  })
                }
              >
                <Icone nome="mais" tamanho={18} /> {t.barbearia.juntarLoja}
              </button>
            </div>
          </div>
        </Gaveta>

        <Gaveta
          id="barbearia.redes"
          titulo={t.barbearia.redes}
          resumo={resumoDasRedes}
          erro={erros.some((e) => DAS_REDES.includes(e))}
        >
          <div className="formulario">
            <div className="ajuda">{t.barbearia.ordemNaApp}</div>
            <ListaArrastavel
              como="div"
              className="campos-ordenaveis"
              itens={f.redes}
              chave={(r) => r}
              nome={nomeDaRede}
              aoReordenar={(redes) => setF({ ...f, redes })}
              desenhar={(r, pega) => (
                <div className="com-pega campo-ordenavel">
                  {pega}
                  <div className="campo-da-rede">{campoDaRede(r)}</div>
                </div>
              )}
            />
          </div>
        </Gaveta>
      </div>

      <div className="gravar">
        <button
          type="button"
          className="botao"
          disabled={!sujo || aCorrer}
          onClick={() => correr(guardar)}
        >
          {t.barbearia.guardar}
        </button>
        {sujo && <span className="estado">{t.barbearia.porGuardar}</span>}
      </div>
      {dialogo}
    </>
  );
}
