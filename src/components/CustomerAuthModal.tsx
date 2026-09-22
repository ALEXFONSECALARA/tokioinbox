import React, { useState, useEffect } from 'react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { formatPhoneMask } from '../utils/phoneUtils';
import { BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';
import {
  X,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Plus,
  Trash2,
  LogOut,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'account' | 'recovery';
  onOrderClick?: (orderId: string) => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onOrderClick,
}) => {
  const {
    customer,
    isAuthenticated,
    customerOrders,
    isLoadingOrders,
    login,
    register,
    logout,
    requestRecovery,
    confirmRecovery,
    updateProfile,
    addAddress,
    removeAddress,
  } = useCustomerAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'recovery_request' | 'recovery_confirm' | 'account'>(
    isAuthenticated ? 'account' : initialMode === 'recovery' ? 'recovery_request' : initialMode
  );

  useEffect(() => {
    if (isOpen) {
      if (isAuthenticated) {
        setMode('account');
      } else if (initialMode === 'recovery') {
        setMode('recovery_request');
      } else {
        setMode(initialMode === 'account' ? 'login' : initialMode);
      }
      setErrorMsg(null);
      setSuccessMsg(null);
      setAlreadyExistsAlert(false);
    }
  }, [isOpen, isAuthenticated, initialMode]);

  // Form Fields
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [alreadyExistsAlert, setAlreadyExistsAlert] = useState(false);

  // Address sub-form
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrZipCode, setAddrZipCode] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('São Paulo');
  const [addrState, setAddrState] = useState('');
  const [addrComplement, setAddrComplement] = useState('');
  const [addrTitle, setAddrTitle] = useState('Casa');
  const [isLookingUpAddrCep, setIsLookingUpAddrCep] = useState(false);
  const [addrCepError, setAddrCepError] = useState<string | null>(null);

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneInput(formatPhoneMask(e.target.value));
    setErrorMsg(null);
    setAlreadyExistsAlert(false);
  };

  // 1. Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!phoneInput.trim() || !passwordInput) {
      setErrorMsg('Informe seu WhatsApp e senha.');
      return;
    }
    setIsLoading(true);
    const res = await login(phoneInput, passwordInput);
    setIsLoading(false);
    if (res.success) {
      setSuccessMsg('Login realizado com sucesso!');
      setTimeout(() => {
        setMode('account');
        setSuccessMsg(null);
      }, 500);
    } else {
      if (res.notFound) {
        setErrorMsg('Nenhuma conta encontrada com este WhatsApp.');
        setAlreadyExistsAlert(false);
      } else {
        setErrorMsg(res.error || 'Credenciais inválidas.');
      }
    }
  };

  // 2. Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAlreadyExistsAlert(false);

    if (!nameInput.trim()) {
      setErrorMsg('Informe seu nome completo.');
      return;
    }
    if (!phoneInput.trim()) {
      setErrorMsg('Informe seu número de WhatsApp.');
      return;
    }
    if (passwordInput.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setErrorMsg('A confirmação não confere com a senha digitada.');
      return;
    }

    setIsLoading(true);
    const res = await register(nameInput, phoneInput, passwordInput, confirmPasswordInput);
    setIsLoading(false);

    if (res.success) {
      setSuccessMsg('Conta criada com sucesso! Seja bem-vindo(a).');
      setTimeout(() => {
        setMode('account');
        setSuccessMsg(null);
      }, 600);
    } else {
      if (res.alreadyExists) {
        setAlreadyExistsAlert(true);
      } else {
        setErrorMsg(res.error || 'Erro ao criar conta.');
      }
    }
  };

  // 3. Request Recovery Code
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!phoneInput.trim()) {
      setErrorMsg('Informe o WhatsApp cadastrado.');
      return;
    }
    setIsLoading(true);
    const res = await requestRecovery(phoneInput);
    setIsLoading(false);
    if (res.success) {
      setSuccessMsg(
        res.debugCode
          ? `Código de verificação gerado: ${res.debugCode} (válido por 15 minutos).`
          : res.message || 'Código enviado via WhatsApp.'
      );
      setMode('recovery_confirm');
    } else {
      setErrorMsg(res.error || 'Não foi possível solicitar recuperação.');
    }
  };

  // 4. Confirm Recovery Code and Set New Password
  const handleConfirmRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!recoveryCodeInput.trim() || recoveryCodeInput.trim().length !== 6) {
      setErrorMsg('Digite o código de 6 dígitos recebido.');
      return;
    }
    if (passwordInput.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setErrorMsg('A confirmação de senha não confere.');
      return;
    }

    setIsLoading(true);
    const res = await confirmRecovery(phoneInput, recoveryCodeInput, passwordInput, confirmPasswordInput);
    setIsLoading(false);

    if (res.success) {
      setSuccessMsg('Senha redefinida com sucesso! Entre com sua nova senha.');
      setTimeout(() => {
        setMode('login');
        setPasswordInput('');
        setConfirmPasswordInput('');
        setRecoveryCodeInput('');
        setSuccessMsg(null);
      }, 1500);
    } else {
      setErrorMsg(res.error || 'Código inválido ou expirado.');
    }
  };

  // 5. Add Address Submit
  const formatAddrCep = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  };

  const handleAddrCepChange = (raw: string) => {
    const formatted = formatAddrCep(raw);
    setAddrZipCode(formatted);
    setAddrCepError(null);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      lookupAddrCep(digits);
    }
  };

  const lookupAddrCep = async (digitsOnly: string) => {
    setIsLookingUpAddrCep(true);
    setAddrCepError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitsOnly}/json/`);
      const data = await res.json();
      if (data.erro) {
        setAddrCepError('CEP não encontrado. Confira o número ou preencha manualmente.');
        return;
      }
      setAddrStreet(data.logradouro || '');
      setAddrNeighborhood(data.bairro || '');
      setAddrCity(data.localidade || addrCity);
      setAddrState(data.uf || '');
    } catch {
      setAddrCepError('Não foi possível buscar o CEP agora. Preencha o endereço manualmente.');
    } finally {
      setIsLookingUpAddrCep(false);
    }
  };

  const handleAddAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim() || !addrNumber.trim() || !addrNeighborhood.trim()) {
      return;
    }
    setIsLoading(true);
    await addAddress({
      title: addrTitle,
      zipCode: addrZipCode || undefined,
      street: addrStreet,
      number: addrNumber,
      neighborhood: addrNeighborhood,
      city: addrCity || 'São Paulo',
      state: addrState || undefined,
      complement: addrComplement || undefined,
      isDefault: false,
    });
    setIsLoading(false);
    setShowAddAddress(false);
    setAddrZipCode('');
    setAddrStreet('');
    setAddrNumber('');
    setAddrNeighborhood('');
    setAddrCity('São Paulo');
    setAddrState('');
    setAddrComplement('');
  };

  // 6. Save Profile Name
  const handleSaveName = async () => {
    if (!editNameVal.trim()) return;
    setIsLoading(true);
    await updateProfile(editNameVal);
    setIsLoading(false);
    setIsEditingName(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E121B] border border-[#C5A880]/30 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#14120F] via-[#0E121B] to-[#14120F] border-b border-[#C5A880]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C5A880]/15 border border-[#C5A880]/35 flex items-center justify-center text-[#C5A880]">
              {mode === 'account' ? <User className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                {mode === 'account'
                  ? 'Minha Conta • ' + BRAND_SHORT_NAME
                  : mode === 'register'
                  ? 'Criar Conta de Cliente'
                  : mode.startsWith('recovery')
                  ? 'Recuperar Acesso'
                  : 'Acessar Conta'}
              </h2>
              <p className="text-[11px] text-stone-400">
                {mode === 'account'
                  ? 'Seus pedidos, endereços e perfil seguro'
                  : 'Autenticação sem dependência de e-mail por WhatsApp'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Notifications */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* ================================================================= */}
          {/* MODE: ACCOUNT (CLIENTE LOGADO)                                   */}
          {/* ================================================================= */}
          {mode === 'account' && customer && (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-[#14120E] border border-stone-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editNameVal}
                          onChange={(e) => setEditNameVal(e.target.value)}
                          className="bg-black/60 border border-[#C5A880]/50 text-white text-xs px-2 py-1 rounded-md"
                          placeholder="Seu nome"
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isLoading}
                          className="px-2 py-1 bg-[#C5A880] text-black font-bold text-xs rounded"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-bold text-white">{customer.name}</span>
                        <button
                          onClick={() => {
                            setEditNameVal(customer.name);
                            setIsEditingName(true);
                          }}
                          className="text-[11px] text-[#C5A880] underline hover:text-white"
                        >
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#C5A880]" />
                    <span>WhatsApp: {customer.phone}</span>
                  </p>
                </div>

                <button
                  onClick={async () => {
                    await logout();
                    setMode('login');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-950/30 transition-colors flex items-center gap-1 min-h-[44px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>

              {/* Saved Addresses Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#C5A880]" />
                    <span>Meus Endereços Salvos</span>
                  </span>
                  <button
                    onClick={() => setShowAddAddress(!showAddAddress)}
                    className="text-xs text-[#C5A880] hover:underline font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddAddress ? 'Cancelar' : 'Adicionar Endereço'}</span>
                  </button>
                </div>

                {showAddAddress && (
                  <form
                    onSubmit={handleAddAddressSubmit}
                    className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2.5 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Rótulo (ex: Casa, Trabalho)"
                        value={addrTitle}
                        onChange={(e) => setAddrTitle(e.target.value)}
                        className="p-2 rounded bg-black/60 border border-stone-700 text-white"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={isLookingUpAddrCep ? 'Buscando CEP...' : 'CEP (preenche o resto sozinho)'}
                        value={addrZipCode}
                        onChange={(e) => handleAddrCepChange(e.target.value)}
                        maxLength={9}
                        className="p-2 rounded bg-black/60 border border-stone-700 text-white"
                      />
                    </div>
                    {addrCepError && <p className="text-rose-400 text-[11px]">{addrCepError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Bairro *"
                        value={addrNeighborhood}
                        onChange={(e) => setAddrNeighborhood(e.target.value)}
                        className="p-2 rounded bg-black/60 border border-stone-700 text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Cidade"
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        className="p-2 rounded bg-black/60 border border-stone-700 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Rua / Avenida *"
                        value={addrStreet}
                        onChange={(e) => setAddrStreet(e.target.value)}
                        className="col-span-2 p-2 rounded bg-black/60 border border-stone-700 text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Nº *"
                        value={addrNumber}
                        onChange={(e) => setAddrNumber(e.target.value)}
                        className="p-2 rounded bg-black/60 border border-stone-700 text-white"
                        required
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Complemento / Apto / Bloco"
                      value={addrComplement}
                      onChange={(e) => setAddrComplement(e.target.value)}
                      className="w-full p-2 rounded bg-black/60 border border-stone-700 text-white"
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2 bg-gradient-to-r from-[#C5A880] to-[#B85D3B] text-black font-black rounded-lg text-xs"
                    >
                      Salvar Endereço
                    </button>
                  </form>
                )}

                {(!customer.savedAddresses || customer.savedAddresses.length === 0) && !showAddAddress && (
                  <div className="p-3 text-center border border-dashed border-stone-800 rounded-xl text-stone-500 text-xs">
                    Nenhum endereço cadastrado ainda.
                  </div>
                )}

                {customer.savedAddresses?.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{addr.title}</span>
                        {addr.isDefault && (
                          <span className="px-1.5 py-0.5 rounded bg-[#C5A880]/20 text-[#C5A880] text-[9px] font-black">
                            PADRÃO
                          </span>
                        )}
                      </div>
                      <p className="text-stone-400 mt-0.5">
                        {addr.street}, {addr.number} {addr.complement ? `(${addr.complement})` : ''} - {addr.neighborhood}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAddress(addr.id)}
                      className="text-stone-500 hover:text-rose-400 p-1"
                      title="Excluir endereço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Customer Isolated Orders */}
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                  <span>Meus Pedidos ({customerOrders.length})</span>
                </div>

                {isLoadingOrders ? (
                  <div className="p-4 text-center text-xs text-stone-400">Carregando seus pedidos...</div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-stone-800 rounded-xl">
                    <ShoppingBag className="w-7 h-7 text-stone-600 mx-auto mb-1.5" />
                    <p className="text-xs text-stone-400">Você ainda não realizou pedidos nesta conta.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => {
                          if (onOrderClick) {
                            onOrderClick(order.id);
                            onClose();
                          }
                        }}
                        className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 hover:border-[#C5A880]/50 transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-[#C5A880]">{order.shortCode}</span>
                            <span className="font-bold text-stone-200">{order.restaurantName}</span>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white block">R$ {order.total.toFixed(2)}</span>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODE: LOGIN                                                       */}
          {/* ================================================================= */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#C5A880]/10 border border-[#C5A880]/20 text-xs text-stone-300">
                Acesse sua conta com seu <strong>WhatsApp</strong> e <strong>senha</strong> para acompanhar pedidos e gerenciar seus endereços com total segurança.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Número de WhatsApp ou Celular:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-300">Sua Senha:</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery_request');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-[#C5A880] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Sua senha secreta"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-stone-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[44px]"
              >
                <span>{isLoading ? 'Autenticando...' : 'Entrar na Minha Conta'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 border-t border-stone-800">
                <span className="text-xs text-stone-400">Ainda não possui conta? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                    setAlreadyExistsAlert(false);
                  }}
                  className="text-xs font-bold text-[#C5A880] hover:underline"
                >
                  Criar conta agora
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* MODE: REGISTER (CRIAR CONTA)                                      */}
          {/* ================================================================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Already Exists Specific Alert */}
              {alreadyExistsAlert && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Este WhatsApp já possui uma conta cadastrada.</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90">
                    Você já possui um cadastro com este número. Escolha uma das opções abaixo:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setAlreadyExistsAlert(false);
                      }}
                      className="px-3 py-1.5 bg-[#C5A880] text-black font-bold text-xs rounded-lg shadow-sm min-h-[44px]"
                    >
                      Entrar com Senha
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('recovery_request');
                        setAlreadyExistsAlert(false);
                      }}
                      className="px-3 py-1.5 bg-black/60 border border-stone-700 text-stone-200 font-bold text-xs rounded-lg hover:border-amber-400 min-h-[44px]"
                    >
                      Recuperar Senha
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">Seu Nome Completo:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ex: Mariana Silva"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  WhatsApp ou Telefone:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Criar Senha (mínimo 6 caracteres):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="No mínimo 6 dígitos"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-stone-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">Confirmar Senha:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Repita a senha criada"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[44px]"
              >
                <span>{isLoading ? 'Cadastrando...' : 'Criar Conta e Prosseguir'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 border-t border-stone-800">
                <span className="text-xs text-stone-400">Já tem conta cadastrada? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setAlreadyExistsAlert(false);
                  }}
                  className="text-xs font-bold text-[#C5A880] hover:underline"
                >
                  Entrar
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* MODE: RECOVERY REQUEST (SOLICITAR CÓDIGO)                         */}
          {/* ================================================================= */}
          {mode === 'recovery_request' && (
            <form onSubmit={handleRequestRecovery} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#C5A880]">
                  <KeyRound className="w-4 h-4" />
                  <span>Recuperação Segura sem E-mail</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  Informe o WhatsApp cadastrado. Um código de verificação seguro de 6 dígitos será gerado para redefinir sua senha.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Seu WhatsApp Cadastrado:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    placeholder="(22) 99999-9999"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[44px]"
              >
                <span>{isLoading ? 'Enviando código...' : 'Solicitar Código de Verificação'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-stone-400 hover:text-white"
                >
                  ← Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* MODE: RECOVERY CONFIRM (DIGITAR CÓDIGO + NOVA SENHA)              */}
          {/* ================================================================= */}
          {mode === 'recovery_confirm' && (
            <form onSubmit={handleConfirmRecovery} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200">
                Digite o código de 6 dígitos e escolha sua nova senha.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Código de 6 Dígitos:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-base text-white tracking-widest font-mono text-center placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nova Senha (mínimo 6 dígitos):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Sua nova senha"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-stone-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Confirmar Nova Senha:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-stone-800 focus:border-[#C5A880] text-sm text-white placeholder-stone-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all min-h-[44px]"
              >
                <span>{isLoading ? 'Redefinindo...' : 'Salvar Nova Senha'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <div className="text-center pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('recovery_request')}
                  className="text-xs text-stone-400 hover:text-white"
                >
                  ← Solicitar outro código
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
