-- O email da conta Google de cada pessoa do backoffice (22 out 2026). Entra-se
-- com o botão do Google, e só entram os emails desta coluna. As ligações de
-- acesso continuam a funcionar, para quem não tiver conta Google.
ALTER TABLE admins ADD COLUMN email TEXT;
CREATE UNIQUE INDEX admins_email_ux ON admins (email) WHERE email IS NOT NULL AND removido_em IS NULL;
