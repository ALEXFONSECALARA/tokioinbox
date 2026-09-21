import React, { useState, useEffect } from 'react';
import { Order } from '../types/restaurant';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  X,
  ShieldCheck,
  RefreshCw,
  QrCode,
  DollarSign,
  Ban,
  Clock,
  Layers,
} from 'lucide-react';

interface AdminFiscalModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  restaurantSlug: string;
}

export const AdminFiscalModal: React.FC<AdminFiscalModalProps> = ({
  order,
  isOpen,
  onClose,
  restaurantSlug,
}) => {
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceContingency, setForceContingency] = useState(false);
  const [contingencyReason, setContingencyReason] = useState('Falha na comunicação com a SEFAZ autorizadora');
  const [existingDoc, setExistingDoc] = useState<any | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cancellation sub-flow
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelJustification, setCancelJustification] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (order && isOpen) {
      setCustomerName(order.customerName || '');
      setCpfCnpj(order.customerPhone ? '' : '');
      setResultMessage(null);
      setIsCancelling(false);
      setCancelJustification('');
      setCancelError(null);
      loadExistingDocument(order.id);
    }
  }, [order, isOpen]);

  const loadExistingDocument = async (orderId: string) => {
    setIsLoadingDoc(true);
    try {
      const token = localStorage.getItem('tokio_staff_token') || 'token-demo';
      const res = await fetch(`/api/fiscal/documents/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.document) {
        setExistingDoc(data.document);
      } else {
        setExistingDoc(null);
      }
    } catch {
      setExistingDoc(null);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  if (!isOpen || !order) return null;

  const handleEmit = async () => {
    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const token = localStorage.getItem('tokio_staff_token') || 'token-demo';

      // Map order items to fiscal items
      const items = order.items.map((item) => ({
        itemId: item.menuItemId || item.id,
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        isService: false,
      }));

      const payload = {
        restaurantSlug,
        orderId: order.id,
        orderShortCode: order.shortCode,
        customerName: customerName.trim() || undefined,
        customerCpfCnpj: cpfCnpj.trim() || undefined,
        orderType: order.orderType,
        items,
        formaPagamento: order.paymentMethod || 'dinheiro',
        subtotal: order.subtotal || order.total,
        descontos: order.discount || 0,
        acrescimos: (order.deliveryFee || 0) + (order.serviceFee || 0),
        total: order.total,
        forceContingency,
        contingencyReason: forceContingency ? contingencyReason : undefined,
        idempotencyKey: `idem-${order.id}`,
      };

      const res = await fetch('/api/fiscal/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setExistingDoc(data.document);
        setResultMessage({
          type: 'success',
          text: data.document.status === 'contingencia'
            ? 'NFC-e emitida legalmente em Contingência Offline!'
            : 'NFC-e autorizada com sucesso na SEFAZ!',
        });
      } else {
        setResultMessage({
          type: 'error',
          text: data.error || 'Falha na emissão da nota fiscal.',
        });
        if (data.document) {
          setExistingDoc(data.document);
        }
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Erro de conexão: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDocument = async () => {
    if (!existingDoc) return;
    if (cancelJustification.trim().length < 15) {
      setCancelError('Justificativa deve conter no mínimo 15 caracteres para atendimento às normas SEFAZ.');
      return;
    }

    setIsSubmitting(true);
    setCancelError(null);

    try {
      const token = localStorage.getItem('tokio_staff_token') || 'token-demo';
      const res = await fetch(`/api/fiscal/documents/${existingDoc.accessKey}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ justificativa: cancelJustification }),
      });

      const data = await res.json();

      if (data.success) {
        setExistingDoc(data.document);
        setIsCancelling(false);
        setResultMessage({
          type: 'success',
          text: 'Documento fiscal cancelado formalmente na SEFAZ com sucesso.',
        });
      } else {
        setCancelError(data.error || 'Erro ao cancelar na SEFAZ.');
      }
    } catch (err: any) {
      setCancelError(`Erro na solicitação: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintDanfce = () => {
    if (!existingDoc) return;
    const printWindow = window.open(`/api/fiscal/documents/${existingDoc.accessKey}/danfce`, '_blank', 'width=400,height=700');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleDownloadXml = () => {
    if (!existingDoc) return;
    window.open(`/api/fiscal/documents/${existingDoc.accessKey}/xml`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Emissão Fiscal (NFC-e / NF-e)
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Pedido #{order.shortCode}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Transmissão regulamentada à SEFAZ com assinatura digital A1
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {isLoadingDoc ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
              <p className="text-sm">Consultando registros fiscais do pedido...</p>
            </div>
          ) : existingDoc ? (
            /* Documento Já Emitido */
            <div className="space-y-6">
              <div
                className={`p-5 rounded-2xl border ${
                  existingDoc.status === 'autorizado'
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : existingDoc.status === 'contingencia'
                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                    : existingDoc.status === 'cancelado'
                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {existingDoc.status === 'autorizado' ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    ) : existingDoc.status === 'contingencia' ? (
                      <Clock className="w-7 h-7 text-amber-400" />
                    ) : existingDoc.status === 'cancelado' ? (
                      <Ban className="w-7 h-7 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-7 h-7 text-amber-400" />
                    )}
                    <div>
                      <h3 className="font-bold text-base uppercase">
                        {existingDoc.documentType.toUpperCase()} #{existingDoc.documentNumber} - Série {existingDoc.series}
                      </h3>
                      <p className="text-xs opacity-80">
                        Status:{' '}
                        <strong className="tracking-wide uppercase">
                          {existingDoc.status === 'contingencia'
                            ? 'Contingência Offline'
                            : existingDoc.status}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 bg-black/40 rounded-lg border border-white/10">
                    Ambiente: {existingDoc.ambiente.toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="opacity-70 block">Total da Nota</span>
                    <strong className="text-sm font-semibold">R$ {existingDoc.total.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">Protocolo SEFAZ</span>
                    <strong className="font-mono text-xs">{existingDoc.protocolo || 'Pendente Transmissão'}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">Tributos Aprox. (IBPT)</span>
                    <strong className="text-xs">R$ {existingDoc.totalTributosAproximados.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">Emissão</span>
                    <strong className="text-xs">
                      {new Date(existingDoc.dataEmissao).toLocaleTimeString('pt-BR')}
                    </strong>
                  </div>
                </div>

                <div className="mt-3 bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] font-mono break-all">
                  <span className="opacity-70 block mb-0.5">Chave de Acesso (44 dígitos):</span>
                  {existingDoc.accessKey}
                </div>

                {existingDoc.status === 'cancelado' && existingDoc.cancelamento && (
                  <div className="mt-3 p-3 bg-rose-900/40 rounded-xl border border-rose-500/30 text-rose-200 text-xs">
                    <p><strong>Cancelada em:</strong> {new Date(existingDoc.cancelamento.dataHora).toLocaleString('pt-BR')}</p>
                    <p><strong>Protocolo Cancelamento:</strong> {existingDoc.cancelamento.protocolo}</p>
                    <p><strong>Motivo:</strong> {existingDoc.cancelamento.justificativa}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons for Issued Document */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handlePrintDanfce}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir DANFE
                </button>

                <button
                  type="button"
                  onClick={handleDownloadXml}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-2 border border-slate-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Baixar XML SEFAZ
                </button>

                {existingDoc.status === 'autorizado' && !isCancelling && (
                  <button
                    type="button"
                    onClick={() => setIsCancelling(true)}
                    className="py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold rounded-2xl flex items-center justify-center gap-2 border border-rose-500/30 transition"
                  >
                    <Ban className="w-4 h-4" />
                    Cancelar NFC-e
                  </button>
                )}
              </div>

              {/* Sub-form de Cancelamento */}
              {isCancelling && (
                <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-3">
                  <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Cancelamento de Documento Fiscal (SEFAZ)
                  </h4>
                  <p className="text-xs text-slate-300">
                    O cancelamento de NFC-e só é admitido no prazo legal regulamentar (até 30 minutos em SP) e exige justificativa idônea.
                  </p>
                  <textarea
                    rows={2}
                    value={cancelJustification}
                    onChange={(e) => setCancelJustification(e.target.value)}
                    placeholder="Informe a justificativa formal (mínimo 15 caracteres, ex: 'Erro no lançamento do pedido ou desistência do cliente')"
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  {cancelError && (
                    <p className="text-xs text-rose-400">{cancelError}</p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCancelling(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelDocument}
                      disabled={isSubmitting || cancelJustification.length < 15}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                    >
                      {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                      Confirmar Cancelamento SEFAZ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Emissão de Nova Nota */
            <div className="space-y-5">
              {/* Order Summary */}
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Tipo de Atendimento:</span>
                  <span className="font-semibold text-white uppercase">{order.orderType}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total a Tributar:</span>
                  <span className="font-bold text-emerald-400 text-base">R$ {order.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Forma de Pagamento:</span>
                  <span className="font-semibold text-slate-200 capitalize">{order.paymentMethod || 'Dinheiro'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Itens no Pedido:</span>
                  <span className="text-slate-300">{order.items.length} itens</span>
                </div>
              </div>

              {/* Customer CPF / CNPJ */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Identificação do Consumidor (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CPF / CNPJ na Nota</label>
                    <input
                      type="text"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00 (Opcional)"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome do Consumidor</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nome ou Razão Social"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Contingency toggle */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceContingency}
                    onChange={(e) => setForceContingency(e.target.checked)}
                    className="w-4 h-4 text-amber-500 bg-slate-800 border-slate-700 rounded focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-200">
                      Emitir em Contingência Offline (Sem Internet / SEFAZ Fora)
                    </span>
                    <p className="text-xs text-slate-400">
                      Gera a NFC-e válida com QR Code local para entrega imediata ao consumidor e transmissão posterior.
                    </p>
                  </div>
                </label>

                {forceContingency && (
                  <div className="pt-2">
                    <label className="block text-xs text-slate-400 mb-1">Justificativa Legal da Contingência</label>
                    <input
                      type="text"
                      value={contingencyReason}
                      onChange={(e) => setContingencyReason(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Feedback messages */}
              {resultMessage && (
                <div
                  className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${
                    resultMessage.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {resultMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  )}
                  <span>{resultMessage.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleEmit}
                  disabled={isSubmitting}
                  className={`px-6 py-3 font-semibold text-sm rounded-2xl flex items-center gap-2 shadow-lg transition ${
                    forceContingency
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {forceContingency ? 'Emitir em Contingência Offline' : 'Transmitir e Emitir NFC-e'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
