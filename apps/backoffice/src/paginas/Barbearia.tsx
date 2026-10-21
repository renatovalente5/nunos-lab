import { LIMITES, type DefinicoesDaBarbearia } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import { Campo, Esqueleto, Icone, useAccao, useAvisar } from '../pecas';
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
      const inicial: Formulario = {
        ...data,
        avisoAte: data.avisoAte ?? '',
        lojas: data.lojas.map((l) => ({
          id: l.id,
          chave: String(l.id),
          nome: l.nome,
          morada: l.morada,
          telefone: l.telefone,
          marcar: l.marcar,
        })),
      };
      setOriginal(inicial);
      setF(inicial);
    }
  }, [data, original]);
  const sujo = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);
  useAvisoAoSair(sujo);
  if (!f) return <Esqueleto linhas={6} />;

  const mudarLoja = (i: number, campo: keyof LojaNoFormulario, valor: string) =>
    setF({ ...f, lojas: f.lojas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)) });
  const mover = (i: number, d: -1 | 1) => {
    const lojas = [...f.lojas];
    [lojas[i], lojas[i + d]] = [lojas[i + d]!, lojas[i]!];
    setF({ ...f, lojas });
  };

  async function guardar() {
    if (!f) return;
    if (f.lojas.some((l) => !l.nome.trim())) {
      avisar('Cada loja precisa de um nome.', true);
      return;
    }
    try {
      await pedir('/api/bo/barbearia', {
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
      setOriginal(null);
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
          placeholder="Novos parceiros esta semana"
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
        {f.lojas.map((l, i) => (
          <div key={l.chave} className="cartao recheado formulario">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <strong>{l.nome || 'Loja nova'}</strong>
              <div className="botoes">
                <button
                  type="button"
                  className="botao secundario icone"
                  aria-label={`Subir ${l.nome}`}
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                >
                  <Icone nome="subir" tamanho={18} />
                </button>
                <button
                  type="button"
                  className="botao secundario icone"
                  aria-label={`Descer ${l.nome}`}
                  disabled={i === f.lojas.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  <Icone nome="descer" tamanho={18} />
                </button>
                <button
                  type="button"
                  className="botao perigo pequeno"
                  onClick={() => setF({ ...f, lojas: f.lojas.filter((_, j) => j !== i) })}
                >
                  Tirar
                </button>
              </div>
            </div>
            <div className="duas-colunas">
              <Campo
                rotulo="Nome"
                valor={l.nome}
                mudar={(v) => mudarLoja(i, 'nome', v)}
                max={LIMITES.loja}
                obrigatorio
              />
              <Campo
                rotulo="Telefone"
                tipo="tel"
                valor={l.telefone}
                mudar={(v) => mudarLoja(i, 'telefone', v)}
                max={LIMITES.telefone}
              />
            </div>
            <Campo
              rotulo="Morada"
              valor={l.morada}
              mudar={(v) => mudarLoja(i, 'morada', v)}
              max={LIMITES.morada}
            />
            <Campo
              rotulo="Ligação de marcação"
              tipo="url"
              valor={l.marcar}
              mudar={(v) => mudarLoja(i, 'marcar', v)}
              max={500}
              ajuda="A página da Fresha desta loja. O botão «Marcar» abre-a."
            />
          </div>
        ))}
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
            placeholder="@nunoslab"
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
