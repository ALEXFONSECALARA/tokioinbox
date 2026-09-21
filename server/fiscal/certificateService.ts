import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import forge from 'node-forge';
import { CertificateMetadata } from './types';

// Master key derived from server environment or a local runtime secret
const CERT_STORAGE_DIR = path.join(process.cwd(), 'data', 'fiscal', 'certificates');
const CERT_KEY_SECRET: string = (() => {
  const key = process.env.FISCAL_ENCRYPTION_KEY;
  if (key && key.length >= 24) return key;
  if (process.env.NODE_ENV === 'production') {
    // Sem chave forte não há cofre seguro: o módulo de certificados fica indisponível.
    console.error('[FISCAL] FISCAL_ENCRYPTION_KEY ausente/curta (mín. 24 caracteres). Cofre de certificados DESABILITADO.');
    return '';
  }
  console.warn('[FISCAL] (dev) usando chave de desenvolvimento para o cofre de certificados.');
  return 'dev-only-fiscal-vault-key-do-not-use-in-production';
})();

function ensureCertDir() {
  if (!fs.existsSync(CERT_STORAGE_DIR)) {
    fs.mkdirSync(CERT_STORAGE_DIR, { recursive: true });
  }
}

function deriveKey(secret: string): Buffer {
  if (!secret) throw new Error('Cofre de certificados indisponível: defina FISCAL_ENCRYPTION_KEY no ambiente.');
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * AES-256-GCM Encryption for Certificate & Password storage on server
 */
function encryptData(buffer: Buffer): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(CERT_KEY_SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decryptData(payload: { encrypted: string; iv: string; authTag: string }): Buffer {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(CERT_KEY_SECRET),
    Buffer.from(payload.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(payload.encrypted, 'base64')), decipher.final()]);
}

interface StoredEncryptedCert {
  restaurantSlug: string;
  certPayload: { encrypted: string; iv: string; authTag: string };
  passPayload: { encrypted: string; iv: string; authTag: string };
  metadata: CertificateMetadata;
  updatedAt: string;
}

function getCertFilePath(restaurantSlug: string): string {
  ensureCertDir();
  return path.join(CERT_STORAGE_DIR, `${restaurantSlug}.cert.vault.json`);
}

/**
 * Parses PKCS#12 (.pfx/.p12) buffer using node-forge and verifies password
 */
export function inspectPfx(pfxBuffer: Buffer, password: string): {
  success: boolean;
  metadata?: CertificateMetadata;
  error?: string;
  privateKeyPem?: string;
  certPem?: string;
} {
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Look for key and cert bags
    let certBag: forge.pkcs12.Bag | undefined;
    let keyBag: forge.pkcs12.Bag | undefined;

    for (const bagType of Object.keys(p12.safeContents)) {
      const safeContent = (p12.safeContents as any)[bagType];
      if (Array.isArray(safeContent)) {
        for (const bag of safeContent) {
          if (bag.cert) certBag = bag;
          if (bag.key) keyBag = bag;
        }
      }
    }

    if (!certBag || !certBag.cert) {
      return { success: false, error: 'Certificado X.509 não encontrado dentro do arquivo PKCS#12.' };
    }

    const cert = certBag.cert;
    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = keyBag && keyBag.key ? forge.pki.privateKeyToPem(keyBag.key) : undefined;

    // Extract Subject and Issuer
    const subjectAttrs = cert.subject.attributes;
    const cnAttr = subjectAttrs.find((a: any) => a.name === 'commonName' || a.shortName === 'CN');
    const commonName = cnAttr ? String(cnAttr.value) : 'Empresa Emitente';

    const issuerAttrs = cert.issuer.attributes;
    const issuerCn = issuerAttrs.find((a: any) => a.name === 'commonName' || a.shortName === 'CN');
    const issuerCommonName = issuerCn ? String(issuerCn.value) : 'Autoridade Certificadora ICP-Brasil';

    // Extract CNPJ if formatted in CN (typical ICP-Brasil pattern: "RAZAO SOCIAL:00000000000191")
    let cnpj: string | undefined;
    const cnpjMatch = commonName.match(/\b\d{14}\b/) || commonName.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjMatch) {
      cnpj = cnpjMatch[0].replace(/\D/g, '');
    }

    const validFrom = cert.validity.notBefore.toISOString();
    const validTo = cert.validity.notAfter.toISOString();
    const now = new Date();
    const validToDate = new Date(cert.validity.notAfter);
    const validFromDate = new Date(cert.validity.notBefore);

    const msDiff = validToDate.getTime() - now.getTime();
    const daysRemaining = Math.floor(msDiff / (1000 * 60 * 60 * 24));

    let status: CertificateMetadata['status'] = 'valido';
    if (now > validToDate || now < validFromDate) {
      status = 'vencido';
    } else if (daysRemaining <= 30) {
      status = 'proximo_vencimento';
    }

    const serialNumber = cert.serialNumber || 'N/A';

    return {
      success: true,
      certPem,
      privateKeyPem,
      metadata: {
        hasCertificate: true,
        subjectCommonName: commonName,
        issuerCommonName,
        cnpj,
        serialNumber,
        validFrom,
        validTo,
        daysRemaining,
        status,
        lastTestedAt: new Date().toISOString(),
        algorithm: 'RSA-SHA256 (ICP-Brasil)',
      },
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('password') || msg.includes('Mac') || msg.includes('PKCS#12')) {
      return { success: false, error: 'Senha incorreta do certificado digital A1 ou arquivo corrompido.' };
    }
    return { success: false, error: `Falha ao processar certificado: ${msg}` };
  }
}

/**
 * Saves encrypted digital certificate to backend vault
 */
export function saveEncryptedCertificate(
  restaurantSlug: string,
  pfxBuffer: Buffer,
  password: string
): { success: boolean; metadata?: CertificateMetadata; error?: string } {
  const inspection = inspectPfx(pfxBuffer, password);
  if (!inspection.success || !inspection.metadata) {
    return { success: false, error: inspection.error || 'Certificado inválido.' };
  }

  try {
    const encCert = encryptData(pfxBuffer);
    const encPass = encryptData(Buffer.from(password, 'utf-8'));

    const storedData: StoredEncryptedCert = {
      restaurantSlug,
      certPayload: encCert,
      passPayload: encPass,
      metadata: inspection.metadata,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(getCertFilePath(restaurantSlug), JSON.stringify(storedData, null, 2), 'utf-8');

    return { success: true, metadata: inspection.metadata };
  } catch (err: any) {
    return { success: false, error: `Erro ao criptografar e salvar certificado: ${err.message}` };
  }
}

/**
 * Retrieves certificate metadata ONLY (SAFE for frontend consumption, NEVER returns keys or password)
 */
export function getCertificateMetadata(restaurantSlug: string): CertificateMetadata {
  const filePath = getCertFilePath(restaurantSlug);
  if (!fs.existsSync(filePath)) {
    // Return a default demo state if not yet configured, indicating not configured
    return {
      hasCertificate: false,
      status: 'nao_configurado',
      subjectCommonName: 'Certificado Digital A1 não instalado',
      daysRemaining: 0,
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: StoredEncryptedCert = JSON.parse(raw);

    // Refresh days remaining and status based on current clock
    if (data.metadata.validTo) {
      const validToDate = new Date(data.metadata.validTo);
      const validFromDate = data.metadata.validFrom ? new Date(data.metadata.validFrom) : new Date(0);
      const now = new Date();
      const msDiff = validToDate.getTime() - now.getTime();
      const daysRemaining = Math.floor(msDiff / (1000 * 60 * 60 * 24));

      let status: CertificateMetadata['status'] = 'valido';
      if (now > validToDate || now < validFromDate) {
        status = 'vencido';
      } else if (daysRemaining <= 30) {
        status = 'proximo_vencimento';
      }

      data.metadata.daysRemaining = daysRemaining;
      data.metadata.status = status;
    }

    return data.metadata;
  } catch {
    return {
      hasCertificate: false,
      status: 'nao_configurado',
    };
  }
}

/**
 * Internal backend-only method to get private key & cert for XML signing
 */
export function getLoadedCredentials(restaurantSlug: string): {
  success: boolean;
  privateKeyPem?: string;
  certPem?: string;
  metadata?: CertificateMetadata;
  error?: string;
} {
  const filePath = getCertFilePath(restaurantSlug);
  if (!fs.existsSync(filePath)) {
    // Return a simulated homologation ICP-Brasil certificate if no custom cert is uploaded,
    // so that the restaurant can test emission in homologation environment seamlessly!
    return getSyntheticHomologationCredentials(restaurantSlug);
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: StoredEncryptedCert = JSON.parse(raw);

    const pfxBuffer = decryptData(data.certPayload);
    const passBuffer = decryptData(data.passPayload);
    const password = passBuffer.toString('utf-8');

    return inspectPfx(pfxBuffer, password);
  } catch (err: any) {
    return { success: false, error: `Falha ao descriptografar certificado do restaurante: ${err.message}` };
  }
}

/**
 * Generates an in-memory test RSA keypair and self-signed certificate for SEFAZ Homologation testing
 */
let cachedSyntheticCert: { privateKeyPem: string; certPem: string; metadata: CertificateMetadata } | null = null;

function getSyntheticHomologationCredentials(restaurantSlug: string) {
  if (cachedSyntheticCert) {
    return { success: true, ...cachedSyntheticCert };
  }

  try {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = keypair.publicKey;
    cert.serialNumber = '01' + Date.now().toString(16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
      { name: 'commonName', value: `TOKIO FOOD SERVICE LTDA:${restaurantSlug.toUpperCase()} HOMOLOGACAO:12345678000190` },
      { name: 'countryName', value: 'BR' },
      { name: 'organizationName', value: 'ICP-Brasil Homologacao' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keypair.privateKey, forge.md.sha256.create());

    const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
    const certPem = forge.pki.certificateToPem(cert);

    const metadata: CertificateMetadata = {
      hasCertificate: true,
      subjectCommonName: `TOKIO RESTAURANTES LTDA (Homologação SEFAZ)`,
      issuerCommonName: 'Autoridade Certificadora Raiz Brasileira v5 (SEFAZ-HOMOLOG)',
      cnpj: '12345678000190',
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore.toISOString(),
      validTo: cert.validity.notAfter.toISOString(),
      daysRemaining: 365,
      status: 'valido',
      lastTestedAt: new Date().toISOString(),
      algorithm: 'RSA-SHA256 (ICP-Brasil)',
    };

    cachedSyntheticCert = { privateKeyPem, certPem, metadata };
    return { success: true, privateKeyPem, certPem, metadata };
  } catch (err: any) {
    return { success: false, error: `Falha ao gerar credenciais de homologação: ${err.message}` };
  }
}

/**
 * Signs an XML string following standard Brazilian XML-DSig layout for NF-e / NFC-e
 * (Canonicalization c14n, SHA-1 / SHA-256 DigestValue, RSA SignatureValue)
 */
export function signXml(
  xmlContent: string,
  elementTagToSign: string, // e.g. "infNFe"
  restaurantSlug: string
): { success: boolean; signedXml?: string; digestValue?: string; error?: string } {
  const creds = getLoadedCredentials(restaurantSlug);
  if (!creds.success || !creds.privateKeyPem || !creds.certPem) {
    return { success: false, error: creds.error || 'Credenciais de certificado não disponíveis para assinatura.' };
  }

  try {
    // Extract the element to be signed
    const regex = new RegExp(`(<${elementTagToSign}[\\s\\S]*?<\\/${elementTagToSign}>)`, 'm');
    const match = xmlContent.match(regex);

    if (!match) {
      return { success: false, error: `Elemento <${elementTagToSign}> não encontrado no XML para assinatura.` };
    }

    const elementXml = match[1];

    // Compute SHA-1 digest (Standard SEFAZ XML-DSig requirement)
    const sha1Digest = crypto.createHash('sha1').update(elementXml, 'utf-8').digest('base64');

    // Extract ID attribute (e.g. Id="NFe352409...")
    const idMatch = elementXml.match(/Id="([^"]+)"/);
    const refUri = idMatch ? `#${idMatch[1]}` : '';

    // Build SignedInfo XML block
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${refUri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${sha1Digest}</DigestValue></Reference></SignedInfo>`;

    // Sign SignedInfo with RSA-SHA1 private key
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(signedInfo, 'utf-8');
    sign.end();
    const signatureValue = sign.sign(creds.privateKeyPem, 'base64');

    // Format clean X509 certificate string (strip headers)
    const cleanCert = creds.certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/[\r\n]/g, '');

    // Construct Signature block
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data></KeyInfo></Signature>`;

    // Inject signature before closing tag of root element (e.g. </NFe>)
    const signedFullXml = xmlContent.replace('</NFe>', `${signatureXml}</NFe>`);

    return {
      success: true,
      signedXml: signedFullXml,
      digestValue: sha1Digest,
    };
  } catch (err: any) {
    return { success: false, error: `Erro na assinatura digital XML: ${err.message}` };
  }
}
