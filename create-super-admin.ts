/**
 * Uso:
 *   npx tsx scripts/create-super-admin.ts seu-email@exemplo.com "SenhaForte123!" "Seu Nome"
 *
 * Exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY configurados no ambiente.
 * Só funciona uma vez: se já existir um super admin, o script recusa
 * (por segurança — para criar outros depois, use a área /admin logado).
 */
import 'dotenv/config';
import { bootstrapFirstSuperAdmin } from '../server/authServiceV2';

async function main() {
  const [email, password, fullName] = process.argv.slice(2);
  if (!email || !password || !fullName) {
    console.error('Uso: npx tsx scripts/create-super-admin.ts <email> <senha> "<nome completo>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('A senha precisa ter no mínimo 8 caracteres.');
    process.exit(1);
  }
  try {
    const result = await bootstrapFirstSuperAdmin(email, password, fullName);
    console.log('✅ Super Admin criado com sucesso:', result.email, `(id: ${result.id})`);
    console.log('Agora faça login normalmente pela tela de login administrativa.');
  } catch (err) {
    console.error('❌ Erro ao criar Super Admin:', (err as Error).message);
    process.exit(1);
  }
}

main();
