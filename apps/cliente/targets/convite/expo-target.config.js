/**
 * A App Clip do convite no iPhone (o Renato, 25 nov 2026). A Apple não tem um Install Referrer como a Play
 * Store: a ligação de um convite abre esta App Clip sem instalar nada. Ela deixa o código num ficheiro do
 * grupo partilhado e mostra quem convidou e as barbearias (marcar, ir). Ao instalar a app, a Apple troca a
 * App Clip pela app, o ficheiro fica, e a app lê-o no primeiro arranque (src/convite-da-loja.ts).
 *
 * Só SwiftUI, sem React Native nem o pacote de JavaScript: fica pequena (a Apple aceita até 15 MB).
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'clip',
  name: 'Convite',
  displayName: "Nuno's Lab",
  // pt.nunoslab.app.clip: o «p» da ligação da Apple (APP_CLIP_IOS em packages/dominio/src/saldo.ts).
  bundleIdentifier: '.clip',
  // A ligação da Apple que abre a App Clip só existe a partir do iOS 16.4.
  deploymentTarget: '16.4',
  icon: '../../assets/icon.png',
  exportJs: false,
  frameworks: ['SwiftUI', 'StoreKit'],
  images: { palavra: '../../assets/marca/palavra.png' },
  colors: { fundo: '#0A0A0A' },
  entitlements: {
    // O grupo da app (app.json): é por ele que o código passa.
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
