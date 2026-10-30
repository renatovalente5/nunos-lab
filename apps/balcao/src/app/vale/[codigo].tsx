import {
  codigoCurto,
  dataCurta,
  diaEmLisboa,
  limiteEmTexto,
  semPartir,
  type VantagemDoParceiro,
} from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { chaveNova, mensagemDe, semRemedio, useFichaParceiro, validar } from '../../sessao';
import { Botao, CONTINUO, Icone, LARGURA_MAXIMA, MARGEM, T, cor, raio } from '@nunos-lab/ui';

const MOTIVO: Record<Exclude<VantagemDoParceiro['motivo'], 'ok'>, string> = {
  ja_usou: 'Já usou hoje',
  limite_do_cliente: 'Chegou ao limite',
  limite_total: 'Esgotada',
  cliente_inactivo: 'Só para clientes activos',
};

/** O cartão lido pelo parceiro: o nome próprio, se é cliente activo, e as vantagens a validar. */
export default function ValeDoParceiro() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const margens = useSafeAreaInsets();
  const consultas = useQueryClient();
  const { data: ficha, error, refetch, isPending } = useFichaParceiro(codigo ?? '');
  const [estado, setEstado] = useState<'pronto' | 'a-enviar' | 'feito'>('pronto');
  const [feito, setFeito] = useState<{ destaque: string; titulo: string; quando: number } | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const escala = useRef(new Animated.Value(0.6)).current;
  const chaves = useRef(new Map<number, string>());
  // O «Concluir» automático: limpa-se ao sair e ao desmontar, para não fechar o ecrã seguinte.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(temporizador.current ?? undefined), []);

  const sair = () => {
    clearTimeout(temporizador.current ?? undefined);
    return router.canGoBack() ? router.back() : router.replace('/');
  };
  const usar = async (v: VantagemDoParceiro) => {
    if (!ficha || estado === 'a-enviar') return;
    setEstado('a-enviar');
    setErro(null);
    const chaveDe = v.cupaoId ?? v.id;
    if (!chaves.current.has(chaveDe)) chaves.current.set(chaveDe, chaveNova());
    try {
      const r = await validar({
        codigo: ficha.cliente.codigo,
        promocaoId: v.id,
        chave: chaves.current.get(chaveDe)!,
        cupaoId: v.cupaoId,
      });
      setFeito({ destaque: r.vale.destaque, titulo: r.vale.titulo, quando: r.vale.quando });
      setEstado('feito');
      Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
      consultas.invalidateQueries({ queryKey: ['balcao', 'hoje-parceiro'] });
      temporizador.current = setTimeout(sair, 3000);
    } catch (e) {
      setEstado('pronto');
      setErro(mensagemDe(e));
      refetch();
    }
  };
  const hora = (unix: number) => {
    const d = new Date(unix * 1000);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: margens.top }}>
      <View style={{ width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center', flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: MARGEM,
            paddingTop: 10,
          }}
        >
          <Pressable
            onPress={sair}
            role="button"
            aria-label="Fechar"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? cor.linha : cor.superficieAlta,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icone nome="fechar" tamanho={20} espessura={2.4} />
          </Pressable>
          {ficha && (
            <T v="legenda" style={{ color: cor.texto3, marginLeft: 14, letterSpacing: 1.5 }}>
              {codigoCurto(ficha.cliente.codigo)}
            </T>
          )}
        </View>

        {!ficha && isPending && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <T v="legenda" style={{ color: cor.texto2 }}>
              A abrir…
            </T>
          </View>
        )}
        {!ficha && error && (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              paddingHorizontal: 32,
            }}
          >
            <T v="subtitulo" style={{ textAlign: 'center' }}>
              {mensagemDe(error)}
            </T>
            {semRemedio(error) ? (
              <Botao nome="Fechar" secundario onPress={sair} />
            ) : (
              <Botao nome="Tentar outra vez" secundario onPress={() => refetch()} />
            )}
          </View>
        )}

        {estado === 'feito' && feito && (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: MARGEM,
            }}
          >
            <Animated.View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: cor.claro,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: escala }],
              }}
            >
              <Icone nome="certo" tamanho={56} cor={cor.sobreClaro} espessura={2.6} />
            </Animated.View>
            <T v="titulo" style={{ marginTop: 28, textAlign: 'center' }}>
              Validado
            </T>
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {semPartir(feito.destaque)} · {semPartir(feito.titulo)} · {hora(feito.quando)}
            </T>
            <View style={{ marginTop: 28 }}>
              <Botao nome="Concluir" onPress={sair} />
            </View>
          </View>
        )}

        {ficha && estado !== 'feito' && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: MARGEM, paddingTop: 24, gap: 10 }}>
              <T v="titulo" numberOfLines={1}>
                {ficha.cliente.nome || 'Cliente'}
              </T>
              <View style={{ flexDirection: 'row' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: ficha.cliente.activo ? cor.claro : cor.superficieAlta,
                  }}
                >
                  <Icone
                    nome={ficha.cliente.activo ? 'certo' : 'relogio'}
                    tamanho={15}
                    cor={ficha.cliente.activo ? cor.sobreClaro : cor.texto2}
                    espessura={2.4}
                  />
                  <T
                    v="legenda"
                    style={{ color: ficha.cliente.activo ? cor.sobreClaro : cor.texto2 }}
                  >
                    {ficha.cliente.activo
                      ? "Cliente activo do Nuno's Lab"
                      : 'Sem corte no último ano'}
                  </T>
                </View>
              </View>
            </View>

            <View
              style={{
                paddingHorizontal: MARGEM,
                marginTop: 22,
                gap: 12,
                paddingBottom: margens.bottom + 24,
              }}
            >
              {ficha.vantagens.length === 0 && (
                <T v="corpo" style={{ color: cor.texto2, textAlign: 'center', marginTop: 20 }}>
                  Sem vantagens para validar hoje.
                </T>
              )}
              {ficha.vantagens.map((v) => {
                const pode = v.motivo === 'ok';
                const limite = v.cupaoId
                  ? `Cupão · até ${dataCurta(v.validoAte!, diaEmLisboa())}`
                  : limiteEmTexto(v);
                return (
                  <View
                    key={v.cupaoId ? `c${v.cupaoId}` : v.id}
                    style={{
                      backgroundColor: cor.superficie,
                      borderRadius: raio.grupo,
                      padding: 18,
                      gap: 6,
                      opacity: pode ? 1 : 0.75,
                      ...CONTINUO,
                    }}
                  >
                    <T v="titulo">{semPartir(v.destaque)}</T>
                    <T v="tituloCartao">{semPartir(v.titulo)}</T>
                    {(limite || v.usadas > 0) && (
                      <T v="legenda" style={{ color: cor.texto2 }}>
                        {[limite, v.usadas > 0 ? `já usou ${v.usadas}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </T>
                    )}
                    <Pressable
                      onPress={() => pode && usar(v)}
                      role="button"
                      aria-disabled={!pode || estado === 'a-enviar'}
                      style={({ pressed }) => ({
                        marginTop: 10,
                        height: 52,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pode
                          ? pressed
                            ? cor.claroPremido
                            : cor.claro
                          : cor.superficieAlta,
                        opacity: estado === 'a-enviar' ? 0.6 : 1,
                      })}
                    >
                      <T
                        v="forte"
                        style={{ color: pode ? cor.sobreClaro : cor.texto2, fontSize: 16 }}
                      >
                        {pode
                          ? estado === 'a-enviar'
                            ? 'A validar…'
                            : 'Validar'
                          : MOTIVO[v.motivo as keyof typeof MOTIVO]}
                      </T>
                    </Pressable>
                  </View>
                );
              })}
              {erro && (
                <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
                  {erro}
                </T>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
