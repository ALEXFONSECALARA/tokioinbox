#!/usr/bin/env node
// Migração: separa config.json do menu.json por restaurante.
//
// ANTES:  server/data/restaurants/<slug>/menu.json  = { restaurantConfig, menuItems, categories }
// DEPOIS: server/data/restaurants/<slug>/config.json = { ...restaurantConfig }
//         server/data/restaurants/<slug>/menu.json   = { menuItems, categories }
//         server/data/restaurants/<slug>/orders.json = (inalterado)
//         server/data/restaurants/<slug>/uploads/    = (criada, se não existir)
//
// Faz backup de toda a pasta server/data/ ANTES de qualquer alteração, em
// server/data-backup-<timestamp>/. Se um restaurante já tiver config.json
// (ex: rodou a migração de novo), ele é pulado — a migração não sobrescreve
// nada silenciosamente.
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile, mkdir, cp, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
const RESTAURANTS_DIR = path.join(DATA_DIR, 'restaurants');

async function main() {
  if (!existsSync(RESTAURANTS_DIR)) {
    console.log('Nenhuma pasta server/data/restaurants encontrada — nada a migrar.');
    return;
  }

  const slugs = (await readdir(RESTAURANTS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (slugs.length === 0) {
    console.log('Nenhum restaurante encontrado — nada a migrar.');
    return;
  }

  // Só migra restaurantes que ainda não têm config.json separado
  const pending = [];
  for (const slug of slugs) {
    const configPath = path.join(RESTAURANTS_DIR, slug, 'config.json');
    const menuPath = path.join(RESTAURANTS_DIR, slug, 'menu.json');
    if (!existsSync(configPath) && existsSync(menuPath)) {
      pending.push(slug);
    }
  }

  if (pending.length === 0) {
    console.log('Todos os restaurantes já estão no formato novo (config.json separado). Nada a fazer.');
    return;
  }

  // 1) Backup completo de server/data/ antes de tocar em qualquer coisa
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'server', `data-backup-${timestamp}`);
  await cp(DATA_DIR, backupDir, { recursive: true });
  console.log(`✅ Backup completo criado em: server/data-backup-${timestamp}/`);

  // 2) Migra cada restaurante pendente
  for (const slug of pending) {
    const menuPath = path.join(RESTAURANTS_DIR, slug, 'menu.json');
    const configPath = path.join(RESTAURANTS_DIR, slug, 'config.json');
    const uploadsDir = path.join(RESTAURANTS_DIR, slug, 'uploads');

    const raw = JSON.parse(await readFile(menuPath, 'utf-8'));
    const { restaurantConfig, menuItems, categories, ...rest } = raw;

    if (!restaurantConfig) {
      console.warn(`⚠️  ${slug}: menu.json não tem "restaurantConfig" — pulando (nada a separar).`);
      continue;
    }

    // Escreve o config.json separado (dados 100% preservados, nada foi editado)
    await writeFile(configPath, JSON.stringify(restaurantConfig, null, 2), 'utf-8');

    // Reescreve o menu.json só com cardápio (categorias/itens), sem duplicar a config
    await writeFile(menuPath, JSON.stringify({ menuItems, categories, ...rest }, null, 2), 'utf-8');

    // Garante a pasta de uploads local do restaurante
    await mkdir(uploadsDir, { recursive: true });

    console.log(`✅ ${slug}: config.json criado, menu.json separado, uploads/ garantida.`);
  }

  console.log('\nMigração concluída. Nenhum dado foi apagado — o backup completo está em');
  console.log(`server/data-backup-${timestamp}/ caso precise conferir ou reverter.`);
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
