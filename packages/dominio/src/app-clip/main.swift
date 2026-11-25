// O que a App Clip do convite decide sem ecrã (apps/cliente/targets/convite): o código da ligação, os
// textos e as casas. Compila-se com o Api.swift, o Textos.swift e o Partilha.swift dela e corre duas vezes,
// em português e em inglês (packages/dominio/src/app-clip.test.ts, só num Mac com o swiftc).
import Foundation

var falhas: [String] = []

func confere<T: Equatable>(_ obtido: T, _ esperado: T, _ caso: String, linha: Int = #line) {
    if obtido != esperado { falhas.append("linha \(linha), \(caso): deu «\(obtido)», esperava «\(esperado)»") }
}

let pt = Lingua.atual == .pt
let nbsp = "\u{00A0}"

// O código da ligação da Apple: só letras e algarismos, em maiúsculas, de 4 a 20.
let base = "https://appclip.apple.com/id?p=pt.nunoslab.app.clip"
for (ligacao, esperado) in [
    ("\(base)&convite=1714QXSA", "1714QXSA"),
    ("\(base)&convite=1714qxsa", "1714QXSA"),
    ("\(base)&convite=1714-QXSA", "1714QXSA"),
    ("\(base)&convite=1714%20QXSA", "1714QXSA"),
    ("https://appclip.apple.com/id?convite=7K3Q9M2X&p=pt.nunoslab.app.clip&l=pt", "7K3Q9M2X"),
    ("\(base)&convite=1714QXSA#fim", "1714QXSA"),
] as [(String, String?)] {
    confere(Partilha.codigo(em: URL(string: ligacao)), esperado, ligacao)
}
for ligacao in [
    base,
    "\(base)&convite=",
    "\(base)&convite=AB1",
    "\(base)&convite=\(String(repeating: "A", count: 21))",
    "\(base)&codigo=1714QXSA",
] {
    confere(Partilha.codigo(em: URL(string: ligacao)), nil, ligacao)
}
confere(Partilha.codigo(em: nil), nil, "sem ligação")
confere(Partilha.limpo(" 1714qxsa\n"), "1714QXSA", "o ficheiro com espaços")
confere(Partilha.limpo("../../x"), nil, "um caminho no ficheiro")

// Os textos.
confere(Textos.euros(100), pt ? "1\(nbsp)€" : "€1", "1 €")
confere(Textos.euros(250), pt ? "2,50\(nbsp)€" : "€2.50", "2,50 €")
confere(Textos.euros(5), pt ? "0,05\(nbsp)€" : "€0.05", "5 cêntimos")
confere(Textos.convidou(""), pt ? "Foste convidado" : "You’ve been invited", "sem nome")
confere(Textos.convidou("Miguel S."), pt ? "Miguel S. convidou-te" : "Miguel S. invited you", "com nome")
confere(Textos.ganhas(0), pt ? "Instala a app e entra." : "Get the app and sign in.", "sem valor")
confere(
    Textos.ganhas(100),
    pt ? "Instala a app e entra: ganhas 1\(nbsp)€." : "Get the app and sign in: you get €1.",
    "1 €"
)

// O convite como a API o dá; um campo em falta não o deita abaixo.
func ler<T: Decodable>(_ tipo: T.Type, _ json: String) -> T? {
    try? JSONDecoder().decode(tipo, from: Data(json.utf8))
}
let convite = ler(Convite.self, #"{"nome":"Miguel S.","valorConvidado":100}"#)
confere(convite?.nome, "Miguel S.", "convite: nome")
confere(convite?.valorConvidado, 100, "convite: valor")
let semNada = ler(Convite.self, #"{"nome":null}"#)
confere(semNada?.nome, "", "convite sem nome")
confere(semNada?.valorConvidado, 0, "convite sem valor")

// As casas como a API as dá (GET /api/app), com uma estragada e outras com campos em falta.
let dados = ler(Dados.self, #"""
{"hoje":"2026-11-25","barbearia":{"instagram":"","lojas":[
 {"id":1,"nome":"Nogueira do Cravo","morada":"Avenida dos Descobrimentos, 912","telefone":"","marcar":"https://www.fresha.com/pt/a/x?multi=true&menu=true","ordem":1,"lat":40.8840641,"lng":-8.4517073},
 {"id":2,"nome":"Casa sem sítio","morada":"Rua de Viseu, 128, Aveiro","marcar":"wa.me/351912345678","lat":null,"lng":null},
 {"nome":"Sem id"},
 {"id":4,"nome":"Só o nome"}
]},"parceiros":[]}
"""#)
let lojas = dados?.barbearia.lojas ?? []
confere(lojas.map(\.id), [1, 2, 4], "as casas que se lêem")
if lojas.count == 3 {
    confere(lojas[0].ligacaoDeMarcar?.absoluteString, "https://www.fresha.com/pt/a/x?multi=true&menu=true", "marcar")
    let mapa = lojas[0].ligacaoDoMapa.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
    confere(mapa?.host, "maps.apple.com", "mapa: Mapas da Apple")
    confere(mapa?.queryItems?.first { $0.name == "ll" }?.value, "40.8840641,-8.4517073", "mapa: sítio")
    confere(mapa?.queryItems?.first { $0.name == "q" }?.value, "Nogueira do Cravo", "mapa: nome")
    confere(lojas[1].ligacaoDeMarcar?.absoluteString, "https://wa.me/351912345678", "marcar sem https")
    let pelaMorada = lojas[1].ligacaoDoMapa.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
    confere(pelaMorada?.queryItems?.first { $0.name == "q" }?.value, "Casa sem sítio, Rua de Viseu, 128, Aveiro", "mapa pela morada")
    confere(lojas[2].morada, "", "sem morada")
    confere(lojas[2].ligacaoDeMarcar, nil, "sem marcação: sem «Marcar»")
    confere(lojas[2].ligacaoDoMapa, nil, "sem morada nem sítio: sem «Ir»")
}
confere(ler(Dados.self, #"{"barbearia":{}}"#)?.barbearia.lojas.count, 0, "sem casas")

// A API da produção, e o caminho do convite.
confere(Api.base.absoluteString, "https://nunos-lab.renato-lima-valente-dcb.workers.dev", "a API")
confere(
    Api.base.appendingPathComponent("api/convite").appendingPathComponent("1714QXSA").absoluteString,
    "https://nunos-lab.renato-lima-valente-dcb.workers.dev/api/convite/1714QXSA",
    "o pedido do convite"
)

if falhas.isEmpty {
    print("App Clip (\(Lingua.atual.rawValue)): tudo certo")
} else {
    FileHandle.standardError.write(Data((falhas.joined(separator: "\n") + "\n").utf8))
    exit(1)
}
