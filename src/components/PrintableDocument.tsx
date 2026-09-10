import React from 'react';
import { Order, RestaurantConfig } from '../types';
import { formatCurrency } from '../utils/helpers';

export type PrintVariant = 'kitchen' | 'delivery' | 'customer';

interface PrintableDocumentProps {
  order: Order;
  config: RestaurantConfig;
  variant: PrintVariant;
  paperWidth: '58mm' | '80mm';
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX (Pagamento Instantâneo)',
  credit_card: 'Cartão de Crédito na Entrega',
  debit_card: 'Cartão de Débito na Entrega',
  cash: 'Dinheiro na Entrega',
  meal_voucher: 'Vale Refeição (VR / Sodexo)',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Documento único que sabe se desenhar de 3 jeitos (cozinha / entrega /
// cliente) a partir dos MESMOS dados do pedido — sem duplicar lógica entre
// a prévia na tela e a versão impressa (é o mesmo componente nas duas).
export const PrintableDocument: React.FC<PrintableDocumentProps> = ({ order, config, variant, paperWidth }) => {
  return (
    <div
      className="printable-receipt font-mono text-stone-900 leading-relaxed"
      style={{ width: paperWidth, maxWidth: paperWidth, fontSize: paperWidth === '58mm' ? '10px' : '11px' }}
    >
      {/* Cabeçalho: nome do restaurante em todos os modelos */}
      <div className="text-center pb-2 border-b-2 border-dashed border-stone-500">
        <p className="font-black" style={{ fontSize: paperWidth === '58mm' ? '12px' : '14px' }}>
          {config.name.toUpperCase()}
        </p>
        {variant !== 'kitchen' && (
          <>
            <p className="text-[10px]">{config.address}</p>
            <p className="text-[10px]">WhatsApp: {config.whatsapp}</p>
          </>
        )}
        <div className="mt-1.5 py-1 px-2 bg-black text-white font-black inline-block" style={{ fontSize: paperWidth === '58mm' ? '11px' : '13px' }}>
          {variant === 'kitchen' ? `COMANDA — PEDIDO #${order.orderNumber}` : `PEDIDO #${order.orderNumber}`}
        </div>
        <p className="text-[10px] mt-1">{formatDateTime(order.createdAt)}</p>
      </div>

      {/* ---------- COZINHA: só produto / quantidade / observação ---------- */}
      {variant === 'kitchen' && (
        <div className="py-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="pb-1.5 mb-1.5 border-b border-dashed border-stone-300 last:border-0">
              <p className="font-black" style={{ fontSize: paperWidth === '58mm' ? '13px' : '15px' }}>
                {item.quantity}x {item.menuItem.name}
              </p>
              {item.selectedChoices.length > 0 && (
                <p className="pl-2 text-[10px]">• {item.selectedChoices.map((c) => c.optionName).join(', ')}</p>
              )}
              {item.selectedExtras.length > 0 && (
                <p className="pl-2 text-[10px]">+ {item.selectedExtras.map((e) => `${e.quantity}x ${e.name}`).join(', ')}</p>
              )}
              {item.specialNotes && (
                <p className="pl-2 font-bold text-[11px] mt-0.5">⚠️ OBS: {item.specialNotes}</p>
              )}
            </div>
          ))}
          {order.notes && (
            <p className="font-bold mt-1 text-[11px]">⚠️ OBS GERAL DO PEDIDO: {order.notes}</p>
          )}
        </div>
      )}

      {/* ---------- ENTREGA: cliente, telefone, endereço, referência, pagamento, total ---------- */}
      {variant === 'delivery' && (
        <>
          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-0.5">
            <p className="font-bold">👤 {order.customer.name}</p>
            <p>📱 {order.customer.phone}</p>
            {order.customer.address && (
              <div className="mt-1 p-1.5 border border-stone-400 rounded">
                <p className="font-bold">
                  📍 {order.customer.address.street}, {order.customer.address.number}
                </p>
                {order.customer.address.unit && <p className="font-semibold">{order.customer.address.unit}</p>}
                {order.customer.address.complement && <p>Comp: {order.customer.address.complement}</p>}
                <p className="font-semibold">Bairro: {order.customer.address.neighborhood}</p>
                <p>{order.customer.address.city} • CEP: {order.customer.address.cep || 'S/N'}</p>
                {order.customer.address.reference && (
                  <p className="italic font-medium">Ref: {order.customer.address.reference}</p>
                )}
              </div>
            )}
          </div>
          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-0.5">
            <p className="font-bold">PAGAMENTO: {paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
            {order.paymentMethod === 'cash' && order.cashChangeFor && (
              <p className="font-bold">
                💵 Troco para {formatCurrency(order.cashChangeFor)} (levar {formatCurrency(order.cashChangeFor - order.total)})
              </p>
            )}
            {order.notes && <p>Obs. de entrega: {order.notes}</p>}
          </div>
          <div className="py-2 flex justify-between font-black" style={{ fontSize: paperWidth === '58mm' ? '13px' : '15px' }}>
            <span>TOTAL A COBRAR:</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </>
      )}

      {/* ---------- CLIENTE: recibo completo, itemizado ---------- */}
      {variant === 'customer' && (
        <>
          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-0.5">
            <p className="font-bold uppercase text-[10px]">Cliente / Entrega:</p>
            <p className="font-semibold">👤 {order.customer.name}</p>
            <p>📱 {order.customer.phone}</p>
            {order.customer.address && (
              <div className="mt-1 p-1.5 border border-stone-400 rounded">
                <p className="font-bold">
                  📍 {order.customer.address.street}, {order.customer.address.number}
                </p>
                {order.customer.address.unit && <p className="font-semibold">{order.customer.address.unit}</p>}
                {order.customer.address.complement && <p>Comp: {order.customer.address.complement}</p>}
                <p className="font-semibold">Bairro: {order.customer.address.neighborhood}</p>
                <p>{order.customer.address.city} • CEP: {order.customer.address.cep || 'S/N'}</p>
                {order.customer.address.reference && <p className="italic">Ref: {order.customer.address.reference}</p>}
              </div>
            )}
          </div>

          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-1.5">
            <p className="font-bold uppercase text-[10px]">Itens:</p>
            {order.items.map((item, idx) => (
              <div key={idx} className="pb-1 border-b border-stone-200 last:border-0">
                <div className="flex justify-between font-bold text-[11px]">
                  <span>{item.quantity}x {item.menuItem.name}</span>
                  <span>{formatCurrency(item.totalPrice)}</span>
                </div>
                {item.selectedChoices.length > 0 && (
                  <p className="pl-2 text-[10px]">• {item.selectedChoices.map((c) => c.optionName).join(', ')}</p>
                )}
                {item.selectedExtras.length > 0 && (
                  <p className="pl-2 text-[10px]">+ {item.selectedExtras.map((e) => `${e.quantity}x ${e.name}`).join(', ')}</p>
                )}
                {item.specialNotes && <p className="pl-2 font-bold text-[10px]">⚠️ OBS: {item.specialNotes}</p>}
              </div>
            ))}
          </div>

          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-0.5">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between">
              <span>Taxa de Entrega:</span>
              <span>{order.deliveryFee === 0 ? 'GRÁTIS' : formatCurrency(order.deliveryFee)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between font-bold">
                <span>Desconto ({order.couponCode || 'Cupom'}):</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black pt-1 border-t border-stone-400" style={{ fontSize: paperWidth === '58mm' ? '13px' : '15px' }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="py-2 border-b-2 border-dashed border-stone-500 space-y-0.5">
            <p className="font-bold">💳 {paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
            {order.paymentMethod === 'cash' && order.cashChangeFor && (
              <p className="font-bold">
                💵 Troco para {formatCurrency(order.cashChangeFor)} (levar {formatCurrency(order.cashChangeFor - order.total)})
              </p>
            )}
            {order.driver && (
              <p className="mt-1">🛵 Entregador: {order.driver.name} ({order.driver.vehicle})</p>
            )}
            {order.notes && <p>OBS: {order.notes}</p>}
          </div>

          <div className="text-center pt-2 space-y-0.5">
            <p className="font-bold text-[11px]">OBRIGADO PELA PREFERÊNCIA!</p>
          </div>
        </>
      )}

      <div className="text-center pt-2 text-stone-400 select-none text-[9px]">- - - CORTE AQUI - - -</div>
    </div>
  );
};
