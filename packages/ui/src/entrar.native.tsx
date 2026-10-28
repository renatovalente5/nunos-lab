import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getRandomBytes } from 'expo-crypto';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cor, letra } from './tema';
import { T } from './texto';

/**
 * Os botões de entrar no telemóvel: o botão nativo da Apple (só no iPhone) e o
 * Google pela app do Google (o id_token vem com o cliente web como «aud», que
 * é o que a API confere). As mesmas propriedades da versão web.
 */
export const LARGURA_DO_BOTAO = 320;

function aleatorio(n = 24): string {
  return Array.from(getRandomBytes(n), (x) => x.toString(16).padStart(2, '0')).join('');
}

export function BotaoDaApple({
  aoEntrar,
}: {
  clienteId: string;
  redirectURI: string;
  aoEntrar: (dados: { token: string; nonce: string; nome: string | null }) => void;
  texto?: string;
}) {
  if (Platform.OS !== 'ios') return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={22}
      style={{ width: LARGURA_DO_BOTAO, height: 44, alignSelf: 'center' }}
      onPress={async () => {
        const nonce = aleatorio();
        try {
          const r = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce,
          });
          if (!r.identityToken) return;
          const nome = [r.fullName?.givenName, r.fullName?.familyName].filter(Boolean).join(' ');
          aoEntrar({ token: r.identityToken, nonce, nome: nome || null });
        } catch {
          // A pessoa cancelou: nada a dizer.
        }
      }}
    />
  );
}

let configurado = false;

export function BotaoDoGoogle({
  clienteId,
  aoEntrar,
}: {
  clienteId: string;
  aoEntrar: (credencial: string) => void;
  texto?: 'continue_with' | 'signin_with';
}) {
  const [erro, setErro] = useState<string | null>(null);
  const entrar = async () => {
    setErro(null);
    try {
      if (!configurado) {
        GoogleSignin.configure({
          webClientId: clienteId,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS || undefined,
        });
        configurado = true;
      }
      if (Platform.OS === 'android')
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await GoogleSignin.signIn();
      const token = r.type === 'success' ? r.data.idToken : null;
      if (token) aoEntrar(token);
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === statusCodes.SIGN_IN_CANCELLED) return;
      setErro(
        codigo === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? 'Este telemóvel não tem os serviços do Google.'
          : 'O Google não abriu. Tenta outra vez.',
      );
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={entrar}
        role="button"
        aria-label="Continuar com o Google"
        style={({ pressed }) => ({
          width: LARGURA_DO_BOTAO,
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderRadius: 999,
          backgroundColor: pressed ? '#1A1A1A' : '#131313',
          borderWidth: 1,
          borderColor: '#3A3A3A',
        })}
      >
        <Svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
          <Path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.7 17.7 9.5 24 9.5z"
          />
          <Path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
          />
          <Path
            fill="#FBBC05"
            d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.8-6z"
          />
          <Path
            fill="#34A853"
            d="M24 48c6.2 0 11.5-2 15.4-5.5l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.3 0-11.7-4.2-13.6-10l-7.8 6C6.5 42.6 14.6 48 24 48z"
          />
        </Svg>
        <T style={{ color: '#FFFFFF', fontFamily: letra.forte, fontSize: 15 }}>
          Continuar com o Google
        </T>
      </Pressable>
      {erro && (
        <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
          {erro}
        </T>
      )}
    </View>
  );
}
