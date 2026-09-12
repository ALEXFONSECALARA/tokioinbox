import React, { useEffect, useState } from 'react';
import { fetchCustomerProfile } from './utils__api';
import { CustomerAccount } from './types';
import { CustomerAccountModal } from './components__customer__CustomerAccountModal';

export const CustomerAccountPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tokioinbox_customer_token'));
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  useEffect(() => { if (token) fetchCustomerProfile(token).then(setCustomer).catch(() => { localStorage.removeItem('tokioinbox_customer_token'); setToken(null); }); }, [token]);
  return (
    <div className="min-h-screen bg-[#060908]">
      <CustomerAccountModal
        isOpen
        onClose={() => { window.location.href = '/'; }}
        token={token}
        customer={customer}
        onLoggedIn={(nextToken, account) => { localStorage.setItem('tokioinbox_customer_token', nextToken); setToken(nextToken); setCustomer(account); }}
        onLoggedOut={() => { localStorage.removeItem('tokioinbox_customer_token'); setToken(null); setCustomer(null); }}
      />
    </div>
  );
};
