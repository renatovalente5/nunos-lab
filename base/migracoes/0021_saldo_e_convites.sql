-- O saldo e os convites (o Renato, 10 nov 2026): cada cliente tem um saldo em euros para usar na
-- barbearia; quem convida ganha quando o convidado vai à barbearia, e o convidado ganha logo. O Nuno
-- define no backoffice se há convites, quanto ganha cada um e quantos convites tem cada cliente
-- (definicoes conv.*; sem elas, valem as predefinições do domínio).

-- O código do convite de cada cliente (o que vai na ligação que partilha): faz-se na primeira vez que
-- a carteira o pede. As mesmas 8 letras dos códigos dos cartões, mas outro código: o do cartão
-- identifica o cliente ao balcão e não se espalha por aí.
ALTER TABLE clientes ADD COLUMN codigo_convite TEXT CHECK (codigo_convite IS NULL OR length(codigo_convite) = 8);
CREATE UNIQUE INDEX clientes_codigo_convite_ux ON clientes (codigo_convite) WHERE codigo_convite IS NOT NULL;

-- Quem convidou quem. Cada cliente só é convidado uma vez, e só antes do primeiro corte. O prémio de
-- quem convida fica escrito no convite quando é aceite (mudar o valor depois não muda o prometido) e
-- entra no saldo dele com o primeiro carimbo do convidado (visitou_em); anular esse carimbo desfaz-o.
CREATE TABLE convites (
  id INTEGER PRIMARY KEY,
  padrinho_id INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  convidado_id INTEGER NOT NULL UNIQUE REFERENCES clientes (id) ON DELETE CASCADE,
  -- Em cêntimos: o que o convidado ganhou ao aceitar, e o que quem convida ganha com a visita.
  premio_convidado INTEGER NOT NULL DEFAULT 0 CHECK (premio_convidado >= 0),
  premio_padrinho INTEGER NOT NULL DEFAULT 0 CHECK (premio_padrinho >= 0),
  criado_em INTEGER NOT NULL DEFAULT (unixepoch()),
  visitou_em INTEGER,
  carimbo_id INTEGER REFERENCES carimbos (id) ON DELETE SET NULL,
  CHECK (padrinho_id != convidado_id)
) STRICT;
CREATE INDEX convites_padrinho_ix ON convites (padrinho_id, criado_em);

-- Os movimentos do saldo, em cêntimos (o Renato: na base cabem cêntimos, mas usam-se euros inteiros):
-- positivo entra, negativo sai. O saldo é a soma dos que não foram anulados; a carteira mostra-os
-- todos, para o cliente conferir. Tipos: «convidado» (ganhou ao aceitar um convite), «convite» (um
-- convidado seu foi à barbearia), «uso» (o barbeiro usou-o ao balcão), «acerto» (o Nuno, no
-- backoffice). A chave é a do aparelho da for partners (o mesmo uso duas vezes conta uma).
CREATE TABLE movimentos_de_saldo (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  valor INTEGER NOT NULL CHECK (valor != 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('convidado', 'convite', 'uso', 'acerto')),
  convite_id INTEGER REFERENCES convites (id) ON DELETE SET NULL,
  loja_id INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  pessoa_id INTEGER REFERENCES equipa (id) ON DELETE SET NULL,
  admin_id INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  nota TEXT NOT NULL DEFAULT '' CHECK (length(nota) <= 140),
  chave TEXT UNIQUE CHECK (chave IS NULL OR length(chave) BETWEEN 8 AND 64),
  criado_em INTEGER NOT NULL DEFAULT (unixepoch()),
  anulado_em INTEGER,
  anulado_por INTEGER REFERENCES equipa (id) ON DELETE SET NULL
) STRICT;
CREATE INDEX movimentos_de_saldo_cliente_ix ON movimentos_de_saldo (cliente_id, criado_em);
CREATE INDEX movimentos_de_saldo_convite_ix ON movimentos_de_saldo (convite_id) WHERE convite_id IS NOT NULL;
