import Foundation

/// O código do convite no ficheiro do grupo partilhado com a app (GRUPO_PARTILHADO_IOS e
/// FICHEIRO_DO_CONVITE_IOS em packages/dominio/src/saldo.ts).
enum Partilha {
    static let grupo = "group.pt.nunoslab.app"
    static let ficheiro = "convite.txt"

    private static var caminho: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: grupo)?
            .appendingPathComponent(ficheiro)
    }

    private static let permitidas = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

    /// O código na ligação («…&convite=CODIGO»).
    static func codigo(em ligacao: URL?) -> String? {
        guard let ligacao,
              let partes = URLComponents(url: ligacao, resolvingAgainstBaseURL: false),
              let valor = partes.queryItems?.first(where: { $0.name == "convite" })?.value
        else { return nil }
        return limpo(valor)
    }

    /// Só letras e algarismos, de 4 a 20: a app (e a API) arrumam-no e conferem-no.
    static func limpo(_ texto: String) -> String? {
        let codigo = String(texto.uppercased().filter { permitidas.contains($0) })
        return (4...20).contains(codigo.count) ? codigo : nil
    }

    static func guardar(_ codigo: String) {
        guard let caminho else { return }
        try? codigo.write(to: caminho, atomically: true, encoding: .utf8)
    }

    static func codigoGuardado() -> String? {
        guard let caminho, let texto = try? String(contentsOf: caminho, encoding: .utf8) else { return nil }
        return limpo(texto)
    }
}
