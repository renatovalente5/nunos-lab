import Foundation

/// A língua do telemóvel, como na app: português, ou inglês para as outras.
enum Lingua: String {
    case pt, en

    static let atual: Lingua = (Locale.preferredLanguages.first ?? "pt").lowercased().hasPrefix("pt") ? .pt : .en
}

/// Os textos da App Clip, com as palavras da app (src/textos).
enum Textos {
    private static var pt: Bool { Lingua.atual == .pt }

    static func convidou(_ nome: String) -> String {
        if nome.isEmpty { return pt ? "Foste convidado" : "You’ve been invited" }
        return pt ? "\(nome) convidou-te" : "\(nome) invited you"
    }

    static func ganhas(_ centimos: Int) -> String {
        if centimos <= 0 { return pt ? "Instala a app e entra." : "Get the app and sign in." }
        return pt ? "Instala a app e entra: ganhas \(euros(centimos))." : "Get the app and sign in: you get \(euros(centimos))."
    }

    static var instalar: String { pt ? "Instalar a app" : "Get the app" }
    static var barbearias: String { pt ? "Barbearias" : "Barbershops" }
    static var marcar: String { pt ? "Marcar" : "Book" }
    static func marcarEm(_ casa: String) -> String { pt ? "Marcar em \(casa)" : "Book at \(casa)" }
    static var ir: String { pt ? "Ir" : "Go" }
    static func irA(_ casa: String) -> String { pt ? "Ir a \(casa)" : "Directions to \(casa)" }
    static var semLigacao: String { pt ? "Sem ligação" : "No connection" }
    static var tentarOutraVez: String { pt ? "Tentar outra vez" : "Try again" }

    /// «1 €», «2,50 €» em português; «€1», «€2.50» em inglês (euros() em packages/dominio/src/saldo.ts),
    /// com um espaço que não parte.
    static func euros(_ centimos: Int) -> String {
        let inteiros = abs(centimos) / 100
        let resto = abs(centimos) % 100
        let numero = resto == 0 ? "\(inteiros)" : "\(inteiros)\(pt ? "," : ".")\(String(format: "%02d", resto))"
        return pt ? "\(numero)\u{00A0}€" : "€\(numero)"
    }
}
