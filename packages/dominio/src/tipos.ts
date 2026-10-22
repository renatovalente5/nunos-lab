import type { IconeDaCategoria } from './limites.ts';
import type { EstadoDaPromocao } from './promocoes.ts';

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
] as const;
export type TipoDeContagem = (typeof TIPOS_DE_CONTAGEM)[number];

// ——— backoffice ———

export type Parceiro = ContactosDoParceiro & {
  id: number;
  nome: string;
  categoriaId: number | null;
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
