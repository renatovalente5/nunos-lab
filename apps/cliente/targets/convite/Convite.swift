import SwiftUI

/// A App Clip do convite (o Renato, 25 nov 2026). A ligação de um convite abre-a no iPhone sem instalar
/// nada: guarda o código no grupo partilhado com a app e mostra quem convidou e as barbearias. Ao instalar
/// a app, a Apple troca a App Clip pela app, e o código fica à espera dela (src/convite-da-loja.ts).
@main
struct ConviteApp: App {
    @StateObject private var estado = Estado()

    var body: some Scene {
        WindowGroup {
            Ecra()
                .environmentObject(estado)
                .preferredColorScheme(.dark)
                // A ligação que abriu a App Clip: a da Apple, com «&convite=CODIGO».
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { atividade in
                    estado.abriu(com: atividade.webpageURL)
                }
                .task {
                    #if DEBUG
                    // Ensaio no simulador: o `simctl launch` não entrega a ligação como o Xcode (_XCAppClipURL),
                    // e a da Apple só abre a App Clip depois de aprovada. Chega pela variável NUNOSLAB_LIGACAO.
                    if let ensaio = ProcessInfo.processInfo.environment["NUNOSLAB_LIGACAO"] {
                        estado.abriu(com: URL(string: ensaio))
                    }
                    #endif
                    await estado.carregar()
                }
        }
    }
}

/// O que o ecrã mostra: quem convida (pela API) e as barbearias (as da app).
@MainActor
final class Estado: ObservableObject {
    /// nil sem código, com um código que não serve, ou com os convites parados (a API responde 404).
    @Published private(set) var convite: Convite?
    @Published private(set) var dados: Dados?
    @Published private(set) var semLigacao = false
    /// A faixa da App Store por baixo, com o «Obter» da app.
    @Published var instalar = false

    /// O código de agora: o da ligação, ou o que ficou guardado de uma vez anterior.
    private var codigo = Partilha.codigoGuardado()
    /// O código já perguntado à API (a ligação e o arranque chegam quase juntos).
    private var perguntado: String?
    private var faixaMostrada = false

    func abriu(com ligacao: URL?) {
        guard let novo = Partilha.codigo(em: ligacao) else { return }
        codigo = novo
        // Primeiro o ficheiro: quem instala logo a seguir já leva o código, com ou sem rede.
        Partilha.guardar(novo)
        Task { await procurarConvite() }
    }

    func carregar() async {
        Task { await procurarConvite() }
        await carregarDados()
    }

    func tentarOutraVez() {
        Task { await procurarConvite() }
        Task { await carregarDados() }
    }

    private func procurarConvite() async {
        guard let codigo, codigo != perguntado else { return }
        perguntado = codigo
        let achado: Convite?
        do {
            achado = try await Api.convite(codigo)
        } catch {
            // Sem rede: o «Tentar outra vez» volta a perguntar.
            if codigo == perguntado { perguntado = nil }
            return
        }
        // Entretanto chegou outra ligação: fica a dela.
        guard codigo == self.codigo else { return }
        convite = achado
        // Quem chega por um convite vem para instalar a app: a faixa da App Store sobe uma vez sozinha.
        if achado != nil && !faixaMostrada {
            faixaMostrada = true
            try? await Task.sleep(nanoseconds: 600_000_000)
            instalar = true
        }
    }

    private func carregarDados() async {
        semLigacao = false
        do {
            dados = try await Api.dados()
        } catch {
            if dados == nil { semLigacao = true }
        }
    }
}
