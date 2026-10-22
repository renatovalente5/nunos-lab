import { useEffect, useRef, useState } from 'react';

/**
 * O botão oficial «Fazer login com o Google» (Google Identity Services). O
 * Google desenha-o e abre a janela dele; nós só recebemos o «credential», um
 * token assinado que a API confere. O script só se carrega nesta página.
 */
export const CLIENTE_GOOGLE = (import.meta.env.VITE_GOOGLE_CLIENTE as string | undefined) ?? '';

type ApiDoGoogle = {
  accounts: {
    id: {
      initialize(opcoes: {
        client_id: string;
        callback: (r: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(onde: HTMLElement, opcoes: Record<string, string | number>): void;
    };
  };
};

declare global {
  interface Window {
    google?: ApiDoGoogle;
  }
}

let carregamento: Promise<ApiDoGoogle> | null = null;

function carregarGoogle(): Promise<ApiDoGoogle> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  carregamento ??= new Promise((resolver, rejeitar) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolver(window.google) : rejeitar(new Error('sem google')));
    s.onerror = () => {
      carregamento = null;
      rejeitar(new Error('o script do Google não carregou'));
    };
    document.head.appendChild(s);
  });
  return carregamento;
}

/** O email que vem dentro do token (só para dizer à pessoa com que conta tentou). */
export function emailDoToken(credencial: string): string | null {
  try {
    const parte = credencial.split('.')[1] ?? '';
    const json = atob(parte.replace(/-/g, '+').replace(/_/g, '/'));
    const email = (JSON.parse(json) as { email?: unknown }).email;
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}

export function BotaoDoGoogle({ aoEntrar }: { aoEntrar: (credencial: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  const ultimo = useRef(aoEntrar);
  ultimo.current = aoEntrar;
  useEffect(() => {
    let vivo = true;
    carregarGoogle()
      .then((google) => {
        if (!vivo || !caixa.current) return;
        google.accounts.id.initialize({
          client_id: CLIENTE_GOOGLE,
          callback: (r) => ultimo.current(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(caixa.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          locale: 'pt-PT',
          width: 300,
        });
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, []);
  if (falhou)
    return (
      <div className="caixa-aviso mau" role="alert">
        Não deu para abrir o Google. Recarrega a página.
      </div>
    );
  return <div ref={caixa} className="botao-google" style={{ minHeight: 44 }} />;
}
