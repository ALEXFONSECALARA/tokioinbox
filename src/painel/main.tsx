import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../utils/index.css';
import { installStaffAuthFetch } from './authFetch';
import { StoreProvider } from '../context/StoreContext';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { PainelApp } from './PainelApp';
import { AppErrorBoundary } from '../components/AppErrorBoundary';

// Painel da equipe: aplicativo separado do cardápio do cliente.
installStaffAuthFetch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <StoreProvider mode="staff">
        <CustomerAuthProvider>
          <PainelApp />
        </CustomerAuthProvider>
      </StoreProvider>
    </AppErrorBoundary>
  </StrictMode>
);
