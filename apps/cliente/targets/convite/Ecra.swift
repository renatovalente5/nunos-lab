import StoreKit
import SwiftUI

/// As cores e as letras da app (packages/ui/src/tema.ts e texto.tsx).
enum Cor {
    static let fundo = Color(red: 0x0A / 255, green: 0x0A / 255, blue: 0x0A / 255)
    static let superficie = Color(red: 0x16 / 255, green: 0x16 / 255, blue: 0x16 / 255)
    static let superficieAlta = Color(red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255)
    static let linha = Color(red: 0x2A / 255, green: 0x2A / 255, blue: 0x2A / 255)
    static let texto = Color(red: 0xF4 / 255, green: 0xF1 / 255, blue: 0xEC / 255)
    static let texto2 = Color(red: 0xA9 / 255, green: 0xA4 / 255, blue: 0x9C / 255)
    static let claroPremido = Color(red: 0xDD / 255, green: 0xD9 / 255, blue: 0xD2 / 255)
}

enum Letra {
    static let titulo = Font.custom("Manrope-ExtraBold", size: 26, relativeTo: .title)
    static let seccao = Font.custom("Manrope-Bold", size: 22, relativeTo: .title2)
    static let forte = Font.custom("Manrope-Bold", size: 16, relativeTo: .body)
    static let corpo = Font.custom("Manrope-Medium", size: 15, relativeTo: .subheadline)
    static let legenda = Font.custom("Manrope-SemiBold", size: 13, relativeTo: .footnote)
    static let pilula = Font.custom("Manrope-Bold", size: 14, relativeTo: .callout)
}

struct Ecra: View {
    @EnvironmentObject private var estado: Estado

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Image("palavra")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 170)
                    .accessibilityLabel("Nuno’s Lab")
                    .padding(.top, 14)

                if let convite = estado.convite {
                    CartaoDoConvite(convite: convite) { estado.instalar = true }
                        .padding(.top, 24)
                        .transition(.opacity)
                }

                Text(Textos.barbearias)
                    .font(Letra.seccao)
                    .tracking(-0.5)
                    .foregroundStyle(Cor.texto)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, 32)
                    .padding(.bottom, 14)

                if let lojas = estado.dados?.barbearia.lojas {
                    Lojas(lojas: lojas)
                } else if estado.semLigacao {
                    SemLigacao { estado.tentarOutraVez() }
                } else {
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(Cor.superficie)
                        .frame(height: 236)
                        .accessibilityHidden(true)
                }

                // Sem convite (ligação sem código, ou convites parados), a app também se instala daqui.
                if estado.convite == nil, estado.dados != nil {
                    BotaoClaro(nome: Textos.instalar) { estado.instalar = true }
                        .padding(.top, 28)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .animation(.easeOut(duration: 0.2), value: estado.convite != nil)
        }
        // A faixa da App Store fica por cima do fim da página (uns 140 pontos): com ela aberta, a página
        // desce mais, para o «Marcar» e o «Ir» da última casa subirem acima dela.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear.frame(height: estado.instalar ? 150 : 0)
        }
        .background(Cor.fundo.ignoresSafeArea())
        .appStoreOverlay(isPresented: $estado.instalar) {
            SKOverlay.AppClipConfiguration(position: .bottom)
        }
    }
}

/// Quem convidou e o que se ganha, com o botão que abre a faixa da App Store.
struct CartaoDoConvite: View {
    let convite: Convite
    let instalar: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "gift.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Cor.texto)
                .accessibilityHidden(true)
                .padding(.bottom, 8)
            Text(Textos.convidou(convite.nome))
                .font(Letra.titulo)
                .tracking(-0.6)
                .foregroundStyle(Cor.texto)
                .accessibilityAddTraits(.isHeader)
            Text(Textos.ganhas(convite.valorConvidado))
                .font(Letra.corpo)
                .foregroundStyle(Cor.texto2)
            BotaoClaro(nome: Textos.instalar, acao: instalar)
                .padding(.top, 16)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Cor.superficie))
        .accessibilityElement(children: .contain)
    }
}

/// As barbearias num grupo, como na Barbearia da app: o nome, a morada, «Marcar» e «Ir».
struct Lojas: View {
    let lojas: [Loja]
    @Environment(\.openURL) private var abrir

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(lojas.enumerated()), id: \.element.id) { i, loja in
                if i > 0 {
                    Rectangle().fill(Cor.linha).frame(height: 1 / 3).padding(.leading, 16)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(loja.nome)
                        .font(Letra.forte)
                        .tracking(-0.15)
                        .foregroundStyle(Cor.texto)
                    if !loja.morada.isEmpty {
                        Text(loja.morada)
                            .font(Letra.legenda)
                            .foregroundStyle(Cor.texto2)
                    }
                    let marcar = loja.ligacaoDeMarcar
                    let mapa = loja.ligacaoDoMapa
                    if marcar != nil || mapa != nil {
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 8) { pilulas(loja, marcar, mapa) }
                            VStack(alignment: .leading, spacing: 8) { pilulas(loja, marcar, mapa) }
                        }
                        .padding(.top, 10)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Cor.superficie))
    }

    @ViewBuilder
    private func pilulas(_ loja: Loja, _ marcar: URL?, _ mapa: URL?) -> some View {
        if let marcar {
            Pilula(nome: Textos.marcar, principal: true) { abrir(marcar) }
                .accessibilityLabel(Textos.marcarEm(loja.nome))
        }
        if let mapa {
            Pilula(nome: Textos.ir, principal: false) { abrir(mapa) }
                .accessibilityLabel(Textos.irA(loja.nome))
        }
    }
}

struct SemLigacao: View {
    let tentar: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text(Textos.semLigacao)
                .font(Letra.forte)
                .foregroundStyle(Cor.texto2)
            Pilula(nome: Textos.tentarOutraVez, principal: false, acao: tentar)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Cor.superficie))
    }
}

/// O botão principal da app: claro, a toda a largura.
struct BotaoClaro: View {
    let nome: String
    let acao: () -> Void

    var body: some View {
        Button(action: acao) {
            Text(nome)
                .font(Letra.forte)
                .foregroundStyle(Cor.fundo)
                .frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(Premido(fundo: Cor.texto, premido: Cor.claroPremido, raio: 16))
    }
}

/// As pílulas das casas na app (34 de altura): a principal clara, a outra escura.
struct Pilula: View {
    let nome: String
    let principal: Bool
    let acao: () -> Void

    var body: some View {
        Button(action: acao) {
            Text(nome)
                .font(Letra.pilula)
                .foregroundStyle(principal ? Cor.fundo : Cor.texto)
                .lineLimit(1)
                .padding(.horizontal, 18)
                .frame(minHeight: 34)
        }
        .buttonStyle(
            Premido(
                fundo: principal ? Cor.texto : Cor.superficieAlta,
                premido: principal ? Cor.claroPremido : Cor.linha,
                raio: 17
            )
        )
        .contentShape(Rectangle())
    }
}

struct Premido: ButtonStyle {
    let fundo: Color
    let premido: Color
    let raio: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: raio, style: .continuous)
                    .fill(configuration.isPressed ? premido : fundo)
            )
    }
}
