import { LIMITES, type DefinicoesDaBarbearia } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { Campo, Esqueleto, Icone, useAccao, useAvisar } from '../pecas';
import { ListaArrastavel } from '../arrastar';
import { useAvisoAoSair } from '../util';

type LojaNoFormulario = {
  id?: number;
  chave: string;
  nome: string;
  morada: string;
  telefone: string;
  marcar: string;
};
type Formulario = Omit<DefinicoesDaBarbearia, 'lojas' | 'avisoAte'> & {
  lojas: LojaNoFormulario[];
  avisoAte: string;
};

function formularioDe(d: DefinicoesDaBarbearia): Formulario {
  return {
    ...d,
    avisoAte: d.avisoAte ?? '',
    lojas: d.lojas.map((l) => ({
      id: l.id,
      chave: String(l.id),
      nome: l.nome,
      morada: l.morada,
      telefone: l.telefone,
      marcar: l.marcar,
    })),
  };
}

export function Barbearia() {
  const { data } = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();

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
      avisar('Cada loja precisa de um nome.', true);
      return;
    }
    const enviado = f;
    try {
      const guardado = await pedir<DefinicoesDaBarbearia>('/api/bo/barbearia', {
        metodo: 'PUT',
        corpo: {
          ...f,
          avisoAte: f.avisoAte || null,
          lojas: f.lojas.map(({ id, nome, morada, telefone, marcar }) => ({
            ...(id ? { id } : {}),
            nome,
            morada,
            telefone,
            marcar,
          })),
        },
      });
      // O formulário fica com o que a API diz que gravou (as lojas novas já com o
      // id), menos o que se escreveu enquanto gravava: isso fica por guardar.
      const novo = formularioDe(guardado);
      setOriginal(novo);
      setF((agora) => (agora === enviado ? novo : agora));
      await refrescar();
      avisar('Guardado');
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
          <h1>Barbearia</h1>
          <p className="subtitulo">
            O separador «Barbearia» da app: as lojas, as marcações e as redes.
          </p>
        </div>
      </div>

      <h2 className="seccao" style={{ marginTop: 0 }}>
        Aviso no topo da app
      </h2>
      <div className="cartao recheado formulario">
        <Campo
          rotulo="Texto"
          valor={f.aviso}
          mudar={(aviso) => setF({ ...f, aviso })}
          max={LIMITES.aviso}
          erro={erros.includes('aviso')}
          placeholder="ex.: Novos parceiros esta semana"
          ajuda="Vazio: sem aviso."
        />
        <div className="duas-colunas">
          <Campo
            rotulo="Até"
            tipo="date"
            valor={f.avisoAte}
            mudar={(avisoAte) => setF({ ...f, avisoAte })}
            erro={erros.includes('avisoAte')}
            ajuda="Vazio: fica até o tirares."
          />
        </div>
      </div>

      <h2 className="seccao">Lojas</h2>
      <div className="formulario">
        <ListaArrastavel
          como="div"
          className="formulario"
          itens={f.lojas}
          chave={(l) => l.chave}
          nome={(l) => l.nome || 'Loja nova'}
          aoReordenar={(lojas) => setF({ ...f, lojas })}
          desenhar={(l, pega) => {
            const i = f.lojas.findIndex((x) => x.chave === l.chave);
            const errado = (campo: string) => erros.includes(`lojas.${i}.${campo}`);
            return (
              <div className="cartao recheado formulario">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pega}
                  <strong style={{ flex: 1, minWidth: 0 }}>{l.nome || 'Loja nova'}</strong>
                  <button
                    type="button"
                    className="botao perigo pequeno"
                    onClick={() =>
                      setF({ ...f, lojas: f.lojas.filter((x) => x.chave !== l.chave) })
                    }
                  >
                    Tirar
                  </button>
                </div>
                <div className="duas-colunas">
                  <Campo
                    rotulo="Nome"
                    valor={l.nome}
                    mudar={(v) => mudarLoja(l.chave, 'nome', v)}
                    max={LIMITES.loja}
                    erro={errado('nome')}
                    obrigatorio
                  />
                  <Campo
                    rotulo="Telefone"
                    tipo="tel"
                    valor={l.telefone}
                    mudar={(v) => mudarLoja(l.chave, 'telefone', v)}
                    max={LIMITES.telefone}
                    erro={errado('telefone')}
                  />
                </div>
                <Campo
                  rotulo="Morada"
                  valor={l.morada}
                  mudar={(v) => mudarLoja(l.chave, 'morada', v)}
                  max={LIMITES.morada}
                  erro={errado('morada')}
                />
                <Campo
                  rotulo="Ligação de marcação"
                  tipo="url"
                  valor={l.marcar}
                  mudar={(v) => mudarLoja(l.chave, 'marcar', v)}
                  max={500}
                  erro={errado('marcar')}
                  ajuda={
                    i === 0
                      ? 'A página da Fresha de cada loja. O botão «Marcar» abre-a.'
                      : undefined
                  }
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
                  { chave: `nova-${Date.now()}`, nome: '', morada: '', telefone: '', marcar: '' },
                ],
              })
            }
          >
            <Icone nome="mais" tamanho={18} /> Juntar loja
          </button>
        </div>
      </div>

      <h2 className="seccao">Redes e contactos</h2>
      <div className="cartao recheado formulario">
        <div className="duas-colunas">
          <Campo
            rotulo="Instagram"
            valor={f.instagram}
            mudar={(instagram) => setF({ ...f, instagram })}
            max={200}
            erro={erros.includes('instagram')}
            placeholder="@conta"
          />
          <Campo
            rotulo="TikTok"
            tipo="url"
            valor={f.tiktok}
            mudar={(tiktok) => setF({ ...f, tiktok })}
            max={200}
            erro={erros.includes('tiktok')}
            placeholder="https://www.tiktok.com/@…"
          />
        </div>
        <div className="duas-colunas">
          <Campo
            rotulo="WhatsApp das tatuagens"
            tipo="url"
            valor={f.whatsapp}
            mudar={(whatsapp) => setF({ ...f, whatsapp })}
            max={200}
            erro={erros.includes('whatsapp')}
            placeholder="https://wa.link/…"
          />
          <Campo
            rotulo="Site"
            tipo="url"
            valor={f.site}
            mudar={(site) => setF({ ...f, site })}
            max={LIMITES.site}
            erro={erros.includes('site')}
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
          Guardar
        </button>
        {sujo && <span className="estado">Alterações por guardar</span>}
      </div>
    </>
  );
}
