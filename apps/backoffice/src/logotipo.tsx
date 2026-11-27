/**
 * O logótipo do parceiro: o campo da página e o editor grande (o Nuno, 27 nov 2026: «fica difícil de
 * ajustar a imagem no sítio certo porque o sítio é muito pequenino»). Como ao mudar a fotografia de
 * perfil no Instagram: o círculo grande fica parado e a imagem mexe-se por trás dele, com o que fica de
 * fora à vista, mais escuro. Arrasta-se; aproxima-se com dois dedos, a roda ou a barra; «Inteiro» e
 * «Encher» põem-na ao meio de uma vez; e ao lado vê-se como fica na app. O editor abre ao escolher a
 * imagem e com «Ajustar»; o ajuste só passa para a página com «Concluir».
 */
import { useQuery } from '@tanstack/react-query';
import {
  AJUSTE_DE_ORIGEM,
  LIMITES_DO_AJUSTE,
  ajusteAoMeio,
  ajusteAproximado,
  ajusteCheio,
  ajusteDosDedos,
  ajusteInteiro,
  caixaDoLogotipo,
  corParaBranco,
  limitarAjuste,
  type AjusteDoLogotipo,
  type PontoNoCirculo,
} from '@nunos-lab/dominio';
import { useEffect, useId, useRef, useState } from 'react';
import { mensagemDe } from './api';
import { carregarLogotipo, corDoLogotipo } from './imagens';
import {
  Folha,
  Icone,
  Logotipo,
  OutraCor,
  estiloDoLogotipo,
  urlDaImagem,
  useAvisar,
} from './pecas';
import { useTextos } from './textos';

/** O círculo no palco do editor, em fracção do lado do palco: à volta vê-se o que fica de fora. */
const CIRCULO = 0.72;

/** A imagem no palco: a mesma caixa do círculo (as contas da app), posta no palco à volta dele. */
function estiloNoPalco(ajuste: AjusteDoLogotipo) {
  const caixa = caixaDoLogotipo(ajuste);
  const margem = (1 - CIRCULO) / 2;
  const pc = (n: number) => `${n * 100}%`;
  return {
    width: pc(CIRCULO * caixa.lado),
    height: pc(CIRCULO * caixa.lado),
    left: pc(margem + CIRCULO * caixa.esquerda),
    top: pc(margem + CIRCULO * caixa.topo),
  };
}

/** A imagem a ajustar: a que já está no parceiro, ou uma acabada de escolher (ainda fora da página). */
type Edicao = { id: string; ajuste: AjusteDoLogotipo };

function EditorDoLogotipo({
  edicao,
  nome,
  cor,
  concluir,
  cancelar,
}: {
  edicao: Edicao;
  /** O nome e a cor do parceiro: para as pré-visualizações e para a cor do parceiro no fundo. */
  nome: string;
  cor: string;
  concluir: (ajuste: AjusteDoLogotipo) => void;
  cancelar: () => void;
}) {
  const t = useTextos();
  const p = t.parceiro;
  const { id } = edicao;
  const [ajuste, setAjuste] = useState(edicao.ajuste);
  // A largura ÷ a altura da imagem, para o «Inteiro» e o «Encher» (lê-se quando ela abre).
  const [proporcao, setProporcao] = useState<number | null>(null);
  // Com dedos (ou o rato) a carregar: a grelha dos terços aparece, como no Instagram.
  const [aMexer, setAMexer] = useState(false);
  // A imagem foi puxada para o meio neste eixo: a linha do meio aparece.
  const [aoMeio, setAoMeio] = useState({ x: false, y: false });
  const palco = useRef<HTMLDivElement>(null);
  const circulo = useRef<HTMLDivElement>(null);
  const idDasTeclas = useId();
  const idDoFundo = useId();
  const idDoTamanho = useId();
  // Os ouvintes postos uma vez lêem daqui o último ajuste.
  const ultimo = useRef(ajuste);
  const mudar = (a: AjusteDoLogotipo) => {
    ultimo.current = a;
    setAjuste(a);
  };
  const daImagem = useQuery({
    queryKey: ['cor-do-logotipo', id],
    queryFn: () => corDoLogotipo(id),
    staleTime: Infinity,
  });
  const fundos = [
    { cor: daImagem.data, nome: p.fundos.logotipo },
    { cor: '#FFFFFF', nome: p.fundos.branco },
    { cor: '#000000', nome: p.fundos.preto },
    { cor: corParaBranco(cor).toUpperCase(), nome: p.fundos.parceiro },
  ].filter(
    (f, i, l): f is { cor: string; nome: string } =>
      !!f.cor && l.findIndex((g) => g.cor === f.cor) === i,
  );

  // Os dedos (ou o rato) a carregar, pela ordem em que assentaram, e onde estão no ecrã; e o ajuste e os
  // dedos de quando o gesto mudou: as contas fazem-se sempre a partir daí, e um dedo que chega ou sai
  // recomeça-o, sem a imagem saltar (o Renato, 10 nov). Os dedos contam em qualquer sítio do palco, também
  // por cima do que fica de fora do círculo; as contas são em fracções do círculo, como na app.
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const partida = useRef<{ ajuste: AjusteDoLogotipo; dedos: PontoNoCirculo[] } | null>(null);
  // Os dedos que assentaram fora do palco sem gesto a decorrer: se um assenta no palco logo a seguir (os
  // dois quase ao mesmo tempo, como quem afasta os dedos), também contam.
  const soltos = useRef(new Map<number, { x: number; y: number; quando: number }>());
  // Só mexem em refs e em estados: os ouvintes postos uma vez podem chamá-las.
  const noCirculo = (pontos: { x: number; y: number }[]): PontoNoCirculo[] => {
    const r = circulo.current?.getBoundingClientRect();
    if (!r?.width) return [];
    return pontos.map((d) => ({
      x: (d.x - r.left - r.width / 2) / r.width,
      y: (d.y - r.top - r.height / 2) / r.height,
    }));
  };
  const dosDedos = () => noCirculo([...dedos.current.values()].slice(0, 2));
  const recomecar = () => {
    partida.current = dedos.current.size ? { ajuste: ultimo.current, dedos: dosDedos() } : null;
    setAMexer(dedos.current.size > 0);
    if (!dedos.current.size) setAoMeio({ x: false, y: false });
  };
  const assentar = (e: PointerEvent) => {
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size === 1)
      for (const [i, d] of soltos.current)
        if (e.timeStamp - d.quando < 250) dedos.current.set(i, { x: d.x, y: d.y });
    soltos.current.clear();
    recomecar();
  };

  // A roda do React é passiva: para a página não rolar enquanto se aproxima, um ouvinte nativo. Aproxima
  // à volta do cursor (os dedos no trackpad chegam como roda com Ctrl).
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const [ponto] = noCirculo([{ x: e.clientX, y: e.clientY }]);
      mudar(
        ajusteAproximado(ultimo.current, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), ponto),
      );
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // O resto do gesto ouve-se no documento: o dedo que assenta fora do palco não chega a ele.
  useEffect(() => {
    const fora = (e: PointerEvent) => {
      const el = palco.current;
      if (!el || e.pointerType !== 'touch' || el.contains(e.target as Node)) return;
      if (!dedos.current.size) {
        soltos.current.set(e.pointerId, { x: e.clientX, y: e.clientY, quando: e.timeStamp });
        return;
      }
      if (dedos.current.size !== 1) return;
      // Com um dedo já no palco, este é o segundo: entra no gesto e não toca no que tem por baixo.
      e.preventDefault();
      e.stopPropagation();
      assentar(e);
    };
    const mexer = (e: PointerEvent) => {
      const solto = soltos.current.get(e.pointerId);
      if (solto) soltos.current.set(e.pointerId, { ...solto, x: e.clientX, y: e.clientY });
      if (!dedos.current.has(e.pointerId)) return;
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p0 = partida.current;
      const novo = p0 && ajusteDosDedos(p0.ajuste, p0.dedos, dosDedos());
      if (!novo) return;
      // Quase ao meio, vai ao meio: um logótipo quer-se centrado, e à mão é difícil acertar.
      const meio = ajusteAoMeio(novo);
      setAoMeio((v) => (v.x === meio.x && v.y === meio.y ? v : { x: meio.x, y: meio.y }));
      mudar(meio.ajuste);
    };
    const largar = (e: PointerEvent) => {
      soltos.current.delete(e.pointerId);
      if (dedos.current.delete(e.pointerId)) recomecar();
    };
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('pointermove', mexer, true);
    document.addEventListener('pointerup', largar, true);
    document.addEventListener('pointercancel', largar, true);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('pointermove', mexer, true);
      document.removeEventListener('pointerup', largar, true);
      document.removeEventListener('pointercancel', largar, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { min, max } = LIMITES_DO_AJUSTE.zoom;
  const url = urlDaImagem(id);
  const passoDoTamanho = 1.12;
  return (
    <Folha
      aberta
      classe="larga"
      fechar={cancelar}
      titulo={p.editorDoLogotipo}
      pe={
        <>
          <button type="button" className="botao" onClick={() => concluir(ultimo.current)}>
            {p.concluir}
          </button>
          <button type="button" className="botao secundario" onClick={cancelar}>
            {t.geral.cancelar}
          </button>
        </>
      }
    >
      <div className="editor-do-logotipo">
        <div className="coluna-do-palco">
          <div
            ref={palco}
            className={`palco-do-logotipo${aMexer ? ' a-mexer' : ''}`}
            tabIndex={0}
            role="group"
            aria-label={p.ajustarLogotipo}
            aria-describedby={idDasTeclas}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Sem a captura, o resto do gesto ouve-se na mesma no documento.
              }
              assentar(e.nativeEvent);
            }}
            onKeyDown={(e) => {
              const a = ultimo.current;
              const passo = e.shiftKey ? 0.1 : 0.02;
              const teclas: Record<string, () => AjusteDoLogotipo | null> = {
                ArrowLeft: () => limitarAjuste({ ...a, x: a.x - passo }),
                ArrowRight: () => limitarAjuste({ ...a, x: a.x + passo }),
                ArrowUp: () => limitarAjuste({ ...a, y: a.y - passo }),
                ArrowDown: () => limitarAjuste({ ...a, y: a.y + passo }),
                '+': () => ajusteAproximado(a, 1.08),
                '=': () => ajusteAproximado(a, 1.08),
                '-': () => ajusteAproximado(a, 1 / 1.08),
              };
              const novo = teclas[e.key]?.();
              if (!teclas[e.key]) return;
              e.preventDefault();
              if (novo) mudar(novo);
            }}
          >
            {/* A imagem inteira, mais escura: o que fica fora do círculo (não aparece na app). */}
            <img
              className="fora"
              src={url}
              alt=""
              draggable={false}
              style={estiloNoPalco(ajuste)}
              onLoad={(e) => {
                const { naturalWidth: l, naturalHeight: a } = e.currentTarget;
                if (l > 0 && a > 0) setProporcao(l / a);
              }}
            />
            <div ref={circulo} className="circulo" style={{ background: ajuste.fundo }}>
              <img src={url} alt="" draggable={false} style={estiloDoLogotipo(ajuste)} />
              <span className="grelha" aria-hidden="true" />
              {aMexer && aoMeio.x && <span className="guia vertical" aria-hidden="true" />}
              {aMexer && aoMeio.y && <span className="guia horizontal" aria-hidden="true" />}
            </div>
            <span id={idDasTeclas} className="so-leitor">
              {p.teclasDoLogotipo}
            </span>
          </div>
          <div className="barra-do-tamanho">
            <button
              type="button"
              className="botao secundario icone"
              aria-label={p.maisPequeno}
              disabled={ajuste.zoom <= min}
              onClick={() => mudar(ajusteAproximado(ultimo.current, 1 / passoDoTamanho))}
            >
              <Icone nome="menos" />
            </button>
            <input
              id={idDoTamanho}
              type="range"
              aria-label={p.tamanho}
              aria-valuetext={`${Math.round(ajuste.zoom * 100)} %`}
              min={Math.log(min)}
              max={Math.log(max)}
              step={0.001}
              value={Math.log(ajuste.zoom)}
              onChange={(e) => {
                const a = ultimo.current;
                mudar(ajusteAproximado(a, Math.exp(Number(e.target.value)) / a.zoom));
              }}
            />
            <button
              type="button"
              className="botao secundario icone"
              aria-label={p.maior}
              disabled={ajuste.zoom >= max}
              onClick={() => mudar(ajusteAproximado(ultimo.current, passoDoTamanho))}
            >
              <Icone nome="mais" />
            </button>
          </div>
          <p className="ajuda como-mexer">{p.comoMexer}</p>
        </div>
        <div className="coluna-dos-acertos">
          <div className="botoes">
            <button
              type="button"
              className="botao secundario pequeno"
              disabled={!proporcao}
              title={p.inteiroAjuda}
              onClick={() => proporcao && mudar(ajusteInteiro(ultimo.current, proporcao))}
            >
              {p.inteiro}
            </button>
            <button
              type="button"
              className="botao secundario pequeno"
              disabled={!proporcao}
              title={p.encherAjuda}
              onClick={() => proporcao && mudar(ajusteCheio(ultimo.current, proporcao))}
            >
              {p.encher}
            </button>
          </div>
          <div className="fundo-do-logotipo">
            <span className="rotulo-campo" id={idDoFundo}>
              {p.fundo}
            </span>
            <div className="cores" role="group" aria-labelledby={idDoFundo}>
              {fundos.map((f) => (
                <button
                  key={f.cor}
                  type="button"
                  className="cor"
                  style={{ background: f.cor }}
                  aria-pressed={ajuste.fundo === f.cor}
                  aria-label={f.nome}
                  title={f.nome}
                  onClick={() => mudar({ ...ultimo.current, fundo: f.cor })}
                />
              ))}
              <OutraCor
                valor={ajuste.fundo}
                mudar={(fundo) => {
                  const novo = limitarAjuste({ ...ultimo.current, fundo });
                  if (novo) mudar(novo);
                }}
              />
            </div>
          </div>
          {/* Como fica na app: o círculo com o fio claro, no preto da app, nos dois tamanhos dela (a
              página do parceiro e o cartão da vantagem). */}
          <div className="logotipo-na-app">
            <span className="rotulo">{t.geral.previsao.naApp}</span>
            <div className="tamanhos">
              <Logotipo
                nome={nome || '?'}
                cor={cor}
                logotipo={id}
                ajuste={ajuste}
                tamanho={84}
                anel
              />
              <span className="no-cartao">
                <Logotipo
                  nome={nome || '?'}
                  cor={cor}
                  logotipo={id}
                  ajuste={ajuste}
                  tamanho={28}
                  anel
                />
                <span className="uma-linha">{nome || p.nomeDoParceiro}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Folha>
  );
}

/**
 * O logótipo do parceiro na página: como fica no círculo da app, «Ajustar» (o editor grande), «Trocar» e
 * «Tirar». A cor do fundo do círculo escolhe-se no editor (o Renato, 9 nov: um logótipo quadrado de fundo
 * verde ficava num círculo branco); uma imagem nova já vem com a cor das orlas, se forem de uma cor só.
 */
export function CampoDoLogotipo({
  rotulo,
  valor,
  ajuste,
  nome,
  cor,
  mudar,
  ajuda,
  erro,
}: {
  rotulo: string;
  valor: string | null;
  ajuste: AjusteDoLogotipo | null;
  /** O nome do parceiro (as iniciais, sem imagem, e as pré-visualizações do editor). */
  nome: string;
  /** A cor do parceiro, que é uma das hipóteses para o fundo. */
  cor: string;
  mudar: (id: string | null, ajuste: AjusteDoLogotipo | null) => void;
  ajuda: string;
  erro?: boolean;
}) {
  const t = useTextos();
  const entrada = useRef<HTMLInputElement>(null);
  const avisar = useAvisar();
  const [aCarregar, setACarregar] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const a = ajuste ?? AJUSTE_DE_ORIGEM;
  const ajustar = () => valor && setEdicao({ id: valor, ajuste: a });
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <span className="rotulo-campo">{rotulo}</span>
      <div className="imagem-campo">
        {valor ? (
          <button
            type="button"
            className="previa-do-logotipo"
            aria-label={t.parceiro.ajustarLogotipo}
            onClick={ajustar}
          >
            <Logotipo nome={nome || '?'} cor={cor} logotipo={valor} ajuste={a} tamanho={88} />
          </button>
        ) : (
          <div className="previa">
            <span className="ajuda">—</span>
          </div>
        )}
        <div className="botoes">
          {valor && (
            <button type="button" className="botao secundario pequeno" onClick={ajustar}>
              {t.parceiro.ajustar}
            </button>
          )}
          <button
            type="button"
            className="botao secundario pequeno"
            disabled={aCarregar}
            onClick={() => entrada.current?.click()}
          >
            {aCarregar
              ? t.geral.imagem.aCarregar
              : valor
                ? t.geral.imagem.trocar
                : t.geral.imagem.escolher}
          </button>
          {valor && (
            <button
              type="button"
              className="botao secundario pequeno"
              onClick={() => mudar(null, null)}
            >
              {t.geral.imagem.tirar}
            </button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const ficheiro = e.target.files?.[0];
            e.target.value = '';
            if (!ficheiro) return;
            setACarregar(true);
            try {
              // A imagem nova abre logo no editor; só fica no parceiro com «Concluir».
              const { id, ajuste: sugestao } = await carregarLogotipo(ficheiro);
              setEdicao({ id, ajuste: sugestao });
            } catch (falha) {
              avisar(mensagemDe(falha), true);
            } finally {
              setACarregar(false);
            }
          }}
        />
      </div>
      {erro ? (
        <div className="mensagem-erro">{t.geral.reveEsteCampo}</div>
      ) : (
        <div className="ajuda">{ajuda}</div>
      )}
      {edicao && (
        <EditorDoLogotipo
          edicao={edicao}
          nome={nome}
          cor={cor}
          concluir={(novo) => {
            mudar(edicao.id, novo);
            setEdicao(null);
          }}
          cancelar={() => setEdicao(null)}
        />
      )}
    </div>
  );
}
