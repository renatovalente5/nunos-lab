import { buffer, juntar } from './bytes.ts';
import {
  algoritmo,
  camposDoCertificado,
  conjunto,
  contexto,
  der,
  inteiro,
  octetos,
  OID,
  oid,
  sequencia,
  tempo,
} from './der.ts';
import { certificadosDoPem, chaveDeAssinatura } from './pem.ts';

/**
 * A assinatura do passe: um CMS SignedData (PKCS#7) DESTACADO sobre o
 * manifest.json, em DER, com a cadeia lá dentro. O que a Apple exige:
 * destacada (sem eContent); os atributos assinados por esta ordem —
 * contentType, signingTime (sem ele o iPhone recusa) e messageDigest
 * (SHA-256); assina-se o SET (0x31) e no ficheiro vão os mesmos bytes como
 * «[0] IMPLICIT»; os certificados (a folha e o WWDR G4) em «[0]».
 */
export async function assinarManifesto(
  conteudo: Uint8Array,
  { certificado, chave, cadeia }: { certificado: string; chave: string; cadeia: string },
  quando = new Date(),
): Promise<Uint8Array> {
  const [folha, ...resto] = [
    ...certificadosDoPem(certificado, 'APPLE_CERTIFICADO'),
    ...certificadosDoPem(cadeia, 'APPLE_CADEIA'),
  ];
  if (!folha) throw new Error('APPLE_CERTIFICADO está vazio.');
  const { serie, emissor, chavePublica } = camposDoCertificado(folha);
  const resumo = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(conteudo)));
  const atributos = [
    sequencia(oid(OID.tipoConteudo), conjunto(oid(OID.dados))),
    sequencia(oid(OID.horaAssinatura), conjunto(tempo(quando))),
    sequencia(oid(OID.resumoMensagem), conjunto(octetos(resumo))),
  ];
  const paraAssinar = conjunto(...atributos);
  const privada = await chaveDeAssinatura(chave, 'RSASSA-PKCS1-v1_5', 'APPLE_CHAVE');
  const assinatura = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privada, buffer(paraAssinar)),
  );
  // A chave e o certificado têm de ser um par: confere-se com a chave pública do certificado.
  const publica = await crypto.subtle
    .importKey(
      'spki',
      buffer(chavePublica),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    .catch(() => null);
  if (
    !publica ||
    !(await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publica,
      buffer(assinatura),
      buffer(paraAssinar),
    ))
  )
    throw new Error('APPLE_CHAVE não corresponde ao certificado em APPLE_CERTIFICADO.');
  const quemAssina = sequencia(
    inteiro(1),
    sequencia(emissor, serie),
    algoritmo(OID.sha256),
    contexto(0, juntar(...atributos)),
    algoritmo(OID.rsa),
    octetos(assinatura),
  );
  const assinado = sequencia(
    inteiro(1),
    conjunto(algoritmo(OID.sha256)),
    sequencia(oid(OID.dados)),
    contexto(0, juntar(folha, ...resto)),
    conjunto(quemAssina),
  );
  return sequencia(oid(OID.assinado), der(0xa0, assinado));
}
