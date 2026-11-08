import {
  LIMITES,
  LIMITES_DOS_VALES,
  PERIODOS_DO_LIMITE,
  SUGESTOES_DE_DESTAQUE,
  diaEmLisboa,
  limiteEmTexto,
  naLingua,
  nomeDoEstado,
  nomeDoPeriodo,
  normalizarDestaque,
  periodoEmTexto,
  somarDias,
  type EstadoDaPromocao,
  type Parceiro,
  type PeriodoDoLimite,
  type Promocao,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import {
  AreaDeTexto,
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  GrupoEmIngles,
  Icone,
  Interruptor,
  porRever,
  PrevisaoDaPromocao,
  Segmentado,
  Seletor,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { useLingua } from '../lingua';
import { useTextos } from '../textos';
import { numero, parametro } from '../util';

/**
 * O conteúdo de uma linha de promoção: o texto grande, o título e, por baixo,
 * o período e só as etiquetas que o interruptor não diz (agendada, terminou,
 * valida ao balcão e quantas vezes já validou, está no saco das surpresas e
 * quantos cupões saíram).
 */
export function ConteudoDaPromocao({
  p,
  hoje,
  comParceiro = false,
}: {
  p: Promocao;
  hoje: string;
  comParceiro?: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const limite = p.validar ? limiteEmTexto(p, lingua) : null;
  return (
    <>
      <span className="promocao-grande">{p.destaque}</span>
      <div className="meio">
        <div className="titulo-linha">{p.titulo}</div>
        <div className="detalhe">
          {comParceiro ? `${p.parceiro} · ` : ''}
          {periodoEmTexto(p, hoje, lingua)}
        </div>
        {(p.emDestaque ||
          p.validar ||
          p.validacoes > 0 ||
          p.surpresa ||
          p.cupoes > 0 ||
          p.estado === 'agendada' ||
          p.estado === 'terminada' ||
          (p.activa && p.parceiroPausado)) && (
          <div className="etiquetas">
            {p.emDestaque && <Etiqueta semPonto>{t.promocoes.emDestaque}</Etiqueta>}
            {p.validar && <Etiqueta semPonto>{t.promocoes.valida(limite)}</Etiqueta>}
            {p.validacoes > 0 && (
              <Etiqueta semPonto>{t.promocoes.validacoes(p.validacoes)}</Etiqueta>
            )}
            {p.surpresa && <Etiqueta semPonto>{t.promocoes.surpresa(p.surpresaDias)}</Etiqueta>}
            {p.cupoes > 0 && <Etiqueta semPonto>{t.promocoes.cupoes(p.cupoes)}</Etiqueta>}
            {p.surpresa &&
              p.surpresaRestantes !== null &&
              (p.surpresaRestantes === 0 ? (
                <Etiqueta tom="fraco" semPonto>
                  {t.promocoes.esgotado}
                </Etiqueta>
              ) : (
                <Etiqueta semPonto>{t.promocoes.faltam(p.surpresaRestantes)}</Etiqueta>
              ))}
            {(p.estado === 'agendada' || p.estado === 'terminada') && (
              <EtiquetaDoEstado estado={p.estado} />
            )}
            {p.activa && p.parceiroPausado && <Etiqueta>{t.promocoes.parceiroPausado}</Etiqueta>}
          </div>
        )}
      </div>
    </>
  );
}

export function EtiquetaDoEstado({ estado }: { estado: EstadoDaPromocao }) {
  const lingua = useLingua();
  const tom = estado === 'activa' ? 'bom' : estado === 'agendada' ? 'atencao' : undefined;
  return <Etiqueta tom={tom}>{nomeDoEstado(estado, lingua)}</Etiqueta>;
}

type Filtro = 'todas' | EstadoDaPromocao;

export function Promocoes() {
  const t = useTextos();
  const promocoes = useQuery({
    queryKey: ['promocoes'],
    queryFn: () => pedir<Promocao[]>('/api/bo/promocoes'),
  });
  const parceiros = useQuery({
    queryKey: ['parceiros'],
    queryFn: () => pedir<Parceiro[]>('/api/bo/parceiros'),
  });
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [doParceiro, setDoParceiro] = useState<number | null>(
    () => Number(parametro('parceiro')) || null,
  );
  const [procura, setProcura] = useState('');
  const [editor, setEditor] = useState<{ promocao: Promocao | null } | null>(null);
  const { correr } = useAccao();
  const hoje = diaEmLisboa();

  const lista = useMemo(() => {
    const termo = procura.trim().toLocaleLowerCase('pt-PT');
    return (promocoes.data ?? []).filter(
      (p) =>
        (filtro === 'todas' || p.estado === filtro) &&
        (doParceiro === null || p.parceiroId === doParceiro) &&
        (!termo ||
          `${p.destaque} ${p.titulo} ${p.parceiro}`.toLocaleLowerCase('pt-PT').includes(termo)),
    );
  }, [promocoes.data, filtro, doParceiro, procura]);
  const conta = (e: EstadoDaPromocao) =>
    (promocoes.data ?? []).filter((p) => p.estado === e).length;

  // «#/promocoes?abrir=12» (do Resumo) abre logo essa promoção. Com a página
  // já aberta, mudar o fragmento não a volta a montar: ouve-se o «hashchange».
  const [abrir, setAbrir] = useState(() => Number(parametro('abrir')) || 0);
  useEffect(() => {
    const mudou = () => setAbrir(Number(parametro('abrir')) || 0);
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  useEffect(() => {
    if (!abrir || !promocoes.data) return;
    const p = promocoes.data.find((x) => x.id === abrir);
    history.replaceState(null, '', '#/promocoes');
    setAbrir(0);
    if (p) setEditor({ promocao: p });
  }, [abrir, promocoes.data]);

  const alternar = (p: Promocao, campo: 'activa' | 'emDestaque') =>
    correr(
      async () => {
        await pedir(`/api/bo/promocoes/${p.id}`, {
          metodo: 'PATCH',
          corpo: { [campo]: !p[campo] },
        });
        await refrescar();
      },
      campo === 'activa'
        ? p.activa
          ? t.promocoes.promocaoPausada
          : t.promocoes.promocaoLigada
        : p.emDestaque
          ? t.promocoes.saiuDoDestaque
          : t.promocoes.emDestaque,
    );

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.promocoes}</h1>
          <p className="subtitulo">{promocoes.data ? t.promocoes.naApp(conta('activa')) : ' '}</p>
        </div>
        <button
          type="button"
          className="botao"
          disabled={!parceiros.data?.length}
          onClick={() => setEditor({ promocao: null })}
        >
          <Icone nome="mais" tamanho={18} /> {t.promocoes.nova}
        </button>
      </div>

      <div className="filtros">
        <Segmentado<Filtro>
          rotulo={t.promocoes.estado}
          valor={filtro}
          mudar={setFiltro}
          opcoes={[
            { valor: 'todas', nome: t.promocoes.filtros.todas },
            ...(['activa', 'agendada', 'pausada', 'terminada'] as const).map((e) => ({
              valor: e,
              nome: `${t.promocoes.filtros[e]} · ${numero(conta(e))}`,
            })),
          ]}
        />
      </div>
      <div className="filtros">
        <select
          className="entrada"
          style={{ maxWidth: 280 }}
          aria-label={t.promocoes.parceiro}
          value={doParceiro ?? ''}
          onChange={(e) => setDoParceiro(Number(e.target.value) || null)}
        >
          <option value="">{t.promocoes.todosOsParceiros}</option>
          {(parceiros.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <input
          className="entrada procura"
          type="search"
          placeholder={t.promocoes.procurar}
          aria-label={t.promocoes.procurarPromocoes}
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
      </div>

      {!promocoes.data ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <div className="cartao">
          <Vazio titulo={promocoes.data.length ? t.promocoes.nenhumaAqui : t.promocoes.aindaSem} />
        </div>
      ) : (
        <div className="cartao">
          <ul className="lista">
            {lista.map((p) => (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  className="linha"
                  onClick={() => setEditor({ promocao: p })}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <ConteudoDaPromocao p={p} hoje={hoje} comParceiro />
                </button>
                <div className="botoes" style={{ padding: '0 18px 0 4px', flexWrap: 'nowrap' }}>
                  <button
                    type="button"
                    className="botao secundario icone so-largo"
                    aria-pressed={p.emDestaque}
                    aria-label={
                      p.emDestaque
                        ? t.promocoes.tirarDoDestaque(p.titulo)
                        : t.promocoes.porEmDestaqueDe(p.titulo)
                    }
                    title={p.emDestaque ? t.promocoes.emDestaque : t.promocoes.porEmDestaque}
                    style={
                      p.emDestaque
                        ? {
                            background: 'var(--marca)',
                            color: 'var(--sobre-marca)',
                            borderColor: 'var(--marca)',
                          }
                        : undefined
                    }
                    onClick={() => alternar(p, 'emDestaque')}
                  >
                    <Icone nome="estrela" tamanho={17} />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    className="interruptor"
                    aria-checked={p.activa}
                    aria-label={p.titulo}
                    onClick={() => alternar(p, 'activa')}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editor && parceiros.data && (
        <EditorDePromocao
          promocao={editor.promocao}
          parceiros={parceiros.data}
          parceiroInicial={doParceiro}
          fechar={() => setEditor(null)}
        />
      )}
    </>
  );
}

type FormularioDaPromocao = {
  parceiroId: number | null;
  destaque: string;
  titulo: string;
  detalhe: string;
  /** Em inglês: vazio, a app em inglês mostra o português. */
  destaqueEn: string;
  tituloEn: string;
  detalheEn: string;
  inicio: string;
  fim: string;
  emDestaque: boolean;
  activa: boolean;
  validar: boolean;
  /** Os limites tal como se escrevem no campo; vazio: sem limite. */
  limitePorCliente: string;
  periodoDoLimite: PeriodoDoLimite;
  limiteTotal: string;
  soClientesActivos: boolean;
  surpresa: boolean;
  /** O saco, tal como se escreve nos campos; «quantos podem sair» vazio: sem limite. */
  surpresaDias: string;
  surpresaPeso: string;
  surpresaRestantes: string;
};

/** Um limite escrito no campo: vazio é «sem limite» (null); fora do intervalo ou partido, NaN. */
function limiteEscrito(texto: string, { min, max }: { min: number; max: number }): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
}

/** O saco das surpresas: o que a API aceita para os dias, o peso e quantos podem sair. */
const LIMITES_DO_SACO = {
  dias: { min: 1, max: 365 },
  peso: { min: 1, max: 100 },
  restantes: { min: 0, max: 100_000 },
} as const;

/** Um número que tem de estar escrito: vazio, partido ou fora do intervalo, NaN. */
function numeroEscrito(texto: string, intervalo: { min: number; max: number }): number {
  return limiteEscrito(texto, intervalo) ?? NaN;
}

/**
 * Criar ou mudar uma promoção. Abre por cima da página (no telemóvel, de
 * baixo), com a pré-visualização tal como fica na app.
 */
export function EditorDePromocao({
  promocao,
  parceiros,
  parceiroFixo,
  parceiroInicial = null,
  fechar,
}: {
  promocao: Promocao | null;
  parceiros?: Parceiro[];
  parceiroFixo?: Parceiro;
  parceiroInicial?: number | null;
  fechar: () => void;
}) {
  const hoje = diaEmLisboa();
  const t = useTextos();
  const lingua = useLingua();
  const [inicial] = useState<FormularioDaPromocao>(() =>
    promocao
      ? {
          parceiroId: promocao.parceiroId,
          destaque: promocao.destaque,
          titulo: promocao.titulo,
          detalhe: promocao.detalhe,
          destaqueEn: promocao.destaqueEn ?? '',
          tituloEn: promocao.tituloEn ?? '',
          detalheEn: promocao.detalheEn ?? '',
          inicio: promocao.inicio ?? '',
          fim: promocao.fim ?? '',
          emDestaque: promocao.emDestaque,
          activa: promocao.activa,
          validar: promocao.validar,
          limitePorCliente:
            promocao.limitePorCliente === null ? '' : String(promocao.limitePorCliente),
          periodoDoLimite: promocao.periodoDoLimite,
          limiteTotal: promocao.limiteTotal === null ? '' : String(promocao.limiteTotal),
          soClientesActivos: promocao.soClientesActivos,
          surpresa: promocao.surpresa,
          surpresaDias: String(promocao.surpresaDias),
          surpresaPeso: String(promocao.surpresaPeso),
          surpresaRestantes:
            promocao.surpresaRestantes === null ? '' : String(promocao.surpresaRestantes),
        }
      : {
          parceiroId: parceiroFixo?.id ?? parceiroInicial,
          destaque: '',
          titulo: '',
          detalhe: '',
          destaqueEn: '',
          tituloEn: '',
          detalheEn: '',
          inicio: '',
          fim: '',
          emDestaque: false,
          activa: true,
          validar: false,
          limitePorCliente: '',
          periodoDoLimite: 'dia',
          limiteTotal: '',
          soClientesActivos: true,
          surpresa: false,
          surpresaDias: '30',
          surpresaPeso: '1',
          surpresaRestantes: '',
        },
  );
  const [f, setF] = useState(inicial);
  const sujo = JSON.stringify(f) !== JSON.stringify(inicial);
  const [erros, setErros] = useState<string[]>([]);
  // A primeira vez que se liga a validação propõem-se as predefinições («1 por dia», só
  // clientes activos: a API devolve-as vazias enquanto está desligada); depois fica o que se escreveu.
  const propos = useRef(promocao?.validar ?? false);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();
  const mudar =
    <K extends keyof FormularioDaPromocao>(k: K) =>
    (v: FormularioDaPromocao[K]) => {
      setF((x) => ({ ...x, [k]: v }));
      setErros((e) => e.filter((c) => c !== k));
    };
  const ligarValidacao = (ligada: boolean) => {
    mudar('validar')(ligada);
    setErros((e) => e.filter((c) => c !== 'limitePorCliente' && c !== 'limiteTotal'));
    if (ligada && !propos.current) {
      propos.current = true;
      setF((x) => ({
        ...x,
        limitePorCliente: '1',
        periodoDoLimite: 'dia',
        soClientesActivos: true,
      }));
    }
  };
  const ligarSurpresa = (ligado: boolean) => {
    mudar('surpresa')(ligado);
    setErros((e) =>
      e.filter((c) => c !== 'surpresaDias' && c !== 'surpresaPeso' && c !== 'surpresaRestantes'),
    );
  };
  const limitePorCliente = limiteEscrito(f.limitePorCliente, LIMITES_DOS_VALES.porCliente);
  const limiteTotal = limiteEscrito(f.limiteTotal, LIMITES_DOS_VALES.total);
  const surpresaDias = numeroEscrito(f.surpresaDias, LIMITES_DO_SACO.dias);
  const surpresaPeso = numeroEscrito(f.surpresaPeso, LIMITES_DO_SACO.peso);
  const surpresaRestantes = limiteEscrito(f.surpresaRestantes, LIMITES_DO_SACO.restantes);
  const parceiro = parceiroFixo ?? parceiros?.find((p) => p.id === f.parceiroId) ?? null;
  // Já validou ou já saiu como cupão: o que se apaga ou se muda de parceiro leva isso junto.
  const comHistorico = !!promocao && (promocao.validacoes > 0 || promocao.cupoes > 0);
  const vaoJunto =
    promocao && comHistorico ? t.promocoes.vaoJunto(promocao.validacoes, promocao.cupoes) : '';
  const fimDoMes = (() => {
    const [a, m] = hoje.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  })();

  async function guardar() {
    const faltam = [
      !f.parceiroId && 'parceiroId',
      !f.destaque.trim() && 'destaque',
      !f.titulo.trim() && 'titulo',
    ].filter(Boolean) as string[];
    if (f.inicio && f.fim && f.inicio > f.fim) faltam.push('fim');
    if (f.validar && Number.isNaN(limitePorCliente)) faltam.push('limitePorCliente');
    if (f.validar && Number.isNaN(limiteTotal)) faltam.push('limiteTotal');
    if (f.surpresa && Number.isNaN(surpresaDias)) faltam.push('surpresaDias');
    if (f.surpresa && Number.isNaN(surpresaPeso)) faltam.push('surpresaPeso');
    if (f.surpresa && Number.isNaN(surpresaRestantes)) faltam.push('surpresaRestantes');
    if (faltam.length) {
      setErros(faltam);
      avisar(
        faltam.includes('fim')
          ? t.promocoes.fimAntesDoInicio
          : faltam.includes('limitePorCliente') || faltam.includes('limiteTotal')
            ? t.promocoes.limitesErrados
            : faltam.includes('surpresaDias') ||
                faltam.includes('surpresaPeso') ||
                faltam.includes('surpresaRestantes')
              ? t.promocoes.sacoErrado
              : t.promocoes.faltamCampos,
        true,
      );
      return;
    }
    const corpo = {
      ...f,
      destaque: normalizarDestaque(f.destaque),
      destaqueEn: normalizarDestaque(f.destaqueEn),
      inicio: f.inicio || null,
      fim: f.fim || null,
      limitePorCliente: f.validar ? limitePorCliente : null,
      limiteTotal: f.validar ? limiteTotal : null,
      // Com o saco desligado os números ficam como estão na API, e voltam quando se liga.
      surpresaDias: f.surpresa ? surpresaDias : undefined,
      surpresaPeso: f.surpresa ? surpresaPeso : undefined,
      // «Quantos podem sair» só vai quando se escreveu outro número: reenviar o
      // que veio repunha na base os cupões que entretanto saíram.
      surpresaRestantes:
        f.surpresa && !(promocao && surpresaRestantes === promocao.surpresaRestantes)
          ? surpresaRestantes
          : undefined,
    };
    try {
      if (promocao) await pedir(`/api/bo/promocoes/${promocao.id}`, { metodo: 'PATCH', corpo });
      else await pedir('/api/bo/promocoes', { metodo: 'POST', corpo });
      await refrescar();
      avisar(promocao ? t.promocoes.guardado : t.promocoes.criada);
      fechar();
    } catch (e) {
      if (e instanceof ErroDaApi && e.campos.length) setErros(e.campos);
      avisar(mensagemDe(e), true);
    }
  }

  return (
    <>
      <Folha
        aberta
        fechar={fechar}
        sujo={sujo}
        titulo={promocao ? t.promocoes.promocao : t.promocoes.nova}
        pe={
          <>
            <button
              type="button"
              className="botao"
              disabled={aCorrer}
              onClick={() => correr(() => guardar())}
            >
              {promocao ? t.promocoes.guardar : t.promocoes.criar}
            </button>
            {promocao && promocao.validacoes > 0 && (
              <span className="estado">{t.promocoes.validacoes(promocao.validacoes)}</span>
            )}
            {promocao && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (
                    await confirmar(
                      t.promocoes.apagarPergunta,
                      t.promocoes.apagarTexto(vaoJunto),
                      t.promocoes.apagar,
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/promocoes/${promocao.id}`, { metodo: 'DELETE' });
                      await refrescar();
                      fechar();
                    }, t.promocoes.apagada);
                }}
              >
                {t.promocoes.apagar}
              </button>
            )}
          </>
        }
      >
        <div className="formulario">
          {!parceiroFixo && (
            <Seletor<number>
              rotulo={t.promocoes.parceiro}
              valor={f.parceiroId}
              mudar={mudar('parceiroId')}
              vazio={t.promocoes.escolheOParceiro}
              erro={erros.includes('parceiroId')}
              opcoes={(parceiros ?? []).map((p) => ({ valor: p.id, nome: p.nome }))}
              ajuda={comHistorico ? t.promocoes.vaoComEla : undefined}
            />
          )}
          <div className="campo">
            <Campo
              rotulo={t.promocoes.emGrande}
              valor={f.destaque}
              mudar={mudar('destaque')}
              max={LIMITES.destaque}
              obrigatorio
              erro={erros.includes('destaque')}
              placeholder={t.promocoes.emGrandeExemplo}
            />
            <div className="sugestoes" aria-label={t.promocoes.sugestoes}>
              {SUGESTOES_DE_DESTAQUE.map((s) => (
                <button key={s} type="button" onClick={() => mudar('destaque')(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Campo
            rotulo={t.promocoes.emQue}
            valor={f.titulo}
            mudar={mudar('titulo')}
            max={LIMITES.titulo}
            obrigatorio
            erro={erros.includes('titulo')}
            placeholder={t.promocoes.emQueExemplo}
          />
          <AreaDeTexto
            rotulo={t.promocoes.condicoes}
            valor={f.detalhe}
            mudar={mudar('detalhe')}
            max={LIMITES.detalhe}
            erro={erros.includes('detalhe')}
            ajuda={t.promocoes.condicoesAjuda}
          />
          <GrupoEmIngles>
            <Campo
              rotulo={t.promocoes.emGrande}
              valor={f.destaqueEn}
              mudar={mudar('destaqueEn')}
              max={LIMITES.destaque}
              erro={erros.includes('destaqueEn')}
              placeholder={t.promocoes.emGrandeExemploEn}
              ajuda={porRever(inicial.destaque, f.destaque, inicial.destaqueEn, f.destaqueEn)}
            />
            <Campo
              rotulo={t.promocoes.emQue}
              valor={f.tituloEn}
              mudar={mudar('tituloEn')}
              max={LIMITES.titulo}
              erro={erros.includes('tituloEn')}
              placeholder={t.promocoes.emQueExemploEn}
              ajuda={porRever(inicial.titulo, f.titulo, inicial.tituloEn, f.tituloEn)}
            />
            <AreaDeTexto
              rotulo={t.promocoes.condicoes}
              valor={f.detalheEn}
              mudar={mudar('detalheEn')}
              max={LIMITES.detalhe}
              erro={erros.includes('detalheEn')}
              ajuda={porRever(inicial.detalhe, f.detalhe, inicial.detalheEn, f.detalheEn)}
            />
          </GrupoEmIngles>
          <div className="duas-colunas">
            <Campo
              rotulo={t.promocoes.comeca}
              tipo="date"
              valor={f.inicio}
              mudar={mudar('inicio')}
              erro={erros.includes('inicio')}
              ajuda={t.promocoes.comecaAjuda}
            />
            <Campo
              rotulo={t.promocoes.acaba}
              tipo="date"
              valor={f.fim}
              mudar={mudar('fim')}
              erro={erros.includes('fim')}
              ajuda={t.promocoes.acabaAjuda}
            />
          </div>
          <div className="sugestoes" aria-label={t.promocoes.atalhos.rotulo}>
            <button type="button" onClick={() => mudar('fim')(somarDias(hoje, 6))}>
              {t.promocoes.atalhos.umaSemana}
            </button>
            <button type="button" onClick={() => mudar('fim')(somarDias(hoje, 29))}>
              {t.promocoes.atalhos.trintaDias}
            </button>
            <button type="button" onClick={() => mudar('fim')(fimDoMes)}>
              {t.promocoes.atalhos.fimDoMes}
            </button>
            <button type="button" onClick={() => mudar('fim')('')}>
              {t.promocoes.atalhos.semFim}
            </button>
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <Interruptor
              ligado={f.activa}
              mudar={mudar('activa')}
              rotulo={t.promocoes.ligada}
              ajuda={t.promocoes.ligadaAjuda}
            />
            <Interruptor
              ligado={f.emDestaque}
              mudar={mudar('emDestaque')}
              rotulo={t.promocoes.emDestaque}
              ajuda={t.promocoes.emDestaqueAjuda}
            />
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <div className="campo">
              <span className="rotulo-campo">{t.promocoes.naAppDoParceiro}</span>
              <Interruptor
                ligado={f.validar}
                mudar={ligarValidacao}
                rotulo={t.promocoes.validar}
                ajuda={t.promocoes.validarAjuda}
              />
            </div>
            {f.validar && (
              <>
                <div className="duas-colunas">
                  <Campo
                    rotulo={t.promocoes.porCliente}
                    tipo="number"
                    valor={f.limitePorCliente}
                    mudar={mudar('limitePorCliente')}
                    minimo={LIMITES_DOS_VALES.porCliente.min}
                    maximo={LIMITES_DOS_VALES.porCliente.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('limitePorCliente')}
                    ajuda={t.promocoes.semLimite}
                  />
                  <Seletor<PeriodoDoLimite>
                    rotulo={t.promocoes.periodo}
                    valor={f.periodoDoLimite}
                    mudar={(v) => mudar('periodoDoLimite')(v ?? 'dia')}
                    opcoes={PERIODOS_DO_LIMITE.map((p) => ({
                      valor: p,
                      nome: nomeDoPeriodo(p, lingua),
                    }))}
                  />
                </div>
                <div className="duas-colunas">
                  <Campo
                    rotulo={t.promocoes.noTotal}
                    tipo="number"
                    valor={f.limiteTotal}
                    mudar={mudar('limiteTotal')}
                    minimo={LIMITES_DOS_VALES.total.min}
                    maximo={LIMITES_DOS_VALES.total.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('limiteTotal')}
                    ajuda={t.promocoes.semLimite}
                  />
                </div>
                <Interruptor
                  ligado={f.soClientesActivos}
                  mudar={mudar('soClientesActivos')}
                  rotulo={t.promocoes.soActivos}
                  ajuda={t.promocoes.soActivosAjuda}
                />
              </>
            )}
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <div className="campo">
              <span className="rotulo-campo">{t.promocoes.noSaco}</span>
              <Interruptor
                ligado={f.surpresa}
                mudar={ligarSurpresa}
                rotulo={t.promocoes.saiComoCupao}
                ajuda={t.promocoes.saiComoCupaoAjuda}
              />
            </div>
            {f.surpresa && (
              <>
                <div className="duas-colunas">
                  <Campo
                    rotulo={t.promocoes.valeDurante}
                    tipo="number"
                    valor={f.surpresaDias}
                    mudar={mudar('surpresaDias')}
                    minimo={LIMITES_DO_SACO.dias.min}
                    maximo={LIMITES_DO_SACO.dias.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaDias')}
                    ajuda={t.promocoes.dias}
                  />
                  <Campo
                    rotulo={t.promocoes.peso}
                    tipo="number"
                    valor={f.surpresaPeso}
                    mudar={mudar('surpresaPeso')}
                    minimo={LIMITES_DO_SACO.peso.min}
                    maximo={LIMITES_DO_SACO.peso.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaPeso')}
                    ajuda={t.promocoes.pesoAjuda}
                  />
                </div>
                <div className="duas-colunas">
                  <Campo
                    rotulo={t.promocoes.quantos}
                    tipo="number"
                    valor={f.surpresaRestantes}
                    mudar={mudar('surpresaRestantes')}
                    minimo={LIMITES_DO_SACO.restantes.min}
                    maximo={LIMITES_DO_SACO.restantes.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaRestantes')}
                    ajuda={t.promocoes.semLimite}
                  />
                </div>
              </>
            )}
          </div>
          <PrevisaoDaPromocao
            parceiro={parceiro}
            destaque={normalizarDestaque(naLingua(lingua, f.destaque, f.destaqueEn))}
            titulo={naLingua(lingua, f.titulo, f.tituloEn)}
            detalhe={naLingua(lingua, f.detalhe, f.detalheEn)}
            inicio={f.inicio || null}
            fim={f.fim || null}
            hoje={hoje}
            validar={f.validar}
            surpresa={f.surpresa}
            limite={
              f.validar
                ? limiteEmTexto(
                    {
                      limitePorCliente: Number.isNaN(limitePorCliente) ? null : limitePorCliente,
                      periodoDoLimite: f.periodoDoLimite,
                    },
                    lingua,
                  )
                : null
            }
          />
        </div>
      </Folha>
      {dialogo}
    </>
  );
}
