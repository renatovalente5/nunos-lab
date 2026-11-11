-- Contra a batota no saldo e nos convites (revisão de 11 nov 2026).

-- As marcas (HMAC, irreversíveis) das formas de entrar e dos emails de quem apagou a conta ou tirou uma
-- forma de entrar: quem volta a entrar com a mesma Apple ou Google já não aceita um convite outra vez
-- (apagar e voltar a entrar fazia de qualquer cliente um «novo», com as boas-vindas de novo).
CREATE TABLE marcas_de_contas_apagadas (
  marca     TEXT PRIMARY KEY CHECK (length(marca) = 64),
  criada_em INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT, WITHOUT ROWID;

-- As formas de entrar (a Apple e a Google: o «sub», o mesmo nas apps da mesma equipa) com que cada pessoa
-- da equipa entra na for partners: a regra do próprio cartão (e do próprio convidado) compara-as com as
-- do cliente, e o «Ocultar o meu email» da Apple já não a contorna.
CREATE TABLE identidades_da_equipa (
  pessoa_id INTEGER NOT NULL REFERENCES equipa (id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL CHECK (tipo IN ('apple', 'google')),
  sujeito   TEXT NOT NULL CHECK (length(sujeito) BETWEEN 1 AND 255),
  criada_em INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tipo, sujeito)
) STRICT;
CREATE INDEX identidades_da_equipa_pessoa_ix ON identidades_da_equipa (pessoa_id);

-- Anular um carimbo procura o convite que ele pagou: sem índice, lia a tabela toda.
CREATE INDEX convites_carimbo_ix ON convites (carimbo_id) WHERE carimbo_id IS NOT NULL;
