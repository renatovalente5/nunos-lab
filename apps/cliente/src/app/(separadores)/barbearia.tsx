import { ligacaoDoInstagram } from '@nunos-lab/dominio';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MapaDasCasas } from '../../componentes/mapa-das-casas';
import { EscolherMapa, type DestinoNoMapa } from '../../componentes/mapas';
import { abrir, definirTitulo, useDados } from '../../dados';
import {
  Ecra,
  Esqueleto,
  Grupo,
  Icone,
  MARGEM,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
} from '@nunos-lab/ui';

export default function Barbearia() {
  const { data, isPending, isError, refetch } = useDados();
  useEffect(() => definirTitulo("Nuno's Lab · Barbearia"), []);
  const b = data?.barbearia;
  const [destino, setDestino] = useState<DestinoNoMapa | null>(null);

  return (
    <Ecra>
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 10 }}>
        <T v="titulo" role="heading" aria-level={1}>
          Barbearia
        </T>
      </View>

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

      {b && (!!b.whatsapp || !!b.instagram || !!b.tiktok || !!b.site) && (
        <>
          <Rotulo>Mais</Rotulo>
          <Grupo>
            {!!b.whatsapp && (
              <Linha
                icone="conversa"
                nome="Tatuagens"
                detalhe="WhatsApp"
                onPress={() => abrir(b.whatsapp)}
              />
            )}
            {!!b.instagram && (
              <Linha
                icone="instagram"
                nome="Instagram"
                detalhe={`@${b.instagram}`}
                onPress={() => abrir(ligacaoDoInstagram(b.instagram))}
                separador={!!b.whatsapp}
              />
            )}
            {!!b.tiktok && (
              <Linha
                icone="site"
                nome="TikTok"
                onPress={() => abrir(b.tiktok)}
                separador={!!(b.whatsapp || b.instagram)}
              />
            )}
            {!!b.site && (
              <Linha
                icone="site"
                nome="Site"
                detalhe={b.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                onPress={() => abrir(b.site)}
                separador={!!(b.whatsapp || b.instagram || b.tiktok)}
              />
            )}
          </Grupo>
        </>
      )}

      <EscolherMapa destino={destino} fechar={() => setDestino(null)} />

      <View style={{ alignItems: 'center', marginTop: 34 }}>
        <Link href="/privacidade" style={{ padding: 12 }}>
          <T v="legenda" style={{ color: cor.texto3 }}>
            Privacidade
          </T>
        </Link>
      </View>
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
