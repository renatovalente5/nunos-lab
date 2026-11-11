import type { PeriodoDoLimite } from '@nunos-lab/dominio';

/**
 * As frases da app em português: a fonte. O inglês (en.ts) tem de ter as mesmas chaves, e o
 * TypeScript não deixa faltar nenhuma.
 */
export const pt = {
  separadores: { vantagens: 'Vantagens', cartao: 'Cartão', barbearia: 'Barbearias' },
  titulos: {
    vantagens: 'Nuno’s Lab · Vantagens',
    cartao: 'Nuno’s Lab · Cartão',
    barbearias: 'Nuno’s Lab · Barbearias',
    conta: 'Nuno’s Lab · Conta',
    privacidade: 'Privacidade · Nuno’s Lab',
    carteira: 'Nuno’s Lab · Carteira',
    parceiro: (nome: string) => `${nome} · Nuno’s Lab`,
  },
  vantagens: {
    emDestaque: 'Em destaque',
    /** Para o leitor de ecrã, a seguir à vantagem com o cadeado. */
    bloqueada: 'bloqueada',
    parceiros: 'Parceiros',
    semCorteHaUmAno: 'As vantagens voltam com o teu próximo corte',
    aindaSemCorte: 'As vantagens começam com o teu primeiro corte',
    categorias: 'Categorias',
    tudo: 'Tudo',
    emBreve: 'Novas vantagens em breve',
  },
  promocao: {
    verTudo: 'Ver tudo',
    menos: 'Ver menos',
    usadaHoje: (hora: string) => `Usada hoje às ${hora}`,
    jaUsaste: {
      dia: 'Já usaste hoje',
      semana: 'Já usaste esta semana',
      mes: 'Já usaste este mês',
      sempre: 'Já usaste',
    } as Record<PeriodoDoLimite, string>,
    mostraOCartao: 'Mostra o cartão ao balcão',
    // O código de cupão de uma vantagem, sem o cadeado (10 nov 2026).
    codigo: 'Código',
    copiar: 'Copiar',
    copiado: 'Copiado',
    copiarCodigo: (codigo: string) => `Copiar o código ${codigo}`,
    // A vantagem apagada, com o cadeado: a quem nunca cortou (ou ainda não tem conta) e a quem não
    // corta há um ano (o Renato, 9 nov).
    bloqueada: {
      nunca: 'Desbloqueia com o teu primeiro corte',
      expirou: 'Desbloqueia com o teu próximo corte',
    },
  },
  cartao: {
    titulo: 'Cartão',
    conta: 'Conta',
    deObjectivo: (objectivo: number) => `de ${objectivo}`,
    /** Por baixo do logótipo: desde quando é cliente e, a partir do 2.º cartão, quantos cortes leva. */
    clienteDesde: (ano: number, cartao: number, cortes: number): string =>
      cartao > 1
        ? `Cliente desde ${ano} · ${cartao}.º cartão · ${cortes} ${cortes === 1 ? 'corte' : 'cortes'}`
        : `Cliente desde ${ano}`,
    // Só a primeira letra: um prémio com uma marca não perde as maiúsculas.
    tensUma: (recompensa: string) =>
      `Tens ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`,
    tensVarias: (n: number) => `Tens ${n} recompensas`,
    mostraOCartao: 'Mostra o cartão ao balcão.',
    /** O prémio a meio é num produto: usa-se nesse dia ou noutro. */
    quandoQuiseres: 'Mostra o cartão ao balcão quando quiseres.',
    verOCodigo: 'Ver o código em grande',
    mostraAoBalcao: 'Mostra ao balcão.\nServe em todas as barbearias.',
    parabens: 'Parabéns!',
    ultimasVisitas: 'Últimas visitas',
    nosParceiros: 'Nos parceiros',
    semLigacaoDesde: (quando: string, hoje: boolean) =>
      `Sem ligação · dados ${hoje ? 'das' : 'de'} ${quando}`,
    semLigacao: 'Sem ligação',
    adicionarApple: 'Adicionar à Carteira Apple',
    adicionarGoogle: 'Adicionar à Carteira do Google',
    aPreparar: 'A preparar…',
    entraParaTer: 'Entra para ter o teu cartão.',
    // O nome curto já acaba em ponto («Miguel S.»): não leva outro.
    entraParaOConvite: (nome: string, valor: string | null) => {
      const de = nome ? ` de ${nome}` : '';
      const frase = valor
        ? `Entra para receberes ${valor} do convite${de}`
        : `Entra para aceitares o convite${de}`;
      return frase.endsWith('.') ? frase : `${frase}.`;
    },
    jaTensCartao:
      'Já tens cartão feito ao balcão? Entra com o email que nos deste. Com a Apple, escolhe partilhar o email.',
    aEntrar: 'A entrar…',
    proximoCarimbo: 'O próximo carimbo abre um cartão novo',
    semLigacaoNoCartao: 'Sem ligação',
    tocarParaTentar: 'Tocar para tentar outra vez.',
    semLigacaoTentar: 'Sem ligação. Tentar outra vez',
  },
  conta: {
    voltar: 'Voltar',
    titulo: 'Conta',
    todas: 'Todas',
    eu: 'Eu',
    nome: 'Nome',
    aniversario: 'Aniversário',
    aMinhaCasa: 'Barbearia',
    formasDeEntrar: 'Formas de entrar',
    tirarForma: (forma: string) => `Tirar ${forma}`,
    tirar: 'Tirar',
    juntarOutraForma: 'Juntar outra forma',
    sessoes: 'Sessões',
    esteAparelho: 'Este aparelho',
    /** Uma sessão sem nome (das apps antigas, antes de dizerem o aparelho). */
    aparelhoSemNome: 'Aparelho',
    usado: (dias: number, data: string): string =>
      dias <= 0
        ? 'Usado hoje'
        : dias === 1
          ? 'Usado ontem'
          : dias < 7
            ? `Usado há ${dias} dias`
            : `Usado a ${data}`,
    terminar: 'Terminar',
    terminarSessao: (aparelho: string) => `Terminar a sessão: ${aparelho}`,
    terminarAsOutras: 'Terminar as outras',
    sair: 'Sair',
    mais: 'Mais',
    lingua: 'Linguagem',
    privacidade: 'Privacidade',
    apagarAConta: 'Apagar a conta',
    oTeuNome: 'O teu nome',
    nomeProprio: 'Nome próprio',
    escreveONome: 'Escreve o teu nome.',
    guardar: 'Guardar',
    tirarOAniversario: 'Tirar o aniversário',
    todasAsCasas: 'Todas as barbearias',
    apagarAviso:
      'Perdes o cartão, os carimbos e as recompensas. Se voltares a entrar, começas do zero. Não se desfaz.',
    dia: 'Dia',
    mes: 'Mês',
    meses: [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ],
  },
  // O saldo e os convites (o Renato, 10 nov 2026). Os valores chegam já em euros («1 €»), ou null
  // quando são zero.
  carteira: {
    titulo: 'Carteira',
    saldo: 'Saldo',
    /** A pílula no topo das Vantagens, para o leitor de ecrã. */
    abrir: (saldo: string) => `Carteira, saldo ${saldo}`,
    comoUsar: 'Usa ao pagar, em qualquer barbearia.',
    comPrimeiroCorte: 'Usa-se no teu primeiro corte, em qualquer barbearia.',
    // Um prémio de convite tirado depois de usado (o corte do amigo foi anulado): não se deve nada.
    negativo: 'Um prémio de convite foi anulado depois de usado. Não há nada a pagar.',
    saldoMudou: 'O teu saldo mudou',
    convidaEGanha: 'Convida e ganha',
    regra: (padrinho: string | null, convidado: string | null): string =>
      padrinho && convidado
        ? `Ganhas ${padrinho} por cada amigo novo que for à barbearia. Ele ganha ${convidado} logo.`
        : padrinho
          ? `Ganhas ${padrinho} por cada amigo novo que for à barbearia.`
          : convidado
            ? `O teu amigo ganha ${convidado} logo.`
            : 'Convida os teus amigos.',
    partilhar: 'Partilhar convite',
    copiarLigacao: 'Copiar ligação',
    copiada: 'Ligação copiada',
    /** O que se partilha, antes da ligação. */
    mensagem: (convidado: string | null, codigo: string): string =>
      convidado
        ? `Ganha ${convidado} no teu primeiro corte no Nuno’s Lab com o meu convite. Código: ${codigo}`
        : `Vem ao Nuno’s Lab com o meu convite. Código: ${codigo}`,
    podesConvidarMais: (n: number): string =>
      n === 0
        ? 'Chegaste ao limite de convites.'
        : `Podes convidar mais ${n} ${n === 1 ? 'pessoa' : 'pessoas'}.`,
    convidados: 'Convidados',
    resumo: (aceites: number, foram: number) =>
      `${aceites} · ${foram} já ${foram === 1 ? 'foi' : 'foram'}`,
    jaFoi: 'Já foi',
    aindaNaoFoi: 'Ainda não foi',
    temCodigo: 'Tens um código de convite?',
    codigo: 'Código de convite',
    usar: 'Usar',
    movimentos: 'Movimentos',
    semMovimentos: 'Ainda sem movimentos.',
    anulado: 'Anulado',
    contaApagada: 'Conta apagada',
    movimento: {
      convidado: (quem: string | null) => (quem ? `Convite de ${quem}` : 'Convite'),
      convite: (quem: string | null) => `${quem ?? 'Um amigo'} foi à barbearia`,
      uso: (loja: string | null) => (loja ? `Usado em ${loja}` : 'Usado na barbearia'),
      acerto: 'Acerto',
    },
    /** O aviso no topo quando o último movimento foi anulado (o saldo volta). */
    foiAnulado: (frase: string) => `Anulado: ${frase}`,
    /** A faixa das Vantagens de quem abriu a ligação de um convite. */
    // Sem nome (uma conta sem ele): «Foste convidado».
    convidou: (nome: string, valor: string | null) =>
      nome
        ? valor
          ? `${nome} convidou-te: ganhas ${valor}`
          : `${nome} convidou-te`
        : valor
          ? `Foste convidado: ganhas ${valor}`
          : 'Foste convidado',
  },
  parceiro: {
    voltar: 'Voltar',
    partilhar: 'Partilhar',
    jaNaoEsta: 'Esta vantagem já não está na app',
    ligar: 'Ligar',
    ligarPara: (nome: string) => `Ligar para ${nome}`,
    instagramDe: (nome: string) => `Instagram de ${nome}`,
    site: 'Site',
    siteDe: (nome: string) => `Site de ${nome}`,
    aTuaVantagem: 'A tua vantagem',
    asTuasVantagens: 'As tuas vantagens',
    vantagem: 'Vantagem',
    vantagens: 'Vantagens',
    // O horário (9 nov): aberto ou fechado agora, pela hora de Lisboa.
    aberto: 'Aberto',
    fechaAs: (aHora: string) => `fecha ${aHora}`,
    fechado: 'Fechado',
    abreAs: (aHora: string) => `abre ${aHora}`,
    abreAmanha: (aHora: string) => `abre amanhã ${aHora}`,
    abreNoDia: (dia: string, aHora: string) => `abre ${dia} ${aHora}`,
    feriado: 'Feriado',
    podeEstarFechado: 'pode estar fechado',
  },
  privacidade: {
    titulo: 'Privacidade',
    paragrafos: [
      'A app mostra as vantagens dos parceiros do Nuno’s Lab e, se quiseres, o teu cartão de carimbos. Sem conta, não pede nada: não usa cookies nem tem publicidade.',
      'Com conta (Apple, Google ou email), o Nuno’s Lab guarda o teu nome, o email, a data de anos se a deres, a língua em que usas a app, e os carimbos: em que barbearia, com quem e quando. É o que faz o cartão funcionar. A Apple e a Google só confirmam quem és; não recebem os teus carimbos.',
      'Se puseres o cartão na Apple Wallet ou na Google Wallet, o cartão (o nome, os carimbos, o código) fica também nessa carteira e actualiza-se a cada corte; a Apple e a Google tratam-no pelas regras delas.',
      'Podes mudar ou apagar a conta na app, a qualquer altura. Ao apagar, saem o nome, o email e as formas de entrar; os carimbos e os movimentos do saldo ficam sem nome, para as contas da barbearia. Se já cortaste ou foste convidado, fica também uma marca irreversível da forma de entrar, só para um convite não se usar duas vezes.',
      'Para o Nuno saber o que interessa, a app conta, sem saber quem és, quantas vezes é aberta e quantas vezes cada parceiro é visto ou contactado. Fica só o dia e o número.',
      'Com os convites, quem convida vê do convidado só o primeiro nome e a inicial do último, e se já foi à barbearia (o dia, não a hora); o convidado vê quem o convidou da mesma forma, e quem abre a ligação de um convite vê o nome de quem o partilhou. O saldo fica com os movimentos: quando, quanto, em que barbearia e com quem foi usado, e a nota de um acerto.',
      'A app guarda neste aparelho a última lista de vantagens e o teu cartão, para abrirem sem rede, e também a língua que escolheste.',
      'A app é servida pelo GitHub Pages e os dados vêm de um servidor da Cloudflare, com a base de dados na União Europeia. Como em qualquer site, estes serviços recebem o endereço do teu aparelho para te entregar a página.',
      'O mapa das barbearias é dos Mapas da Apple: para o mostrar, o teu aparelho liga-se à Apple, que recebe o endereço dele, como qualquer site. No Android é uma imagem que o nosso servidor pede à Apple e guarda por pouco tempo.',
    ],
  },
  barbearia: { titulo: 'Barbearias', mais: 'Mais', tatuagens: 'Tatuagens', site: 'Site' },
  mapa: {
    marcar: 'Marcar',
    marcarEm: (casa: string) => `Marcar em ${casa}`,
    ir: 'Ir',
    irA: (casa: string) => `Ir a ${casa}`,
    mapaComAsCasas: 'Mapa com as barbearias',
    mapasDaApple: 'Mapas da Apple',
    verTodas: 'Ver todas as barbearias',
  },
  naoEncontrado: { texto: 'Esta página não existe', verAsVantagens: 'Ver as vantagens' },
  erroDoEcra: { titulo: 'Algo correu mal', texto: 'A app não conseguiu abrir este ecrã.' },
  /** As respostas da API, pelo código do erro. */
  erros: {
    sessao: 'A sessão acabou. Entra outra vez.',
    google_invalido: 'O Google não confirmou a entrada. Tenta outra vez.',
    apple_invalido: 'A Apple não confirmou a entrada. Tenta outra vez.',
    apple_desligado: 'Entrar com a Apple ainda não está disponível.',
    muitas_tentativas: 'Demasiadas tentativas. Espera um minuto.',
    codigo_invalido: 'Código errado.',
    noutra_conta: 'Essa conta já está ligada a outro cartão.',
    forma_actual: 'É a forma com que entraste agora. Entra por outra e volta aqui.',
    ultima_forma: 'É a única forma de entrar: não se pode tirar.',
    so_formas_novas: 'Só podes tirar esta daqui a uns dias.',
    invalido: 'Há algo por corrigir.',
    demonstracao: 'Na conta de demonstração isto não se muda.',
    // Os convites (10 nov 2026).
    convites_desligados: 'Os convites estão parados.',
    convite_desconhecido: 'Este código de convite não existe.',
    convite_proprio: 'Esse código é o teu.',
    ja_convidado: 'Já usaste um código de convite.',
    ja_cortou: 'O código de convite é só para antes do primeiro corte.',
    convites_esgotados: 'Quem te convidou já não tem convites.',
    convite_reciproco: 'Não podes usar o código de quem tu convidaste.',
    convite_mais_recente: 'Esse código é de alguém que chegou depois de ti.',
    conta_ja_usada:
      'Já tiveste conta no Nuno’s Lab: o código de convite é só para quem chega pela primeira vez.',
    grande: 'O pedido é grande de mais.',
    rede: 'Sem ligação. Tenta outra vez.',
    interno: 'Algo correu mal. Tenta outra vez.',
  } as Record<string, string> & { interno: string },
};
