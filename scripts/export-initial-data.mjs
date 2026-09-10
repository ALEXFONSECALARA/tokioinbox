import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS, INITIAL_RESTAURANT_CONFIG } from '../src/data/initialData.ts';
import { writeFileSync } from 'fs';

const data = {
  categories: INITIAL_CATEGORIES,
  menuItems: INITIAL_MENU_ITEMS,
  restaurantConfig: INITIAL_RESTAURANT_CONFIG,
};

writeFileSync(new URL('../server/data/menu.json', import.meta.url), JSON.stringify(data, null, 2));
console.log('menu.json gerado com sucesso.');
