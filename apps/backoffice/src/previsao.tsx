/**
 * «Na app»: a app dos clientes desenhada no backoffice, para ver antes de gravar. As medidas são as da
 * app (apps/cliente e packages/ui), em pt, num ecrã do iPhone das capturas (393 pt de largura): aqui 1 pt
 * é 1 px, e onde não cabe o `zoom` encolhe tudo por igual. O destaque das Vantagens é baixo e largo
 * desde 8 nov 2026, a página do parceiro tem uma faixa curta só com a cor desde 11 nov, e o anel à
 * volta do logótipo é de 16 nov.
 */
import { useQuery } from '@tanstack/react-query';
import {
  corParaBranco,
  degrauDoDesconto,
  DESENHOS_DAS_CATEGORIAS,
  misturar,
  semPartir,
  validadeEmTexto,
  type AjusteDoLogotipo,
  type CategoriaComContagem,
  type IconeDaCategoria,
} from '@nunos-lab/dominio';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { pedir } from './api';
import { useLingua } from './lingua';
import { Logotipo } from './pecas';
import { useTextos } from './textos';

/** A largura do iPhone das capturas da app e a barra de cima dele (a zona segura). */
const LARGURA_DO_ECRA = 393;
const BARRA_DE_CIMA = 59;
/** A faixa da página do parceiro, abaixo da barra de cima (`ALTURA_DA_FAIXA` da app). */
const ALTURA_DA_FAIXA = 150;
/** O destaque das Vantagens com a letra normal (`alturaDoDestaque` da app). */
const ALTURA_DO_DESTAQUE = 124;
/** O desconto em grande, por degraus de letras (`ESCALA_DO_BILHETE` da app). */
const ESCALA_DO_BILHETE = [36, 30, 26, 22] as const;

/** Os desenhos da app (packages/ui/src/icone.tsx) que as pré-visualizações mostram. */
const DESENHOS_DA_APP = {
  voltar: ['M15 5l-7 7 7 7'],
  seguinte: ['M9 5l7 7-7 7'],
  partilhar: ['M12 3v12', 'M7.5 7.5L12 3l4.5 4.5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'],
  mapa: [
    'M12 21s-7-6.1-7-11.4a7 7 0 0 1 14 0C19 14.9 12 21 12 21z',
    'M12 12a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  ],
  ligar: [
    'M5.2 3.5h3.1l1.9 4.8-2.4 1.5a11.5 11.5 0 0 0 6.4 6.4l1.5-2.4 4.8 1.9v3.1a2 2 0 0 1-2.2 2A17 17 0 0 1 3.2 5.7a2 2 0 0 1 2-2.2z',
  ],
  instagram: [
    'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3z',
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M17.3 6.7h.01',
  ],
  site: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3.6 9h16.8',
    'M3.6 15h16.8',
    'M12 3c2.3 2.5 3.4 5.5 3.4 9s-1.1 6.5-3.4 9c-2.3-2.5-3.4-5.5-3.4-9s1.1-6.5 3.4-9z',
  ],
  cartao: [
    'M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z',
    'M3.5 10h17',
  ],
  etiqueta: [
    'M20.5 12.4V4.5a1 1 0 0 0-1-1h-7.9l-8.6 8.6a1.4 1.4 0 0 0 0 2l6.4 6.4a1.4 1.4 0 0 0 2 0z',
    'M16 8h.01',
  ],
  copiar: [
    'M10 9h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 21h-9a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 10 9z',
    'M15.5 9V5.5A1.5 1.5 0 0 0 14 4H5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 5 16h3.5',
  ],
} satisfies Record<string, readonly string[]>;

function IconeDaApp({
  nome,
  tamanho,
  espessura = 1.8,
  estilo,
}: {
  nome: keyof typeof DESENHOS_DA_APP;
  tamanho: number;
  espessura?: number;
  estilo?: CSSProperties;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flex: 'none', ...estilo }}
    >
      {DESENHOS_DA_APP[nome].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function letraDoDesconto(destaque: string): CSSProperties {
  const tamanho = ESCALA_DO_BILHETE[degrauDoDesconto(destaque)];
  return {
    fontSize: tamanho,
    lineHeight: `${Math.round(tamanho * 1.08)}px`,
    letterSpacing: -tamanho * 0.035,
  };
}

/** O desenho verdadeiro da categoria de um parceiro (o diamante das Joias); sem categoria, os pontos. */
export function useDesenhoDaCategoria(categoriaId: number | null | undefined): IconeDaCategoria {
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const k = categorias.data?.find((c) => c.id === categoriaId);
  return k?.desenho ?? k?.icone ?? 'outro';
}

/**
 * O ecrã do iPhone, 393 px de largura e 1 px por pt. Onde não cabe (ao lado do editor do parceiro, ou
 * num telemóvel), encolhe todo por igual com o `zoom`, como uma captura em pequeno.
 */
function EcraDaApp({ pagina = false, children }: { pagina?: boolean; children: ReactNode }) {
  const t = useTextos();
  const fora = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useLayoutEffect(() => {
    const el = fora.current;
    if (!el) return;
    const medir = () => {
      // Numa folha ainda fechada a largura é 0: espera-se pela de quando abre.
      if (el.clientWidth > 0) setEscala(Math.min(1, el.clientWidth / LARGURA_DO_ECRA));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return (
    <div ref={fora} className="previsao-fora">
      <div
        className={`previsao${pagina ? ' pagina' : ''}`}
        role="group"
        aria-label={t.geral.previsao.rotulo}
        style={{ zoom: escala }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A `Capa` da app: a cor do parceiro a escurecer de canto a canto, com o desenho da categoria em grande
 * (95 % da altura, rodado e a sair pelo canto), branco a 13 %. Sem fotografias (11 nov 2026).
 */
function CapaNaApp({
  cor,
  desenho,
  altura,
  raio = 0,
  veu = false,
  esbater = false,
  borda = false,
  className = '',
  children,
}: {
  cor: string;
  desenho: IconeDaCategoria;
  altura: number;
  raio?: number;
  /** O véu da esquerda para a direita (o destaque, com o texto à esquerda). */
  veu?: boolean;
  /** A capa a desvanecer para o fundo da app, em baixo (a página do parceiro). */
  esbater?: boolean;
  /** Um fio claro à volta, por cima da cor (o destaque). */
  borda?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const base = corParaBranco(cor);
  return (
    <div
      className={`capa-na-app ${className}`}
      style={{
        height: altura,
        borderRadius: raio,
        // Na app é um SVG esticado de canto a canto: «to bottom right» dá o mesmo, um ângulo não.
        background: `linear-gradient(to bottom right, ${base}, ${misturar(base, '#000000', 0.45)})`,
      }}
    >
      <span className="recorte" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          style={{
            width: altura * 0.95,
            height: altura * 0.95,
            right: -altura * 0.12,
            bottom: -altura * 0.1,
          }}
        >
          {(DESENHOS_DAS_CATEGORIAS[desenho] ?? DESENHOS_DAS_CATEGORIAS.outro).map((d) => (
            <path
              key={d}
              d={d}
              stroke="#FFFFFF"
              strokeWidth={1.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </span>
      {veu && <span className="veu-de-lado" />}
      {esbater && <span className="esbatido" />}
      {borda && <span className="borda" />}
      {children}
    </div>
  );
}

type ParceiroDaPrevisao = {
  nome: string;
  cor: string;
  logotipo: string | null;
  logotipoAjuste?: AjusteDoLogotipo | null;
};

/**
 * Um destaque das Vantagens (`CartaoDestaque` da app): baixo e largo, o logótipo com o anel e o nome em
 * cima, o desconto em grande em baixo, à esquerda, com a validade ao lado e o título por baixo.
 */
function DestaqueNaApp({
  parceiro,
  nome,
  desenho,
  destaque,
  titulo,
  validade,
}: {
  parceiro: ParceiroDaPrevisao | null;
  nome: string;
  desenho: IconeDaCategoria;
  destaque: string;
  titulo: string;
  validade: string | null;
}) {
  const cor = parceiro?.cor ?? '#5C544C';
  return (
    <CapaNaApp
      cor={cor}
      desenho={desenho}
      altura={ALTURA_DO_DESTAQUE}
      raio={22}
      veu
      borda
      className="destaque-na-app"
    >
      <div className="topo-do-destaque">
        {parceiro && (
          <Logotipo
            nome={parceiro.nome}
            cor={cor}
            logotipo={parceiro.logotipo}
            ajuste={parceiro.logotipoAjuste}
            tamanho={28}
            anel
          />
        )}
        <span className="uma-linha">{nome}</span>
      </div>
      <div className="fundo-do-destaque">
        <div className="linha-do-desconto">
          <span className="desconto uma-linha" style={letraDoDesconto(destaque)}>
            {semPartir(destaque)}
          </span>
          {validade && <span className="pilula uma-linha">{validade}</span>}
        </div>
        <div className="uma-linha">{semPartir(titulo)}</div>
      </div>
    </CapaNaApp>
  );
}

export type VantagemDaPrevisao = {
  destaque: string;
  titulo: string;
  detalhe: string;
  validade: string | null;
  /** O limite por cliente («1 vez por dia»), numa pílula ao lado da validade. */
  limite: string | null;
  /** O código de cupão: à vista de quem tem a vantagem, e usa-se ao pagar (10 e 11 nov 2026). */
  codigo: string | null;
};

/**
 * Uma vantagem na página do parceiro (`CartaoDaPromocao` da app), como a vê quem a pode usar: o desconto,
 * a validade e o limite, o título, as condições (as longas cortadas a duas linhas, com «Ver tudo»), o
 * código, se houver, e como se usa.
 */
function VantagemNaApp({
  destaque,
  titulo,
  detalhe,
  validade,
  limite,
  codigo,
}: VantagemDaPrevisao) {
  const t = useTextos();
  const longo = detalhe.length > 90;
  const pilulas = [validade, limite].filter((p): p is string => !!p);
  return (
    <div className="vantagem-na-app">
      <div className="cima-da-vantagem">
        <span className="desconto" style={letraDoDesconto(destaque)}>
          {semPartir(destaque)}
        </span>
        {pilulas.length > 0 && (
          <span className="pilulas">
            {pilulas.map((texto, i) => (
              <span key={i} className="pilula">
                {texto}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="titulo-da-vantagem">{semPartir(titulo)}</div>
      {!!detalhe && (
        <div className={`detalhe-da-vantagem${longo ? ' cortado' : ''}`}>{semPartir(detalhe)}</div>
      )}
      {longo && (
        <div className="ver-tudo">
          {t.geral.previsao.verTudo}
          <IconeDaApp nome="seguinte" tamanho={14} estilo={{ transform: 'rotate(90deg)' }} />
        </div>
      )}
      {codigo && (
        <div className="codigo-na-app">
          <div className="caixa-do-codigo">
            <div className="legenda">{t.geral.previsao.codigo}</div>
            <div className="o-codigo">{codigo}</div>
          </div>
          <span className="copiar">
            <IconeDaApp nome="copiar" tamanho={16} espessura={2.2} />
            {t.geral.previsao.copiar}
          </span>
        </div>
      )}
      <div className="como-se-usa">
        <IconeDaApp nome={codigo ? 'etiqueta' : 'cartao'} tamanho={16} espessura={2.2} />
        {codigo ? t.geral.previsao.usaOCodigo : t.geral.previsao.mostraOCartao}
      </div>
    </div>
  );
}

/**
 * A vantagem como fica na app, para ver antes de gravar: o destaque das Vantagens, se estiver em
 * destaque (só esses lá aparecem), e o cartão da página do parceiro.
 */
export function PrevisaoDaPromocao({
  parceiro,
  destaque,
  titulo,
  detalhe,
  inicio,
  fim,
  hoje,
  limite = null,
  codigo = null,
  emDestaque,
}: {
  parceiro: (ParceiroDaPrevisao & { categoriaId?: number | null }) | null;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  hoje: string;
  limite?: string | null;
  codigo?: string | null;
  emDestaque: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const validade = validadeEmTexto({ inicio, fim }, hoje, lingua);
  const desenho = useDesenhoDaCategoria(parceiro?.categoriaId);
  const oDestaque = destaque || '−10%';
  const oTitulo = titulo || t.geral.previsao.titulo;
  return (
    <EcraDaApp>
      <div className="rotulo-previsao">{t.geral.previsao.naApp}</div>
      {emDestaque && (
        <DestaqueNaApp
          parceiro={parceiro}
          nome={parceiro?.nome ?? t.geral.previsao.parceiro}
          desenho={desenho}
          destaque={oDestaque}
          titulo={oTitulo}
          validade={validade}
        />
      )}
      <VantagemNaApp
        destaque={oDestaque}
        titulo={oTitulo}
        detalhe={detalhe}
        validade={validade}
        limite={limite}
        codigo={codigo}
      />
    </EcraDaApp>
  );
}

/**
 * A página do parceiro como fica na app (11 nov 2026): a faixa curta com a cor, a desvanecer para o
 * fundo, com Voltar e Partilhar; o logótipo de 84 com o anel a subir 64 sobre ela; o nome, «Categoria ·
 * Localidade», a descrição; os botões redondos que o parceiro tem; e a primeira vantagem.
 */
export function PrevisaoDoParceiro({
  nome,
  cor,
  logotipo,
  ajuste,
  desenho,
  onde,
  descricao,
  accoes,
  vantagens,
  vantagem,
}: {
  nome: string;
  cor: string;
  logotipo: string | null;
  ajuste: AjusteDoLogotipo | null;
  desenho: IconeDaCategoria;
  onde: string;
  descricao: string;
  accoes: { ir: boolean; ligar: boolean; instagram: boolean; site: boolean };
  /** Quantas vantagens estão na app (o título diz «A tua vantagem» ou «As tuas vantagens»). */
  vantagens: number;
  vantagem: VantagemDaPrevisao | null;
}) {
  const t = useTextos();
  const p = t.geral.previsao;
  const botoes = [
    accoes.ir && { icone: 'mapa' as const, nome: p.ir },
    accoes.ligar && { icone: 'ligar' as const, nome: p.ligar },
    accoes.instagram && { icone: 'instagram' as const, nome: 'Instagram' },
    accoes.site && { icone: 'site' as const, nome: p.site },
  ].filter((b) => !!b);
  return (
    <EcraDaApp pagina>
      <CapaNaApp cor={cor} desenho={desenho} altura={BARRA_DE_CIMA + ALTURA_DA_FAIXA} esbater>
        <div className="rotulo-previsao sobre-a-faixa">{p.naApp}</div>
        <div className="botoes-da-faixa" aria-hidden="true">
          <span className="botao-sobre-a-faixa">
            <IconeDaApp nome="voltar" tamanho={21} espessura={2.2} />
          </span>
          <span className="botao-sobre-a-faixa">
            <IconeDaApp nome="partilhar" tamanho={21} espessura={2.2} />
          </span>
        </div>
      </CapaNaApp>
      <div className="cabeca-do-parceiro">
        <Logotipo
          nome={nome || '?'}
          cor={cor}
          logotipo={logotipo}
          ajuste={ajuste}
          tamanho={84}
          anel
        />
        <div className="nome-do-parceiro">{nome || t.parceiro.nomeDoParceiro}</div>
        {onde && <div className="onde">{onde}</div>}
        {descricao && <div className="descricao">{descricao}</div>}
      </div>
      {botoes.length > 0 && (
        <div className="botoes-redondos">
          {botoes.map((b) => (
            <span key={b.icone} className="botao-redondo">
              <span className="circulo">
                <IconeDaApp nome={b.icone} tamanho={22} espessura={2} />
              </span>
              <span className="uma-linha">{b.nome}</span>
            </span>
          ))}
        </div>
      )}
      {vantagem && (
        <>
          <div className="rotulo-na-app">{vantagens > 1 ? p.asTuasVantagens : p.aTuaVantagem}</div>
          <VantagemNaApp {...vantagem} />
        </>
      )}
    </EcraDaApp>
  );
}
