import type { HorarioDaSemana } from './horario.ts';
import type { Rede } from './ligacoes.ts';
import type { IconeDaCategoria } from './limites.ts';
import type { AjusteDoLogotipo } from './logotipo.ts';
import type { EstadoDaPromocao } from './promocoes.ts';
import type { PeriodoDoLimite } from './vales.ts';

/** O contrato da API: o que a app e o backoffice recebem. A API acrescenta, nunca renomeia. */

export type Categoria = {
  id: number;
  nome: string;
  /** Para as apps, sempre um desenho que as antigas conhecem (ver `categoriaParaAsApps`). */
  icone: IconeDaCategoria;
  ordem: number;
  /** O desenho verdadeiro, quando é novo de mais para as apps antigas (9 nov 2026). */
  desenho?: IconeDaCategoria;
};

export type Loja = {
  id: number;
  nome: string;
  morada: string;
  telefone: string;
  /** A ligação de marcação (Fresha, WhatsApp…). */
  marcar: string;
  ordem: number;
  /** Onde fica, para o mapa e o passe da Wallet; null enquanto o backoffice não souber. */
  lat: number | null;
  lng: number | null;
};

export type PromocaoPublica = {
  id: number;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  emDestaque: boolean;
  /**
   * Sempre true: qualquer promoção se valida ao ler o cartão, se o parceiro quiser; senão basta
   * mostrar a app (o Renato, 8 nov 2026). Fica pelas apps instaladas antes disso, que o lêem.
   */
  validar: true;
  /** Quantas vezes cada cliente pode usar (null: sem limite), no período: conta ao ler o cartão. */
  limitePorCliente: number | null;
  periodoDoLimite: PeriodoDoLimite;
  /**
   * Sempre true: todas as vantagens são só para quem cortou o cabelo no último ano (o Renato,
   * 8 nov 2026). Fica pelas apps instaladas antes disso, que o lêem.
   */
  soClientesActivos: true;
  /** Sempre false: o saco das surpresas saiu (8 nov 2026). Fica pelas apps instaladas antes disso. */
  surpresa: false;
};

export type ContactosDoParceiro = {
  localidade: string;
  morada: string;
  telefone: string;
  instagram: string;
  site: string;
  /** Com o horário por dias, o texto dele na língua pedida; sem ele, o texto livre de antes. */
  horario: string;
  /** O horário por dias (9 nov 2026); null: só o texto livre de antes, ou nenhum. */
  horarioSemana: HorarioDaSemana | null;
  descricao: string;
};

export type ParceiroPublico = ContactosDoParceiro & {
  id: number;
  nome: string;
  categoriaId: number | null;
  /**
   * Sempre null: um parceiro é de todas as barbearias (o Renato, 8 nov 2026). Fica porque as apps
   * instaladas antes disso filtravam por ele, e null é «aparece para todas».
   */
  lojaId: null;
  cor: string;
  /** Identificadores de imagem: a app junta-lhes a morada da API. */
  logotipo: string | null;
  /** O fundo, o tamanho e o sítio do logótipo no círculo (9 nov 2026); null: branco e a 70 %. */
  logotipoAjuste: AjusteDoLogotipo | null;
  capa: string | null;
  /** Um parceiro inventado para a demonstração. */
  exemplo: boolean;
  novo: boolean;
  promocoes: PromocaoPublica[];
};

export type Barbearia = {
  instagram: string;
  tiktok: string;
  whatsapp: string;
  site: string;
  /** A ordem das redes na app (a escolhida no backoffice). */
  redes: Rede[];
  lojas: Loja[];
};

export type DadosDaApp = {
  hoje: string;
  barbearia: Barbearia;
  aviso: string | null;
  /** Último dia do aviso (a app sem rede tira-o no dia seguinte). */
  avisoAte?: string | null;
  categorias: Categoria[];
  parceiros: ParceiroPublico[];
  /** O programa de agora, para o cartão de quem ainda não entrou (falta em respostas guardadas antigas). */
  programa?: { objectivo: number; recompensa: string };
};

/** Os tipos de toque que a app conta, sem saber quem tocou. */
export const TIPOS_DE_CONTAGEM = [
  'abrir',
  'parceiro',
  'promocao',
  'mapa',
  'ligar',
  'instagram',
  'site',
  'marcar',
  'cartao',
  'entrar',
] as const;
export type TipoDeContagem = (typeof TIPOS_DE_CONTAGEM)[number];

// ——— backoffice ———

export type Parceiro = ContactosDoParceiro & {
  id: number;
  nome: string;
  /**
   * A descrição e o horário de antes (o texto livre) em inglês (vazio: a app em inglês mostra o
   * português). O horário por dias já vem nas duas línguas.
   */
  horarioEn: string;
  descricaoEn: string;
  categoriaId: number | null;
  cor: string;
  logotipo: string | null;
  logotipoAjuste: AjusteDoLogotipo | null;
  capa: string | null;
  exemplo: boolean;
  activo: boolean;
  ordem: number;
  criadoEm: number;
  alteradoEm: number;
  promocoesNaApp: number;
  promocoesTotal: number;
};

export type Promocao = PromocaoPublica & {
  /** Os textos em inglês (vazio: a app em inglês mostra o português). */
  destaqueEn: string;
  tituloEn: string;
  detalheEn: string;
  parceiroId: number;
  parceiro: string;
  /** Para toda a gente (null: sem limite), e quantas já foram usadas. */
  limiteTotal: number | null;
  validacoes: number;
  /** O parceiro está desligado: a promoção, mesmo ligada, não está na app. */
  parceiroPausado: boolean;
  activa: boolean;
  ordem: number;
  criadaEm: number;
  alteradaEm: number;
  estado: EstadoDaPromocao;
};

export type CategoriaComContagem = Categoria & { parceiros: number; nomeEn: string };

export type Eu = { id: number; nome: string; sessao: number };

export type SessaoDoBackoffice = {
  id: number;
  aparelho: string;
  criadaEm: number;
  vistaEm: number;
  actual: boolean;
};

export type PessoaComAcesso = {
  id: number;
  nome: string;
  /** O email da conta Google com que entra (null: só por ligação de acesso). */
  email: string | null;
  criadoEm: number;
  eu: boolean;
  sessoes: SessaoDoBackoffice[];
};

export type Resumo = {
  hoje: string;
  dias: number;
  parceiros: { naApp: number; pausados: number; semPromocoes: number; exemplos: number };
  promocoes: { naApp: number; agendadas: number; terminadas: number; pausadas: number };
  aAcabar: { id: number; destaque: string; titulo: string; parceiro: string; fim: string }[];
  semPromocoes: { id: number; nome: string }[];
  aberturas: { dia: string; n: number }[];
  totais: { aberturas: number; parceiros: number; contactos: number; marcacoes: number };
  maisVistos: { id: number; nome: string; vistas: number; contactos: number }[];
  marcacoes: { id: number; nome: string; n: number }[];
};

export type EntradaDoRegisto = {
  id: number;
  quando: number;
  quem: string | null;
  accao: string;
  alvo: string;
};

export type ParceiroComPromocoes = { parceiro: Parceiro; promocoes: Promocao[] };

export type DefinicoesDaBarbearia = {
  lojas: Loja[];
  instagram: string;
  tiktok: string;
  whatsapp: string;
  site: string;
  redes: Rede[];
  aviso: string;
  /** O aviso em inglês (vazio: a app em inglês mostra o português). */
  avisoEn: string;
  avisoAte: string | null;
};

// ——— fidelidade: o cliente (a app) ———

export type TipoDeEntrada = 'apple' | 'google' | 'email';

export type FormaDeEntrar = {
  id: number;
  tipo: TipoDeEntrada;
  /** O email que essa forma trouxe (null: a Apple escondeu-o). */
  email: string | null;
  criadaEm: number;
  /** Juntada há menos de 7 dias: ainda não pode ficar sozinha na conta. */
  aExperiencia: boolean;
};

export type SessaoDoCliente = {
  id: number;
  aparelho: string;
  criadaEm: number;
  vistaEm: number;
  actual: boolean;
};

export type VisitaDoCliente = {
  id: number;
  quando: number;
  loja: string | null;
  pessoa: string | null;
};

export type CartaoDoCliente = {
  id: number;
  numero: number;
  objectivo: number;
  recompensa: string;
  carimbos: number;
};

export type RecompensaPorUsar = { cartaoId: number; recompensa: string; ganhaEm: number };

/** O que a app recebe de /api/eu: a pessoa, o cartão, as visitas, a conta. */
export type ClienteEu = {
  id: number;
  /** A sessão de demonstração (os revisores das lojas): a app esconde o que a API recusa. */
  demo?: boolean;
  codigo: string;
  nome: string;
  aniversario: string | null;
  lojaId: number | null;
  criadoEm: number;
  cortes: number;
  cartao: CartaoDoCliente;
  recompensas: RecompensaPorUsar[];
  visitas: VisitaDoCliente[];
  formas: FormaDeEntrar[];
  sessoes: SessaoDoCliente[];
  /** Sempre true: a regra dos 15 minutos saiu a 6 nov 2026. Fica pelas apps antigas, que sem o campo pediam para sair. */
  provaRecente: boolean;
  programa: { objectivo: number; recompensa: string };
  /** Corte no último ano: as vantagens dos parceiros valem. */
  activo: boolean;
  /** As vantagens validadas nos parceiros, da mais recente para a mais antiga. */
  vales: ValeDoCliente[];
  /**
   * Que carteiras estão ligadas no servidor (os botões da app), e se o passe da
   * Apple já está nalgum iPhone (há aparelhos registados): aí o selo sai.
   */
  wallet: { apple: boolean; google: boolean; appleNaCarteira: boolean };
  /** Sempre vazia: o saco das surpresas saiu (8 nov 2026). Fica pelas apps instaladas antes disso. */
  cupoes: never[];
  /** A prenda de anos do programa: faz anos hoje, deu a data há 30 dias ou mais, e ainda não a levou este ano. */
  prenda: string | null;
};

export type ValeDoCliente = {
  id: number;
  quando: number;
  parceiroId: number;
  parceiro: string;
  promocaoId: number;
  destaque: string;
  titulo: string;
};

// ——— fidelidade: a Balcão ———

export type PapelDaEquipa = 'dono' | 'barbeiro' | 'parceiro';

export type PessoaDaEquipa = {
  id: number;
  nome: string;
  /** Entra com o Google ou a Apple deste email (null: só por ligação de acesso). */
  email: string | null;
  papel: PapelDaEquipa;
  /** A casa (barbeiro); null: todas. */
  lojaId: number | null;
  /** O estabelecimento (papel parceiro). */
  parceiroId: number | null;
  activo: boolean;
  criadoEm: number;
};

export type EuDaBalcao = {
  pessoa: PessoaDaEquipa;
  sessao: number;
  lojas: Loja[];
  programa: {
    objectivo: number;
    recompensa: string;
    porDia: number;
    aniversario: string;
  };
  parceiro: { id: number; nome: string } | null;
};

export type FichaDoBalcao = {
  cliente: {
    id: number;
    codigo: string;
    nome: string;
    criadoEm: number;
    cortes: number;
    /** Faz anos hoje (se o cliente tiver dado a data). */
    aniversario: boolean;
  };
  cartao: CartaoDoCliente;
  recompensas: RecompensaPorUsar[];
  ultima: VisitaDoCliente | null;
  hoje: {
    carimbos: number;
    ultimo: { quando: number; pessoa: string | null } | null;
    /** O prémio entregue hoje (o corte grátis não leva carimbo). */
    entregue: { quando: number; pessoa: string | null } | null;
  };
  /** A prenda de anos do programa: faz anos hoje, deu a data há 30 dias ou mais, e ainda não a levou este ano. */
  prenda: string | null;
  /** A prenda deste ano já foi entregue: quando e por quem. */
  prendaEntregue: { quando: number; pessoa: string | null } | null;
};

export type ResultadoDoCarimbo = {
  carimboId: number;
  cartao: CartaoDoCliente;
  /** Este carimbo completou o cartão: foi o corte da oferta (o 10.º), já entregue. */
  completo: boolean;
  recompensa: string | null;
  anulavelAte: number;
  /** Sempre null: o saco das surpresas saiu (8 nov 2026). Fica pelas for partners de antes disso. */
  cupao: null;
};

export type UltimoCarimbo = {
  id: number;
  quando: number;
  cliente: string;
  clienteId: number;
  codigo: string;
  pessoa: string | null;
  pessoaId: number | null;
  /** Até quando quem carimbou pode anular (instante do servidor). */
  anulavelAte: number;
  loja: string | null;
  carimbos: number;
  objectivo: number;
  anulado: boolean;
  repetido: boolean;
  recompensa: boolean;
};

export type HojeDaBalcao = {
  dia: string;
  carimbos: number;
  novos: number;
  recompensas: number;
  ultimos: UltimoCarimbo[];
};

export type ResumoDaBalcao = {
  periodo: 'hoje' | 'semana' | 'mes';
  de: string;
  ate: string;
  carimbos: number;
  anterior: number;
  novos: number;
  recompensas: number;
  emRisco: number;
  porLoja: { id: number; nome: string; n: number }[];
  porPessoa: {
    id: number;
    nome: string;
    loja: string | null;
    n: number;
    primeiro: number | null;
    ultimo: number | null;
  }[];
};

export type ClienteProcurado = {
  id: number;
  codigo: string;
  nome: string;
  /** Só o início e o domínio («re…@gmail.com»): distingue homónimos sem dar a lista de emails. */
  email: string | null;
  carimbos: number;
  objectivo: number;
  ultimo: number | null;
};

// ——— os vales (a Balcão do parceiro) ———

export type VantagemDoParceiro = {
  id: number;
  destaque: string;
  titulo: string;
  detalhe: string;
  limitePorCliente: number | null;
  periodoDoLimite: PeriodoDoLimite;
  /** Pode usar agora; senão, o motivo. */
  motivo: 'ok' | 'ja_usou' | 'limite_do_cliente' | 'limite_total' | 'cliente_inactivo';
  /** Quantas vezes este cliente a usou no período do limite. */
  usadas: number;
};

export type FichaDoParceiro = {
  cliente: {
    id: number;
    codigo: string;
    /** Só o nome próprio: o parceiro não precisa de mais. */
    nome: string;
    activo: boolean;
  };
  vantagens: VantagemDoParceiro[];
};

export type Vale = {
  id: number;
  quando: number;
  promocaoId: number;
  destaque: string;
  titulo: string;
  cliente: string;
  codigo: string;
  pessoa: string | null;
  anulado: boolean;
};

export type HojeDoParceiro = { dia: string; validacoes: number; ultimos: Vale[] };

// ——— fidelidade: o backoffice ———

export type PessoaDaEquipaNoBackoffice = PessoaDaEquipa & {
  loja: string | null;
  parceiro: string | null;
  sessoes: SessaoDoBackoffice[];
};

export type ClienteDoBackoffice = {
  id: number;
  codigo: string;
  nome: string;
  email: string | null;
  aniversario: string | null;
  lojaId: number | null;
  criadoEm: number;
  cortes: number;
  ultimo: number | null;
  carimbos: number;
  objectivo: number;
  recompensasPorUsar: number;
  exemplo: boolean;
  apagado: boolean;
  formas: TipoDeEntrada[];
  /**
   * Sem email porque, ao entrar com a Apple, escolheu «Ocultar o meu email»: o endereço de
   * retransmissão não diz quem é, e não se guarda como o email dele (o Renato, 9 nov).
   */
  emailOculto: boolean;
};

export type FichaDoCliente = ClienteDoBackoffice & {
  cartoes: {
    id: number;
    numero: number;
    objectivo: number;
    recompensa: string;
    carimbos: number;
    iniciadoEm: number;
    completoEm: number | null;
    usadoEm: number | null;
    usadoLoja: string | null;
    usadoPor: string | null;
  }[];
  historico: (VisitaDoCliente & {
    cartaoNumero: number;
    anuladoEm: number | null;
    anuladoPor: string | null;
    repetido: boolean;
    semLeitura: boolean;
  })[];
};

export type Metricas = {
  de: string;
  ate: string;
  dias: number;
  lojaId: number | null;
  totais: {
    carimbos: number;
    carimbosAnterior: number;
    clientesNovos: number;
    clientesNovosAnterior: number;
    clientesActivos: number;
    recompensasGanhas: number;
    recompensasUsadas: number;
    recompensasPorUsar: number;
    anulados: number;
    repetidos: number;
    semLeitura: number;
  };
  porDia: { dia: string; n: number }[];
  porLoja: { id: number; nome: string; n: number; clientes: number; anterior: number }[];
  porPessoa: {
    id: number;
    nome: string;
    loja: string | null;
    n: number;
    anulados: number;
    repetidos: number;
    semLeitura: number;
    recompensas: number;
  }[];
  /** [dia da semana 0–6][hora 0–23], em Lisboa. */
  mapaDeCalor: number[][];
  clientes: {
    total: number;
    activos30: number;
    activos90: number;
    activos365: number;
    /** Dias médios entre visitas de quem tem duas ou mais. */
    frequencia: number | null;
    /** Dos clientes novos há 60–120 dias, a fracção que voltou nos 60 dias seguintes. */
    retorno: number | null;
    emRisco: number;
    perdidos: number;
    variasCasas: number;
    distribuicao: { faixa: string; n: number }[];
    top: { id: number; nome: string; cortes: number; ultimo: number }[];
  };
  /** Por mês do 1.º corte: quantos entraram, e quantos voltaram em cada um dos meses seguintes. */
  coortes: { mes: string; clientes: number; voltaram: number[] }[];
  contas: { total: number; apple: number; google: number; email: number; soBalcao: number };
  parcerias: {
    validacoes: number;
    validacoesAnterior: number;
    clientesUnicos: number;
    /** Dos clientes com cartão, quantos já usaram alguma vantagem (sempre). */
    clientesComParcerias: number;
    porParceiro: { id: number; nome: string; n: number; clientes: number; anterior: number }[];
    porPromocao: {
      id: number;
      parceiro: string;
      destaque: string;
      titulo: string;
      n: number;
      total: number;
      limiteTotal: number | null;
    }[];
    semValidacoes: { id: number; nome: string }[];
    /** Pela casa do cliente. */
    porCasa: { id: number; nome: string; n: number }[];
  };
};
