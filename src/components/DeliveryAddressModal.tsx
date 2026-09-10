import React, { useState, useEffect } from 'react';
import { DeliveryAddress, RestaurantConfig, DeliveryZone } from '../types';
import { formatCurrency, playSoundEffect, calculateDeliveryFee } from '../utils/helpers';
import { 
  X, 
  MapPin, 
  Search, 
  Bike, 
  Clock, 
  Check, 
  AlertCircle, 
  Home, 
  Building2,
  Navigation
} from 'lucide-react';

interface DeliveryAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: DeliveryAddress | null;
  onSaveAddress: (address: DeliveryAddress) => void;
  restaurantConfig: RestaurantConfig;
}

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  onSaveAddress,
  restaurantConfig,
}) => {
  const [cep, setCep] = useState(currentAddress?.cep || '');
  const [street, setStreet] = useState(currentAddress?.street || '');
  const [number, setNumber] = useState(currentAddress?.number || '');
  const [neighborhood, setNeighborhood] = useState(currentAddress?.neighborhood || 'Bela Vista');
  const [city, setCity] = useState(currentAddress?.city || 'São Paulo - SP');
  // Apto/Bloco separado do Complemento livre (Fase 4, item 7)
  const [unit, setUnit] = useState(currentAddress?.unit || '');
  const [complement, setComplement] = useState(currentAddress?.complement || '');
  const [reference, setReference] = useState(currentAddress?.reference || '');
  const [lat, setLat] = useState<number | undefined>(currentAddress?.lat);
  const [lng, setLng] = useState<number | undefined>(currentAddress?.lng);

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (currentAddress) {
      setCep(currentAddress.cep || '');
      setStreet(currentAddress.street || '');
      setNumber(currentAddress.number || '');
      setNeighborhood(currentAddress.neighborhood || 'Bela Vista');
      setCity(currentAddress.city || 'São Paulo - SP');
      setUnit(currentAddress.unit || '');
      setComplement(currentAddress.complement || '');
      setReference(currentAddress.reference || '');
      setLat(currentAddress.lat);
      setLng(currentAddress.lng);
    }
  }, [currentAddress, isOpen]);

  if (!isOpen) return null;

  // Geocodificação best-effort via Nominatim (Fase 4, item 8) — mesmo padrão
  // do CheckoutModal: nunca bloqueia nem mostra erro, é só um dado extra.
  const geocodeAddress = async (street_: string, neighborhood_: string, city_: string, state_: string) => {
    try {
      const query = encodeURIComponent(`${street_ || ''}, ${neighborhood_ || ''}, ${city_ || ''}, ${state_ || ''}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${query}`);
      const results = await res.json();
      if (Array.isArray(results) && results[0]) {
        setLat(parseFloat(results[0].lat));
        setLng(parseFloat(results[0].lon));
      }
    } catch {
      // Best-effort — segue sem lat/lng se falhar.
    }
  };

  // Handle CEP lookup
  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setCepError('O CEP deve conter 8 dígitos');
      return;
    }

    setIsLoadingCep(true);
    setCepError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      } else {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(`${data.localidade || 'São Paulo'} - ${data.uf || 'SP'}`);
        if (data.complemento && !complement) {
          setComplement(data.complemento);
        }
        playSoundEffect('beep');
        geocodeAddress(data.logradouro, data.bairro, data.localidade, data.uf);
      }
    } catch {
      setCepError('Erro ao consultar CEP. Preencha manualmente.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    // Format mask 00000-000
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    setCep(val);

    if (val.replace(/\D/g, '').length === 8) {
      handleCepLookup(val);
    }
  };

  // Motor de cálculo de entrega (Fase 4, itens 9-13) — antes este preview
  // caía automaticamente na PRIMEIRA zona cadastrada quando o bairro não
  // batia com nenhuma (bug real que o item 12 do escopo pede pra corrigir:
  // nunca assumir a primeira zona como se fosse a certa). Agora usa o mesmo
  // motor do checkout, com o mesmo fallback padrão (taxa fixa do
  // restaurante) só quando não dá pra calcular de nenhuma forma.
  const deliveryCalc = calculateDeliveryFee(restaurantConfig, { neighborhood, cep, lat, lng });
  const currentZoneFee = deliveryCalc.fee ?? restaurantConfig.deliveryFee;
  const currentZoneEta = deliveryCalc.etaMinutes
    ? `${deliveryCalc.etaMinutes.total} min`
    : restaurantConfig.estimatedDeliveryTime;

  const handleSelectZoneQuick = (zone: DeliveryZone) => {
    setNeighborhood(zone.name || zone.neighborhood);
    playSoundEffect('beep');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!street.trim()) {
      setValidationError('Por favor, informe o nome da Rua / Avenida.');
      return;
    }
    if (!number.trim()) {
      setValidationError('Por favor, informe o número da residência / prédio.');
      return;
    }
    if (!neighborhood.trim()) {
      setValidationError('Por favor, informe ou selecione o Bairro.');
      return;
    }

    const savedAddr: DeliveryAddress = {
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      unit: unit.trim() || undefined,
      complement: complement.trim(),
      reference: reference.trim(),
      lat,
      lng,
    };

    playSoundEffect('success');
    onSaveAddress(savedAddr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="delivery-address-modal"
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950 font-bold">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Endereço de Entrega (Delivery)
              </h2>
              <p className="text-xs text-stone-300">
                Onde você deseja receber seu pedido quentinho?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-stone-800 flex-1">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* CEP Lookup with auto-fill */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">
              CEP (Preenchimento Automático)
            </label>
            <div className="flex gap-2">
              <input
                id="input-address-cep"
                type="text"
                value={cep}
                onChange={handleCepChange}
                placeholder="Ex: 01310-100"
                className="flex-1 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => handleCepLookup(cep)}
                disabled={isLoadingCep}
                className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isLoadingCep ? (
                  <span>Buscando...</span>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Buscar CEP</span>
                  </>
                )}
              </button>
            </div>
            {cepError && (
              <p className="text-rose-600 text-xs mt-1 font-medium">{cepError}</p>
            )}
          </div>

          {/* Quick Neighborhood Zone Chips */}
          <div>
            <label className="block font-bold text-stone-700 mb-1.5 flex items-center justify-between">
              <span>Ou selecione seu Bairro de entrega:</span>
              <span className="text-[11px] text-amber-700 font-semibold">Taxa calculada</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-stone-50 rounded-2xl border border-stone-200">
              {restaurantConfig.deliveryZones.map((zone) => {
                const zoneName = zone.name || zone.neighborhood;
                const isSelected = neighborhood.toLowerCase() === zoneName.toLowerCase();
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleSelectZoneQuick(zone)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-[var(--brand)] text-slate-950 border-[var(--brand-light)] font-bold shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{zoneName}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">
                      Taxa: {formatCurrency(zone.fee)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Street and Number */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block font-bold text-stone-700 mb-1">
                Rua / Avenida *
              </label>
              <input
                id="input-address-street"
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ex: Av. Paulista"
                required
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Número *
              </label>
              <input
                id="input-address-number"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1500"
                required
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white font-bold"
              />
            </div>
          </div>

          {/* Neighborhood and City */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Bairro *
              </label>
              <input
                id="input-address-neighborhood"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Bela Vista"
                required
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Cidade / UF
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="São Paulo - SP"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white text-stone-600"
              />
            </div>
          </div>

          {/* Unit (Apto/Bloco), Complement and Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Apto / Bloco
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Apto 302, Bloco B"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Complemento (Opcional)
              </label>
              <input
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Casa azul, fundos"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Ponto de Referência
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Próximo ao metrô MASP"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white"
              />
            </div>
          </div>

          {/* Summary Box for the Delivery Zone */}
          <div className="bg-[var(--brand-tint)] border border-[var(--brand-tint)] rounded-2xl p-3.5 flex items-center justify-between text-stone-900">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-stone-900">
                  Taxa para {neighborhood || 'seu bairro'}: {formatCurrency(currentZoneFee)}
                </p>
                <p className="text-[11px] text-stone-600 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Tempo estimado: {currentZoneEta}</span>
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-black bg-white px-2 py-1 rounded-lg border border-[var(--brand-light)] text-amber-800">
              Delivery Ativo
            </span>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              id="save-delivery-address-btn"
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[var(--brand-light)] font-black rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Endereço de Entrega</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
