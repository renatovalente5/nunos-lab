import {
  LIMITES,
  LIMITES_DOS_VALES,
  NOME_DO_ESTADO,
  NOME_DO_PERIODO,
  PERIODOS_DO_LIMITE,
  SUGESTOES_DE_DESTAQUE,
  diaEmLisboa,
  limiteEmTexto,
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
  Icone,
  Interruptor,
  PrevisaoDaPromocao,
  Segmentado,
  Seletor,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { parametro, plural } from '../util';

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
  const limite = p.validar ? limiteEmTexto(p) : null;
  return (
    <>
      <span className="promocao-grande">{p.destaque}</span>
      <div className="meio">
        <div className="titulo-linha">{p.titulo}</div>
        <div className="detalhe">
          {comParceiro ? `${p.parceiro} · ` : ''}
          {periodoEmTexto(p, hoje)}
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
            {p.emDestaque && <Etiqueta semPonto>Em destaque</Etiqueta>}
            {p.validar && <Etiqueta semPonto>{limite ? `Valida · ${limite}` : 'Valida'}</Etiqueta>}
            {p.validacoes > 0 && (
              <Etiqueta semPonto>{plural(p.validacoes, 'validação', 'validações')}</Etiqueta>
            )}
            {p.surpresa && (
              <Etiqueta semPonto>Surpresa · {plural(p.surpresaDias, 'dia', 'dias')}</Etiqueta>
            )}
            {p.cupoes > 0 && <Etiqueta semPonto>{plural(p.cupoes, 'cupão', 'cupões')}</Etiqueta>}
            {p.surpresa &&
              p.surpresaRestantes !== null &&
              (p.surpresaRestantes === 0 ? (
                <Etiqueta tom="fraco" semPonto>
                  Esgotado
                </Etiqueta>
              ) : (
                <Etiqueta semPonto>Faltam {p.surpresaRestantes.toLocaleString('pt-PT')}</Etiqueta>
              ))}
            {(p.estado === 'agendada' || p.estado === 'terminada') && (
              <EtiquetaDoEstado estado={p.estado} />
            )}
            {p.activa && p.parceiroPausado && <Etiqueta>Parceiro pausado</Etiqueta>}
          </div>
        )}
      </div>
    </>
  );
}

export function EtiquetaDoEstado({ estado }: { estado: EstadoDaPromocao }) {
  const tom = estado === 'activa' ? 'bom' : estado === 'agendada' ? 'atencao' : undefined;
  return <Etiqueta tom={tom}>{NOME_DO_ESTADO[estado]}</Etiqueta>;
}

type Filtro = 'todas' | EstadoDaPromocao;

export function Promocoes() {
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
          ? 'Promoção pausada'
          : 'Promoção ligada'
        : p.emDestaque
          ? 'Saiu do destaque'
          : 'Em destaque',
    );

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Promoções</h1>
          <p className="subtitulo">
            {promocoes.data ? `${plural(conta('activa'), 'promoção', 'promoções')} na app` : ' '}
          </p>
        </div>
        <button
          type="button"
          className="botao"
          disabled={!parceiros.data?.length}
          onClick={() => setEditor({ promocao: null })}
        >
          <Icone nome="mais" tamanho={18} /> Nova promoção
        </button>
      </div>

      <div className="filtros">
        <Segmentado<Filtro>
          rotulo="Estado"
          valor={filtro}
          mudar={setFiltro}
          opcoes={[
            { valor: 'todas', nome: 'Todas' },
            { valor: 'activa', nome: `Na app · ${conta('activa')}` },
            { valor: 'agendada', nome: `Agendadas · ${conta('agendada')}` },
            { valor: 'pausada', nome: `Pausadas · ${conta('pausada')}` },
            { valor: 'terminada', nome: `Terminaram · ${conta('terminada')}` },
          ]}
        />
      </div>
      <div className="filtros">
        <select
          className="entrada"
          style={{ maxWidth: 280 }}
          aria-label="Parceiro"
          value={doParceiro ?? ''}
          onChange={(e) => setDoParceiro(Number(e.target.value) || null)}
        >
          <option value="">Todos os parceiros</option>
          {(parceiros.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <input
          className="entrada procura"
          type="search"
          placeholder="Procurar"
          aria-label="Procurar promoções"
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
      </div>

      {!promocoes.data ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <div className="cartao">
          <Vazio titulo={promocoes.data.length ? 'Nenhuma promoção aqui' : 'Ainda sem promoções'} />
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
                      p.emDestaque ? `Tirar ${p.titulo} do destaque` : `Pôr ${p.titulo} em destaque`
                    }
                    title={p.emDestaque ? 'Em destaque' : 'Pôr em destaque'}
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
  const [f, setF] = useState<FormularioDaPromocao>(() =>
    promocao
      ? {
          parceiroId: promocao.parceiroId,
          destaque: promocao.destaque,
          titulo: promocao.titulo,
          detalhe: promocao.detalhe,
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
  const fimDoMes = (() => {
    const [a, m] = hoje.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  })();

  async function guardar(comoNova = false) {
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
          ? 'O fim tem de ser no dia do início ou depois.'
          : faltam.includes('limitePorCliente') || faltam.includes('limiteTotal')
            ? 'Os limites: de 1 a 100 por cliente, de 1 a 100 000 no total.'
            : faltam.includes('surpresaDias') ||
                faltam.includes('surpresaPeso') ||
                faltam.includes('surpresaRestantes')
              ? 'O saco: de 1 a 365 dias, peso de 1 a 100, até 100 000 a sair.'
              : 'Faltam campos obrigatórios.',
        true,
      );
      return;
    }
    const corpo = {
      ...f,
      destaque: normalizarDestaque(f.destaque),
      inicio: f.inicio || null,
      fim: f.fim || null,
      limitePorCliente: f.validar ? limitePorCliente : null,
      limiteTotal: f.validar ? limiteTotal : null,
      // Com o saco desligado os números ficam como estão na API, e voltam quando se liga.
      surpresaDias: f.surpresa ? surpresaDias : undefined,
      surpresaPeso: f.surpresa ? surpresaPeso : undefined,
      surpresaRestantes: f.surpresa ? surpresaRestantes : undefined,
    };
    try {
      if (promocao && !comoNova)
        await pedir(`/api/bo/promocoes/${promocao.id}`, { metodo: 'PATCH', corpo });
      else await pedir('/api/bo/promocoes', { metodo: 'POST', corpo });
      await refrescar();
      avisar(comoNova ? 'Cópia criada' : promocao ? 'Guardado' : 'Promoção criada');
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
        titulo={promocao ? 'Promoção' : 'Nova promoção'}
        pe={
          <>
            <button
              type="button"
              className="botao"
              disabled={aCorrer}
              onClick={() => correr(() => guardar())}
            >
              {promocao ? 'Guardar' : 'Criar'}
            </button>
            {promocao && (
              <button
                type="button"
                className="botao secundario"
                disabled={aCorrer}
                onClick={() => correr(() => guardar(true))}
              >
                Guardar como nova
              </button>
            )}
            {promocao && promocao.validacoes > 0 && (
              <span className="estado">
                {plural(promocao.validacoes, 'validação', 'validações')}
              </span>
            )}
            {promocao && (
              <button
                type="button"
                className="botao perigo"
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (
                    await confirmar(
                      'Apagar a promoção?',
                      'Sai da app e do backoffice. Para a tirar só por uns tempos, desliga-a.',
                      'Apagar',
                    )
                  )
                    await correr(async () => {
                      await pedir(`/api/bo/promocoes/${promocao.id}`, { metodo: 'DELETE' });
                      await refrescar();
                      fechar();
                    }, 'Promoção apagada');
                }}
              >
                Apagar
              </button>
            )}
          </>
        }
      >
        <div className="formulario">
          {!parceiroFixo && (
            <Seletor<number>
              rotulo="Parceiro"
              valor={f.parceiroId}
              mudar={mudar('parceiroId')}
              vazio="Escolhe o parceiro"
              erro={erros.includes('parceiroId')}
              opcoes={(parceiros ?? []).map((p) => ({ valor: p.id, nome: p.nome }))}
            />
          )}
          <div className="campo">
            <Campo
              rotulo="Em grande"
              valor={f.destaque}
              mudar={mudar('destaque')}
              max={LIMITES.destaque}
              obrigatorio
              erro={erros.includes('destaque')}
              placeholder="ex.: −10%"
            />
            <div className="sugestoes" aria-label="Sugestões">
              {SUGESTOES_DE_DESTAQUE.map((s) => (
                <button key={s} type="button" onClick={() => mudar('destaque')(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Campo
            rotulo="Em quê"
            valor={f.titulo}
            mudar={mudar('titulo')}
            max={LIMITES.titulo}
            obrigatorio
            erro={erros.includes('titulo')}
            placeholder="ex.: Na refeição"
          />
          <AreaDeTexto
            rotulo="Condições"
            valor={f.detalhe}
            mudar={mudar('detalhe')}
            max={LIMITES.detalhe}
            erro={erros.includes('detalhe')}
            ajuda="Curtas: quando, onde, quantas vezes."
          />
          <div className="duas-colunas">
            <Campo
              rotulo="Começa"
              tipo="date"
              valor={f.inicio}
              mudar={mudar('inicio')}
              erro={erros.includes('inicio')}
              ajuda="Vazio: já."
            />
            <Campo
              rotulo="Acaba"
              tipo="date"
              valor={f.fim}
              mudar={mudar('fim')}
              erro={erros.includes('fim')}
              ajuda="Vazio: não acaba."
            />
          </div>
          <div className="sugestoes" aria-label="Atalhos para o fim">
            <button type="button" onClick={() => mudar('fim')(somarDias(hoje, 6))}>
              Uma semana
            </button>
            <button type="button" onClick={() => mudar('fim')(somarDias(hoje, 29))}>
              30 dias
            </button>
            <button type="button" onClick={() => mudar('fim')(fimDoMes)}>
              Fim do mês
            </button>
            <button type="button" onClick={() => mudar('fim')('')}>
              Sem fim
            </button>
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <Interruptor
              ligado={f.activa}
              mudar={mudar('activa')}
              rotulo="Ligada"
              ajuda="Desligada, não aparece na app."
            />
            <Interruptor
              ligado={f.emDestaque}
              mudar={mudar('emDestaque')}
              rotulo="Em destaque"
              ajuda="Aparece no cartão grande, no topo da app."
            />
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <div className="campo">
              <span className="rotulo-campo">Na Balcão do parceiro</span>
              <Interruptor
                ligado={f.validar}
                mudar={ligarValidacao}
                rotulo="O parceiro valida ao ler o cartão"
                ajuda="Desligado, basta mostrar a app."
              />
            </div>
            {f.validar && (
              <>
                <div className="duas-colunas">
                  <Campo
                    rotulo="Por cliente"
                    tipo="number"
                    valor={f.limitePorCliente}
                    mudar={mudar('limitePorCliente')}
                    minimo={LIMITES_DOS_VALES.porCliente.min}
                    maximo={LIMITES_DOS_VALES.porCliente.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('limitePorCliente')}
                    ajuda="Vazio: sem limite."
                  />
                  <Seletor<PeriodoDoLimite>
                    rotulo="Período"
                    valor={f.periodoDoLimite}
                    mudar={(v) => mudar('periodoDoLimite')(v ?? 'dia')}
                    opcoes={PERIODOS_DO_LIMITE.map((p) => ({ valor: p, nome: NOME_DO_PERIODO[p] }))}
                  />
                </div>
                <div className="duas-colunas">
                  <Campo
                    rotulo="No total"
                    tipo="number"
                    valor={f.limiteTotal}
                    mudar={mudar('limiteTotal')}
                    minimo={LIMITES_DOS_VALES.total.min}
                    maximo={LIMITES_DOS_VALES.total.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('limiteTotal')}
                    ajuda="Vazio: sem limite."
                  />
                </div>
                <Interruptor
                  ligado={f.soClientesActivos}
                  mudar={mudar('soClientesActivos')}
                  rotulo="Só clientes activos"
                  ajuda="Corte no último ano."
                />
              </>
            )}
          </div>
          <div className="cartao recheado formulario" style={{ boxShadow: 'none' }}>
            <div className="campo">
              <span className="rotulo-campo">No saco das surpresas</span>
              <Interruptor
                ligado={f.surpresa}
                mudar={ligarSurpresa}
                rotulo="Sai como cupão ao carimbar"
                ajuda="Não aparece na lista; sai sorteada a quem corta o cabelo."
              />
            </div>
            {f.surpresa && (
              <>
                <div className="duas-colunas">
                  <Campo
                    rotulo="Vale durante"
                    tipo="number"
                    valor={f.surpresaDias}
                    mudar={mudar('surpresaDias')}
                    minimo={LIMITES_DO_SACO.dias.min}
                    maximo={LIMITES_DO_SACO.dias.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaDias')}
                    ajuda="dias"
                  />
                  <Campo
                    rotulo="Peso no sorteio"
                    tipo="number"
                    valor={f.surpresaPeso}
                    mudar={mudar('surpresaPeso')}
                    minimo={LIMITES_DO_SACO.peso.min}
                    maximo={LIMITES_DO_SACO.peso.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaPeso')}
                    ajuda="Mais peso, sai mais vezes."
                  />
                </div>
                <div className="duas-colunas">
                  <Campo
                    rotulo="Quantos podem sair"
                    tipo="number"
                    valor={f.surpresaRestantes}
                    mudar={mudar('surpresaRestantes')}
                    minimo={LIMITES_DO_SACO.restantes.min}
                    maximo={LIMITES_DO_SACO.restantes.max}
                    modoDeTeclado="numeric"
                    erro={erros.includes('surpresaRestantes')}
                    ajuda="Vazio: sem limite."
                  />
                </div>
              </>
            )}
          </div>
          <PrevisaoDaPromocao
            parceiro={parceiro}
            destaque={normalizarDestaque(f.destaque)}
            titulo={f.titulo}
            detalhe={f.detalhe}
            inicio={f.inicio || null}
            fim={f.fim || null}
            hoje={hoje}
            validar={f.validar}
            surpresa={f.surpresa}
            limite={
              f.validar
                ? limiteEmTexto({
                    limitePorCliente: Number.isNaN(limitePorCliente) ? null : limitePorCliente,
                    periodoDoLimite: f.periodoDoLimite,
                  })
                : null
            }
          />
        </div>
      </Folha>
      {dialogo}
    </>
  );
}
