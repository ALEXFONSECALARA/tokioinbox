import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Router } from './Router.tsx';
import './index.css';

const reportClientError=(message:string,details:Record<string,unknown>={})=>{try{fetch('/api/client-errors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,details})}).catch(()=>{})}catch{}};
window.addEventListener('error',(e)=>reportClientError(e.message||'Erro de interface',{source:e.filename||'',line:e.lineno||0,column:e.colno||0}));
window.addEventListener('unhandledrejection',(e)=>reportClientError(String((e.reason as any)?.message||e.reason||'Promise rejeitada')));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
