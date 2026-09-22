import fs from 'fs';
import path from 'path';
import { IS_PRODUCTION } from './security';

/**
 * DIRETÓRIO DE DADOS PERSISTENTES
 * ---------------------------------------------------------------------------
 * Antes, cada serviço definia individualmente:
 *   const DATA_DIR = path.join(process.cwd(), 'data');
 *
 * Isso funciona em desenvolvimento, mas em qualquer plataforma de deploy com
 * sistema de arquivos EFÊMERO (Render, Railway, Fly, containers em geral sem
 * disco persistente anexado), a pasta `data/` — que guarda users.json,
 * state.json (caixa, mesas, config), orders.json, devices.json, printers.json,
 * catálogo etc. — é recriada do zero a cada novo deploy/restart. É essa a causa
 * real de "a senha do admin reseta a cada deploy": o usuário admin não está
 * sendo apagado por lógica de negócio, ele nunca chega a ser persistido de
 * verdade porque o disco em si não sobrevive ao deploy.
 *
 * Correção:
 * 1. `DATA_DIR` agora é configurável via variável de ambiente `DATA_DIR`,
 *    para apontar para um disco persistente real (ex.: no Render, um
 *    "Persistent Disk" montado em `/var/data`, configurando DATA_DIR=/var/data).
 * 2. Se `DATA_DIR` não for definida, o comportamento antigo é mantido
 *    (`process.cwd()/data`) — nada quebra para quem já roda assim.
 * 3. No boot, `checkDataPersistence()` verifica se a pasta parece "nova"
 *    (sem users.json) em produção e imprime um aviso alto e explícito no log,
 *    em vez de silenciosamente recriar o admin com uma senha diferente.
 *
 * Isso NÃO apaga, migra ou recria nada sozinho — apenas torna o caminho
 * configurável e o problema visível.
 */

const configured = process.env.DATA_DIR?.trim();
export const DATA_DIR = configured ? path.resolve(configured) : path.join(process.cwd(), 'data');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Chamar uma única vez no boot do servidor (server.ts). Não lança erro:
 * apenas loga um alerta visível quando parece que o disco de dados é novo
 * em produção, o que é o sintoma direto do bug "reset após deploy".
 */
export function checkDataPersistence() {
  ensureDataDir();
  const usersFile = path.join(DATA_DIR, 'users.json');
  const markerFile = path.join(DATA_DIR, '.persistence-check');
  const usersExisted = fs.existsSync(usersFile);
  const markerExisted = fs.existsSync(markerFile);

  try {
    fs.writeFileSync(
      markerFile,
      JSON.stringify({ lastBoot: new Date().toISOString(), dataDir: DATA_DIR }, null, 2),
      'utf-8'
    );
  } catch {
    // Se nem isso for gravável, o alerta abaixo já cobre o cenário.
  }

  if (IS_PRODUCTION && !usersExisted && !markerExisted) {
    console.warn('==========================================================');
    console.warn('[PERSISTÊNCIA] ATENÇÃO: nenhum dado anterior encontrado em');
    console.warn(`[PERSISTÊNCIA]   ${DATA_DIR}`);
    console.warn('[PERSISTÊNCIA] Isso é normal na primeira execução. Se isto');
    console.warn('[PERSISTÊNCIA] aparecer a CADA deploy, o disco não está sendo');
    console.warn('[PERSISTÊNCIA] persistido entre deploys (sistema de arquivos');
    console.warn('[PERSISTÊNCIA] efêmero). Usuários, senhas, mesas e caixa serão');
    console.warn('[PERSISTÊNCIA] perdidos a cada novo deploy até isso ser corrigido.');
    console.warn('[PERSISTÊNCIA] Correção: anexar um disco persistente da');
    console.warn('[PERSISTÊNCIA] plataforma de hospedagem e apontar a variável');
    console.warn('[PERSISTÊNCIA] de ambiente DATA_DIR para o caminho montado');
    console.warn('[PERSISTÊNCIA] (ex.: DATA_DIR=/var/data no Render).');
    console.warn('==========================================================');
  }

  return { dataDir: DATA_DIR, usersExisted, markerExisted };
}
