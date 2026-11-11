import { euros, type MotivoDaVantagem } from '@nunos-lab/dominio';

/**
 * As frases da for partners em português: a fonte. O inglês (en.ts) tem de ter as mesmas chaves, e
 * o TypeScript não deixa faltar nenhuma.
 */
export const pt = {
  geral: {
    voltar: 'Voltar',
    conta: 'Conta',
    concluir: 'Concluir',
    aAbrir: 'A abrir…',
    semNome: 'Sem nome',
    hoje: 'Hoje',
    anular: 'Anular',
    lerOCartao: 'Ler o cartão',
    carimbosDe: (carimbos: number, objectivo: number) => `${carimbos} de ${objectivo}`,
  },
  entrar: {
    comAConta: 'Entra com a conta que o Nuno registou.',
  },
  inicio: {
    casaEConta: 'Barbearia e conta',
    carimbos: 'Carimbos',
    novos: 'Novos',
    premios: 'Prémios',
    procurar: 'Procurar',
    clienteNovo: 'Cliente novo',
    resumo: 'Resumo',
    repetido: 'repetido',
    semCarimbos: (dia: string) => `${dia} · ainda sem carimbos`,
  },
  parceiro: {
    parceiroDoNunosLab: 'Parceiro Nuno’s Lab',
    parceiro: 'Parceiro',
    validacoesHoje: 'Validações hoje',
    cliente: 'cliente',
    semValidacoes: (dia: string) => `${dia} · ainda sem validações`,
    // Anular uma validação: o Nuno não as anula no backoffice, por isso não se fala nele.
    tardeParaAnular: 'Já passaram 10 minutos: já não se anula.',
    deOutraPessoa: 'Foi outra pessoa que validou: só ela anula.',
  },
  ficha: {
    hoje: 'hoje',
    ontem: 'ontem',
    haDias: (n: number) => `há ${n} dias`,
    haSemanas: (n: number) => `há ${n} semanas`,
    cartaoCompleto: 'Cartão completo',
    fazAnos: 'Faz anos',
    clienteDesde: (ano: number, cortes: number, completos: number) =>
      `Cliente desde ${ano} · ${cortes} ${cortes === 1 ? 'corte' : 'cortes'}${
        completos > 0
          ? ` · ${completos} ${completos === 1 ? 'cartão completo' : 'cartões completos'}`
          : ''
      }`,
    deObjectivo: (objectivo: number) => `de ${objectivo}`,
    ultimaVisita: (quando: string) => `Última visita ${quando}`,
    primeiraVisita: 'Primeira visita',
    prendaDeAnos: (prenda: string) => `Prenda de anos: ${prenda}`,
    entregarAPrenda: 'Entregar a prenda',
    // O prémio a meio do cartão (10 nov 2026): num produto, entrega-se nesse dia ou noutro.
    premioAMeio: (carimbos: number, recompensa: string) =>
      `Prémio dos ${carimbos}: ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`,
    entregarOPremio: 'Entregar o prémio',
    premioAMeioEntregue: (recompensa: string, hora: string, pessoa: string | null) =>
      `${recompensa} entregue hoje às ${hora}${pessoa ? ` por ${pessoa}` : ''}`,
    ganhouPremioAMeio: 'Ganhou o prémio. Entrega-o agora ou noutro dia.',
    esteCorteDa: (recompensa: string) =>
      `Este corte dá ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`,
    prendaEntregue: (quando: string, hoje: boolean, pessoa: string | null) =>
      `Prenda de anos entregue ${hoje ? 'às' : 'a'} ${quando}${pessoa ? ` por ${pessoa}` : ''}`,
    jaCarimbadoAs: (hora: string, pessoa: string | null) =>
      `Já carimbado hoje às ${hora}${pessoa ? ` por ${pessoa}` : ''}.`,
    premioEntregueHoje: (recompensa: string, hora: string, pessoa: string | null) =>
      `${recompensa || 'Prémio'} entregue hoje às ${hora}${pessoa ? ` por ${pessoa}` : ''}. Não leva carimbo.`,
    jaCarimbado: 'Já carimbado hoje.',
    carimbadoAs: (hora: string, pessoa: string | null) =>
      `Carimbado hoje às ${hora}${pessoa ? ` por ${pessoa}` : ''}`,
    carimboAnulado: (hora: string) => `Carimbo das ${hora} anulado`,
    anularCarimbo: 'Anular carimbo',
    anularOCarimbo: (nome: string, hora: string) =>
      nome ? `Anular o carimbo de ${nome} das ${hora}?` : `Anular o carimbo das ${hora}?`,
    // Só a primeira letra: um prémio com uma marca («Pomada Reuzel») não perde as maiúsculas.
    entregar: (recompensa: string) =>
      `Entregar: ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`,
    recompensaEntregue: (recompensa: string | undefined) =>
      `${recompensa ?? 'Recompensa'} entregue`,
    carimbarNaMesma: 'Carimbar na mesma',
    aCarimbar: 'A carimbar…',
    carimbar: 'Carimbar',
    // O saldo (o Renato, 10 nov 2026): os valores chegam em cêntimos; ao balcão usam-se euros inteiros.
    saldo: 'Saldo',
    usarSaldo: 'Usar saldo',
    menosUmEuro: 'Menos 1 €',
    maisUmEuro: 'Mais 1 €',
    // Só 1 € é singular: «Fica 1 €», «Ficam 2 €», «Ficam 0,50 €».
    fica: (centimos: number) => `${centimos === 100 ? 'Fica' : 'Ficam'} ${euros(centimos)}`,
    usar: (centimos: number) => `Usar ${euros(centimos)}`,
    aUsar: 'A usar…',
    usados: (centimos: number) => `${centimos === 100 ? 'Usado' : 'Usados'} ${euros(centimos)}`,
    devolvidos: (centimos: number) =>
      `${centimos === 100 ? 'Devolvido' : 'Devolvidos'} ${euros(centimos)}`,
    saldoDe: (centimos: number) => `Saldo ${euros(centimos)}`,
    // Um prémio de convite anulado depois de usado: o cliente não deve nada ao balcão.
    saldoNegativo: 'Um prémio de convite foi anulado depois de usado. Nada a cobrar.',
    // As boas-vindas de um convite usam-se com o primeiro corte (revisão de 11 nov 2026).
    saldoDepoisDoCorte: 'Usa-se depois de carimbar.',
    // Sem o cartão lido (código escrito, procura, email), o saldo só o dono o usa (11 nov 2026).
    lerParaUsar: 'Lê o cartão para usar o saldo.',
    anularCarimboEUso: (centimos: number, hora: string) =>
      `Anular o carimbo e devolver ${centimos === 100 ? 'o' : 'os'} ${euros(centimos)} ${centimos === 100 ? 'usado' : 'usados'} às ${hora}?`,
    usouAs: (centimos: number, hora: string, pessoa: string | null) =>
      `Usou ${euros(centimos)} às ${hora}${pessoa ? ` · ${pessoa}` : ''}`,
    devolverOUso: (centimos: number, hora: string) =>
      `Devolver também ${centimos === 100 ? 'o' : 'os'} ${euros(centimos)} ${centimos === 100 ? 'usado' : 'usados'} às ${hora}?`,
    devolver: 'Devolver',
    anularOUso: (centimos: number, hora: string) =>
      `Anular o uso de ${euros(centimos)} das ${hora}?`,
  },
  vale: {
    motivo: {
      ja_usou: 'Já usou hoje',
      limite_do_cliente: 'Chegou ao limite',
      limite_total: 'Esgotada',
      cliente_inactivo: 'Só para clientes activos',
    } as Record<Exclude<MotivoDaVantagem, 'ok'>, string>,
    validado: 'Validado',
    cliente: 'Cliente',
    clienteActivo: 'Cliente activo do Nuno’s Lab',
    semCorteNoUltimoAno: 'Sem corte no último ano',
    semVantagens: 'Sem vantagens para validar hoje.',
    jaUsou: (n: number) => `já usou ${n}`,
    aValidar: 'A validar…',
    validar: 'Validar',
  },
  resumo: {
    titulo: 'Resumo',
    periodos: { hoje: 'Hoje', semana: 'Semana', mes: 'Mês' },
    asTresCasas: 'As três barbearias',
    todasAsCasas: 'Todas as barbearias',
    estaCasa: 'Esta barbearia',
    anterior: { hoje: 'ontem', semana: 'semana anterior', mes: 'mês anterior' },
    casa: 'Barbearia',
    mudarDeCasa: (casa: string) => `Barbearia: ${casa}. Mudar.`,
    soODono: 'Só o dono vê o resumo.',
    carimbos: (n: number): string => (n === 1 ? 'carimbo' : 'carimbos'),
    novos: 'Novos',
    premios: 'Prémios',
    porCasa: 'Por barbearia',
    equipa: 'Equipa',
  },
  novo: {
    titulo: 'Cliente novo',
    faltaONome: 'O nome faz falta.',
    emailErrado: 'Esse email não está certo.',
    mensagem: (codigo: string, ligacao: string) =>
      `O teu cartão Nuno’s Lab: ${codigo}. A app: ${ligacao}`,
    entraComOEmail: 'Entra na app com esse email e encontra o cartão.',
    entraComAppleOuGoogle: 'Sem email, o cliente mostra este código a cada visita.',
    copiado: 'Copiado',
    partilhar: 'Partilhar',
    nome: 'Nome',
    email: 'Email (para entrar na app)',
    carimbarJa: 'Carimbar já',
    aGuardar: 'A guardar…',
    guardar: 'Guardar',
  },
  ler: {
    naoECartao: 'Isso não é um cartão do Nuno’s Lab.',
    lanterna: 'Lanterna',
    escreveOCodigo: 'Escreve o código',
    ouEscreveOCodigo: 'Ou escreve o código',
    abrir: 'Abrir',
  },
  camara: {
    precisa: 'A app precisa da câmara para ler o cartão.',
    permitir: 'Permitir a câmara',
    abrirDefinicoes: 'Abrir as definições',
    aAbrir: 'A abrir a câmara…',
    semAcesso: 'Sem acesso à câmara.',
  },
  conta: {
    papel: { dono: 'Dono', barbeiro: 'Barbeiro', parceiro: 'Parceiro' },
    casaOndeCarimbo: 'Barbearia onde estou a carimbar',
    aMinhaCasa: 'A minha barbearia',
    definicoes: 'Definições',
    sessao: 'Sessão',
    sairDesteAparelho: 'Sair deste aparelho',
    sairPergunta: 'Sair deste aparelho?',
    sair: 'Sair',
  },
  procurar: {
    titulo: 'Procurar',
    pista: 'Nome, email ou código',
    semVisitas: 'sem visitas',
    ninguem: (q: string) => `Ninguém com «${q}».`,
  },
  confirmar: { cancelar: 'Cancelar' },
  naoEncontrado: { texto: 'Esta página não existe', irParaOInicio: 'Ir para o início' },
  erroDoEcra: { titulo: 'Algo correu mal', texto: 'A app não conseguiu abrir este ecrã.' },
  erros: {
    sessao: 'A sessão acabou. Entra outra vez.',
    google_invalido: 'O Google não confirmou a entrada.',
    apple_invalido: 'A Apple não confirmou a entrada.',
    apple_desligado: 'Entrar com a Apple ainda não está disponível.',
    sem_acesso: 'Esta conta não está na equipa. Pede ao Nuno para a juntar.',
    email_escondido:
      'A Apple escondeu o teu email, e é por ele que a equipa te conhece. Entra com o Google, ou deixa de usar «Iniciar sessão com a Apple» nesta app nas Definições e volta a entrar escolhendo «Partilhar o meu email».',
    muitas_tentativas: 'Demasiadas tentativas. Espera um minuto.',
    codigo_invalido: 'Código errado.',
    cartao_desconhecido: 'Este código não é de nenhum cartão.',
    outra_casa: 'A tua conta não carimba nesta barbearia.',
    so_barbearia: 'A tua conta não carimba.',
    proprio_cartao: 'É o teu cartão. Pede a um colega.',
    entregue_hoje: 'O prémio foi entregue hoje: o corte do prémio não leva carimbo.',
    so_parceiro: 'A tua conta não valida vantagens.',
    parceiro_desligado: 'Este parceiro está desligado no Nuno’s Lab. Fala com a barbearia.',
    ja_usou: 'Já usou hoje.',
    limite_do_cliente: 'Este cliente chegou ao limite.',
    limite_total: 'Esta vantagem esgotou.',
    cliente_inactivo: 'Sem corte no último ano: não vale.',
    so_dono: 'Só o dono vê isto.',
    ja_anulado: 'Já estava anulado.',
    tarde_para_anular: 'Já passaram 10 minutos: só o Nuno anula.',
    premio_so_o_dono: 'O carimbo do prémio só o Nuno anula.',
    de_outra_pessoa: 'Foi outra pessoa que carimbou: só ela, ou o Nuno, anula.',
    recompensa_usada: 'A recompensa deste cartão já foi entregue.',
    cartao_seguinte: 'O cartão seguinte já tem carimbos.',
    email_ja_tem_cartao: 'Esse email já tem cartão. Procura o cliente.',
    limite_do_dia: 'Já tinha o carimbo de hoje.',
    repetido: 'Esse carimbo já tinha entrado.',
    nao_existe: 'Isso não existe.',
    json: 'O pedido chegou malformado. Tenta outra vez.',
    sem_prenda: 'Hoje não há prenda para este cliente.',
    prenda_entregue: 'A prenda deste ano já foi entregue.',
    premio_a_meio_entregue: 'O prémio a meio deste cartão já foi entregue.',
    saldo_insuficiente: 'O saldo já não chega para isto.',
    saldo_antes_do_corte: 'Este saldo usa-se com o primeiro corte: carimba primeiro.',
    saldo_sem_corte_hoje: 'O saldo usa-se no dia de um corte: carimba primeiro.',
    saldo_so_com_cartao: 'Sem o cartão lido, o saldo só o dono o usa.',
    uso_de_outro_dia: 'Esse uso é de outro dia: acerta-se no backoffice.',
    saldo_usado_hoje: 'Este cliente usou saldo hoje: anula primeiro o uso (ou pede ao dono).',
    limite_do_dia_maximo: 'Este cliente já tem dois carimbos hoje: mais, só o dono.',
    convidado_proprio:
      'Foste tu que convidaste este cliente: o primeiro corte carimba-o outro barbeiro.',
    uso_anulado: 'Este uso já foi anulado.',
    uso_de_outra_pessoa: 'Só quem usou o saldo o pode anular (ou o dono).',
    tarde_para_anular_uso: 'Já passaram 10 minutos: só o dono pode anular.',
    invalido: 'Há algo por corrigir.',
    grande: 'O pedido é demasiado grande.',
    referencia: 'Isso já não existe. Recarrega.',
    rede: 'Sem ligação.',
    interno: 'Algo correu mal. Tenta outra vez.',
  } as Record<string, string> & { interno: string },
};
