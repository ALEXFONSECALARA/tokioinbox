// Espelha exatamente server/lib/permissions.js — qualquer alteração deve ser
// feita nos dois lugares. Mantido separado (em vez de importado) porque
// frontend (Vite) e backend (Node puro) não compartilham módulos neste
// projeto.
export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
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
