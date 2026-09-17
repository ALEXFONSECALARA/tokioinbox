/**
 * scripts/diagnose.ts - Ferramenta de diagnóstico do sistema e integridade de dados
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export function runDiagnostic() {
  console.log('🔍 [DIAGNÓSTICO] Verificando integridade do sistema...');
  const ordersFile = path.join(DATA_DIR, 'orders.json');
  if (fs.existsSync(ordersFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
      console.log(`✅ Base de Pedidos íntegra: ${Array.isArray(data) ? data.length : 0} pedidos carregados.`);
    } catch (e: any) {
      console.error('❌ Erro no arquivo orders.json:', e.message);
    }
  } else {
    console.log('ℹ️ Base de pedidos ainda não inicializada.');
  }

  console.log('✅ Portas e ambiente:');
  console.log(`- Node: ${process.version}`);
  console.log(`- Diretório: ${process.cwd()}`);
}

if (process.argv[1] && process.argv[1].endsWith('diagnose.ts')) {
  runDiagnostic();
}
