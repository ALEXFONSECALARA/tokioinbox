import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../utils/index.css';
import { StoreProvider } from '../context/StoreContext';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { CustomerApp } from './CustomerApp';

// Cardápio público do cliente. O painel da equipe é outro aplicativo (painel.html).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider mode="customer">
      <CustomerAuthProvider>
        <CustomerApp />
      </CustomerAuthProvider>
    </StoreProvider>
  </StrictMode>
);
