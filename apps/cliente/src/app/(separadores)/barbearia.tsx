import { REDES, ligacaoDoInstagram } from '@nunos-lab/dominio';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CabecalhoDoSeparador } from '../../componentes/cabecalho';
import { MapaDasCasas } from '../../componentes/mapa-das-casas';
import { EscolherMapa, type DestinoNoMapa } from '../../componentes/mapas';
import { abrir, definirTitulo, useDados } from '../../dados';
import {
  Ecra,
  Esqueleto,
  Grupo,
  Icone,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
} from '@nunos-lab/ui';
import { useTextos } from '../../textos';

export default function Barbearia() {
  const { data, isPending, isError, refetch } = useDados();
  const t = useTextos();
  useEffect(() => definirTitulo(t.titulos.barbearias), [t]);
  const b = data?.barbearia;
  // As redes preenchidas, pela ordem que o Nuno escolheu no backoffice (uma API antiga não a manda).
  const redes = b ? (b.redes ?? REDES).filter((r) => !!b[r]) : [];
  const [destino, setDestino] = useState<DestinoNoMapa | null>(null);

  return (
    <Ecra>
      <CabecalhoDoSeparador titulo={t.barbearia.titulo} />

      {!data && isPending && <Esqueleto />}
      {!data && isError && <SemLigacao tentar={() => refetch()} />}

      {b && b.lojas.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <MapaDasCasas
            lojas={b.lojas}
            aoIr={(l) => setDestino({ nome: l.nome, morada: l.morada, procurar: "Nuno's Lab" })}
          />
        </View>
      )}

      {b && redes.length > 0 && (
        <>
          <Rotulo>{t.barbearia.mais}</Rotulo>
          <Grupo>
            {redes.map((r, i) =>
              r === 'whatsapp' ? (
                <Linha
                  key={r}
                  icone="conversa"
                  nome={t.barbearia.tatuagens}
                  detalhe="WhatsApp"
                  onPress={() => abrir(b.whatsapp)}
                  separador={i > 0}
                />
              ) : r === 'instagram' ? (
                <Linha
                  key={r}
                  icone="instagram"
                  nome="Instagram"
                  detalhe={`@${b.instagram}`}
                  onPress={() => abrir(ligacaoDoInstagram(b.instagram))}
                  separador={i > 0}
                />
              ) : r === 'tiktok' ? (
                <Linha
                  key={r}
                  icone="site"
                  nome="TikTok"
                  onPress={() => abrir(b.tiktok)}
                  separador={i > 0}
                />
              ) : (
                <Linha
                  key={r}
                  icone="site"
                  nome={t.barbearia.site}
                  detalhe={b.site.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  onPress={() => abrir(/^https?:\/\//.test(b.site) ? b.site : `https://${b.site}`)}
                  separador={i > 0}
                />
              ),
            )}
          </Grupo>
        </>
      )}

      <EscolherMapa destino={destino} fechar={() => setDestino(null)} />
    </Ecra>
  );
}

function Linha({
  icone,
  nome,
  detalhe,
  onPress,
  separador = false,
}: {
  icone: 'conversa' | 'instagram' | 'site';
  nome: string;
  detalhe?: string;
  onPress: () => void;
  separador?: boolean;
}) {
  return (
    <View>
      {separador && <Separador recuo={56} />}
      <Pressable
        onPress={onPress}
        role="link"
        aria-label={detalhe ? `${nome}, ${detalhe}` : nome}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          minHeight: 58,
          backgroundColor: pressed ? cor.superficieAlta : 'transparent',
        })}
      >
        <Icone nome={icone} tamanho={22} />
        <T v="forte" style={{ marginLeft: 18, flex: 1 }}>
          {nome}
        </T>
        {!!detalhe && (
          <T v="legenda" style={{ color: cor.texto2, marginRight: 8 }}>
            {detalhe}
          </T>
        )}
        <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
      </Pressable>
    </View>
  );
}
