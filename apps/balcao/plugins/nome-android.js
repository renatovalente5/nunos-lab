// O nome da app no Android com o acento («Nuno's Lab Balcão»): o `name` do app.json fica sem ele,
// porque o EAS e o prebuild não concordam no nome do projecto Xcode quando há acentos.
const { AndroidConfig, withStringsXml } = require('expo/config-plugins');
module.exports = (config, { nome }) =>
  withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: nome }],
      c.modResults,
    );
    return c;
  });
