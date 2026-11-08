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
    parceiro: (nome) => `${nome} · Nuno’s Lab`,
  },
  vantagens: {
    emDestaque: 'Featured',
    parceiros: 'Partners',
    semCorteHaUmAno: 'Visit one of our barbershops to get your perks back',
    aindaSemCorte: 'Visit one of our barbershops to get your perks',
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
    comOCartao: 'With a Nuno’s Lab card',
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
    verOCodigo: 'Show code full screen',
    mostraAoBalcao: 'Show it when you pay.\nWorks at all our barbershops.',
    parabens: 'Happy birthday!',
    ultimasVisitas: 'Recent visits',
    nosParceiros: 'Perks used',
    semLigacaoDesde: (quando) => `No connection · last updated ${quando}`,
    semLigacao: 'No connection',
    adicionarApple: 'Add to Apple Wallet',
    adicionarGoogle: 'Add to Google Wallet',
    aPreparar: 'Preparing…',
    entraParaTer: 'Sign in to get your card.',
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
    morada: (morada) => `Address: ${morada}. Open in maps.`,
  },
  privacidade: {
    titulo: 'Privacy',
    paragrafos: [
      'The app shows perks from Nuno’s Lab partners and, if you like, your stamp card. Without an account, it doesn’t ask for anything, uses no cookies and shows no ads.',
      'With an account (Apple, Google or email), Nuno’s Lab stores your name, email, birthday (if you add it), the language you use the app in, and your stamps: which barbershop, who stamped your card and when. That’s what makes the card work. Apple and Google only confirm who you are; they don’t receive your stamps.',
      'If you add the card to Apple Wallet or Google Wallet, it’s also stored there (your name, stamps and code) and updates after every haircut. Apple and Google handle it under their own terms.',
      'You can change or delete your account in the app at any time. When you delete it, your data is removed; only anonymous totals are kept, for the barbershop’s statistics.',
      'To help Nuno see what interests people, the app anonymously counts how often it’s opened and how often each partner is viewed or contacted. Only the date and the total are kept.',
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
    grande: 'The request is too large.',
    rede: 'No connection. Try again.',
    interno: 'Something went wrong. Try again.',
  },
};
