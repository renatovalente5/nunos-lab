import type { Lingua } from '@nunos-lab/dominio';

/**
 * As frases do passe (Apple e Google), na língua da conta: o português é a fonte, o inglês
 * (britânico) tem as mesmas chaves. Num aviso da Apple («changeMessage») o «%@» é o valor novo.
 */
const pt = {
  etiqueta: 'pt-PT',
  descricao: "Cartão Nuno's Lab",
  carimbos: 'CARIMBOS',
  carimbosDe: (n: number, de: number) => `${n} de ${de}`,
  avisoCompleto: (frase: string) => `Cartão completo (%@): ${frase}`,
  avisoNovo: 'Carimbo novo: %@',
  avisoNovoEProximo: (frase: string) => `Carimbo novo: %@ · ${frase}`,
  cliente: 'CLIENTE',
  porUsar: 'POR USAR',
  ultimaVisita: 'Última visita',
  comoFunciona: 'Como funciona',
  como: (objectivo: number, recompensa: string) =>
    `Um carimbo por corte. Ao ${objectivo}.º, ${recompensa}.`,
  asCasas: 'As casas',
  contacto: 'Contacto',
  site: 'Site',
  privacidade: 'Privacidade',
  mostraOCartao: (loja: string) => `Nuno's Lab ${loja}: mostra o cartão.`,
  cartao: 'CARTÃO',
  completo: 'Completo',
  faltam: (n: number): string => (n === 1 ? 'FALTA' : 'FALTAM'),
  tensPorUsar: (n: number, recompensa: string) =>
    `Tens ${n === 1 ? '' : `${n} × `}${recompensa} por usar`,
  cartaoCompleto: 'Cartão completo',
  aoObjectivo: (recompensa: string, objectivo: number) => `${recompensa} ao ${objectivo}.º`,
  cortes: 'Cortes',
  premio: 'Prémio',
  // Na Google Wallet.
  carimbosGoogle: 'Carimbos',
  porUsarGoogle: 'Por usar',
  clienteGoogle: 'Cliente',
  carimbosNaImagem: (n: number, de: number) => `${n} de ${de} carimbos`,
};

const en: typeof pt = {
  etiqueta: 'en-GB',
  descricao: "Nuno's Lab card",
  carimbos: 'STAMPS',
  carimbosDe: (n, de) => `${n} of ${de}`,
  avisoCompleto: (frase) => `Card complete (%@) – ${frase}`,
  avisoNovo: 'New stamp: %@',
  avisoNovoEProximo: (frase) => `New stamp: %@ – ${frase}`,
  cliente: 'NAME',
  porUsar: 'READY TO USE',
  ultimaVisita: 'Last visit',
  comoFunciona: 'How it works',
  como: (objectivo, recompensa) => `One stamp per haircut. At ${objectivo} stamps, ${recompensa}.`,
  asCasas: 'Our barbershops',
  contacto: 'Contact',
  site: 'Website',
  privacidade: 'Privacy',
  mostraOCartao: (loja) => `Nuno's Lab ${loja}: show your card.`,
  cartao: 'CARD',
  completo: 'Complete',
  faltam: () => 'TO GO',
  tensPorUsar: (n, recompensa) => `Ready to use: ${n === 1 ? '' : `${n} × `}${recompensa}`,
  cartaoCompleto: 'Card complete',
  aoObjectivo: (recompensa, objectivo) => `${recompensa} at ${objectivo} stamps`,
  cortes: 'Haircuts',
  premio: 'Reward',
  carimbosGoogle: 'Stamps',
  porUsarGoogle: 'Ready to use',
  clienteGoogle: 'Client',
  carimbosNaImagem: (n, de) => `${n} of ${de} stamps`,
};

export const TEXTOS_DO_PASSE: Record<Lingua, typeof pt> = { pt, en };
