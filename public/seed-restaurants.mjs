// Gera server/data/restaurants.json (registro) e server/data/restaurants/<slug>/menu.json
// para os 4 restaurantes. Rode com: node scripts/seed-restaurants.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'server', 'data');

// Reaproveita o cardápio da hamburgueria se já existir (pra não perder edições
// feitas pelo admin); caso contrário usa os dados originais do Sabor & Brasa.
const hamburgueriaPath = path.join(DATA_DIR, 'restaurants', 'hamburgueria', 'menu.json');
const oldMenuPath = path.join(DATA_DIR, 'menu.json');
let oldMenu;
try {
  oldMenu = JSON.parse(readFileSync(hamburgueriaPath, 'utf-8'));
} catch {
  oldMenu = JSON.parse(readFileSync(oldMenuPath, 'utf-8'));
}

const baseConfig = (overrides) => ({
  name: '',
  tagline: '',
  logo: '',
  bannerImage: '',
  phone: '(11) 98765-4321',
  whatsapp: '5511987654321',
  address: 'Rua Exemplo, 123 - Centro',
  isOpen: true,
  openingHours: '18:00 - 23:30',
  deliveryFee: 6.5,
  minimumOrder: 20,
  estimatedDeliveryTime: '35-50 min',
  deliveryZones: [],
  drivers: [],
  pixKey: '',
  pixKeyType: 'random',
  instagram: '',
  allowTableOrders: false,
  totalTables: 0,
  splashEnabled: false,
  splashImages: [],
  splashDurationSeconds: 3,
  ...overrides,
});

const restaurants = {
  hamburgueria: {
    slug: 'hamburgueria',
    name: 'Sabor & Brasa Delivery',
    emoji: '🍔',
    color: '#D85A30',
    categories: oldMenu.categories,
    menuItems: oldMenu.menuItems,
    restaurantConfig: oldMenu.restaurantConfig,
  },
  japones: {
    slug: 'japones',
    name: 'Sakura Sushi House',
    emoji: '🍣',
    color: '#B91C1C',
    categories: [
      { id: 'entradas', name: 'Entradas', icon: '🥢' },
      { id: 'sushi', name: 'Sushi & Sashimi', icon: '🍣' },
      { id: 'quentes', name: 'Pratos Quentes', icon: '🍜' },
      { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
    ],
    menuItems: [
      { id: 'j1', name: 'Combinado Salmão (20 peças)', categoryId: 'sushi', description: 'Sushis e sashimis variados de salmão fresco', price: 69.9, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', available: true, tags: ['mais_vendido'] },
      { id: 'j2', name: 'Hot Roll Filadélfia', categoryId: 'sushi', description: 'Empanado, cream cheese e salmão', price: 32.9, image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'j3', name: 'Yakisoba de Frango', categoryId: 'quentes', description: 'Macarrão oriental com legumes e frango', price: 34.9, image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'j4', name: 'Gyoza (6 unidades)', categoryId: 'entradas', description: 'Pastelzinho japonês recheado com carne', price: 24.9, image: 'https://images.unsplash.com/photo-1541696490-8744a5dc0228?auto=format&fit=crop&w=600&q=80', available: true, tags: ['destaque'] },
      { id: 'j5', name: 'Temaki Salmão', categoryId: 'sushi', description: 'Cone de alga recheado com arroz e salmão', price: 26.9, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'j6', name: 'Refrigerante Lata', categoryId: 'bebidas', description: '350ml', price: 6.5, image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
    ],
    restaurantConfig: baseConfig({
      name: 'Sakura Sushi House',
      tagline: 'Culinária japonesa fresca, direto pro seu delivery',
      logo: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=300&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80',
      minimumOrder: 30,
    }),
  },
  italiano: {
    slug: 'italiano',
    name: 'Trattoria Bella Massa',
    emoji: '🍝',
    color: '#15803D',
    categories: [
      { id: 'entradas', name: 'Entradas', icon: '🫒' },
      { id: 'massas', name: 'Massas', icon: '🍝' },
      { id: 'risotos', name: 'Risotos', icon: '🍚' },
      { id: 'bebidas', name: 'Bebidas', icon: '🍷' },
    ],
    menuItems: [
      { id: 'i1', name: 'Fettuccine Alfredo', categoryId: 'massas', description: 'Massa fresca ao molho branco cremoso', price: 42.9, image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80', available: true, tags: ['mais_vendido'] },
      { id: 'i2', name: 'Lasanha à Bolonhesa', categoryId: 'massas', description: 'Camadas de massa, molho bolonhesa e queijos', price: 46.9, image: 'https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=600&q=80', available: true, tags: ['destaque'] },
      { id: 'i3', name: 'Risoto de Funghi', categoryId: 'risotos', description: 'Arroz arbóreo cremoso com cogumelos', price: 48.9, image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'i4', name: 'Bruschetta Tomate e Manjericão', categoryId: 'entradas', description: 'Pão italiano tostado com tomate fresco', price: 22.9, image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'i5', name: 'Nhoque ao Sugo', categoryId: 'massas', description: 'Nhoque de batata com molho de tomate', price: 39.9, image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'i6', name: 'Taça de Vinho Tinto', categoryId: 'bebidas', description: '150ml', price: 18.9, image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
    ],
    restaurantConfig: baseConfig({
      name: 'Trattoria Bella Massa',
      tagline: 'Massas artesanais como na Itália',
      logo: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=300&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?auto=format&fit=crop&w=1200&q=80',
      minimumOrder: 35,
    }),
  },
  pizza: {
    slug: 'pizza',
    name: "Pizzaria Forno d'Ouro",
    emoji: '🍕',
    color: '#CA8A04',
    categories: [
      { id: 'salgadas', name: 'Pizzas Salgadas', icon: '🍕' },
      { id: 'doces', name: 'Pizzas Doces', icon: '🍫' },
      { id: 'bordas', name: 'Bordas Recheadas', icon: '🧀' },
      { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
    ],
    menuItems: [
      { id: 'p1', name: 'Pizza Margherita (G)', categoryId: 'salgadas', description: 'Molho de tomate, mussarela e manjericão', price: 44.9, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80', available: true, tags: ['mais_vendido'] },
      { id: 'p2', name: 'Pizza Calabresa (G)', categoryId: 'salgadas', description: 'Calabresa fatiada, cebola e azeitona', price: 46.9, image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80', available: true, tags: ['destaque'] },
      { id: 'p3', name: 'Pizza Quatro Queijos (G)', categoryId: 'salgadas', description: 'Mussarela, provolone, parmesão e gorgonzola', price: 52.9, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'p4', name: 'Pizza Chocolate com Morango (G)', categoryId: 'doces', description: 'Chocolate ao leite e morangos frescos', price: 49.9, image: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'p5', name: 'Borda Recheada Catupiry', categoryId: 'bordas', description: 'Adicional de borda recheada', price: 8.9, image: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
      { id: 'p6', name: 'Refrigerante 2L', categoryId: 'bebidas', description: 'Coca-Cola, Guaraná ou Fanta', price: 12.9, image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80', available: true, tags: [] },
    ],
    restaurantConfig: baseConfig({
      name: "Pizzaria Forno d'Ouro",
      tagline: 'Pizza no forno a lenha, quentinha na sua casa',
      logo: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=300&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
      minimumOrder: 25,
    }),
  },
};

mkdirSync(DATA_DIR, { recursive: true });

const registry = Object.values(restaurants).map((r) => ({
  slug: r.slug,
  name: r.name,
  emoji: r.emoji,
  color: r.color,
}));
writeFileSync(path.join(DATA_DIR, 'restaurants.json'), JSON.stringify(registry, null, 2));

for (const r of Object.values(restaurants)) {
  const dir = path.join(DATA_DIR, 'restaurants', r.slug);
  mkdirSync(dir, { recursive: true });

  // Cada restaurante tem arquivos próprios e independentes: config.json (identidade,
  // delivery, pagamento, entregadores, splash...), menu.json (categorias + itens) e
  // orders.json (pedidos). Nunca existe um arquivo global compartilhado entre eles.
  const configFile = path.join(dir, 'config.json');
  if (!existsSync(configFile)) {
    writeFileSync(configFile, JSON.stringify(r.restaurantConfig, null, 2));
  }
  const menuFile = path.join(dir, 'menu.json');
  if (!existsSync(menuFile)) {
    writeFileSync(menuFile, JSON.stringify({ categories: r.categories, menuItems: r.menuItems }, null, 2));
  }
  const ordersFile = path.join(dir, 'orders.json');
  if (!existsSync(ordersFile)) {
    writeFileSync(ordersFile, JSON.stringify([], null, 2));
  }
  mkdirSync(path.join(dir, 'uploads'), { recursive: true });
}

console.log('Restaurantes gerados:', registry.map((r) => r.slug).join(', '));
