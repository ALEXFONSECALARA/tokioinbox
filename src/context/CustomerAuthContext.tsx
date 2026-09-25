import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CustomerSession, CustomerAddress } from '../types/customerAuth';
import { Order } from '../types/restaurant';

interface CustomerAuthContextType {
  customer: CustomerSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  customerOrders: Order[];
  isLoadingOrders: boolean;
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string; notFound?: boolean }>;
  register: (
    name: string,
    phone: string,
    password: string,
    confirmPassword?: string
  ) => Promise<{ success: boolean; error?: string; alreadyExists?: boolean }>;
  logout: () => Promise<void>;
  requestRecovery: (phone: string) => Promise<{ success: boolean; message?: string; error?: string; debugCode?: string }>;
  confirmRecovery: (
    phone: string,
    code: string,
    newPassword: string,
    confirmPassword?: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
  addAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<{ success: boolean; error?: string }>;
  removeAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  refreshCustomerOrders: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'tokio_customer_token';
const CACHE_KEY = 'tokio_customer_session';

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [customer, setCustomer] = useState<CustomerSession | null>(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // Validate session on mount
  const validateCurrentSession = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch('/api/customer/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomer(data.customer);
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
          return true;
        }
      }
      // If invalid, clear
      setCustomer(null);
      setToken(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CACHE_KEY);
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      validateCurrentSession(token);
    } else {
      setIsLoading(false);
    }
  }, [token, validateCurrentSession]);

  const refreshCustomerOrders = useCallback(async () => {
    if (!token) {
      setCustomerOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/customer/my-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setCustomerOrders(data.orders);
        }
      }
    } catch (err) {
      console.error('[AUTH ORDERS ERROR]', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [token]);

  useEffect(() => {
    if (customer && token) {
      refreshCustomerOrders();
    }
  }, [customer?.id, token, refreshCustomerOrders]);

  // 1. Login
  const login = async (phone: string, password: string) => {
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (data.success && data.token && data.customer) {
        setToken(data.token);
        setCustomer(data.customer);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
        return { success: true };
      }
      return { success: false, error: data.error || 'Falha ao autenticar', notFound: data.notFound };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor. Tente novamente.' };
    }
  };

  // 2. Register
  const register = async (name: string, phone: string, password: string, confirmPassword?: string) => {
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, confirmPassword }),
      });
      const data = await res.json();
      if (data.success && data.token && data.customer) {
        setToken(data.token);
        setCustomer(data.customer);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
        return { success: true };
      }
      return {
        success: false,
        error: data.error || 'Erro ao realizar cadastro.',
        alreadyExists: data.alreadyExists,
      };
    } catch {
      return { success: false, error: 'Erro de conexão ao cadastrar.' };
    }
  };

  // 3. Logout
  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/customer/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token }),
        });
      } catch {
        // silent
      }
    }
    setToken(null);
    setCustomer(null);
    setCustomerOrders([]);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHE_KEY);
  };

  // 4. Request Recovery
  const requestRecovery = async (phone: string) => {
    try {
      const res = await fetch('/api/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return data;
    } catch {
      return { success: false, error: 'Erro ao solicitar código de recuperação.' };
    }
  };

  // 5. Confirm Recovery
  const confirmRecovery = async (
    phone: string,
    code: string,
    newPassword: string,
    confirmPassword?: string
  ) => {
    try {
      const res = await fetch('/api/customer/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, newPassword, confirmPassword }),
      });
      const data = await res.json();
      return data;
    } catch {
      return { success: false, error: 'Erro ao confirmar redefinição de senha.' };
    }
  };

  // 6. Update Profile
  const updateProfile = async (name: string) => {
    if (!token) return { success: false, error: 'Não autenticado' };
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao atualizar dados.' };
    } catch {
      return { success: false, error: 'Erro de conexão.' };
    }
  };

  // 7. Add Address
  const addAddress = async (address: Omit<CustomerAddress, 'id'>) => {
    if (!token) return { success: false, error: 'Não autenticado' };
    try {
      const res = await fetch('/api/customer/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(address),
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao salvar endereço.' };
    } catch {
      return { success: false, error: 'Erro de conexão.' };
    }
  };

  // 8. Remove Address
  const removeAddress = async (addressId: string) => {
    if (!token) return { success: false, error: 'Não autenticado' };
    try {
      const res = await fetch(`/api/customer/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.customer));
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao excluir endereço.' };
    } catch {
      return { success: false, error: 'Erro de conexão.' };
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        token,
        isAuthenticated: Boolean(customer && token),
        isLoading,
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
        refreshCustomerOrders,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export function useCustomerAuth(): CustomerAuthContextType {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return ctx;
}
