-- O QR do balcão (o Nuno, 27 nov 2026): cada barbearia pode ter um código, impresso num QR ao balcão; o
-- cliente lê-o com a app e o carimbo entra sem o barbeiro tirar o telemóvel do bolso. Sem código, a
-- barbearia não tem QR. Trocar o código (no backoffice) faz os QR impressos antes deixarem de valer.
ALTER TABLE lojas ADD COLUMN codigo_qr TEXT CHECK (codigo_qr IS NULL OR length(codigo_qr) = 16);
CREATE UNIQUE INDEX lojas_codigo_qr_ux ON lojas (codigo_qr) WHERE codigo_qr IS NOT NULL;

-- O carimbo que o cliente deu a si mesmo, pelo QR do balcão (sem pessoa da equipa: o histórico diz «QR
-- do balcão»).
ALTER TABLE carimbos ADD COLUMN pelo_qr INTEGER NOT NULL DEFAULT 0 CHECK (pelo_qr IN (0, 1));
