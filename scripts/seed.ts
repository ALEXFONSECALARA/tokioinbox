/**
 * scripts/seed.ts - Popula dados iniciais de demonstração para o sistema de restaurante
 * (Mesas, Cardápios multi-praça: Cozinha, SushiBar, Bar)
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export function runSeed() {
  console.log('🌱 [SEED] Iniciando seed de dados do sistema...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const ordersFile = path.join(DATA_DIR, 'orders.json');
  if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(ordersFile, JSON.stringify([], null, 2), 'utf-8');
    console.log('✅ Arquivo orders.json inicializado.');
  }

  const devicesFile = path.join(DATA_DIR, 'devices.json');
  if (!fs.existsSync(devicesFile)) {
    fs.writeFileSync(devicesFile, JSON.stringify([], null, 2), 'utf-8');
    console.log('✅ Arquivo devices.json inicializado.');
  }

  console.log('🎉 [SEED] Concluído com sucesso!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed();
}
