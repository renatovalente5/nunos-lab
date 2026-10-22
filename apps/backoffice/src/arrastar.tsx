import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

/**
 * Uma lista que se ordena a arrastar, com o rato ou com o dedo (Pointer
 * Events: o mesmo código para os dois). Agarra-se pela pega «⠿» de cada linha;
 * o resto da linha continua a abrir o que abria. Sem rato nem dedo, a pega
 * também anda com as setas do teclado.
 *
 * Enquanto se arrasta, a linha segue o ponteiro e as outras abrem espaço; a
 * ordem nova só se entrega a `aoReordenar` quando se larga. Perto do topo ou
 * do fundo do ecrã, a página rola sozinha.
 */
type Arrasto = {
  chave: string | number;
  ponteiro: number;
  inicio: number;
  alvo: number;
  y0: number;
  yAgora: number;
  topos: number[];
  alturas: number[];
  passo: number;
  elementos: HTMLElement[];
  rolar: number | null;
};

export function ListaArrastavel<T>({
  itens,
  chave,
  nome,
  aoReordenar,
  desenhar,
  como: Etiqueta = 'ul',
  className = 'lista',
}: {
  itens: T[];
  chave: (item: T) => string | number;
  nome: (item: T) => string;
  aoReordenar: (novos: T[]) => void;
  desenhar: (item: T, pega: ReactNode) => ReactNode;
  como?: 'ul' | 'ol' | 'div';
  className?: string;
}) {
  const [ordem, setOrdem] = useState(itens);
  const [aArrastar, setAArrastar] = useState<string | number | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const arrasto = useRef<Arrasto | null>(null);
  const elementos = useRef(new Map<string | number, HTMLElement>());
  // As funções de quem usa a lista mudam a cada desenho dele: guardam-se aqui,
  // para um arrasto nunca ser interrompido por um desenho a meio.
  const deFora = useRef({ aoReordenar, nome });
  deFora.current = { aoReordenar, nome };
  const ordemAgora = useRef(ordem);
  ordemAgora.current = ordem;

  // Os dados novos (depois de gravar, ou de outro ecrã) só entram fora de um arrasto.
  useEffect(() => {
    if (!arrasto.current) setOrdem(itens);
  }, [itens]);

  const posicionar = useCallback(() => {
    const a = arrasto.current;
    if (!a) return;
    const dy = a.yAgora + window.scrollY - a.y0;
    const centro = a.topos[a.inicio]! + a.alturas[a.inicio]! / 2 + dy;
    let alvo = 0;
    a.topos.forEach((t, i) => {
      if (i !== a.inicio && t + a.alturas[i]! / 2 < centro) alvo++;
    });
    a.alvo = alvo;
    a.elementos.forEach((el, i) => {
      if (i === a.inicio) el.style.transform = `translateY(${dy}px)`;
      else if (a.inicio < alvo && i > a.inicio && i <= alvo)
        el.style.transform = `translateY(${-a.passo}px)`;
      else if (a.inicio > alvo && i >= alvo && i < a.inicio)
        el.style.transform = `translateY(${a.passo}px)`;
      else el.style.transform = '';
    });
  }, []);

  // Perto das pontas do ecrã, a página rola, e a linha continua debaixo do dedo.
  const rolarSozinho = useCallback(() => {
    const a = arrasto.current;
    if (!a) return;
    const zona = 72;
    const y = a.yAgora;
    const velocidade =
      y < zona
        ? -Math.ceil(((zona - y) / zona) * 14)
        : y > window.innerHeight - zona
          ? Math.ceil(((y - (window.innerHeight - zona)) / zona) * 14)
          : 0;
    if (velocidade) {
      window.scrollBy(0, velocidade);
      posicionar();
    }
    a.rolar = requestAnimationFrame(rolarSozinho);
  }, [posicionar]);

  const largar = useCallback((cancelar = false) => {
    const a = arrasto.current;
    if (!a) return;
    if (a.rolar) cancelAnimationFrame(a.rolar);
    arrasto.current = null;
    document.body.classList.remove('a-arrastar-algo');
    // Sem transição neste instante: a lista muda de ordem e as linhas voltam ao sítio ao mesmo tempo.
    a.elementos.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
    });
    requestAnimationFrame(() => a.elementos.forEach((el) => (el.style.transition = '')));
    setAArrastar(null);
    if (cancelar || a.alvo === a.inicio) return;
    const nova = [...ordemAgora.current];
    const [movido] = nova.splice(a.inicio, 1);
    nova.splice(a.alvo, 0, movido!);
    setOrdem(nova);
    deFora.current.aoReordenar(nova);
    setAnuncio(`${deFora.current.nome(movido!)}: posição ${a.alvo + 1} de ${nova.length}`);
  }, []);

  // Se a lista sair do ecrã a meio de um arrasto, larga-se sem mudar nada.
  useEffect(() => () => largar(true), [largar]);

  const comecar = (e: PointerEvent<HTMLButtonElement>, item: T) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const chaves = ordem.map(chave);
    const els = chaves.map((k) => elementos.current.get(k)).filter((el): el is HTMLElement => !!el);
    if (els.length !== chaves.length) return;
    const caixas = els.map((el) => el.getBoundingClientRect());
    const topos = caixas.map((c) => c.top + window.scrollY);
    const alturas = caixas.map((c) => c.height);
    const inicio = chaves.indexOf(chave(item));
    const vizinho = inicio + 1 < topos.length ? inicio + 1 : inicio - 1;
    const intervalo =
      vizinho >= 0
        ? Math.abs(topos[vizinho]! - topos[inicio]!) -
          (vizinho > inicio ? alturas[inicio]! : alturas[vizinho]!)
        : 0;
    arrasto.current = {
      chave: chave(item),
      ponteiro: e.pointerId,
      inicio,
      alvo: inicio,
      y0: e.clientY + window.scrollY,
      yAgora: e.clientY,
      topos,
      alturas,
      passo: alturas[inicio]! + Math.max(0, intervalo),
      elementos: els,
      rolar: null,
    };
    document.body.classList.add('a-arrastar-algo');
    setAArrastar(chave(item));
    arrasto.current.rolar = requestAnimationFrame(rolarSozinho);
  };

  const mover = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current;
    if (!a || e.pointerId !== a.ponteiro) return;
    a.yAgora = e.clientY;
    posicionar();
  };

  const teclado = (e: KeyboardEvent<HTMLButtonElement>, item: T) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const i = ordem.findIndex((x) => chave(x) === chave(item));
    const j = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (j < 0 || j >= ordem.length) return;
    const nova = [...ordem];
    [nova[i], nova[j]] = [nova[j]!, nova[i]!];
    setOrdem(nova);
    aoReordenar(nova);
    setAnuncio(`${nome(item)}: posição ${j + 1} de ${nova.length}`);
  };

  const ItemDaLista = Etiqueta === 'div' ? 'div' : 'li';
  return (
    <>
      <Etiqueta className={className}>
        {ordem.map((item) => {
          const k = chave(item);
          const pega = (
            <button
              type="button"
              className="pega"
              aria-label={`Ordem de ${nome(item)}: arrasta, ou usa as setas`}
              onPointerDown={(e) => comecar(e, item)}
              onPointerMove={mover}
              onPointerUp={() => largar()}
              onPointerCancel={() => largar(true)}
              onLostPointerCapture={() => largar()}
              onKeyDown={(e) => teclado(e, item)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                {[6, 12, 18].map((y) =>
                  [9, 15].map((x) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" fill="currentColor" />
                  )),
                )}
              </svg>
            </button>
          );
          return (
            <ItemDaLista
              key={k}
              ref={(el: HTMLElement | null) => {
                if (el) elementos.current.set(k, el);
                else elementos.current.delete(k);
              }}
              className={`arrastavel${aArrastar === k ? ' a-arrastar' : ''}`}
            >
              {desenhar(item, pega)}
            </ItemDaLista>
          );
        })}
      </Etiqueta>
      <div className="so-leitor" role="status" aria-live="polite">
        {anuncio}
      </div>
    </>
  );
}
