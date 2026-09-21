import { Router, Request, Response } from 'express';
import {
  authenticateStaff,
  requireRole,
} from '../authMiddleware';
import { getOrderForTracking } from '../orderService';
import {
  emitFiscalDocument,
  getAllFiscalDocuments,
  getFiscalConfig,
  saveFiscalConfig,
  cancelFiscalDocument,
  reprocessContingencyDocument,
  generateDanfceHtml,
  getDocumentByAccessKey,
  getDocumentByOrderId,
  formatAccessKey,
  getAllInutilizacoes,
  requestInutilizacao,
} from './documentService';
import {
  getCertificateMetadata,
  saveEncryptedCertificate,
} from './certificateService';
import { testSefazConnection } from './sefazService';
import { generateAccountantExport, runTaxSimulation } from './simulationService';
import { getFiscalAuditLogs } from './fiscalAudit';
import { FiscalEnvironment } from './types';

export const fiscalRouter = Router();

// ==========================================
// 1. CONFIGURAÇÃO FISCAL
// ==========================================

fiscalRouter.get(
  '/config/:restaurantSlug',
  authenticateStaff,
  (req: Request, res: Response) => {
    try {
      const config = getFiscalConfig(req.params.restaurantSlug);
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

fiscalRouter.post(
  '/config/:restaurantSlug',
  authenticateStaff,
  requireRole('super_admin', 'administrador'),
  (req: Request, res: Response) => {
    try {
      const operatorName = req.userSession?.name || 'Administrador';
      const configData = {
        ...req.body,
        restaurantSlug: req.params.restaurantSlug,
      };

      const result = saveFiscalConfig(configData, operatorName);
      res.json({ success: true, config: result.config });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 2. CERTIFICADO DIGITAL A1 (VAULT SEGURO)
// ==========================================

fiscalRouter.get(
  '/certificate/:restaurantSlug',
  authenticateStaff,
  (req: Request, res: Response) => {
    try {
      // SAFE: Only returns metadata (CN, validity, days remaining, status)
      // NEVER returns private key, cert bytes or password
      const metadata = getCertificateMetadata(req.params.restaurantSlug);
      res.json({ success: true, metadata });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

fiscalRouter.post(
  '/certificate/upload',
  authenticateStaff,
  requireRole('super_admin', 'administrador'),
  (req: Request, res: Response) => {
    try {
      const { restaurantSlug, pfxBase64, password } = req.body;

      if (!restaurantSlug || !pfxBase64 || !password) {
        return res.status(400).json({
          success: false,
          error: 'Restaurante, arquivo .PFX/.P12 e senha são obrigatórios.',
        });
      }

      const pfxBuffer = Buffer.from(pfxBase64, 'base64');
      const saved = saveEncryptedCertificate(restaurantSlug, pfxBuffer, password);

      if (!saved.success) {
        return res.status(400).json({ success: false, error: saved.error });
      }

      res.json({
        success: true,
        message: 'Certificado digital A1 criptografado e instalado com sucesso no servidor.',
        metadata: saved.metadata,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 3. STATUS DA SEFAZ & CONECTIVIDADE
// ==========================================

fiscalRouter.get('/sefaz-status', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const uf = (req.query.uf as string) || 'SP';
    const ambiente = (req.query.ambiente as FiscalEnvironment) || 'homologacao';

    const status = await testSefazConnection(uf, ambiente);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. EMISSÃO FISCAL NO CAIXA (IDEMPOTENTE)
// ==========================================

fiscalRouter.post(
  '/emit',
  authenticateStaff,
  requireRole('super_admin', 'administrador', 'caixa'),
  async (req: Request, res: Response) => {
    try {
      const operatorName = req.userSession?.name || 'Operador Caixa';
      const operatorRole = req.userSession?.role || 'caixa';

      const {
        restaurantSlug,
        orderId,
        orderShortCode,
        customerId,
        customerName,
        customerCpfCnpj,
        customerEmail,
        orderType,
        items,
        formaPagamento,
        subtotal,
        descontos,
        acrescimos,
        total,
        forceContingency,
        contingencyReason,
        idempotencyKey,
      } = req.body;

      if (!restaurantSlug || !orderId || !items || !total) {
        return res.status(400).json({
          success: false,
          error: 'Dados obrigatórios ausentes para emissão do documento fiscal.',
        });
      }

      const safeItems = (items || []).map((it: any, idx: number) => ({
        id: String(it.id || it.itemId || `it-${idx + 1}`),
        name: String(it.name || it.itemName || `Item #${idx + 1}`),
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || it.price || 0),
        totalPrice: Number(it.totalPrice || (it.quantity || 1) * (it.unitPrice || it.price || 0)),
        ncm: it.ncm,
        cest: it.cest,
        cfop: it.cfop,
        cst: it.cst,
        csosn: it.csosn,
        origem: it.origem !== undefined ? Number(it.origem) : 0,
        isService: !!it.isService,
      }));

      const emission = await emitFiscalDocument({
        restaurantSlug,
        orderId,
        orderShortCode: orderShortCode || (orderId ? String(orderId).slice(0, 4).toUpperCase() : '#PED'),
        customerId,
        customerName,
        customerCpfCnpj,
        customerEmail,
        orderType: orderType || 'mesa',
        items: safeItems,
        formaPagamento: formaPagamento || 'dinheiro',
        subtotal: Number(subtotal) || Number(total),
        descontos: Number(descontos) || 0,
        acrescimos: Number(acrescimos) || 0,
        total: Number(total),
        operatorName,
        operatorRole,
        forceContingency: !!forceContingency,
        contingencyReason,
        idempotencyKey,
      });

      if (!emission.success && emission.error) {
        return res.status(422).json({
          success: false,
          error: emission.error,
          document: emission.document,
        });
      }

      res.json({
        success: true,
        document: emission.document,
        isExisting: emission.isExisting,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 5. CONSULTA DE DOCUMENTOS FISCAIS
// ==========================================

fiscalRouter.get('/documents', authenticateStaff, (req: Request, res: Response) => {
  try {
    let docs = getAllFiscalDocuments();

    const {
      restaurantSlug,
      periodo,
      numero,
      serie,
      orderId,
      cliente,
      status,
      chave,
      tipo,
    } = req.query;

    if (restaurantSlug) {
      docs = docs.filter((d) => d.restaurantSlug === restaurantSlug);
    }
    if (numero) {
      docs = docs.filter((d) => String(d.documentNumber).includes(String(numero)));
    }
    if (serie) {
      docs = docs.filter((d) => String(d.series) === String(serie));
    }
    if (orderId) {
      docs = docs.filter(
        (d) => d.orderId === orderId || d.orderShortCode.toLowerCase() === String(orderId).toLowerCase()
      );
    }
    if (cliente) {
      const q = String(cliente).toLowerCase();
      docs = docs.filter(
        (d) =>
          (d.customerName && d.customerName.toLowerCase().includes(q)) ||
          (d.customerCpfCnpj && d.customerCpfCnpj.includes(q))
      );
    }
    if (status) {
      docs = docs.filter((d) => d.status === status);
    }
    if (chave) {
      docs = docs.filter((d) => d.accessKey.includes(String(chave).replace(/\s/g, '')));
    }
    if (tipo) {
      docs = docs.filter((d) => d.documentType === tipo);
    }

    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

fiscalRouter.get('/documents/:idOrKey', authenticateStaff, (req: Request, res: Response) => {
  try {
    const param = req.params.idOrKey;
    const doc =
      getDocumentByAccessKey(param) ||
      getDocumentByOrderId(param) ||
      getAllFiscalDocuments().find((d) => d.id === param);

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento fiscal não encontrado.' });
    }

    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download do XML da nota fiscal (acesso público para o consumidor portador da chave ou ID)
fiscalRouter.get('/documents/:idOrKey/xml', (req: Request, res: Response) => {
  try {
    const param = req.params.idOrKey;
    const doc = /^\d{44}$/.test(param) ? getDocumentByAccessKey(param) : undefined; // somente pela chave de acesso (44 dígitos)

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento fiscal não encontrado.' });
    }

    const xml = doc.xmlAutorizado || doc.xmlAssinado || '';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="NFCe_${doc.accessKey}.xml"`
    );
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Consulta pública de NFC-e do pedido (usado na tela de rastreamento do cliente)
fiscalRouter.get('/public-order/:orderId', (req: Request, res: Response) => {
  try {
    const param = req.params.orderId;
    const token = String(req.query.t || '');
    // Só quem tem o token secreto do pedido (recebido na criação) consulta o documento fiscal.
    const order = getOrderForTracking(param, token);
    if (!order) {
      return res.json({ success: true, hasFiscalDoc: false });
    }
    const doc = getDocumentByOrderId(order.id);
    if (!doc) {
      return res.json({ success: true, hasFiscalDoc: false });
    }

    const config = getFiscalConfig(doc.restaurantSlug);

    return res.json({
      success: true,
      hasFiscalDoc: true,
      document: {
        id: doc.id,
        accessKey: doc.accessKey,
        formattedAccessKey: formatAccessKey(doc.accessKey),
        type: doc.documentType,
        status: doc.status,
        number: doc.documentNumber,
        series: doc.series,
        protocol: doc.protocolo,
        issueDate: doc.dataEmissao,
        totalAmount: doc.total,
        approximateTaxesTotal: doc.totalTributosAproximados,
        // CPF/CNPJ e nome do consumidor NÃO são expostos por esta rota pública.
        danfceUrl: `/api/fiscal/documents/${doc.accessKey}/danfce`,
        xmlUrl: `/api/fiscal/documents/${doc.accessKey}/xml`,
        qrCodeUrl: doc.qrCodeUrl,
        restaurantName: config.nomeFantasia || config.razaoSocial,
        cnpj: config.cnpj,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

fiscalRouter.get('/documents/:idOrKey/danfce', (req: Request, res: Response) => {
  try {
    const param = req.params.idOrKey;
    const doc = /^\d{44}$/.test(param) ? getDocumentByAccessKey(param) : undefined; // somente pela chave de acesso (44 dígitos)

    if (!doc) {
      return res.status(404).send('Documento fiscal não encontrado.');
    }

    const config = getFiscalConfig(doc.restaurantSlug);
    const html = generateDanfceHtml(doc, config);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`Erro ao gerar DANFC-e: ${err.message}`);
  }
});

// ==========================================
// 6. CANCELAMENTO DE DOCUMENTO FISCAL
// ==========================================

fiscalRouter.post(
  '/documents/:accessKey/cancel',
  authenticateStaff,
  requireRole('super_admin', 'administrador'),
  async (req: Request, res: Response) => {
    try {
      const { justificativa } = req.body;
      const operatorName = req.userSession?.name || 'Administrador';
      const operatorRole = req.userSession?.role || 'admin';

      if (!justificativa || justificativa.trim().length < 15) {
        return res.status(400).json({
          success: false,
          error: 'Justificativa é obrigatória e deve possuir no mínimo 15 caracteres.',
        });
      }

      const result = await cancelFiscalDocument({
        accessKey: req.params.accessKey,
        justificativa,
        operatorName,
        operatorRole,
      });

      if (!result.success) {
        return res.status(422).json({ success: false, error: result.error });
      }

      res.json({ success: true, document: result.document });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 7. REPROCESSAMENTO DE CONTINGÊNCIA
// ==========================================

fiscalRouter.post(
  '/documents/:accessKey/reprocess',
  authenticateStaff,
  requireRole('super_admin', 'administrador'),
  async (req: Request, res: Response) => {
    try {
      const operatorName = req.userSession?.name || 'Administrador';
      const result = await reprocessContingencyDocument(req.params.accessKey, operatorName);

      if (!result.success) {
        return res.status(422).json({ success: false, error: result.error });
      }

      res.json({ success: true, document: result.document });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 8. SIMULADOR TRIBUTÁRIO & CENÁRIOS
// ==========================================

fiscalRouter.get(
  '/simulation/:restaurantSlug',
  authenticateStaff,
  (req: Request, res: Response) => {
    try {
      const periodo = (req.query.periodo as any) || 'mes';
      const simulation = runTaxSimulation(req.params.restaurantSlug, periodo);
      res.json({ success: true, simulation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 9. EXPORTAR PARA CONTADOR
// ==========================================

fiscalRouter.get(
  '/export-accountant/:restaurantSlug',
  authenticateStaff,
  (req: Request, res: Response) => {
    try {
      const exportData = generateAccountantExport(req.params.restaurantSlug);
      res.json({ success: true, exportData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 10. AUDITORIA FISCAL
// ==========================================

fiscalRouter.get(
  '/audit-logs',
  authenticateStaff,
  requireRole('super_admin', 'administrador'),
  (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const restaurantSlug = req.query.restaurantSlug as string | undefined;
      const logs = getFiscalAuditLogs(limit, restaurantSlug);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 11. INUTILIZAÇÃO DE NUMERAÇÃO SEFAZ (AJUSTE SINIEF 07/05)
// ==========================================

fiscalRouter.get(
  '/inutilizacoes/:restaurantSlug',
  authenticateStaff,
  (req: Request, res: Response) => {
    try {
      const records = getAllInutilizacoes(req.params.restaurantSlug);
      res.json({ success: true, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

fiscalRouter.post(
  '/inutilizacoes/:restaurantSlug',
  authenticateStaff,
  requireRole('super_admin', 'administrador', 'caixa'),
  async (req: Request, res: Response) => {
    try {
      const { modelo, serie, numeroInicial, numeroFinal, justificativa } = req.body;
      const operatorName = req.userSession?.name || 'Administrador Fiscal';
      const operatorRole = req.userSession?.role || 'administrador';

      const result = await requestInutilizacao({
        restaurantSlug: req.params.restaurantSlug,
        modelo: Number(modelo) as 65 | 55,
        serie: Number(serie),
        numeroInicial: Number(numeroInicial),
        numeroFinal: Number(numeroFinal),
        justificativa: String(justificativa || ''),
        operatorName,
        operatorRole,
      });

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true, record: result.record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
