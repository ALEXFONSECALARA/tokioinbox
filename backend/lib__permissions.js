// Catálogo de permissões granulares do painel (Fase 4, itens 17-19).
//
// IMPORTANTE sobre o alcance real da aplicação destas permissões nesta
// entrega: o login "mestre" (senha única ADMIN_PASSWORD, que já existia e
// continua funcionando exatamente como antes) sempre tem acesso total —
// nenhum comportamento antigo muda pra quem usa essa senha.
//
// Para usuários individuais (novos, criados em /api/admin/users), as
// permissões abaixo são o catálogo completo pedido no prompt e já ficam
// salvas e editáveis no painel. A aplicação de fato (bloquear a ação no
// backend se a permissão não estiver marcada) hoje está implementada para:
//   - ADMIN_GERENCIAR_USUARIOS / RESTAURANTE_USUARIOS → rotas /api/admin/users
//   - ADMIN_ATIVAR_DESATIVAR_RESTAURANTES → PATCH /api/admin/restaurants/:slug/active
//   - ADMIN_GERENCIAR_RESTAURANTES → usada como "bypass" do isolamento por
//     restaurante (ver requireOwnRestaurant em server/index.js)
//   - Isolamento por restaurante (item 19/44): qualquer usuário vinculado a
//     um restaurante não acessa dados de outro restaurante, em nenhuma rota
//     protegida por :slug, a menos que tenha ADMIN_GERENCIAR_RESTAURANTES.
//
// As demais permissões (pedidos, cardápio, clientes, financeiro) já ficam
// definidas, salvas e prontas — a aplicação fina delas dentro de cada rota
// existente (ex: permitir "ver pedidos" mas bloquear "alterar status") é o
// próximo passo natural, listado nas pendências da entrega.
export const PERMISSION_GROUPS = [
  {
    id: 'pedidos',
    label: 'Pedidos',
    permissions: [
      { key: 'ver_pedidos', label: 'Ver pedidos' },
      { key: 'criar_pedido', label: 'Criar pedido' },
      { key: 'editar_pedido', label: 'Editar pedido' },
      { key: 'alterar_status_pedido', label: 'Alterar status' },
      { key: 'cancelar_pedido', label: 'Cancelar pedido' },
      { key: 'cancelar_varios', label: 'Cancelar vários' },
      { key: 'cancelar_todos', label: 'Cancelar todos' },
    ],
  },
  {
    id: 'cardapio',
    label: 'Cardápio',
    permissions: [
      { key: 'ver_cardapio', label: 'Ver cardápio' },
      { key: 'criar_produto', label: 'Criar produto' },
      { key: 'editar_produto', label: 'Editar produto' },
      { key: 'alterar_preco', label: 'Alterar preço' },
      { key: 'excluir_produto', label: 'Excluir produto' },
      { key: 'gerenciar_categorias', label: 'Gerenciar categorias' },
      { key: 'gerenciar_badges', label: 'Gerenciar badges' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    permissions: [
      { key: 'ver_clientes', label: 'Ver clientes' },
      { key: 'editar_clientes', label: 'Editar clientes' },
      { key: 'ver_historico', label: 'Ver histórico' },
      { key: 'gerenciar_historico', label: 'Excluir histórico' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    permissions: [
      { key: 'ver_vendas', label: 'Ver vendas' },
      { key: 'relatorios', label: 'Relatórios' },
      { key: 'configurar_taxas', label: 'Configurar taxas' },
    ],
  },
  {
    id: 'restaurante',
    label: 'Restaurante',
    permissions: [
      { key: 'restaurante_configuracoes', label: 'Configurações' },
      { key: 'restaurante_entrega', label: 'Entrega' },
      { key: 'restaurante_impressoras', label: 'Impressoras' },
      { key: 'restaurante_usuarios', label: 'Usuários (do próprio restaurante)' },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    permissions: [
      { key: 'admin_gerenciar_usuarios', label: 'Gerenciar usuários (todos os restaurantes)' },
      { key: 'admin_gerenciar_restaurantes', label: 'Gerenciar restaurantes' },
      { key: 'admin_ativar_desativar_restaurantes', label: 'Ativar/desativar restaurantes' },
      { key: 'admin_alterar_permissoes', label: 'Alterar permissões' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

// Filtra um objeto de permissões recebido do cliente pra só aceitar chaves
// conhecidas (nunca confiar cegamente no corpo da requisição) e garantir
// valores booleanos.
export function sanitizePermissions(incoming) {
  const clean = {};
  if (!incoming || typeof incoming !== 'object') return clean;
  for (const key of ALL_PERMISSION_KEYS) {
    if (incoming[key] === true) clean[key] = true;
  }
  return clean;
}
