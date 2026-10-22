import type { IconeDaCategoria } from './limites.ts';

/**
 * Os desenhos das categorias: linha, 24×24, traço redondo. Os mesmos na app
 * (react-native-svg) e no backoffice (svg), para o Nuno escolher o que vê.
 */
export const DESENHOS_DAS_CATEGORIAS: Record<IconeDaCategoria, readonly string[]> = {
  comer: [
    'M7 3v7',
    'M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3',
    'M7 10v11',
    'M17 21V3c-2.2 1-3.5 3.6-3.5 7v3H17',
  ],
  cafe: [
    'M4 9h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9z',
    'M16 11h1.5a2.5 2.5 0 0 1 0 5H16',
    'M8 3.5c0 1 1 1.5 1 2.5',
    'M12 3.5c0 1 1 1.5 1 2.5',
  ],
  bebidas: ['M5 4h14l-7 8.5z', 'M12 12.5V20', 'M8 20h8', 'M7.5 7h9'],
  carro: [
    'M5 16H3.5v-3.5l2-5A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.5l2 5V16H19',
    'M3.5 12.5h17',
    'M9.5 16h5',
    'M7.3 18a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
    'M16.7 18a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  ],
  oficina: [
    'M14.6 6.4a4.2 4.2 0 0 0-5.3 5.4l-5.6 5.6a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.2 4.2 0 0 0 5.4-5.3l-2.6 2.6-2.4-.6-.6-2.4z',
  ],
  treino: ['M6.5 6.5v11', 'M3.5 9v6', 'M17.5 6.5v11', 'M20.5 9v6', 'M6.5 12h11'],
  beleza: [
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
    'M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  ],
  saude: [
    'M12 20.5s-8.5-4.8-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6.2-8.5 11-8.5 11z',
  ],
  roupa: ['M9 3.5 4 6l1.6 4 2-.9V20h8.8V9.1l2 .9L20 6l-5-2.5a3 3 0 0 1-6 0z'],
  compras: ['M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z', 'M9 10V6.5a3 3 0 0 1 6 0V10'],
  casa: ['M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z'],
  animais: [
    'M12 12.5c-2.4 0-4.4 2.5-4.4 4.5 0 1.5 1.2 2.3 2.5 2.3.8 0 1.2-.4 1.9-.4s1.1.4 1.9.4c1.3 0 2.5-.8 2.5-2.3 0-2-2-4.5-4.4-4.5z',
    'M6 11.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
    'M9.4 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
    'M14.6 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
    'M18 11.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
  ],
  tecnologia: [
    'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3z',
    'M11 18h2',
  ],
  educacao: [
    'M3.5 6.5A1.5 1.5 0 0 1 5 5h5.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 0-1.5-1.5h-7z',
    'M20.5 6.5A1.5 1.5 0 0 0 19 5h-5.5A1.5 1.5 0 0 0 12 6.5V20a1.5 1.5 0 0 1 1.5-1.5h7z',
  ],
  lazer: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'],
  outro: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 12h.01', 'M12 12h.01', 'M16 12h.01'],
};

/** O nome de cada desenho, para o leitor de ecrã e a dica do rato. */
export const NOMES_DOS_DESENHOS: Record<IconeDaCategoria, string> = {
  comer: 'Garfo e faca',
  cafe: 'Chávena',
  bebidas: 'Copo',
  carro: 'Carro',
  oficina: 'Chave',
  treino: 'Haltere',
  beleza: 'Brilho',
  saude: 'Coração',
  roupa: 'Camisola',
  compras: 'Saco',
  casa: 'Casa',
  animais: 'Pata',
  tecnologia: 'Telemóvel',
  educacao: 'Livro',
  lazer: 'Estrela',
  outro: 'Pontos',
};
