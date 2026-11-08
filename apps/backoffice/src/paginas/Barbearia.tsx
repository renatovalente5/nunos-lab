import { LIMITES, type DefinicoesDaBarbearia } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import {
  Campo,
  Esqueleto,
  GrupoEmIngles,
  Icone,
  useAccao,
  useAvisar,
  useConfirmar,
} from '../pecas';
import { ListaArrastavel } from '../arrastar';
import { useTextos } from '../textos';
import { useAvisoAoSair } from '../util';

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

/** «40.884, -8.452» → { lat, lng }; vazio → sem coordenadas; outra coisa → null. */
function coordenadasDe(texto: string): { lat: number | null; lng: number | null } | null {
  const t = texto.trim();
  if (!t) return { lat: null, lng: null };
  const m = /^(-?\d{1,2}(?:\.\d+)?)[\s,;]+(-?\d{1,3}(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function Barbearia() {
  const t = useTextos();
  const { data } = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
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
  const sujo = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);
  useAvisoAoSair(sujo);
  if (!f) return <Esqueleto linhas={6} />;

  const mudarLoja = (chave: string, campo: keyof LojaNoFormulario, valor: string) =>
    setF({ ...f, lojas: f.lojas.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)) });

  async function guardar() {
    if (!f) return;
    if (f.lojas.some((l) => !l.nome.trim())) {
      avisar(t.barbearia.lojaSemNome, true);
      return;
    }
    const malEscritas = f.lojas.map((l, i) => (coordenadasDe(l.coordenadas) ? null : i));
    if (malEscritas.some((i) => i !== null)) {
      setErros(malEscritas.filter((i) => i !== null).map((i) => `lojas.${i}.coordenadas`));
      avisar(t.barbearia.coordenadasErradas, true);
      return;
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
      await refrescar();
      avisar(t.barbearia.guardado);
      setErros([]);
    } catch (e) {
      if (e instanceof ErroDaApi) setErros(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.barbearia}</h1>
          <p className="subtitulo">{t.barbearia.subtitulo}</p>
        </div>
      </div>

      <h2 className="seccao" style={{ marginTop: 0 }}>
        {t.barbearia.aviso}
      </h2>
      <div className="cartao recheado formulario">
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

      <h2 className="seccao">{t.barbearia.lojas}</h2>
      <div className="formulario">
        <ListaArrastavel
          como="div"
          className="formulario"
          itens={f.lojas}
          chave={(l) => l.chave}
          nome={(l) => l.nome || t.barbearia.lojaNova}
          aoReordenar={(lojas) => setF({ ...f, lojas })}
          desenhar={(l, pega) => {
            const i = f.lojas.findIndex((x) => x.chave === l.chave);
            const errado = (campo: string) => erros.includes(`lojas.${i}.${campo}`);
            return (
              <div className="cartao recheado formulario">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pega}
                  <strong style={{ flex: 1, minWidth: 0 }}>{l.nome || t.barbearia.lojaNova}</strong>
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
                    {t.barbearia.tirar}
                  </button>
                </div>
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
                  ajuda={i === 0 ? t.barbearia.coordenadasAjuda : undefined}
                />
                <Campo
                  rotulo={t.barbearia.marcacao}
                  tipo="url"
                  valor={l.marcar}
                  mudar={(v) => mudarLoja(l.chave, 'marcar', v)}
                  max={500}
                  erro={errado('marcar')}
                  erroTexto={t.barbearia.marcacaoErrada}
                  ajuda={i === 0 ? t.barbearia.marcacaoAjuda : undefined}
                />
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

      <h2 className="seccao">{t.barbearia.redes}</h2>
      <div className="cartao recheado formulario">
        <div className="duas-colunas">
          <Campo
            rotulo="Instagram"
            valor={f.instagram}
            mudar={(instagram) => setF({ ...f, instagram })}
            max={200}
            erro={erros.includes('instagram')}
            erroTexto={t.barbearia.instagramErrado}
            placeholder={t.barbearia.conta}
          />
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
        </div>
        <div className="duas-colunas">
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
          <Campo
            rotulo={t.barbearia.site}
            tipo="url"
            valor={f.site}
            mudar={(site) => setF({ ...f, site })}
            max={LIMITES.site}
            erro={erros.includes('site')}
            erroTexto={t.barbearia.siteErrado}
          />
        </div>
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
