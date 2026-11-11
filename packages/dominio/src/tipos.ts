import type { HorarioDaSemana } from './horario.ts';
import type { Rede } from './ligacoes.ts';
import type { IconeDaCategoria } from './limites.ts';
import type { AjusteDoLogotipo } from './logotipo.ts';
import type { EstadoDaPromocao } from './promocoes.ts';
import type { DefinicoesDosConvites, TipoDeMovimento } from './saldo.ts';
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
  /** O lugar na ordem das vantagens, a única, que o Nuno arrasta no backoffice (10 nov 2026). As
   *  respostas de antes não o traziam, e a app guarda-as para abrir sem rede. */
  ordem?: number;
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
  /**
   * Tem um código de cupão (10 nov 2026). O código não vem aqui, na lista que toda a gente vê: só
   * no «eu» de quem tem a vantagem desbloqueada (`ClienteEu.codigosDasVantagens`).
   */
  temCupao?: boolean;
};

export type ContactosDoParceiro = {
  localidade: string;
  morada: string;
  /**
   * O sítio exato (10 nov 2026): com ele, o «Ir» vai ao ponto em vez de procurar pelo nome e pela
   * morada. Null, ou ausente nas respostas de antes, é procurar como antes.
   */
  lat?: number | null;
  lng?: number | null;
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
  programa?: {
    objectivo: number;
    recompensa: string;
    /** O prémio a meio dos cartões novos (null: não há; falta nas respostas de antes de 10 nov 2026). */
    meio?: { carimbos: number; recompensa: string } | null;
  };
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
  /** O código de cupão (vazio: sem código); a app só o mostra a quem não tem o cadeado. */
  cupao: string;
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
  /**
   * O prémio a meio deste cartão (10 nov 2026): em que carimbo, o quê (na língua pedida), e se já se
   * ganhou e entregou. null: este cartão não tem. As respostas de antes não o traziam.
   */
  meio?: { carimbos: number; recompensa: string; ganho: boolean; usado: boolean } | null;
};

export type RecompensaPorUsar = { cartaoId: number; recompensa: string; ganhaEm: number };

/** Um prémio a meio ganho e por entregar: é num produto, e espera pelo cliente (nesse dia ou noutro). */
export type PremioAMeioPorUsar = {
  cartaoId: number;
  /** Em que carimbo se ganhou («o prémio dos 5»). */
  carimbos: number;
  recompensa: string;
  ganhoEm: number;
};

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
  /** Os prémios a meio por entregar (10 nov 2026; as respostas de antes não os traziam). */
  premiosAMeio?: PremioAMeioPorUsar[];
  visitas: VisitaDoCliente[];
  formas: FormaDeEntrar[];
  sessoes: SessaoDoCliente[];
  /** Sempre true: a regra dos 15 minutos saiu a 6 nov 2026. Fica pelas apps antigas, que sem o campo pediam para sair. */
  provaRecente: boolean;
  programa: {
    objectivo: number;
    recompensa: string;
    meio?: { carimbos: number; recompensa: string } | null;
  };
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
  /**
   * Os códigos de cupão das vantagens, por id da vantagem (10 nov 2026). Só a quem tem um corte no
   * último ano (sem o cadeado); aos outros vem vazio, para o código nem chegar ao telemóvel.
   */
  codigosDasVantagens?: Record<string, string>;
  /** O saldo (10 nov 2026): o número do topo da app e o último movimento, para a animação quando muda. */
  saldo?: SaldoNoEu;
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
  /** Os prémios a meio ganhos e por entregar, o mais antigo primeiro. */
  premiosAMeio: PremioAMeioPorUsar[];
  /** O último prémio a meio entregue hoje: o quê, quando e por quem (outro barbeiro vê que já foi). */
  premioAMeioEntregue: { recompensa: string; quando: number; pessoa: string | null } | null;
  /**
   * O saldo do cliente (10 nov 2026), em cêntimos, e o último uso de hoje (para o anular, e para outro
   * barbeiro ver que já foi usado). Falta nas respostas de antes do saldo.
   */
  saldo?: {
    valor: number;
    usadoHoje: {
      movimentoId: number;
      /** O valor usado, positivo, em cêntimos. */
      valor: number;
      quando: number;
      pessoa: string | null;
      /** Quem usou anula nos 10 minutos seguintes; o dono sempre. */
      podeAnular: boolean;
    } | null;
  };
};

export type ResultadoDoCarimbo = {
  carimboId: number;
  cartao: CartaoDoCliente;
  /** Este carimbo completou o cartão: foi o corte da oferta (o 10.º), já entregue. */
  completo: boolean;
  recompensa: string | null;
  /** Este carimbo ganhou o prémio a meio: o prémio, na língua pedida (fica por entregar). */
  premioAMeio?: string | null;
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

/**
 * Uma coisa que uma pessoa da equipa fez (o histórico da pessoa no backoffice, 11 nov 2026): um carimbo,
 * um uso do saldo, um prémio entregue, ou um carimbo ou um uso de outra pessoa que anulou.
 */
export type AcontecimentoDaPessoa = {
  tipo: 'carimbo' | 'uso' | 'premio' | 'meio' | 'anulou-carimbo' | 'anulou-uso';
  id: number;
  quando: number;
  /** O cliente (null: já não existe). */
  cliente: { id: number; nome: string; apagado: boolean } | null;
  loja: string | null;
  /** Em cêntimos: o uso (negativo), também no uso que anulou. */
  valor: number | null;
  /** O prémio entregue (no «premio» e no «meio»); o inglês vazio nos cartões de antes do inglês. */
  recompensa: string | null;
  recompensaEn: string | null;
  semLeitura: boolean;
  repetido: boolean;
  /** O que fez e foi anulado: quando e por quem (null: no backoffice). */
  anulado: { em: number; por: string | null } | null;
  /** O que anulou: quem o tinha feito e quando. */
  de: { pessoa: string | null; quando: number } | null;
};

/** O histórico de uma pessoa da equipa, do mais recente para trás, às páginas. */
export type HistoricoDaPessoa = {
  /** Os últimos 30 dias (só na primeira página). */
  numeros: {
    carimbos: number;
    /** Em cêntimos, o que usou do saldo dos clientes (sem os usos anulados). */
    saldoUsado: number;
    /** Carimbos e usos dela que foram anulados. */
    anulados: number;
    /** Carimbos e usos sem ler o cartão. */
    semLeitura: number;
  } | null;
  acontecimentos: AcontecimentoDaPessoa[];
  /** A página seguinte (mais antiga), ou null se não houver. */
  seguinte: string | null;
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
    /** O prémio em inglês (vazio nos cartões de antes do inglês: aí o português traduz-se pelas regras). */
    recompensaEn: string;
    carimbos: number;
    iniciadoEm: number;
    completoEm: number | null;
    usadoEm: number | null;
    usadoLoja: string | null;
    usadoPor: string | null;
    /** O prémio a meio deste cartão (null: não tem). */
    meio: {
      carimbos: number;
      recompensa: string;
      recompensaEn: string;
      ganhoEm: number | null;
      usadoEm: number | null;
      usadoLoja: string | null;
      usadoPor: string | null;
    } | null;
  }[];
  historico: (VisitaDoCliente & {
    cartaoNumero: number;
    anuladoEm: number | null;
    anuladoPor: string | null;
    repetido: boolean;
    semLeitura: boolean;
  })[];
  /** O saldo e os convites (10 nov 2026); falta nas respostas de antes. */
  saldo?: SaldoDoBackoffice;
};

/** A resposta de usar o saldo ao balcão: a ficha nova e o uso feito por esta chave (11 nov 2026). */
export type FichaDepoisDoUso = FichaDoBalcao & {
  usoFeito?: { movimentoId: number; valor: number; quando: number } | null;
};

/** Na ficha do cliente do backoffice: o saldo, os movimentos (com quem os fez) e os convites. */
export type SaldoDoBackoffice = {
  /** Em cêntimos. */
  valor: number;
  movimentos: (MovimentoDoSaldo & {
    /** Quem da equipa usou, ou quem do backoffice acertou. */
    por: string | null;
    /** Um uso sem ler o cartão (escrito à mão, ou procurado): como nos carimbos (11 nov 2026). */
    semLeitura?: boolean;
    /** Quem da equipa o anulou (null: o backoffice, ou desconhecido). */
    anuladoPor?: string | null;
    /** Quando foi anulado (o histórico do backoffice, 11 nov 2026; falta nas respostas de antes). */
    anuladoEm?: number | null;
    /** O outro lado de um convite (no «convite» e no «convidado»): para abrir a ficha dele. */
    quemId?: number | null;
    /** O outro lado apagou a conta (o nome já não existe). */
    quemApagado?: boolean;
  })[];
  /** Os convites deste cliente: quem aceitou (nome inteiro, é o backoffice) e se já foi. */
  convites: (ConviteFeito & {
    clienteId: number;
    /** Quando este cliente recebeu o prémio pela visita deste (null: ainda não, ou anulado). */
    premioEm?: number | null;
    /** O convidado apagou a conta. */
    apagado?: boolean;
  })[];
  convidadoPor: {
    clienteId: number;
    nome: string;
    criadoEm: number;
    /** Quem convidou apagou a conta. */
    apagado?: boolean;
  } | null;
  codigoDoConvite: string | null;
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

// ——— saldo e convites (o Renato, 10 nov 2026) ———

/** Um movimento do saldo, como a carteira o mostra: a app escreve a frase na língua dela. */
export type MovimentoDoSaldo = {
  id: number;
  /** Em cêntimos: positivo entrou, negativo saiu. */
  valor: number;
  tipo: TipoDeMovimento;
  /**
   * O outro lado de um convite, em nome curto («Pedro S.»): no «convite», o convidado que foi à
   * barbearia; no «convidado», quem convidou. Null nos outros.
   */
  quem: string | null;
  /** Onde se usou (no «uso»). */
  loja: string | null;
  /** A nota de um acerto do Nuno (no «acerto»). */
  nota: string;
  criadoEm: number;
  /** Anulado: aparece riscado e não conta para o saldo. */
  anulado: boolean;
};

/** No «eu»: o saldo, o último movimento (a animação compara-o com o último visto) e se há convites. */
export type SaldoNoEu = {
  /** Em cêntimos. */
  saldo: number;
  ultimo: MovimentoDoSaldo | null;
  /** Os convites estão ligados no backoffice (a pílula aparece mesmo com o saldo a zero). */
  convites: boolean;
  /**
   * Ainda pode escrever o código de quem o convidou (convites ligados, sem convite, sem nenhum corte): a
   * app lembra-o no topo (11 nov 2026). Opcional: a API de antes não o manda.
   */
  podeUsarCodigo?: boolean;
};

/** Um convite feito por este cliente: quem aceitou (nome curto) e se já foi à barbearia. */
export type ConviteFeito = {
  nome: string;
  criadoEm: number;
  visitouEm: number | null;
  /** Em cêntimos: o que ganha (ou ganhou) quem convidou com a visita deste. */
  premio: number;
};

/** A carteira do cliente (GET /api/eu/carteira). */
export type CarteiraDoCliente = {
  /** Em cêntimos. */
  saldo: number;
  convites: DefinicoesDosConvites & {
    /**
     * O código para partilhar (null com os convites desligados). A ligação faz-se na app, como a dos
     * parceiros: `${SITIO}/?convite=CODIGO`.
     */
    codigo: string | null;
    /** Convites aceites, e destes quantos já foram à barbearia. */
    aceites: number;
    visitaram: number;
    /** Do mais recente para o mais antigo. */
    lista: ConviteFeito[];
  };
  /** Quem convidou este cliente, e o que ganhou ao aceitar (null: ninguém). */
  convidadoPor: { nome: string; premio: number; criadoEm: number } | null;
  /** Ainda pode escrever o código de quem o convidou: convites ligados, sem convite e sem nenhum corte. */
  podeUsarCodigo: boolean;
  /** Do mais recente para o mais antigo (até 100). */
  movimentos: MovimentoDoSaldo[];
};

/** O que a página de um convite mostra antes de entrar (GET /api/convite/:codigo). */
export type ConviteParaQuemChega = {
  /** Quem convida, em nome curto. */
  nome: string;
  /** Em cêntimos: o que o convidado ganha ao aceitar. */
  valorConvidado: number;
};
