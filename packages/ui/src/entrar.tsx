import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cor, letra } from './tema';
import { T } from './texto';

/**
 * Os botões de entrar, na web: o oficial da Google (desenhado pelo Google,
 * escuro e em cápsula) e o da Apple (o nosso botão, com o logótipo e o texto
 * que a Apple pede). Os dois devolvem o token que a API confere. Na app
 * nativa estes ficheiros ganham versões próprias.
 */

type ApiDoGoogle = {
  accounts: {
    id: {
      initialize(o: {
        client_id: string;
        callback: (r: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(onde: HTMLElement, o: Record<string, string | number>): void;
    };
  };
};
type ApiDaApple = {
  auth: {
    init(o: {
      clientId: string;
      scope: string;
      redirectURI: string;
      state?: string;
      nonce?: string;
      usePopup?: boolean;
    }): void;
    signIn(): Promise<{
      authorization: { id_token: string; code: string; state?: string };
      user?: { name?: { firstName?: string; lastName?: string }; email?: string };
    }>;
  };
};
declare global {
  interface Window {
    google?: ApiDoGoogle;
    AppleID?: ApiDaApple;
  }
}

const scripts = new Map<string, Promise<void>>();
function carregar(src: string): Promise<void> {
  if (Platform.OS !== 'web') return Promise.reject(new Error('só na web'));
  let p = scripts.get(src);
  if (!p) {
    p = new Promise((resolver, rejeitar) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolver();
      s.onerror = () => {
        scripts.delete(src);
        rejeitar(new Error(`não carregou: ${src}`));
      };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

export const LARGURA_DO_BOTAO = 320;

export function BotaoDoGoogle({
  clienteId,
  aoEntrar,
  texto = 'continue_with',
}: {
  clienteId: string;
  aoEntrar: (credencial: string) => void;
  texto?: 'continue_with' | 'signin_with';
}) {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const [falhou, setFalhou] = useState(false);
  const ultimo = useRef(aoEntrar);
  ultimo.current = aoEntrar;
  useEffect(() => {
    let vivo = true;
    carregar('https://accounts.google.com/gsi/client')
      .then(() => {
        const google = window.google;
        const onde = caixa.current as unknown as HTMLElement | null;
        if (!vivo || !google || !onde) return;
        // O Safari pinta de branco um iframe «claro» dentro de uma página escura
        // (desencontro de color-scheme): a caixa declara-se clara e fica transparente.
        onde.style.colorScheme = 'light';
        google.accounts.id.initialize({
          client_id: clienteId,
          callback: (r) => ultimo.current(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(onde, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: texto,
          logo_alignment: 'left',
          locale: 'pt-PT',
          width: LARGURA_DO_BOTAO,
        });
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [clienteId, texto]);
  if (falhou)
    return (
      <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
        O Google não abriu. Recarrega a página.
      </T>
    );
  return (
    <View
      ref={caixa}
      style={{
        width: LARGURA_DO_BOTAO,
        height: 44,
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: '#131314',
        justifyContent: 'center',
      }}
    />
  );
}

function aleatorio(n = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function BotaoDaApple({
  clienteId,
  redirectURI,
  aoEntrar,
  texto = 'Continuar com a Apple',
}: {
  clienteId: string;
  redirectURI: string;
  aoEntrar: (dados: { token: string; nonce: string; nome: string | null }) => void;
  texto?: string;
}) {
  const [estado, setEstado] = useState<'a-carregar' | 'pronto' | 'falhou' | 'a-entrar'>(
    'a-carregar',
  );
  const nonce = useRef(aleatorio());
  useEffect(() => {
    let vivo = true;
    carregar('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_PT/appleid.auth.js')
      .then(() => {
        if (!vivo || !window.AppleID) return;
        window.AppleID.auth.init({
          clientId: clienteId,
          scope: 'name email',
          redirectURI,
          nonce: nonce.current,
          usePopup: true,
        });
        setEstado('pronto');
      })
      .catch(() => vivo && setEstado('falhou'));
    return () => {
      vivo = false;
    };
  }, [clienteId, redirectURI]);
  const entrar = async () => {
    if (estado !== 'pronto' || !window.AppleID) return;
    setEstado('a-entrar');
    try {
      const r = await window.AppleID.auth.signIn();
      const nome = [r.user?.name?.firstName, r.user?.name?.lastName].filter(Boolean).join(' ');
      aoEntrar({ token: r.authorization.id_token, nonce: nonce.current, nome: nome || null });
    } catch {
      // A pessoa fechou a janela: nada a dizer.
    } finally {
      setEstado('pronto');
    }
  };
  if (estado === 'falhou') return null;
  return (
    <Pressable
      onPress={entrar}
      role="button"
      aria-label={texto}
      aria-disabled={estado !== 'pronto'}
      style={({ pressed }) => ({
        width: LARGURA_DO_BOTAO,
        height: 44,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 999,
        backgroundColor: pressed ? cor.claroPremido : cor.claro,
        opacity: estado === 'pronto' ? 1 : 0.6,
      })}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
        <Path
          fill={cor.sobreClaro}
          d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.7-3.8zM14 5.5c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"
        />
      </Svg>
      <T style={{ color: cor.sobreClaro, fontFamily: letra.forte, fontSize: 15 }}>{texto}</T>
    </Pressable>
  );
}
