import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useEu, useResumo } from '../sessao';
import {
  CONTINUO,
  Ecra,
  Folha,
  Grupo,
  Icone,
  MARGEM,
  OpcaoDaFolha,
  Rotulo,
  Separador,
  T,
  cor,
  raio,
} from '@nunos-lab/ui';

const PERIODOS = [
  ['hoje', 'Hoje'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
] as const;

function hora(unix: number | null): string {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** O resumo do dono: os carimbos, por casa e por pessoa, hoje, na semana ou no mês. */
export default function Resumo() {
  const { data: eu } = useEu();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number][0]>('hoje');
  const [casa, setCasa] = useState<number | null>(null);
  const [aEscolherCasa, setAEscolherCasa] = useState(false);
  const { data: r } = useResumo(periodo, casa);
  const todasAsCasas = eu?.lojas.length === 3 ? 'As três casas' : 'Todas as casas';
  const nomeDaCasa =
    casa === null ? todasAsCasas : (eu?.lojas.find((l) => l.id === casa)?.nome ?? 'Esta casa');
  // Sem carimbos ainda, «▼ 100 %» de manhã é alarme sem razão: só se compara quando há.
  const variacao =
    r && r.carimbos > 0 && r.anterior > 0
      ? Math.round(((r.carimbos - r.anterior) / r.anterior) * 100)
      : null;
  const anterior =
    periodo === 'hoje' ? 'ontem' : periodo === 'semana' ? 'a semana anterior' : 'o mês anterior';
  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          role="button"
          aria-label="Voltar"
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
          <Icone nome="voltar" tamanho={21} espessura={2.2} />
        </Pressable>
        <T v="titulo" role="heading" aria-level={1}>
          Resumo
        </T>
      </View>

      <View
        style={{
          marginHorizontal: MARGEM,
          marginTop: 18,
          flexDirection: 'row',
          backgroundColor: cor.superficie,
          borderRadius: 999,
          padding: 3,
        }}
        role="tablist"
      >
        {PERIODOS.map(([valor, nome]) => (
          <Pressable
            key={valor}
            onPress={() => setPeriodo(valor)}
            role="tab"
            aria-selected={periodo === valor}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              alignItems: 'center',
              backgroundColor: periodo === valor ? cor.superficieAlta : 'transparent',
            }}
          >
            <T
              v="forte"
              style={{ fontSize: 14, color: periodo === valor ? cor.texto : cor.texto2 }}
            >
              {nome}
            </T>
          </Pressable>
        ))}
      </View>

      {eu && eu.lojas.length > 1 && (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 14, flexDirection: 'row' }}>
          <Pressable
            onPress={() => setAEscolherCasa(true)}
            role="button"
            aria-label={`Casa: ${nomeDaCasa}. Mudar.`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 40,
              paddingLeft: 12,
              paddingRight: 10,
              borderRadius: raio.pilula,
              borderWidth: 1,
              borderColor: cor.linha,
              backgroundColor: pressed ? cor.superficie : 'transparent',
            })}
          >
            <Icone nome="mapa" tamanho={16} cor={cor.texto2} espessura={2} />
            <T v="legenda" style={{ color: cor.texto }}>
              {nomeDaCasa}
            </T>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <Icone nome="seguinte" tamanho={14} cor={cor.texto3} espessura={2.2} />
            </View>
          </Pressable>
        </View>
      )}
      {eu && eu.lojas.length > 1 && (
        <Folha aberta={aEscolherCasa} fechar={() => setAEscolherCasa(false)} titulo="Casa">
          <View role="radiogroup" aria-label="Casa">
            <OpcaoDaFolha
              nome={todasAsCasas}
              escolhida={casa === null}
              onPress={() => {
                setCasa(null);
                setAEscolherCasa(false);
              }}
            />
            {eu.lojas.map((l) => (
              <OpcaoDaFolha
                key={l.id}
                nome={l.nome}
                escolhida={casa === l.id}
                onPress={() => {
                  setCasa(l.id);
                  setAEscolherCasa(false);
                }}
                separador
              />
            ))}
          </View>
        </Folha>
      )}

      {r && (
        <>
          <View style={{ paddingHorizontal: MARGEM, marginTop: 22 }}>
            <T v="destaque" style={{ fontSize: 64, lineHeight: 68, letterSpacing: -3 }}>
              {r.carimbos}
            </T>
            <T v="corpo" style={{ color: cor.texto2, marginTop: 2 }}>
              carimbos
              {variacao !== null && (
                <T v="corpo" style={{ color: variacao >= 0 ? '#8FD3A1' : '#E07A72' }}>
                  {' '}
                  · {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao)} %
                </T>
              )}
              {variacao !== null ? ` vs. ${anterior}` : ''}
              {variacao === null && r.carimbos === 0 && r.anterior > 0
                ? ` · ${anterior}: ${r.anterior}`
                : ''}
            </T>
          </View>
          <View style={{ paddingHorizontal: MARGEM, marginTop: 18, flexDirection: 'row', gap: 10 }}>
            {[
              [r.novos, 'Novos'],
              [r.recompensas, 'Prémios'],
              [r.emRisco, 'Em risco'],
            ].map(([v, n]) => (
              <View
                key={String(n)}
                style={{
                  flex: 1,
                  backgroundColor: cor.superficie,
                  borderRadius: raio.grupo,
                  padding: 14,
                  ...CONTINUO,
                }}
              >
                <T v="subtitulo">{v}</T>
                <T
                  v="legenda"
                  style={{ color: cor.texto2, marginTop: 2, fontSize: 12, letterSpacing: -0.2 }}
                  numberOfLines={1}
                >
                  {n}
                </T>
              </View>
            ))}
          </View>

          <Rotulo>Por casa</Rotulo>
          <Grupo>
            {r.porLoja.map((l, i) => {
              const maior = Math.max(1, ...r.porLoja.map((x) => x.n));
              return (
                <View key={l.id}>
                  {i > 0 && <Separador />}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T v="forte">{l.nome}</T>
                      <T v="forte">{l.n}</T>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: cor.superficieAlta,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round((l.n / maior) * 100)}%`,
                          height: '100%',
                          backgroundColor: cor.claro,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Grupo>

          <Rotulo>Equipa</Rotulo>
          <Grupo>
            {r.porPessoa.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <Separador />}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T v="forte">{p.nome}</T>
                    <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                      {[
                        p.loja,
                        p.primeiro && p.ultimo ? `${hora(p.primeiro)} – ${hora(p.ultimo)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </T>
                  </View>
                  <T v="forte">{p.n}</T>
                </View>
              </View>
            ))}
          </Grupo>
        </>
      )}
    </Ecra>
  );
}
