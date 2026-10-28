import type { IconeDaCategoria } from './limites.ts';
import type { EstadoDaPromocao } from './promocoes.ts';
import type { PeriodoDoLimite } from './vales.ts';

/** O contrato da API: o que a app e o backoffice recebem. A API acrescenta, nunca renomeia. */

export type Categoria = { id: number; nome: string; icone: IconeDaCategoria; ordem: number };

export type Loja = {
  id: number;
  nome: string;
  morada: string;
  telefone: string;
  /** A ligação de marcação (Fresha, WhatsApp…). */
  marcar: string;
  ordem: number;
};

export type PromocaoPublica = {
  id: number;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  emDestaque: boolean;
  /** O parceiro valida ao ler o cartão (senão basta mostrar a app). */
  validar: boolean;
  /** Quantas vezes cada cliente pode usar (null: sem limite), no período. */
  limitePorCliente: number | null;
  periodoDoLimite: PeriodoDoLimite;
  /** Só para quem cortou o cabelo no último ano. */
  soClientesActivos: boolean;
};

export type ContactosDoParceiro = {
  localidade: string;
  morada: string;
  telefone: string;
  instagram: string;
  site: string;
  horario: string;
  descricao: string;
};

export type ParceiroPublico = ContactosDoParceiro & {
  id: number;
  nome: string;
  categoriaId: number | null;
  /** A casa do Nuno's Lab de que o parceiro é; null: aparece para todas. */
  lojaId: number | null;
  cor: string;
  /** Identificadores de imagem: a app junta-lhes a morada da API. */
  logotipo: string | null;
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
  categoriaId: number | null;
  lojaId: number | null;
  cor: string;
  logotipo: string | null;
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

export type CategoriaComContagem = Categoria & { parceiros: number };

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
  ligacoes: { id: number; criadoEm: number; expiraEm: number }[];
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
  aviso: string;
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
  servico: string | null;
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
  /** Entrou há menos de 15 minutos: pode juntar e tirar formas, e apagar a conta. */
  provaRecente: boolean;
  programa: { objectivo: number; recompensa: string };
  /** Corte no último ano: as vantagens dos parceiros valem. */
  activo: boolean;
  /** As vantagens validadas nos parceiros, da mais recente para a mais antiga. */
  vales: ValeDoCliente[];
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

/** Um serviço que a Balcão pergunta ao carimbar; o preço em cêntimos, para a receita estimada. */
export type Servico = {
  id: number;
  nome: string;
  preco: number | null;
  ordem: number;
  activo: boolean;
};

export type EuDaBalcao = {
  pessoa: PessoaDaEquipa;
  sessao: number;
  lojas: Loja[];
  servicos: Servico[];
  programa: {
    objectivo: number;
    recompensa: string;
    porDia: number;
    servicos: boolean;
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
  hoje: { carimbos: number; ultimo: { quando: number; pessoa: string | null } | null };
};

export type ResultadoDoCarimbo = {
  carimboId: number;
  cartao: CartaoDoCliente;
  /** Este carimbo completou o cartão: a recompensa fica por usar. */
  completo: boolean;
  recompensa: string | null;
  anulavelAte: number;
};

export type UltimoCarimbo = {
  id: number;
  quando: number;
  cliente: string;
  clienteId: number;
  codigo: string;
  pessoa: string | null;
  loja: string | null;
  servico: string | null;
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
  ligacoes: { id: number; criadoEm: number; expiraEm: number }[];
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
    /** Em cêntimos, pelos preços dos serviços; null quando os serviços não têm preço. */
    receita: number | null;
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
  servicos: { id: number | null; nome: string; n: number; receita: number | null }[];
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
