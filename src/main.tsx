import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Router } from '@/src/Router';
import { DeployWatcher } from '@/src/components/system/DeployWatcher';
import '@/src/index.css';

const reportClientError=(message:string,details:Record<string,unknown>={})=>{try{fetch('/api/client-errors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,details})}).catch(()=>{})}catch{}};
window.addEventListener('error',(e)=>reportClientError(e.message||'Erro de interface',{source:e.filename||'',line:e.lineno||0,column:e.colno||0}));
window.addEventListener('unhandledrejection',(e)=>reportClientError(String((e.reason as any)?.message||e.reason||'Promise rejeitada')));

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClientError(error.message || 'Erro fatal de interface', { componentStack: info.componentStack || '' });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui',background:'#070908',color:'#f4f0e5',textAlign:'center'}}>
      <div style={{maxWidth:420}}><div style={{fontSize:40,marginBottom:12}}>⚠️</div><h1 style={{fontSize:22,margin:'0 0 8px'}}>O sistema encontrou um erro</h1><p style={{opacity:.7,fontSize:14,lineHeight:1.5}}>O erro foi registrado automaticamente. Recarregue a página para continuar.</p><button onClick={()=>window.location.reload()} style={{marginTop:18,padding:'12px 18px',borderRadius:12,border:0,fontWeight:800,cursor:'pointer'}}>Recarregar</button></div>
    </div>;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><Router /><DeployWatcher /></AppErrorBoundary>
  </StrictMode>,
);
