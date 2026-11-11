import type { Textos } from './index';

/** 1st, 2nd, 3rd, 4th… 11th, 12th, 13th… 21st. */
function ordinal(n: number): string {
  const fim = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${fim}`;
}

/** The app’s phrases in British English. Every key in pt.ts must be here too. */
export const en: Textos = {
  separadores: { vantagens: 'Perks', cartao: 'Card', barbearia: 'Barbershops' },
  titulos: {
    vantagens: 'Nuno’s Lab · Perks',
    cartao: 'Nuno’s Lab · Card',
    barbearias: 'Nuno’s Lab · Barbershops',
    conta: 'Nuno’s Lab · Account',
    privacidade: 'Privacy · Nuno’s Lab',
    carteira: 'Nuno’s Lab · Wallet',
    parceiro: (nome) => `${nome} · Nuno’s Lab`,
  },
  vantagens: {
    emDestaque: 'Featured',
    bloqueada: 'locked',
    parceiros: 'Partners',
    semCorteHaUmAno: 'Your perks come back with your next haircut',
    aindaSemCorte: 'Your perks start with your first haircut',
    categorias: 'Categories',
    tudo: 'All',
    emBreve: 'New perks coming soon',
  },
  promocao: {
    verTudo: 'Show more',
    menos: 'Show less',
    usadaHoje: (hora) => `Used today at ${hora}`,
    jaUsaste: {
      dia: 'Already used today',
      semana: 'Already used this week',
      mes: 'Already used this month',
      sempre: 'Already used',
    },
    mostraOCartao: 'Show your card when you pay',
    codigo: 'Code',
    copiar: 'Copy',
    copiado: 'Copied',
    copiarCodigo: (codigo) => `Copy the code ${codigo}`,
    bloqueada: {
      nunca: 'Unlocks with your first haircut',
      expirou: 'Unlocks with your next haircut',
    },
  },
  cartao: {
    titulo: 'Card',
    conta: 'Account',
    deObjectivo: (objectivo) => `of ${objectivo}`,
    clienteDesde: (ano, cartao, cortes) =>
      cartao > 1
        ? `Client since ${ano} · ${ordinal(cartao)} card · ${cortes} ${cortes === 1 ? 'haircut' : 'haircuts'}`
        : `Client since ${ano}`,
    tensUma: (recompensa) =>
      `Reward ready: ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`,
    tensVarias: (n) => `${n} rewards ready`,
    mostraOCartao: 'Show your card when you pay.',
    quandoQuiseres: 'Show your card at the counter whenever you like.',
    verOCodigo: 'Show code full screen',
    mostraAoBalcao: 'Show it when you pay.\nWorks at all our barbershops.',
    parabens: 'Happy birthday!',
    ultimasVisitas: 'Recent visits',
    nosParceiros: 'Perks used',
    semLigacaoDesde: (quando, hoje) =>
      `No connection · last updated ${hoje ? 'at' : 'on'} ${quando}`,
    semLigacao: 'No connection',
    adicionarApple: 'Add to Apple Wallet',
    adicionarGoogle: 'Add to Google Wallet',
    aPreparar: 'Preparing…',
    entraParaTer: 'Sign in to get your card.',
    entraParaOConvite: (nome, valor) => {
      const convite = nome ? `${nome}’s invite` : 'your invite';
      return valor ? `Sign in to get ${valor} from ${convite}.` : `Sign in to accept ${convite}.`;
    },
    jaTensCartao:
      'Got a card at the barbershop? Sign in with the email you gave us. With Apple, choose Share My Email.',
    aEntrar: 'Signing in…',
    proximoCarimbo: 'Your next stamp starts a new card',
    semLigacaoNoCartao: 'No connection',
    tocarParaTentar: 'Tap to try again.',
    semLigacaoTentar: 'No connection. Try again',
  },
  conta: {
    voltar: 'Back',
    titulo: 'Account',
    todas: 'All',
    eu: 'Profile',
    nome: 'Name',
    aniversario: 'Birthday',
    aMinhaCasa: 'Barbershop',
    formasDeEntrar: 'Sign-in methods',
    tirarForma: (forma) => `Remove ${forma} sign-in`,
    tirar: 'Remove',
    juntarOutraForma: 'Add another method',
    sessoes: 'Devices',
    esteAparelho: 'This device',
    aparelhoSemNome: 'Device',
    usado: (dias, data) =>
      dias <= 0
        ? 'Last used today'
        : dias === 1
          ? 'Last used yesterday'
          : dias < 7
            ? `Last used ${dias} days ago`
            : `Last used ${data}`,
    terminar: 'Sign out',
    terminarSessao: (aparelho) => `Sign out ${aparelho}`,
    terminarAsOutras: 'Sign out other devices',
    sair: 'Sign out',
    mais: 'More',
    lingua: 'Language',
    privacidade: 'Privacy',
    apagarAConta: 'Delete account',
    oTeuNome: 'Your name',
    nomeProprio: 'First name',
    escreveONome: 'Enter your name.',
    guardar: 'Save',
    tirarOAniversario: 'Remove birthday',
    todasAsCasas: 'All barbershops',
    apagarAviso:
      'You’ll lose your card, stamps and rewards. If you sign in again, you’ll start from zero. This can’t be undone.',
    dia: 'Day',
    mes: 'Month',
    meses: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  },
  carteira: {
    titulo: 'Wallet',
    saldo: 'Balance',
    abrir: (saldo) => `Wallet, balance ${saldo}`,
    comoUsar: 'Use it when you pay, at any of our barbershops.',
    comPrimeiroCorte: 'Use it on your first haircut, at any of our barbershops.',
    negativo: 'An invite reward was cancelled after it was used. There’s nothing to pay.',
    saldoMudou: 'Your balance changed',
    convidaEGanha: 'Invite and earn',
    regra: (padrinho, convidado) =>
      padrinho && convidado
        ? `You get ${padrinho} for each new friend who visits one of our barbershops. They get ${convidado} straight away.`
        : padrinho
          ? `You get ${padrinho} for each new friend who visits one of our barbershops.`
          : convidado
            ? `Your friend gets ${convidado} straight away.`
            : 'Invite your friends.',
    partilhar: 'Share invite',
    copiarLigacao: 'Copy link',
    copiada: 'Link copied',
    mensagem: (convidado, codigo) =>
      convidado
        ? `Get ${convidado} off your first haircut at Nuno’s Lab with my invite. Code: ${codigo}`
        : `Come to Nuno’s Lab with my invite. Code: ${codigo}`,
    podesConvidarMais: (n) =>
      n === 0
        ? 'You’ve reached your invite limit.'
        : `You can invite ${n} more ${n === 1 ? 'person' : 'people'}.`,
    convidados: 'Invited',
    resumo: (aceites, foram) => `${aceites} · ${foram} visited`,
    jaFoi: 'Visited',
    aindaNaoFoi: 'Not yet',
    temCodigo: 'Got an invite code?',
    codigo: 'Invite code',
    usar: 'Use',
    movimentos: 'Activity',
    semMovimentos: 'No activity yet.',
    anulado: 'Cancelled',
    contaApagada: 'Deleted account',
    movimento: {
      convidado: (quem) => (quem ? `Invite from ${quem}` : 'Invite'),
      convite: (quem) => `${quem ?? 'A friend'} visited`,
      uso: (loja) => (loja ? `Used in ${loja}` : 'Used at the barbershop'),
      acerto: 'Adjustment',
    },
    foiAnulado: (frase) => `Cancelled: ${frase}`,
    convidou: (nome, valor) =>
      nome
        ? valor
          ? `${nome} invited you: you get ${valor}`
          : `${nome} invited you`
        : valor
          ? `You’ve been invited: you get ${valor}`
          : 'You’ve been invited',
  },
  parceiro: {
    voltar: 'Back',
    partilhar: 'Share',
    jaNaoEsta: 'This perk is no longer available',
    ligar: 'Call',
    ligarPara: (nome) => `Call ${nome}`,
    instagramDe: (nome) => `${nome} on Instagram`,
    site: 'Website',
    siteDe: (nome) => `${nome} website`,
    aTuaVantagem: 'Your perk',
    asTuasVantagens: 'Your perks',
    vantagem: 'Perk',
    vantagens: 'Perks',
    aberto: 'Open',
    fechaAs: (aHora) => `closes ${aHora}`,
    fechado: 'Closed',
    abreAs: (aHora) => `opens ${aHora}`,
    abreAmanha: (aHora) => `opens tomorrow ${aHora}`,
    abreNoDia: (dia, aHora) => `opens on ${dia} ${aHora}`,
    feriado: 'Public holiday',
    podeEstarFechado: 'may be closed',
  },
  privacidade: {
    titulo: 'Privacy',
    paragrafos: [
      'The app shows perks from Nuno’s Lab partners and, if you like, your stamp card. Without an account, it doesn’t ask for anything, uses no cookies and shows no ads.',
      'With an account (Apple, Google or email), Nuno’s Lab stores your name, email, birthday (if you add it), the language you use the app in, and your stamps: which barbershop, who stamped your card and when. That’s what makes the card work. Apple and Google only confirm who you are; they don’t receive your stamps.',
      'If you add the card to Apple Wallet or Google Wallet, it’s also stored there (your name, stamps and code) and updates after every haircut. Apple and Google handle it under their own terms.',
      'You can change or delete your account in the app at any time. When you delete it, your name, email and sign-in methods are removed; your stamps and balance activity stay without a name, for the barbershop’s accounts. If you had a haircut or were invited, an irreversible mark of your sign-in method is also kept, only so that an invite can’t be used twice.',
      'To help Nuno see what interests people, the app anonymously counts how often it’s opened and how often each partner is viewed or contacted. Only the date and the total are kept.',
      'With invites, the person who invites sees only the first name and last initial of whoever they invited, and whether they’ve visited (the day, not the time); the invited person sees who invited them in the same way, and anyone who opens an invite link sees the name of whoever shared it. Your balance keeps its activity: when, how much, at which barbershop and by whom it was used, and the note on any adjustment.',
      'The app stores the latest list of perks and your card on this device, so they open without a connection. It also remembers the language you chose.',
      'The app is hosted on GitHub Pages and the data comes from a Cloudflare server, with the database in the European Union. As with any website, these services receive your device’s IP address to send you the page.',
      'The map of our barbershops comes from Apple Maps: to show it, your device connects to Apple, which receives its IP address, as with any website. On Android, it’s an image that our server requests from Apple and keeps for a short time.',
    ],
  },
  barbearia: { titulo: 'Barbershops', mais: 'More', tatuagens: 'Tattoos', site: 'Website' },
  mapa: {
    marcar: 'Book',
    marcarEm: (casa) => `Book at ${casa}`,
    ir: 'Go',
    irA: (casa) => `Directions to ${casa}`,
    mapaComAsCasas: 'Map of our barbershops',
    mapasDaApple: 'Apple Maps',
    verTodas: 'Show all barbershops',
  },
  naoEncontrado: { texto: 'This page doesn’t exist', verAsVantagens: 'See the perks' },
  erroDoEcra: { titulo: 'Something went wrong', texto: 'The app couldn’t open this screen.' },
  erros: {
    sessao: 'You’ve been signed out. Sign in again.',
    google_invalido: 'Google couldn’t confirm your sign-in. Try again.',
    apple_invalido: 'Apple couldn’t confirm your sign-in. Try again.',
    apple_desligado: 'Sign in with Apple isn’t available yet.',
    muitas_tentativas: 'Too many attempts. Try again in a minute.',
    codigo_invalido: 'Wrong code.',
    noutra_conta: 'That account is already linked to another card.',
    forma_actual:
      'You’re signed in with this one. Sign in another way, then come back to remove it.',
    ultima_forma: 'It’s your only way to sign in, so it can’t be removed.',
    so_formas_novas: 'You can remove this one in a few days’ time.',
    invalido: 'Something isn’t right. Check and try again.',
    demonstracao: 'This can’t be changed on the demo account.',
    convites_desligados: 'Invites are paused.',
    convite_desconhecido: 'This invite code doesn’t exist.',
    convite_proprio: 'That’s your own code.',
    ja_convidado: 'You’ve already used an invite code.',
    ja_cortou: 'Invite codes are only for before your first haircut.',
    convites_esgotados: 'The person who invited you has no invites left.',
    convite_reciproco: 'You can’t use the code of someone you invited.',
    convite_mais_recente: 'That code belongs to someone who joined after you.',
    conta_ja_usada:
      'You’ve had a Nuno’s Lab account before: invite codes are only for first-time customers.',
    grande: 'The request is too large.',
    rede: 'No connection. Try again.',
    interno: 'Something went wrong. Try again.',
  },
};
