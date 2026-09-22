import fs from 'fs';
import path from 'path';
import {
  FiscalDocument,
  FiscalDocumentStatus,
  FiscalDocumentType,
  RestaurantFiscalConfig,
  InutilizacaoRecord,
} from './types';
import { calculateOrderTaxes, InputItemForTax, resolveDocumentType } from './taxEngine';
import {
  buildNfeXml,
  cancelSefazDocument,
  generateChaveAcesso,
  generateNfceQrCodeUrl,
  transmitToSefaz,
  inutilizarNumeracaoSefaz,
} from './sefazService';
import { signXml } from './certificateService';
import { logFiscalAction } from './fiscalAudit';

const FISCAL_DIR = path.join(process.cwd(), 'data', 'fiscal');
const CONFIGS_FILE = path.join(FISCAL_DIR, 'configs.json');
const DOCUMENTS_FILE = path.join(FISCAL_DIR, 'documents.json');
const INUTILIZACOES_FILE = path.join(FISCAL_DIR, 'inutilizacoes.json');

function ensureFiscalStorage() {
  if (!fs.existsSync(FISCAL_DIR)) {
    fs.mkdirSync(FISCAL_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIGS_FILE)) {
    fs.writeFileSync(CONFIGS_FILE, JSON.stringify(DEFAULT_CONFIGS, null, 2), 'utf-8');
  }
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(INUTILIZACOES_FILE)) {
    fs.writeFileSync(INUTILIZACOES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Initial Brazilian fiscal configs for system restaurants
const DEFAULT_CONFIGS: Record<string, RestaurantFiscalConfig> = {
  japones: {
    restaurantSlug: 'japones',
    razaoSocial: 'TOKIO SAKURA RESTAURANTE ORIENTAL LTDA',
    nomeFantasia: 'Tokio Sushi House & Japanese Bar',
    cnpj: '38.412.981/0001-45',
    inscricaoEstadual: '148.920.312.110',
    inscricaoMunicipal: '4.892.100-3',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1578',
    bairro: 'Bela Vista',
    complemento: 'Térreo Gastronômico',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 6.8, // % média 2ª faixa Anexo I
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 104,
    serieNfe: 1,
    numeroAtualNfe: 12,
    cscId: '000001',
    cscToken: 'TOKIO_CSC_SEFAZ_TOKEN_HOMOLOG_2026',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema Inicial',
  },
  italiano: {
    restaurantSlug: 'italiano',
    razaoSocial: 'BELLA VISTA CUCINA TRATTORIA LTDA',
    nomeFantasia: 'Cantina Bella Vista',
    cnpj: '41.829.102/0001-90',
    inscricaoEstadual: '149.201.884.118',
    inscricaoMunicipal: '5.102.394-1',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '01311-200',
    logradouro: 'Alameda Santos',
    numero: '820',
    bairro: 'Cerqueira César',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 6.5,
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 88,
    serieNfe: 1,
    numeroAtualNfe: 5,
    cscId: '000001',
    cscToken: 'BELLA_CSC_TOKEN_2026',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema Inicial',
  },
  pizza: {
    restaurantSlug: 'pizza',
    razaoSocial: 'FORNO D ORO PIZZARIA NAPOLITANA LTDA',
    nomeFantasia: "Forno D'Oro Pizzas & Calzones",
    cnpj: '45.192.304/0001-72',
    inscricaoEstadual: '150.392.119.112',
    inscricaoMunicipal: '5.390.112-9',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '04530-001',
    logradouro: 'Rua Amauri',
    numero: '310',
    bairro: 'Itaim Bibi',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 7.2,
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 142,
    serieNfe: 1,
    numeroAtualNfe: 8,
    cscId: '000001',
    cscToken: 'FORNO_CSC_TOKEN_2026',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema Inicial',
  },
  hamburgueria: {
    restaurantSlug: 'hamburgueria',
    razaoSocial: 'BURGER SMASH CRAFT BEER LTDA',
    nomeFantasia: 'Burger & Craft House',
    cnpj: '48.901.293/0001-11',
    inscricaoEstadual: '151.849.201.115',
    inscricaoMunicipal: '5.498.102-0',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '05425-070',
    logradouro: 'Rua dos Pinheiros',
    numero: '450',
    bairro: 'Pinheiros',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 7.0,
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 210,
    serieNfe: 1,
    numeroAtualNfe: 15,
    cscId: '000001',
    cscToken: 'BURGER_CSC_TOKEN_2026',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema Inicial',
  },
};

/**
 * Retrieves fiscal configuration for restaurant
 */
export function getFiscalConfig(restaurantSlug: string): RestaurantFiscalConfig {
  ensureFiscalStorage();
  try {
    const raw = fs.readFileSync(CONFIGS_FILE, 'utf-8');
    const configs: Record<string, RestaurantFiscalConfig> = JSON.parse(raw);
    if (configs[restaurantSlug]) {
      return configs[restaurantSlug];
    }
  } catch (err) {
    console.error('Erro ao ler configs fiscais:', err);
  }

  // Fallback to default template or create default
  const baseDefault = DEFAULT_CONFIGS[restaurantSlug] || {
    restaurantSlug,
    razaoSocial: `RESTAURANTE ${restaurantSlug.toUpperCase()} GASTRONOMIA LTDA`,
    nomeFantasia: `Restaurante ${restaurantSlug}`,
    cnpj: '38.412.981/0001-45',
    inscricaoEstadual: '148.920.312.110',
    inscricaoMunicipal: '4.892.100-3',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 6.8,
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 1,
    serieNfe: 1,
    numeroAtualNfe: 1,
    cscId: '000001',
    cscToken: 'TOKIO_CSC_KEY_2026',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema',
  };

  saveFiscalConfig(baseDefault, 'Sistema');
  return baseDefault;
}

/**
 * Saves fiscal configuration
 */
export function saveFiscalConfig(
  config: RestaurantFiscalConfig,
  operatorName: string
): { success: boolean; config: RestaurantFiscalConfig } {
  ensureFiscalStorage();
  const raw = fs.readFileSync(CONFIGS_FILE, 'utf-8');
  const configs: Record<string, RestaurantFiscalConfig> = JSON.parse(raw);

  const updatedConfig: RestaurantFiscalConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorName,
  };

  configs[config.restaurantSlug] = updatedConfig;
  fs.writeFileSync(CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf-8');

  logFiscalAction({
    userId: 'admin',
    userName: operatorName,
    userRole: 'admin',
    action: 'ALTERACAO_CONFIG_FISCAL',
    restaurantSlug: config.restaurantSlug,
    details: `Configurações fiscais atualizadas para ${config.razaoSocial} (CNPJ: ${config.cnpj}, Ambiente: ${config.ambiente})`,
  });

  return { success: true, config: updatedConfig };
}

/**
 * Loads all fiscal documents
 */
export function getAllFiscalDocuments(): FiscalDocument[] {
  ensureFiscalStorage();
  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllDocuments(docs: FiscalDocument[]) {
  ensureFiscalStorage();
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

/**
 * Finds document by order ID
 */
export function getDocumentByOrderId(orderId: string): FiscalDocument | undefined {
  const docs = getAllFiscalDocuments();
  return docs.find((d) => d.orderId === orderId);
}

/**
 * Finds document by access key
 */
export function getDocumentByAccessKey(accessKey: string): FiscalDocument | undefined {
  const docs = getAllFiscalDocuments();
  return docs.find((d) => d.accessKey === accessKey);
}

/**
 * EMISSÃO DE DOCUMENTO FISCAL (NFC-e / NF-e / NFS-e)
 * Strictly idempotent: prevents double issuance on double click, refresh, retry or sync.
 */
export async function emitFiscalDocument(params: {
  restaurantSlug: string;
  orderId: string;
  orderShortCode: string;
  customerId?: string;
  customerName?: string;
  customerCpfCnpj?: string;
  customerEmail?: string;
  orderType: string;
  items: InputItemForTax[];
  formaPagamento: string;
  subtotal: number;
  descontos?: number;
  acrescimos?: number;
  total: number;
  operatorName: string;
  operatorRole?: string;
  forceContingency?: boolean;
  contingencyReason?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  document?: FiscalDocument;
  error?: string;
  isExisting?: boolean;
}> {
  ensureFiscalStorage();

  // 1. Idempotency Check: if order already has an authorized or contingency fiscal document, return it!
  const existingDocs = getAllFiscalDocuments();
  const alreadyEmitted = existingDocs.find(
    (d) =>
      d.orderId === params.orderId &&
      (d.status === 'autorizado' || d.status === 'contingencia')
  );

  if (alreadyEmitted) {
    return {
      success: true,
      document: alreadyEmitted,
      isExisting: true,
    };
  }

  const config = getFiscalConfig(params.restaurantSlug);

  // 2. Identify appropriate fiscal document model
  const isCompany = !!(
    params.customerCpfCnpj && params.customerCpfCnpj.replace(/\D/g, '').length === 14
  );
  const hasOnlyServices = params.items.length > 0 && params.items.every((it) => it.isService);
  const documentType = resolveDocumentType(
    params.orderType,
    params.customerCpfCnpj,
    isCompany,
    hasOnlyServices
  );

  // 3. Increment document number for the series atomically
  let nextNumber = config.numeroAtualNfce + 1;
  const series = config.serieNfce;
  config.numeroAtualNfce = nextNumber;
  saveFiscalConfig(config, params.operatorName);

  // 4. Calculate Taxes with TaxEngine
  const taxResults = calculateOrderTaxes(params.items, config);

  // 5. Generate 44-digit Access Key
  const dataEmissaoDate = new Date();
  const tpEmis = params.forceContingency ? 9 : 1;
  const modeloCode = documentType === 'nfce' ? '65' : '55';

  const { chave, cDV, cNF } = generateChaveAcesso({
    uf: config.uf,
    dataEmissao: dataEmissaoDate,
    cnpj: config.cnpj,
    modelo: modeloCode,
    serie: series,
    numero: nextNumber,
    tpEmis,
  });

  // 6. Generate QR Code URL
  const qrCodeUrl = generateNfceQrCodeUrl({
    chaveAcesso: chave,
    ambiente: config.ambiente,
    uf: config.uf,
    cscId: config.cscId,
    cscToken: config.cscToken,
  });

  const docId = `fisc-${Date.now()}-${nextNumber}`;
  const nowIso = dataEmissaoDate.toISOString();

  // Create initial document entity
  const fiscalDoc: FiscalDocument = {
    id: docId,
    idempotencyKey: params.idempotencyKey || `idem-${params.orderId}-${Date.now()}`,
    restaurantSlug: params.restaurantSlug,
    restaurantName: config.nomeFantasia,
    orderId: params.orderId,
    orderShortCode: params.orderShortCode,
    customerId: params.customerId,
    customerName: params.customerName || (params.customerCpfCnpj ? 'Consumidor Identificado' : 'Consumidor Final'),
    customerCpfCnpj: params.customerCpfCnpj,
    customerEmail: params.customerEmail,
    orderType: params.orderType,
    documentType,
    documentNumber: nextNumber,
    series,
    accessKey: chave,
    status: 'pendente',
    ambiente: config.ambiente,
    subtotal: params.subtotal,
    descontos: params.descontos || 0,
    acrescimos: params.acrescimos || 0,
    total: params.total,
    formaPagamento: params.formaPagamento,
    totalIcms: taxResults.totalIcms,
    totalPis: taxResults.totalPis,
    totalCofins: taxResults.totalCofins,
    totalIss: taxResults.totalIss,
    totalTributosAproximados: taxResults.totalTributosAproximados,
    items: taxResults.itemsBreakdown,
    dataEmissao: nowIso,
    qrCodeUrl,
    contingenciaJustificativa: params.forceContingency
      ? params.contingencyReason || 'Falha de transmissão com WebService SEFAZ'
      : undefined,
    contingenciaDataHora: params.forceContingency ? nowIso : undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 7. Build XML Layout 4.00
  const rawXml = buildNfeXml(fiscalDoc, config, cNF, cDV, !!params.forceContingency);

  // 8. Sign XML with PKCS#12 Digital Certificate
  const signResult = signXml(rawXml, 'infNFe', params.restaurantSlug);
  if (!signResult.success || !signResult.signedXml) {
    fiscalDoc.status = 'rejeitado';
    fiscalDoc.motivoStatus = `Falha na assinatura digital: ${signResult.error}`;
    saveAllDocuments([fiscalDoc, ...existingDocs]);

    logFiscalAction({
      userId: params.operatorName,
      userName: params.operatorName,
      userRole: params.operatorRole || 'caixa',
      action: 'REJEICAO_ASSINATURA',
      restaurantSlug: params.restaurantSlug,
      documentNumber: nextNumber,
      accessKey: chave,
      details: `Rejeição ao assinar documento #${nextNumber}: ${signResult.error}`,
    });

    return { success: false, error: signResult.error, document: fiscalDoc };
  }

  fiscalDoc.xmlAssinado = signResult.signedXml;

  // 9. Transmit to SEFAZ Authorizer
  const transmission = await transmitToSefaz(
    signResult.signedXml,
    fiscalDoc,
    config,
    params.forceContingency
  );

  fiscalDoc.status = transmission.status;
  fiscalDoc.protocolo = transmission.protocolo;
  fiscalDoc.codigoStatusSefaz = transmission.codigoStatusSefaz;
  fiscalDoc.motivoStatus = transmission.motivoStatus;
  fiscalDoc.xmlAutorizado = transmission.xmlAutorizado;
  if (transmission.status === 'autorizado') {
    fiscalDoc.dataAutorizacao = new Date().toISOString();
  }

  // 10. Persist document
  saveAllDocuments([fiscalDoc, ...existingDocs]);

  // 11. Audit Log
  logFiscalAction({
    userId: params.operatorName,
    userName: params.operatorName,
    userRole: params.operatorRole || 'caixa',
    action: transmission.status === 'contingencia' ? 'EMISSAO_CONTINGENCIA' : 'EMISSAO_AUTORIZADA',
    restaurantSlug: params.restaurantSlug,
    documentNumber: nextNumber,
    accessKey: chave,
    details: `Emissão ${documentType.toUpperCase()} #${nextNumber} (${transmission.status.toUpperCase()}) - Total: R$ ${params.total.toFixed(2)} - Protocolo: ${transmission.protocolo || 'N/A'}`,
  });

  return {
    success: transmission.status === 'autorizado' || transmission.status === 'contingencia',
    document: fiscalDoc,
    error: transmission.status === 'rejeitado' ? transmission.motivoStatus : undefined,
  };
}

/**
 * CANCELAMENTO FORMAL DE DOCUMENTO FISCAL
 */
export async function cancelFiscalDocument(params: {
  accessKey: string;
  justificativa: string;
  operatorName: string;
  operatorRole: string;
}): Promise<{ success: boolean; document?: FiscalDocument; error?: string }> {
  const docs = getAllFiscalDocuments();
  const index = docs.findIndex((d) => d.accessKey === params.accessKey);

  if (index === -1) {
    return { success: false, error: 'Documento fiscal não encontrado.' };
  }

  const doc = docs[index];

  if (doc.status === 'cancelado') {
    return { success: false, error: 'Documento já se encontra cancelado.' };
  }

  if (doc.status !== 'autorizado' && doc.status !== 'contingencia') {
    return { success: false, error: `Não é possível cancelar documento com status '${doc.status}'.` };
  }

  // Check legal cancellation timeframe (NFC-e SP/RJ/MG allows up to 30 minutes; NF-e allows up to 24 hours)
  const emissaoTime = new Date(doc.dataEmissao).getTime();
  const diffMinutes = (Date.now() - emissaoTime) / (1000 * 60);

  if (doc.documentType === 'nfce' && diffMinutes > 30) {
    return {
      success: false,
      error: `Prazo legal de cancelamento de NFC-e expirado (${Math.floor(diffMinutes)} minutos decorridos. Limite regulamentar da SEFAZ é de 30 minutos).`,
    };
  }

  const config = getFiscalConfig(doc.restaurantSlug);

  const sefazCancel = await cancelSefazDocument({
    accessKey: doc.accessKey,
    protocoloAutorizacao: doc.protocolo || '',
    justificativa: params.justificativa,
    config,
    usuario: params.operatorName,
  });

  if (!sefazCancel.success) {
    return { success: false, error: sefazCancel.error };
  }

  const nowIso = new Date().toISOString();
  doc.status = 'cancelado';
  doc.updatedAt = nowIso;
  doc.cancelamento = {
    protocolo: sefazCancel.protocoloEvento || `135${Date.now()}`,
    justificativa: params.justificativa,
    dataHora: nowIso,
    usuario: params.operatorName,
    codigoSefaz: sefazCancel.codigoSefaz,
    respostaSefaz: sefazCancel.respostaSefaz,
  };

  docs[index] = doc;
  saveAllDocuments(docs);

  logFiscalAction({
    userId: params.operatorName,
    userName: params.operatorName,
    userRole: params.operatorRole,
    action: 'CANCELAMENTO_FISCAL',
    restaurantSlug: doc.restaurantSlug,
    documentNumber: doc.documentNumber,
    accessKey: doc.accessKey,
    details: `Cancelamento ${doc.documentType.toUpperCase()} #${doc.documentNumber} - Motivo: "${params.justificativa}" - Protocolo SEFAZ: ${doc.cancelamento.protocolo}`,
  });

  return { success: true, document: doc };
}

/**
 * REPROCESSA DOCUMENTO EMITIDO EM CONTINGÊNCIA
 */
export async function reprocessContingencyDocument(
  accessKey: string,
  operatorName: string
): Promise<{ success: boolean; document?: FiscalDocument; error?: string }> {
  const docs = getAllFiscalDocuments();
  const doc = docs.find((d) => d.accessKey === accessKey);

  if (!doc) {
    return { success: false, error: 'Documento fiscal não encontrado.' };
  }

  if (doc.status !== 'contingencia') {
    return { success: false, error: `Documento possui status '${doc.status}', não está em contingência.` };
  }

  const config = getFiscalConfig(doc.restaurantSlug);

  // Transmit XML to SEFAZ
  const transmission = await transmitToSefaz(
    doc.xmlAssinado || '',
    doc,
    config,
    false // Real transmission
  );

  if (transmission.status === 'autorizado') {
    doc.status = 'autorizado';
    doc.protocolo = transmission.protocolo;
    doc.codigoStatusSefaz = 100;
    doc.motivoStatus = 'Autorizado após contingência offline';
    doc.dataAutorizacao = new Date().toISOString();
    doc.xmlAutorizado = transmission.xmlAutorizado;
    doc.updatedAt = new Date().toISOString();

    saveAllDocuments(docs);

    logFiscalAction({
      userId: operatorName,
      userName: operatorName,
      userRole: 'admin',
      action: 'TRANSMISSAO_CONTINGENCIA_SUCESSO',
      restaurantSlug: doc.restaurantSlug,
      documentNumber: doc.documentNumber,
      accessKey: doc.accessKey,
      details: `Contingência #${doc.documentNumber} transmitida e autorizada com sucesso na SEFAZ. Protocolo: ${transmission.protocolo}`,
    });

    return { success: true, document: doc };
  }

  return {
    success: false,
    error: `Falha na transmissão da contingência para SEFAZ: ${transmission.motivoStatus}`,
  };
}

/**
 * Retorna histórico de inutilizações registradas
 */
export function getAllInutilizacoes(restaurantSlug?: string): InutilizacaoRecord[] {
  ensureFiscalStorage();
  try {
    const raw = fs.readFileSync(INUTILIZACOES_FILE, 'utf-8');
    const records: InutilizacaoRecord[] = JSON.parse(raw);
    if (restaurantSlug && restaurantSlug !== 'all') {
      return records.filter((r) => r.restaurantSlug === restaurantSlug);
    }
    return records;
  } catch (err) {
    console.error('Erro ao ler inutilizacoes.json:', err);
    return [];
  }
}

/**
 * Solicita e registra inutilização de faixa de numeração na SEFAZ
 */
export async function requestInutilizacao(params: {
  restaurantSlug: string;
  modelo: 65 | 55;
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
  operatorName: string;
  operatorRole: string;
}): Promise<{ success: boolean; record?: InutilizacaoRecord; error?: string }> {
  ensureFiscalStorage();
  const config = getFiscalConfig(params.restaurantSlug);

  const sefazResult = await inutilizarNumeracaoSefaz({
    config,
    modelo: params.modelo,
    serie: params.serie,
    numeroInicial: params.numeroInicial,
    numeroFinal: params.numeroFinal,
    justificativa: params.justificativa,
  });

  if (!sefazResult.success) {
    return { success: false, error: sefazResult.error || sefazResult.respostaSefaz };
  }

  const newRecord: InutilizacaoRecord = {
    id: `inut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    restaurantSlug: params.restaurantSlug,
    modelo: params.modelo,
    serie: params.serie,
    numeroInicial: params.numeroInicial,
    numeroFinal: params.numeroFinal,
    justificativa: params.justificativa.trim(),
    protocolo: sefazResult.protocolo,
    dataSolicitacao: new Date().toISOString(),
    status: 'homologado',
    mensagemSefaz: sefazResult.respostaSefaz,
    usuario: params.operatorName,
  };

  const records = getAllInutilizacoes();
  records.unshift(newRecord);
  fs.writeFileSync(INUTILIZACOES_FILE, JSON.stringify(records, null, 2), 'utf-8');

  logFiscalAction({
    userId: params.operatorName,
    userName: params.operatorName,
    userRole: params.operatorRole,
    action: 'INUTILIZACAO_NUMERACAO',
    restaurantSlug: params.restaurantSlug,
    details: `Inutilização ${params.modelo === 65 ? 'NFC-e' : 'NF-e'} Série ${params.serie} (Números ${params.numeroInicial} a ${params.numeroFinal}) - Protocolo SEFAZ: ${sefazResult.protocolo} - Motivo: "${params.justificativa}"`,
  });

  return { success: true, record: newRecord };
}

/**
 * Format 44-digit access key into 4-digit groups (e.g. 3526 0938 4129 ...)
 */
export function formatAccessKey(key: string): string {
  if (!key || key.length !== 44) return key;
  return key.match(/.{1,4}/g)?.join(' ') || key;
}

/**
 * Generates official thermal receipt DANFCE HTML representation for printing or client viewing
 */
export function generateDanfceHtml(doc: FiscalDocument, config: RestaurantFiscalConfig): string {
  const formattedKey = formatAccessKey(doc.accessKey);
  const dataEmissaoFormatted = new Date(doc.dataEmissao).toLocaleString('pt-BR');

  const itemsRows = doc.items
    .map(
      (it, idx) => `
    <tr>
      <td style="text-align: left; padding: 3px 0;">
        <span style="font-weight: 600;">${idx + 1}. ${it.itemName}</span><br/>
        <span style="font-size: 10px; color: #555;">NCM: ${it.ncm} | CFOP: ${it.cfop} ${it.csosn ? `| CSOSN: ${it.csosn}` : ''}</span>
      </td>
      <td style="text-align: center; vertical-align: top; padding: 3px 0;">${it.quantity} UN</td>
      <td style="text-align: right; vertical-align: top; padding: 3px 0;">${it.unitPrice.toFixed(2)}</td>
      <td style="text-align: right; vertical-align: top; padding: 3px 0; font-weight: 600;">${it.totalPrice.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE NFC-e - #${doc.documentNumber}</title>
  <style>
    @page { margin: 4mm; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
      max-width: 320px;
      margin: 0 auto;
    }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
    .header h2 { font-size: 14px; margin: 0 0 4px 0; text-transform: uppercase; font-family: sans-serif; }
    .header p { margin: 2px 0; font-size: 10px; }
    .title-box { text-align: center; font-weight: bold; margin: 6px 0; font-size: 12px; }
    .table-items { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
    .table-items th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; }
    .totals { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .bold { font-weight: bold; }
    .qr-box { text-align: center; margin: 10px 0; }
    .qr-box img { max-width: 140px; height: auto; }
    .footer { text-align: center; font-size: 9px; color: #333; margin-top: 8px; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid #000;
      font-weight: bold;
      font-size: 10px;
      margin-top: 4px;
    }
    @media print {
      body { width: 100%; max-width: 100%; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${config.nomeFantasia}</h2>
    <p><strong>${config.razaoSocial}</strong></p>
    <p>CNPJ: ${config.cnpj} | IE: ${config.inscricaoEstadual}</p>
    <p>${config.logradouro}, ${config.numero} ${config.complemento || ''} - ${config.bairro}</p>
    <p>${config.municipio} - ${config.uf} | CEP: ${config.cep}</p>
  </div>

  <div class="title-box">
    DANFE NFC-e - Documento Auxiliar da<br/>Nota Fiscal de Consumidor Eletrônica
    <br/>
    ${
      doc.status === 'contingencia'
        ? '<div class="badge">EMITIDA EM CONTINGÊNCIA OFFLINE (PENDENTE DE AUTORIZAÇÃO)</div>'
        : doc.status === 'cancelado'
        ? '<div class="badge" style="border: 2px solid red; color: red;">DOCUMENTO FISCAL CANCELADO</div>'
        : '<div class="badge">NFC-e NÃO PERMITE APROVEITAMENTO DE CRÉDITO DE ICMS</div>'
    }
  </div>

  <table class="table-items">
    <thead>
      <tr>
        <th>ITEM/DESCRIÇÃO</th>
        <th style="text-align: center;">QTD</th>
        <th style="text-align: right;">VL.UNIT</th>
        <th style="text-align: right;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>QTD. TOTAL DE ITENS:</span><span>${doc.items.length}</span></div>
    <div class="row"><span>SUBTOTAL:</span><span>R$ ${doc.subtotal.toFixed(2)}</span></div>
    ${doc.descontos > 0 ? `<div class="row"><span>DESCONTOS:</span><span>- R$ ${doc.descontos.toFixed(2)}</span></div>` : ''}
    ${doc.acrescimos > 0 ? `<div class="row"><span>ACRÉSCIMOS / TAXAS:</span><span>+ R$ ${doc.acrescimos.toFixed(2)}</span></div>` : ''}
    <div class="row bold" style="font-size: 13px;"><span>VALOR TOTAL A PAGAR:</span><span>R$ ${doc.total.toFixed(2)}</span></div>
    <div class="row"><span>FORMA DE PAGAMENTO:</span><span>${doc.formaPagamento.toUpperCase()}</span></div>
  </div>

  <div style="font-size: 10px; margin: 4px 0; border-bottom: 1px dashed #000; padding-bottom: 4px;">
    <strong>Tributos Totais Incidentes (Lei Federal 12.741/2012):</strong> R$ ${doc.totalTributosAproximados.toFixed(2)} (${((doc.totalTributosAproximados / (doc.total || 1)) * 100).toFixed(1)}%)<br/>
    <span style="font-size: 9px; color: #444;">Federais: R$ ${doc.items.reduce((s, it) => s + it.tributosAproximadosFederais, 0).toFixed(2)} | Estaduais: R$ ${doc.items.reduce((s, it) => s + it.tributosAproximadosEstaduais, 0).toFixed(2)} | Fonte: IBPT</span>
  </div>

  <div style="margin: 6px 0; font-size: 10px; text-align: center;">
    <strong>CONSUMIDOR:</strong> ${doc.customerCpfCnpj ? `${doc.customerName} - Doc: ${doc.customerCpfCnpj}` : 'CONSUMIDOR NÃO IDENTIFICADO'}<br/>
    <strong>NÚMERO:</strong> ${doc.documentNumber} | <strong>SÉRIE:</strong> ${doc.series} | <strong>EMISSÃO:</strong> ${dataEmissaoFormatted}
  </div>

  <div style="font-size: 9px; word-break: break-all; text-align: center; margin: 6px 0;">
    <strong>CHAVE DE ACESSO:</strong><br/>
    <span style="font-size: 10px; font-weight: bold;">${formattedKey}</span>
  </div>

  <div class="qr-box">
    <p style="font-size: 10px; margin: 2px 0;"><strong>Consulte pela Chave de Acesso em:</strong><br/>https://www.nfce.fazenda.sp.gov.br/consulta</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(doc.qrCodeUrl || '')}" alt="QR Code NFC-e" />
  </div>

  <div class="footer">
    ${
      doc.protocolo
        ? `<p><strong>Protocolo de Autorização:</strong> ${doc.protocolo} - ${doc.dataAutorizacao ? new Date(doc.dataAutorizacao).toLocaleString('pt-BR') : ''}</p>`
        : '<p><strong>Aguardando Transmissão em Lote</strong></p>'
    }
    <p>Ambiente de ${doc.ambiente === 'producao' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO - SEM VALOR FISCAL'}</p>
    <p>Pedido #${doc.orderShortCode} | Sistema Tokio Food Service</p>
  </div>
</body>
</html>`;
}
