import { requireOptionalNativeModule } from 'expo';

/**
 * Esta app tem a câmara para o QR do balcão (27 nov 2026): a expo-camera chegou na 1.0.6, e as apps de
 * antes recebem o código novo por OTA sem ela. À parte do leitor, para o Cartão não o carregar.
 */
export const temCamara = !!requireOptionalNativeModule('ExpoCamera');
