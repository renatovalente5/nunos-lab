-- Entrar na for partners com um código mandado ao email da equipa (28 nov 2026).

-- A tabela dos códigos existe desde a 0004 («quando houver caixa de correio»), sem uso até hoje. Cada
-- código passa a dizer a que pessoa da equipa se mandou (vazio: o email não é da equipa e não saiu nada,
-- mas conta para os limites, para a resposta ser igual) e de que rede veio o pedido (um resumo, para os
-- limites por rede). A limpeza da madrugada apaga-os um dia depois de caducarem.
ALTER TABLE codigos_de_entrada ADD COLUMN pessoa_id INTEGER REFERENCES equipa (id) ON DELETE CASCADE;
ALTER TABLE codigos_de_entrada ADD COLUMN rede TEXT NOT NULL DEFAULT '';
CREATE INDEX codigos_de_entrada_rede_ix ON codigos_de_entrada (rede, criado_em);

-- Uma Apple ou Google ligada à pessoa por um código (a Apple com o email escondido, ou outro email):
-- só estas abrem a sessão sem o email bater certo. As outras ficam só para a regra do próprio cartão.
ALTER TABLE identidades_da_equipa ADD COLUMN ligada INTEGER NOT NULL DEFAULT 0 CHECK (ligada IN (0, 1));

-- A Apple ou a Google que não deu com ninguém espera aqui 15 minutos pelo código do email da equipa.
CREATE TABLE ligacoes_da_equipa (
  resumo    BLOB PRIMARY KEY CHECK (length(resumo) = 32),
  tipo      TEXT NOT NULL CHECK (tipo IN ('apple', 'google')),
  sujeito   TEXT NOT NULL CHECK (length(sujeito) BETWEEN 1 AND 255),
  expira_em INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
