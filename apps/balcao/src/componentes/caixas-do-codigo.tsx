import { ALGARISMOS_DO_CODIGO, codigoDepoisDe } from '@nunos-lab/dominio';
import { forwardRef, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { CONTINUO, T, cor } from '@nunos-lab/ui';

export type CaixasDoCodigoRef = { focar(): void };

/**
 * As seis casas do código. Por cima delas há um só campo, invisível, que o teclado, o colar e o
 * preenchimento automático enchem: o iPhone sugere o código que chega por email (o Mail, e no iOS 26
 * também o Gmail e o Outlook), e do iOS 26.0.1 ao 26.3 metia-o todo na primeira casa quando cada casa era
 * um campo. As casas só mostram o que lá está.
 */
export const CaixasDoCodigo = forwardRef<
  CaixasDoCodigoRef,
  { valor: string; aoMudar: (codigo: string) => void; rotulo: string; errado?: boolean }
>(function CaixasDoCodigo({ valor, aoMudar, rotulo, errado = false }, ref) {
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const [focado, setFocado] = useState(false);
  useImperativeHandle(ref, () => ({ focar: () => campo.current?.focus() }), []);
  const aqui = Math.min(valor.length, ALGARISMOS_DO_CODIGO - 1);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View
        aria-hidden
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        pointerEvents="none"
      >
        {Array.from({ length: ALGARISMOS_DO_CODIGO }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              maxWidth: 52,
              // 52 × 60 no telemóvel; num ecrã de 320 px encolhe sem ficar um risco alto.
              aspectRatio: 52 / 60,
              borderRadius: 16,
              backgroundColor: cor.superficieAlta,
              borderWidth: 1.5,
              borderColor: errado
                ? cor.perigo
                : focado && i === aqui && valor.length < ALGARISMOS_DO_CODIGO
                  ? cor.texto2
                  : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              ...CONTINUO,
            }}
          >
            <T v="titulo" style={{ fontSize: 26, lineHeight: 32 }}>
              {valor[i] ?? ''}
            </T>
          </View>
        ))}
      </View>
      <TextInput
        ref={campo}
        value={valor}
        onChangeText={(texto) => aoMudar(codigoDepoisDe(valor, texto))}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoCorrect={false}
        aria-label={rotulo}
        aria-invalid={errado}
        caretHidden
        selectionColor="transparent"
        // Quase invisível, mas não 0: com 0 o Android não lhe dá toques. 16 px: o Safari não aproxima.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.011,
          color: 'transparent',
          backgroundColor: 'transparent',
          fontSize: 16,
        }}
      />
    </View>
  );
});
