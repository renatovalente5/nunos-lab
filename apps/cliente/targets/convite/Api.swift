import Foundation

/// Quem convida, como a página do convite o mostra (GET /api/convite/:codigo).
struct Convite: Decodable {
    /// O nome curto («Miguel S.»); vazio numa conta sem nome.
    let nome: String
    /// Em cêntimos: o que ganha quem aceita.
    let valorConvidado: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        nome = (try? c.decodeIfPresent(String.self, forKey: .nome)) ?? ""
        valorConvidado = (try? c.decodeIfPresent(Int.self, forKey: .valorConvidado)) ?? 0
    }

    private enum CodingKeys: String, CodingKey { case nome, valorConvidado }
}

/// O que a App Clip usa dos dados da app (GET /api/app): as barbearias.
struct Dados: Decodable {
    let barbearia: Barbearia

    struct Barbearia: Decodable {
        let lojas: [Loja]

        /// Uma casa que não se lê (um campo novo ou em falta) não apaga as outras.
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            lojas = (try c.decodeIfPresent([Talvez<Loja>].self, forKey: .lojas) ?? []).compactMap(\.valor)
        }

        private enum CodingKeys: String, CodingKey { case lojas }
    }
}

/// Um elemento de uma lista que pode não se ler: fica nil em vez de deitar a lista abaixo.
struct Talvez<T: Decodable>: Decodable {
    let valor: T?

    init(from decoder: Decoder) throws {
        valor = try? T(from: decoder)
    }
}

struct Loja: Decodable, Identifiable {
    let id: Int
    let nome: String
    let morada: String
    /// A ligação de marcação (Fresha, WhatsApp…); vazia se a casa não a tem.
    let marcar: String
    let lat: Double?
    let lng: Double?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        nome = try c.decode(String.self, forKey: .nome)
        morada = (try? c.decodeIfPresent(String.self, forKey: .morada)) ?? ""
        marcar = (try? c.decodeIfPresent(String.self, forKey: .marcar)) ?? ""
        lat = try? c.decodeIfPresent(Double.self, forKey: .lat)
        lng = try? c.decodeIfPresent(Double.self, forKey: .lng)
    }

    private enum CodingKeys: String, CodingKey { case id, nome, morada, marcar, lat, lng }

    var ligacaoDeMarcar: URL? {
        let texto = marcar.trimmingCharacters(in: .whitespaces)
        guard !texto.isEmpty else { return nil }
        return URL(string: texto.contains("://") ? texto : "https://\(texto)")
    }

    /// Os Mapas da Apple no sítio exato (as coordenadas do backoffice) ou, sem ele, pela morada.
    var ligacaoDoMapa: URL? {
        var partes = URLComponents(string: "https://maps.apple.com/")!
        if let lat, let lng {
            partes.queryItems = [URLQueryItem(name: "ll", value: "\(lat),\(lng)"), URLQueryItem(name: "q", value: nome)]
        } else if !morada.isEmpty {
            partes.queryItems = [URLQueryItem(name: "q", value: "\(nome), \(morada)")]
        } else {
            return nil
        }
        return partes.url
    }
}

enum Api {
    /// A API da produção. Numa build de ensaio (Debug), a variável NUNOSLAB_API troca-a pela local.
    static var base: URL {
        #if DEBUG
        if let local = ProcessInfo.processInfo.environment["NUNOSLAB_API"], let url = URL(string: local) {
            return url
        }
        #endif
        return URL(string: "https://nunos-lab.renato-lima-valente-dcb.workers.dev")!
    }

    /// Quem convida; nil se o código não serve ou os convites estão parados (404). Sem rede, dá erro.
    static func convite(_ codigo: String) async throws -> Convite? {
        let url = base.appendingPathComponent("api/convite").appendingPathComponent(codigo)
        let (corpo, resposta) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 15))
        guard (resposta as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONDecoder().decode(Convite.self, from: corpo)
    }

    static func dados() async throws -> Dados {
        var partes = URLComponents(url: base.appendingPathComponent("api/app"), resolvingAgainstBaseURL: false)!
        partes.queryItems = [URLQueryItem(name: "lingua", value: Lingua.atual.rawValue)]
        let (corpo, resposta) = try await URLSession.shared.data(for: URLRequest(url: partes.url!, timeoutInterval: 15))
        guard (resposta as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(Dados.self, from: corpo)
    }
}
