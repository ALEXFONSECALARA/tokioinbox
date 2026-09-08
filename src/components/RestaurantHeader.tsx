import React, { useState } from 'react';
import { RestaurantConfig, OrderType } from '../types/restaurant';
import { useStore } from '../context/StoreContext';
import {
  Clock,
  Bike,
  Store,
  UtensilsCrossed,
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Info,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface RestaurantHeaderProps {
  restaurant?: RestaurantConfig;
}

export const RestaurantHeader: React.FC<RestaurantHeaderProps> = ({ restaurant: propRestaurant }) => {
  const { currentRestaurant, orderType, setOrderType, selectedTable, setSelectedTable } = useStore();
  const restaurant = propRestaurant || currentRestaurant;
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);

  return (
    <div className="relative mb-6">
      {/* Banner Background */}
      <div className="h-48 sm:h-64 w-full relative overflow-hidden bg-slate-950 rounded-3xl border border-amber-500/20 shadow-2xl">
        <img
          src={restaurant.banner}
          alt={restaurant.name}
          className="w-full h-full object-cover object-center filter brightness-[0.75]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/50 to-transparent" />

        {/* Status badge in corner */}
        <div className="absolute top-4 right-4 z-10">
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 shadow-lg ${
              restaurant.isOpen
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                restaurant.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            {restaurant.isOpen ? 'Aberto Agora' : 'Fechado no Momento'}
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20 relative z-20">
        <div className="glass-gold-card rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Logo and Identity */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                />
                <span className="absolute -bottom-2 -right-2 text-2xl filter drop-shadow">
                  {restaurant.emoji}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {restaurant.name}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40 shadow-sm">
                    {restaurant.cuisine}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                  {restaurant.tagline}
                </p>

                {/* Rating & Details Row */}
                <div className="flex items-center gap-3 sm:gap-4 mt-2.5 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {restaurant.rating.toFixed(1)} ({restaurant.reviewCount} avaliações)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {restaurant.estimatedTimeMin} - {restaurant.estimatedTimeMax} min
                  </span>
                  <span>•</span>
                  <button
                    onClick={() => setShowInfoModal(true)}
                    className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Ver horários e endereço
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions / WhatsApp */}
            <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
              <a
                href={`https://wa.me/${restaurant.whatsapp}?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20card%C3%A1pio%20do%20${encodeURIComponent(
                  restaurant.name
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>

              <button
                onClick={() => setShowInfoModal(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              >
                Detalhes
              </button>
            </div>
          </div>

          {/* Order Modality Segmented Controller */}
          <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => {
                  setOrderType('delivery');
                  setSelectedTable(null);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  orderType === 'delivery'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Delivery (Entrega)</span>
              </button>

              <button
                onClick={() => {
                  setOrderType('retirada');
                  setSelectedTable(null);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  orderType === 'retirada'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Retirar no Balcão</span>
              </button>

              <button
                onClick={() => {
                  setOrderType('mesa');
                  setShowTableSelector(true);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  orderType === 'mesa'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>
                  {selectedTable ? `Mesa ${selectedTable}` : 'Consumo no Local / Mesa'}
                </span>
              </button>
            </div>

            {/* Context Notice based on modality */}
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              {orderType === 'delivery' && (
                <>
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Taxa: R$ {restaurant.deliveryFee.toFixed(2)} • Pedido mín: R${' '}
                    {restaurant.minOrderValue.toFixed(2)}
                  </span>
                </>
              )}
              {orderType === 'retirada' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sem taxa de entrega • Retirada em {restaurant.estimatedTimeMin} min</span>
                </>
              )}
              {orderType === 'mesa' && (
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-semibold">
                    {selectedTable ? `Mesa nº ${selectedTable} selecionada` : 'Por favor selecione sua mesa'}
                  </span>
                  <button
                    onClick={() => setShowTableSelector(true)}
                    className="text-xs underline text-slate-300 hover:text-white"
                  >
                    Trocar mesa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table Selection Modal */}
      {showTableSelector && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Número da sua Mesa</h3>
              </div>
              <button
                onClick={() => setShowTableSelector(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Informe a mesa onde você está acomodado para que o garçom e a cozinha entreguem seu pedido diretamente:
            </p>

            <div className="grid grid-cols-4 gap-2.5 mb-6">
              {restaurant.activeTables.map((tableNum) => (
                <button
                  key={tableNum}
                  onClick={() => {
                    setSelectedTable(tableNum);
                    setOrderType('mesa');
                    setShowTableSelector(false);
                  }}
                  className={`py-3 rounded-xl font-bold text-sm border transition-all ${
                    selectedTable === tableNum
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-105'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  }`}
                >
                  Mesa {tableNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowTableSelector(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700"
            >
              Confirmar e Fechar
            </button>
          </div>
        </div>
      )}

      {/* Restaurant Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{restaurant.emoji}</span>
                <h3 className="text-lg font-bold text-white">{restaurant.name}</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Endereço:</span>
                  <span>{restaurant.address}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Horário de Funcionamento:</span>
                  <span>{restaurant.openingHours}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Contato Direto:</span>
                  <span>{restaurant.phone}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 mt-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tempo estimado:</span>
                  <span className="font-bold text-white">
                    {restaurant.estimatedTimeMin} a {restaurant.estimatedTimeMax} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taxa de entrega padrão:</span>
                  <span className="font-bold text-emerald-400">
                    R$ {restaurant.deliveryFee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pedido mínimo:</span>
                  <span className="font-bold text-white">
                    R$ {restaurant.minOrderValue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
