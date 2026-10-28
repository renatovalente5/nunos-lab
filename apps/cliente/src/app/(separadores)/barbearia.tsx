import {
  ligacaoDoInstagram,
  ligacaoDoMapa,
  ligacaoDoTelefone,
  semPartir,
} from '@nunos-lab/dominio';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import { Esqueleto, SemLigacao } from '../../componentes/estados';
import { Icone } from '../../componentes/icone';
import { Botao, Ecra, Grupo, Rotulo, Separador } from '../../componentes/pecas';
import { T } from '../../componentes/texto';
import { abrir, contar, definirTitulo, useDados } from '../../dados';
import { cor, LARGURA_MAXIMA, letra, MARGEM } from '../../tema';

const palavra = require('../../../assets/marca/palavra.png');
const lema = require('../../../assets/marca/lema.png');

export default function Barbearia() {
  const { data, isPending, isError, refetch } = useDados();
  const { width } = useWindowDimensions();
  useEffect(() => definirTitulo("Nuno's Lab · Barbearia"), []);
  const b = data?.barbearia;
  // O logótipo à largura do ecrã (até 350 px), tal como está: só a branco.
  const larguraDaPalavra = Math.min(350, Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM);

  return (
    <Ecra>
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 6 }}>
        <Image
          source={palavra}
          style={{ width: larguraDaPalavra, height: Math.round((larguraDaPalavra * 227) / 1200) }}
          resizeMode="contain"
          accessibilityLabel="Nuno's Lab"
          role="img"
        />
        <Image
          source={lema}
          style={{ width: 236, height: Math.round((236 * 46) / 900), marginTop: 18 }}
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
          <View style={{ paddingHorizontal: MARGEM }}>
            {b.lojas.map((l, i) => (
              <View key={l.id}>
                {i > 0 && <Separador />}
                <View style={{ paddingTop: i > 0 ? 22 : 0, paddingBottom: 22 }}>
                  <T v="subtitulo">{l.nome}</T>
                  {!!l.morada && (
                    <T v="corpo" style={{ color: cor.texto2, marginTop: 4 }}>
                      {semPartir(l.morada)}
                    </T>
                  )}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    {!!l.marcar && (
                      <Botao
                        nome="Marcar"
                        icone="calendario"
                        largo
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
                    {!!l.telefone && (
                      <Botao
                        nome="Ligar"
                        icone="ligar"
                        secundario
                        rotulo={`Ligar para ${l.nome}`}
                        onPress={() => abrir(ligacaoDoTelefone(l.telefone))}
                      />
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
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
      {separador && <Separador />}
      <Pressable
        onPress={onPress}
        role="link"
        aria-label={detalhe ? `${nome}, ${detalhe}` : nome}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 60,
          backgroundColor: pressed ? cor.superficie : 'transparent',
        })}
      >
        <Icone nome={icone} tamanho={22} espessura={2} />
        <T v="forte" style={{ marginLeft: 16, flex: 1, fontFamily: letra.extra }}>
          {nome}
        </T>
        {!!detalhe && (
          <T v="corpo" style={{ color: cor.texto2, marginRight: 10, fontSize: 14 }}>
            {detalhe}
          </T>
        )}
        <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
      </Pressable>
    </View>
  );
}
