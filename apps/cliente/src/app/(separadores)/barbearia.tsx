import { ligacaoDoInstagram, ligacaoDoMapa, semPartir } from '@nunos-lab/dominio';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Esqueleto, SemLigacao } from '../../componentes/estados';
import { Icone } from '../../componentes/icone';
import { Botao, Ecra, Grupo, Rotulo } from '../../componentes/pecas';
import { T } from '../../componentes/texto';
import { abrir, contar, definirTitulo, useDados } from '../../dados';
import { cor, MARGEM, raio } from '../../tema';

const palavra = require('../../../assets/marca/palavra.png');
const lema = require('../../../assets/marca/lema.png');

export default function Barbearia() {
  const { data, isPending, isError, refetch } = useDados();
  useEffect(() => definirTitulo("Nuno's Lab · Barbearia"), []);
  const b = data?.barbearia;

  return (
    <Ecra>
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 18, gap: 16 }}>
        <Image
          source={palavra}
          style={{ width: 260, height: Math.round((260 * 227) / 1200) }}
          resizeMode="contain"
          accessibilityLabel="Nuno's Lab"
          role="img"
        />
        <Image
          source={lema}
          style={{ width: 230, height: Math.round((230 * 46) / 900), opacity: 0.55 }}
          resizeMode="contain"
          accessibilityLabel="Cut, ink, coffee, style"
          role="img"
        />
      </View>

      {!data && isPending && <Esqueleto />}
      {!data && isError && <SemLigacao tentar={() => refetch()} />}

      {b && b.lojas.length > 0 && (
        <>
          <Rotulo>Marcar</Rotulo>
          <View style={{ gap: 12 }}>
            {b.lojas.map((l) => (
              <View
                key={l.id}
                style={{
                  marginHorizontal: MARGEM,
                  backgroundColor: cor.superficie,
                  borderRadius: raio.grupo,
                  padding: 18,
                  gap: 4,
                }}
              >
                <T v="subtitulo">{l.nome}</T>
                {!!l.morada && (
                  <T v="corpo" style={{ color: cor.texto2 }}>
                    {semPartir(l.morada)}
                  </T>
                )}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {!!l.marcar && (
                    <Botao
                      nome="Marcar"
                      icone="calendario"
                      rotulo={`Marcar em ${l.nome}`}
                      onPress={() => {
                        contar('marcar', l.id);
                        abrir(l.marcar);
                      }}
                    />
                  )}
                  {!!l.morada && (
                    <Botao
                      nome="Ir"
                      icone="mapa"
                      secundario
                      rotulo={`Ir a ${l.nome}`}
                      onPress={() => abrir(ligacaoDoMapa(l.morada, "Nuno's Lab"))}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {b && (!!b.whatsapp || !!b.instagram || !!b.tiktok) && (
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
          </Grupo>
        </>
      )}

      <View style={{ alignItems: 'center', marginTop: 34 }}>
        <Link href="/privacidade" style={{ padding: 10 }}>
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
      {separador && <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: 56 }} />}
      <Pressable
        onPress={onPress}
        role="link"
        aria-label={detalhe ? `${nome}, ${detalhe}` : nome}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          minHeight: 56,
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
