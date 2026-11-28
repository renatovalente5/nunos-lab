/**
 * O QR do balcão de uma barbearia (o Nuno, 27 nov 2026): criar, imprimir, trocar e desligar. O QR leva a
 * página da app com o código da barbearia; o cliente lê-o com a app (Cartão › Ler o QR do balcão) e o
 * carimbo entra sem o barbeiro tirar o telemóvel do bolso. O código só existe aqui e na base: a API
 * pública nunca o mostra.
 */
import { SITIO_DA_APP, ligacaoDoBalcao, type QrDaLoja } from '@nunos-lab/dominio';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { encode } from 'uqr';
import { ErroDaApi, pedir } from './api';
import { useAccao, useConfirmar } from './pecas';
import { useTextos } from './textos';

/** A app na web (na produção, a do GitHub Pages): é para lá que o QR leva quem o lê com a câmara. */
const SITIO = (import.meta.env.VITE_APP as string | undefined) || SITIO_DA_APP;
const PALAVRA = `${import.meta.env.BASE_URL}palavra.png`;

/** Os módulos escuros do QR, num só caminho de SVG (como o QR do cartão na app). */
function desenhoDoQr(texto: string): { d: string; n: number } {
  const q = encode(texto, { ecc: 'M', border: 0 });
  let d = '';
  q.data.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { d, n: q.size };
}

function QR({ desenho, rotulo }: { desenho: { d: string; n: number }; rotulo: string }) {
  return (
    <svg
      viewBox={`0 0 ${desenho.n} ${desenho.n}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={rotulo}
    >
      <path d={desenho.d} fill="#000" />
    </svg>
  );
}

/**
 * O cartaz para o balcão, só na impressão: preto como a marca, o logótipo, o QR num quadrado branco e
 * como se lê. Fica fora da página (no fim do body), e o CSS de impressão esconde o resto.
 */
function Cartaz({ loja, desenho }: { loja: string; desenho: { d: string; n: number } }) {
  const q = useTextos().barbearia.qr;
  return createPortal(
    <div className="cartaz-do-qr">
      <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
      <div className="carimba-aqui">{q.carimbaAqui}</div>
      <div className="quadrado">
        <QR desenho={desenho} rotulo={q.rotulo(loja)} />
      </div>
      <div className="como-ler">{q.comoLer}</div>
      <div className="um-por-dia">
        {q.umPorDia} · {loja}
      </div>
    </div>,
    document.body,
  );
}

export function QrDoBalcao({ lojaId, loja }: { lojaId: number; loja: string }) {
  const q = useTextos().barbearia.qr;
  const consultas = useQueryClient();
  const { confirmar, dialogo } = useConfirmar();
  const { correr, aCorrer } = useAccao();
  const [aImprimir, setAImprimir] = useState(false);
  const chave = ['qr-do-balcao', lojaId];
  const qr = useQuery({
    queryKey: chave,
    queryFn: () => pedir<QrDaLoja>(`/api/bo/lojas/${lojaId}/qr`),
  });
  const codigo = qr.data?.codigo ?? null;
  const desenho = useMemo(
    () => (codigo ? desenhoDoQr(ligacaoDoBalcao(codigo, SITIO)) : null),
    [codigo],
  );
  // O cartaz entra na página, imprime-se, e sai quando a janela da impressão fecha. A folha A5 e o
  // esconder o resto só valem para ele: a classe no <html> e o @page entram e saem com o cartaz.
  useEffect(() => {
    if (!aImprimir) return;
    const raiz = document.documentElement;
    raiz.classList.add('a-imprimir-o-cartaz');
    const pagina = document.createElement('style');
    pagina.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(pagina);
    const acabou = () => setAImprimir(false);
    window.addEventListener('afterprint', acabou);
    // Imprime quando o logótipo do cartaz já carregou (com a rede lenta, um tempo fixo saía sem ele); se
    // nunca carregar, ao fim de 3 s imprime-se na mesma (o «Imprimir» ficava sem fazer nada).
    let vez = 0;
    let impresso = false;
    const imprimir = () => {
      if (impresso) return;
      impresso = true;
      vez = window.setTimeout(() => window.print(), 50);
    };
    const prazo = window.setTimeout(imprimir, 3000);
    const palavra = document.querySelector<HTMLImageElement>('.cartaz-do-qr .palavra');
    if (!palavra || palavra.complete) imprimir();
    else {
      palavra.addEventListener('load', imprimir, { once: true });
      palavra.addEventListener('error', imprimir, { once: true });
    }
    return () => {
      window.clearTimeout(vez);
      window.clearTimeout(prazo);
      window.removeEventListener('afterprint', acabou);
      palavra?.removeEventListener('load', imprimir);
      palavra?.removeEventListener('error', imprimir);
      raiz.classList.remove('a-imprimir-o-cartaz');
      pagina.remove();
    };
  }, [aImprimir]);

  // «Criar» só cria (numa página antiga, com o QR já criado noutra, a API recusa e o de agora aparece);
  // «Trocar QR» diz que é para trocar (2.ª revisão de 27 nov 2026).
  const pedirQr = (metodo: 'POST' | 'DELETE', corpo?: { trocar: true }) =>
    correr(async () => {
      try {
        consultas.setQueryData(
          chave,
          await pedir<QrDaLoja>(`/api/bo/lojas/${lojaId}/qr`, { metodo, corpo }),
        );
      } catch (e) {
        if (e instanceof ErroDaApi && e.codigo === 'ja_tem_qr')
          await consultas.invalidateQueries({ queryKey: chave });
        throw e;
      }
    });

  return (
    <div className="qr-do-balcao">
      <span className="rotulo-campo">{q.titulo}</span>
      {!qr.data ? null : codigo && desenho ? (
        <div className="com-qr">
          <div className="quadrado-do-qr">
            <QR desenho={desenho} rotulo={q.rotulo(loja)} />
          </div>
          <div className="accoes-do-qr">
            {/* Sem coordenadas (de antes da regra que o impede), o QR não carimba: diz-se aqui. */}
            {!qr.data.temSitio && <p className="mensagem-erro">{q.semSitioComQr}</p>}
            <p className="ajuda">{q.comQr}</p>
            <div className="botoes">
              <button type="button" className="botao pequeno" onClick={() => setAImprimir(true)}>
                {q.imprimir}
              </button>
              <button
                type="button"
                className="botao secundario pequeno"
                disabled={aCorrer}
                onClick={async () => {
                  if (await confirmar(q.trocarPergunta, q.trocarTexto, q.trocar))
                    await pedirQr('POST', { trocar: true });
                }}
              >
                {q.trocar}
              </button>
              <button
                type="button"
                className="botao secundario pequeno"
                disabled={aCorrer}
                onClick={async () => {
                  if (await confirmar(q.desligarPergunta, q.desligarTexto, q.desligar))
                    await pedirQr('DELETE');
                }}
              >
                {q.desligar}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="sem-qr">
          <p className="ajuda">{qr.data.temSitio ? q.semQr : q.semSitio}</p>
          <div>
            <button
              type="button"
              className="botao secundario pequeno"
              disabled={!qr.data.temSitio || aCorrer}
              onClick={() => pedirQr('POST')}
            >
              {q.criar}
            </button>
          </div>
        </div>
      )}
      {aImprimir && desenho && <Cartaz loja={loja} desenho={desenho} />}
      {dialogo}
    </div>
  );
}
