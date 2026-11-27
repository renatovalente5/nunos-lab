/**
 * A app da web tem câmara para o QR do balcão (27 nov 2026)? À parte do leitor (que traz o jsQR), para o
 * Cartão não o carregar logo ao abrir.
 */
export const temCamara = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
