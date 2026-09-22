import crypto from 'crypto';
import {
  FiscalDocument,
  FiscalEnvironment,
  RestaurantFiscalConfig,
} from './types';
import { signXml } from './certificateService';

// IBGE UF Codes
export const UF_IBGE_MAP: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

/**
 * IMPORTANTE (integridade fiscal):
 * Este módulo NÃO possui integração real com os web services da SEFAZ (SOAP + mTLS).
 * As respostas abaixo são SIMULAÇÕES e só podem ser usadas em HOMOLOGAÇÃO.
 * Em PRODUÇÃO nenhum documento é "autorizado" de mentira: a operação é recusada
 * com mensagem clara até que uma integração real (ou provedor fiscal) seja ligada.
 */
export const SEFAZ_REAL_INTEGRATION_AVAILABLE = false;

const PRODUCTION_BLOCK_MESSAGE =
  'Integração real com a SEFAZ não está configurada. Em produção o sistema não simula autorização fiscal. ' +
  'Use o ambiente de homologação para testes ou conecte um provedor fiscal.';

function isProduction(ambiente: FiscalEnvironment | string | undefined): boolean {
  return ambiente === 'producao';
}

// Official SEFAZ Portal QR Code Base URLs per UF (Homologação e Produção)
export const SEFAZ_QRCODE_URLS: Record<string, { homologacao: string; producao: string }> = {
  SP: {
    homologacao: 'https://homologacao.nfce.fazenda.sp.gov.br/qrcode',
    producao: 'https://nfce.fazenda.sp.gov.br/qrcode',
  },
  RJ: {
    homologacao: 'http://homologacao.fazenda.rj.gov.br/nfe/consulta',
    producao: 'http://www.fazenda.rj.gov.br/nfe/consulta',
  },
  MG: {
    homologacao: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    producao: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
  },
  PR: {
    homologacao: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
    producao: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
  },
  RS: {
    homologacao: 'https://dfe-portal.svrs.rs.gov.br/nfce/qrcode',
    producao: 'https://dfe-portal.svrs.rs.gov.br/nfce/qrcode',
  },
  SC: {
    homologacao: 'https://sat.sef.sc.gov.br/nfce/consulta',
    producao: 'https://sat.sef.sc.gov.br/nfce/consulta',
  },
};

/**
 * Calculates Module 11 check digit for 43-digit numeric string
 */
export function calculateModulo11(digits: string): number {
  let sum = 0;
  let weight = 2;

  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const dv = 11 - remainder;
  return dv === 0 || dv === 10 || dv === 11 ? 0 : dv;
}

/**
 * Generates official 44-digit Chave de Acesso for Brazilian NF-e / NFC-e:
 * cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
 */
export function generateChaveAcesso(params: {
  uf: string;
  dataEmissao: Date;
  cnpj: string;
  modelo: string; // '65' para NFC-e, '55' para NF-e
  serie: number;
  numero: number;
  tpEmis: number; // 1: Normal, 9: Contingência Offline NFC-e
  cNF?: string; // Código numérico aleatório de 8 dígitos
}): { chave: string; cDV: number; cNF: string } {
  const cUF = UF_IBGE_MAP[params.uf.toUpperCase()] || '35'; // Default SP (35)
  const ano = String(params.dataEmissao.getFullYear()).slice(-2);
  const mes = String(params.dataEmissao.getMonth() + 1).padStart(2, '0');
  const aamm = `${ano}${mes}`;
  const cleanCnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod = params.modelo.padStart(2, '0');
  const serie = String(params.serie).padStart(3, '0');
  const nNF = String(params.numero).padStart(9, '0');
  const tpEmis = String(params.tpEmis);

  // Generate 8-digit random code or preserve provided
  const cNF = params.cNF || String(Math.floor(10000000 + Math.random() * 90000000));

  const base43 = `${cUF}${aamm}${cleanCnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const cDV = calculateModulo11(base43);
  const chave = `${base43}${cDV}`;

  return { chave, cDV, cNF };
}

/**
 * Generates official NFC-e QR Code URL according to SEFAZ Technical Note v2.0
 */
export function generateNfceQrCodeUrl(params: {
  chaveAcesso: string;
  ambiente: FiscalEnvironment;
  uf: string;
  cscId?: string;
  cscToken?: string;
  digestValue?: string;
}): string {
  const ufUrls = SEFAZ_QRCODE_URLS[params.uf.toUpperCase()] || SEFAZ_QRCODE_URLS['SP'];
  const baseUrl = params.ambiente === 'producao' ? ufUrls.producao : ufUrls.homologacao;

  const versaoQr = '2';
  const tpAmb = params.ambiente === 'producao' ? '1' : '2';
  const cIdToken = (params.cscId || '000001').padStart(6, '0');
  const csc = params.cscToken || 'SEFAZ_CSC_HOMOLOGACAO_TOKIO_KEY';

  // String to hash for QR code: chNFe|versaoQr|tpAmb|cIdToken + CSC
  const stringToHash = `${params.chaveAcesso}|${versaoQr}|${tpAmb}|${parseInt(cIdToken, 10)}${csc}`;
  const sha1Hex = crypto.createHash('sha1').update(stringToHash, 'utf-8').digest('hex');

  return `${baseUrl}?p=${params.chaveAcesso}|${versaoQr}|${tpAmb}|${parseInt(cIdToken, 10)}|${sha1Hex}`;
}

/**
 * Builds compliant NFe XML (Layout 4.00)
 */
export function buildNfeXml(
  doc: FiscalDocument,
  config: RestaurantFiscalConfig,
  cNF: string,
  cDV: number,
  isContingencia = false
): string {
  const cUF = UF_IBGE_MAP[config.uf.toUpperCase()] || '35';
  const modelo = doc.documentType === 'nfce' ? '65' : '55';
  const tpAmb = doc.ambiente === 'producao' ? '1' : '2';
  const tpEmis = isContingencia ? '9' : '1'; // 1: Normal, 9: Contingencia Offline NFC-e
  const dhEmi = new Date(doc.dataEmissao).toISOString().replace(/\.\d{3}Z$/, '-03:00');

  // CRT: 1 = Simples Nacional, 3 = Regime Normal
  const crt = config.regimeTributario.startsWith('simples') ? '1' : '3';

  // Construct items XML
  const itemsXml = doc.items
    .map((item, index) => {
      const nItem = index + 1;
      const cProd = String(item.itemId || (item as any).id || `PROD-${nItem}`).slice(0, 20);
      const xProd = String(item.itemName || (item as any).name || 'ITEM GASTRONOMICO').replace(/[&<>'"]/g, '');
      const ncm = (item.ncm || '21069090').replace(/\D/g, '');
      const cfop = item.cfop || '5102';
      const uCom = item.isService ? 'SV' : 'UN';
      const qCom = item.quantity.toFixed(4);
      const vUnCom = item.unitPrice.toFixed(4);
      const vProd = item.totalPrice.toFixed(2);

      let icmsBlock = '';
      if (crt === '1') {
        const csosn = item.csosn || '102';
        icmsBlock = `<ICMSSN102><orig>${item.origem}</orig><CSOSN>${csosn}</CSOSN></ICMSSN102>`;
        if (csosn === '500') {
          icmsBlock = `<ICMSSN500><orig>${item.origem}</orig><CSOSN>500</CSOSN><vBCSTRet>0.00</vBCSTRet><vICMSSTRet>0.00</vICMSSTRet></ICMSSN500>`;
        }
      } else {
        const cst = item.cst || '00';
        icmsBlock = `<ICMS00><orig>${item.origem}</orig><CST>${cst}</CST><modBC>3</modBC><vBC>${item.baseCalculoIcms.toFixed(2)}</vBC><pICMS>${item.aliquotaIcms.toFixed(2)}</pICMS><vICMS>${item.valorIcms.toFixed(2)}</vICMS></ICMS00>`;
      }

      const cestTag = item.cest ? `<CEST>${item.cest.replace(/\D/g, '')}</CEST>` : '';

      return `
    <det nItem="${nItem}">
      <prod>
        <cProd>${cProd}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${xProd}</xProd>
        <NCM>${ncm}</NCM>
        ${cestTag}
        <CFOP>${cfop}</CFOP>
        <uCom>${uCom}</uCom>
        <qCom>${qCom}</qCom>
        <vUnCom>${vUnCom}</vUnCom>
        <vProd>${vProd}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${uCom}</uTrib>
        <qTrib>${qCom}</qTrib>
        <vUnTrib>${vUnCom}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${item.totalTributosAproximados.toFixed(2)}</vTotTrib>
        <ICMS>${icmsBlock}</ICMS>
        <PIS><PISOutr><CST>99</CST><vBC>${item.baseCalculoPis.toFixed(2)}</vBC><pPIS>${item.aliquotaPis.toFixed(2)}</pPIS><vPIS>${item.valorPis.toFixed(2)}</vPIS></PISOutr></PIS>
        <COFINS><COFINSOutr><CST>99</CST><vBC>${item.baseCalculoCofins.toFixed(2)}</vBC><pCOFINS>${item.aliquotaCofins.toFixed(2)}</pCOFINS><vCOFINS>${item.valorCofins.toFixed(2)}</vCOFINS></COFINSOutr></COFINS>
      </imposto>
    </det>`;
    })
    .join('');

  // Payment mapping (NFC-e layout: 01: Dinheiro, 02: Cheque, 03: Cartão de Crédito, 04: Cartão de Débito, 17: PIX)
  let tPag = '01';
  const payLower = (doc.formaPagamento || '').toLowerCase();
  if (payLower.includes('pix')) tPag = '17';
  else if (payLower.includes('debito') || payLower.includes('débito')) tPag = '04';
  else if (payLower.includes('credito') || payLower.includes('crédito') || payLower.includes('card')) tPag = '03';

  // Customer block (dest)
  let destXml = '';
  if (doc.customerCpfCnpj) {
    const cleanDoc = doc.customerCpfCnpj.replace(/\D/g, '');
    const tag = cleanDoc.length === 14 ? 'CNPJ' : 'CPF';
    const cleanName = (doc.customerName || 'CONSUMIDOR FINAL').replace(/[&<>'"]/g, '');
    destXml = `
    <dest>
      <${tag}>${cleanDoc}</${tag}>
      <xNome>${cleanName}</xNome>
      <indIEDest>9</indIEDest>
    </dest>`;
  }

  // Contingency tags
  let contingenciaXml = '';
  if (isContingencia) {
    const dhCont = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
    contingenciaXml = `
      <dhCont>${dhCont}</dhCont>
      <xJust>${(doc.contingenciaJustificativa || 'FALHA TEMPORARIA DE TRANSMISSAO COM SEFAZ').slice(0, 256)}</xJust>`;
  }

  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${doc.accessKey}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>VENDA DE MERCADORIAS AO CONSUMIDOR</natOp>
      <mod>${modelo}</mod>
      <serie>${doc.series}</serie>
      <nNF>${doc.documentNumber}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${config.codigoMunicipioIbge || '3550308'}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>${tpEmis}</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>TokioFiscal_v2026.1</verProc>
      ${contingenciaXml}
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${config.razaoSocial.replace(/[&<>'"]/g, '')}</xNome>
      <xFant>${config.nomeFantasia.replace(/[&<>'"]/g, '')}</xFant>
      <enderEmit>
        <xLgr>${config.logradouro.replace(/[&<>'"]/g, '')}</xLgr>
        <nro>${config.numero}</nro>
        <xBairro>${config.bairro.replace(/[&<>'"]/g, '')}</xBairro>
        <cMun>${config.codigoMunicipioIbge || '3550308'}</cMun>
        <xMun>${config.municipio.replace(/[&<>'"]/g, '')}</xMun>
        <UF>${config.uf}</UF>
        <CEP>${config.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>${config.inscricaoEstadual.replace(/\D/g, '')}</IE>
      <CRT>${crt}</CRT>
    </emit>
    ${destXml}
    ${itemsXml}
    <total>
      <ICMSTot>
        <vBC>${doc.items.reduce((s, it) => s + it.baseCalculoIcms, 0).toFixed(2)}</vBC>
        <vICMS>${doc.totalIcms.toFixed(2)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFFem>0.00</vICMSUFFem>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${doc.subtotal.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${doc.descontos.toFixed(2)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${doc.totalPis.toFixed(2)}</vPIS>
        <vCOFINS>${doc.totalCofins.toFixed(2)}</vCOFINS>
        <vOutro>${doc.acrescimos.toFixed(2)}</vOutro>
        <vNF>${doc.total.toFixed(2)}</vNF>
        <vTotTrib>${doc.totalTributosAproximados.toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>${tPag}</tPag>
        <vPag>${doc.total.toFixed(2)}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>Trib aprox R$: ${doc.items.reduce((s, it) => s + it.tributosAproximadosFederais, 0).toFixed(2)} Fed, R$: ${doc.items.reduce((s, it) => s + it.tributosAproximadosEstaduais, 0).toFixed(2)} Est. Fonte: IBPT. Pedido #${doc.orderShortCode}. Sistema Tokio Food Service.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

  return rawXml;
}

/**
 * Checks connection status with SEFAZ / municipal authority
 */
export async function testSefazConnection(
  uf: string,
  ambiente: FiscalEnvironment
): Promise<{
  online: boolean;
  cStat: number;
  xMotivo: string;
  tempoRespostaMs: number;
  tpAmb: string;
  uf: string;
  autorizador: string;
  versaoAplicativo: string;
}> {
  const startTime = Date.now();
  if (isProduction(ambiente) && !SEFAZ_REAL_INTEGRATION_AVAILABLE) {
    return {
      online: false,
      cStat: 0,
      xMotivo: PRODUCTION_BLOCK_MESSAGE,
      tempoRespostaMs: 0,
      tpAmb: '1 (Produção)',
      uf: uf.toUpperCase(),
      autorizador: `SEFAZ-${uf.toUpperCase()}`,
      versaoAplicativo: 'SIMULACAO',
    };
  }
  // [SIMULAÇÃO - HOMOLOGAÇÃO] latência do web service
  await new Promise((r) => setTimeout(r, 140));
  const tempoRespostaMs = Date.now() - startTime;

  return {
    online: true,
    cStat: 107,
    xMotivo: '[SIMULADO] Serviço em Operação (homologação)',
    tempoRespostaMs,
    tpAmb: ambiente === 'producao' ? '1 (Produção)' : '2 (Homologação)',
    uf: uf.toUpperCase(),
    autorizador: `SEFAZ-${uf.toUpperCase()}`,
    versaoAplicativo: 'SP_NFCe_PL_009_V4',
  };
}

/**
 * Sends signed XML to SEFAZ Authorizer
 */
export async function transmitToSefaz(
  signedXml: string,
  doc: FiscalDocument,
  config: RestaurantFiscalConfig,
  forceOfflineContingency = false
): Promise<{
  success: boolean;
  status: 'autorizado' | 'rejeitado' | 'contingencia' | 'erro_comunicacao';
  protocolo?: string;
  codigoStatusSefaz: number;
  motivoStatus: string;
  xmlAutorizado?: string;
}> {
  if (isProduction(doc.ambiente) && !SEFAZ_REAL_INTEGRATION_AVAILABLE) {
    return {
      success: false,
      status: 'erro_comunicacao',
      codigoStatusSefaz: 0,
      motivoStatus: PRODUCTION_BLOCK_MESSAGE,
    };
  }

  if (forceOfflineContingency) {
    return {
      success: true,
      status: 'contingencia',
      codigoStatusSefaz: 999,
      motivoStatus: 'Emissão em Contingência Offline autorizada legalmente (Aguardando transmissão SEFAZ)',
    };
  }

  // Verification of basic SEFAZ validation rules
  if (!config.cnpj || config.cnpj.replace(/\D/g, '').length !== 14) {
    return {
      success: false,
      status: 'rejeitado',
      codigoStatusSefaz: 207,
      motivoStatus: 'Rejeição 207: CNPJ do emitente inválido',
    };
  }

  if (!config.inscricaoEstadual) {
    return {
      success: false,
      status: 'rejeitado',
      codigoStatusSefaz: 209,
      motivoStatus: 'Rejeição 209: Inscrição Estadual do emitente inválida',
    };
  }

  // Realistic SEFAZ Authorization simulation with authentic Protocol structure
  const nProt = `1${UF_IBGE_MAP[config.uf.toUpperCase()] || '35'}${String(Date.now()).slice(-10)}`;
  const dhRecbto = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');

  // Enclose in nfeProc (Standard SEFAZ distribution XML)
  const xmlAutorizado = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${signedXml}<protNFe versao="4.00"><infProt><tpAmb>${doc.ambiente === 'producao' ? '1' : '2'}</tpAmb><verAplic>SP_NFCe_PL_009_V4</verAplic><chNFe>${doc.accessKey}</chNFe><dhRecbto>${dhRecbto}</dhRecbto><nProt>${nProt}</nProt><digVal>${crypto.createHash('sha1').update(signedXml).digest('base64')}</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;

  return {
    success: true,
    status: 'autorizado',
    protocolo: nProt,
    codigoStatusSefaz: 100,
    motivoStatus: '[SIMULADO - HOMOLOGAÇÃO] Autorizado o uso da NF-e',
    xmlAutorizado,
  };
}

/**
 * Cancels an authorized fiscal document at SEFAZ within the legal cancellation period
 */
export async function cancelSefazDocument(params: {
  accessKey: string;
  protocoloAutorizacao: string;
  justificativa: string;
  config: RestaurantFiscalConfig;
  usuario: string;
}): Promise<{
  success: boolean;
  protocoloEvento?: string;
  codigoSefaz: number;
  respostaSefaz: string;
  error?: string;
}> {
  if (isProduction(params.config.ambiente) && !SEFAZ_REAL_INTEGRATION_AVAILABLE) {
    return { success: false, codigoSefaz: 0, respostaSefaz: PRODUCTION_BLOCK_MESSAGE, error: PRODUCTION_BLOCK_MESSAGE };
  }
  if (params.justificativa.trim().length < 15) {
    return {
      success: false,
      codigoSefaz: 494,
      respostaSefaz: 'Rejeição: Justificativa de cancelamento deve conter no mínimo 15 caracteres.',
      error: 'Justificativa de cancelamento deve conter no mínimo 15 caracteres.',
    };
  }

  const protocoloEvento = `135${String(Date.now()).slice(-10)}`;

  return {
    success: true,
    protocoloEvento,
    codigoSefaz: 135,
    respostaSefaz: '[SIMULADO - HOMOLOGAÇÃO] Evento registrado (cancelamento)',
  };
}

/**
 * Inutiliza faixa de numeração na SEFAZ (Ajuste SINIEF 07/05 - Quebra de sequência de numeração)
 */
export async function inutilizarNumeracaoSefaz(params: {
  config: RestaurantFiscalConfig;
  modelo: 65 | 55;
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
}): Promise<{
  success: boolean;
  protocolo?: string;
  codigoSefaz: number;
  respostaSefaz: string;
  xmlInutilizacao?: string;
  error?: string;
}> {
  if (isProduction(params.config.ambiente) && !SEFAZ_REAL_INTEGRATION_AVAILABLE) {
    return { success: false, codigoSefaz: 0, respostaSefaz: PRODUCTION_BLOCK_MESSAGE, error: PRODUCTION_BLOCK_MESSAGE };
  }
  if (params.justificativa.trim().length < 15) {
    return {
      success: false,
      codigoSefaz: 494,
      respostaSefaz: 'Rejeição: A justificativa de inutilização deve conter no mínimo 15 caracteres.',
      error: 'A justificativa de inutilização deve conter no mínimo 15 caracteres.',
    };
  }

  if (params.numeroFinal < params.numeroInicial) {
    return {
      success: false,
      codigoSefaz: 236,
      respostaSefaz: 'Rejeição 236: Número final menor que número inicial na faixa de inutilização.',
      error: 'Número final não pode ser menor que número inicial.',
    };
  }

  const ano = new Date().getFullYear().toString().slice(-2);
  const cnpjClean = params.config.cnpj.replace(/\D/g, '');
  const cUf = UF_IBGE_MAP[params.config.uf.toUpperCase()] || '35';
  const nProt = `1${cUf}${String(Date.now()).slice(-10)}`;
  const dhRecbto = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');

  const xmlInut = `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut Id="ID${cUf}${ano}${cnpjClean}${params.modelo}${String(params.serie).padStart(3, '0')}${String(params.numeroInicial).padStart(9, '0')}${String(params.numeroFinal).padStart(9, '0')}"><tpAmb>${params.config.ambiente === 'producao' ? '1' : '2'}</tpAmb><xServ>INUTILIZAR</xServ><cUF>${cUf}</cUF><ano>${ano}</ano><CNPJ>${cnpjClean}</CNPJ><mod>${params.modelo}</mod><serie>${params.serie}</serie><nNFIni>${params.numeroInicial}</nNFIni><nNFFin>${params.numeroFinal}</nNFFin><xJust>${params.justificativa.trim()}</xJust></infInut></inutNFe>`;

  return {
    success: true,
    protocolo: nProt,
    codigoSefaz: 102,
    respostaSefaz: '[SIMULADO - HOMOLOGAÇÃO] Inutilização registrada',
    xmlInutilizacao: `<retInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut><tpAmb>${params.config.ambiente === 'producao' ? '1' : '2'}</tpAmb><verAplic>SP_NFCe_PL_009_V4</verAplic><cStat>102</cStat><xMotivo>Inutilização de número homologada</xMotivo><cUF>${cUf}</cUF><ano>${ano}</ano><CNPJ>${cnpjClean}</CNPJ><mod>${params.modelo}</mod><serie>${params.serie}</serie><nNFIni>${params.numeroInicial}</nNFIni><nNFFin>${params.numeroFinal}</nNFFin><dhRecbto>${dhRecbto}</dhRecbto><nProt>${nProt}</nProt></infInut></retInutNFe>`,
  };
}
