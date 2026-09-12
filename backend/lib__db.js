// Ponto único de acesso a dados usado por backend/index.js. Escolhe o backend
// automaticamente:
//   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY configurados → Supabase
//   - caso contrário → arquivos JSON (backend/), como sempre funcionou
//
// Isso implementa a migração gradual da seção 49 do prompt mestre: dá pra
// configurar o Supabase em produção (Render) enquanto o ambiente local de
// um dev continua funcionando sem nenhuma chave configurada. backend/index.js
// e o frontend não sabem (nem precisam saber) qual dos dois está em uso —
// as duas implementações devolvem exatamente o mesmo formato de dados.
import { supabaseEnabled } from './lib__supabaseClient.js';
import * as jsonDb from './lib__adapters__db.json.js';
import * as supabaseDb from './lib__adapters__db.supabase.js';

const production = process.env.RENDER === 'true' || String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (production && !supabaseEnabled) {
  throw new Error('Supabase é obrigatório em produção. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Render.');
}
const impl = supabaseEnabled ? supabaseDb : jsonDb;

export const backendName = supabaseEnabled ? 'supabase' : 'json';
export const getRestaurants = impl.getRestaurants;
export const getRestaurantsAdmin = impl.getRestaurantsAdmin;
export const setRestaurantActive = impl.setRestaurantActive;
export const restaurantExists = impl.restaurantExists;
export const restaurantIsActive = impl.restaurantIsActive;
export const readRestaurantData = impl.readRestaurantData;
export const listOrders = impl.listOrders;
export const getOrder = impl.getOrder;
export const createOrder = impl.createOrder;
export const updateOrder = impl.updateOrder;
export const updateMenuItems = impl.updateMenuItems;
export const updateCategories = impl.updateCategories;
export const updateConfig = impl.updateConfig;
export const getPlatformSettings = impl.getPlatformSettings;
export const updatePlatformSettings = impl.updatePlatformSettings;
// Usuários do painel + permissões granulares (Fase 4, itens 17-19)
export const listAdminUsers = impl.listAdminUsers;
export const getAdminUserByLogin = impl.getAdminUserByLogin;
export const getAdminUserById = impl.getAdminUserById;
export const createAdminUser = impl.createAdminUser;
export const updateAdminUser = impl.updateAdminUser;
// Contas de cliente + endereços salvos (Fase 4, itens 20-22)
export const createCustomer = impl.createCustomer;
export const getCustomerByPhone = impl.getCustomerByPhone;
export const listCustomers = impl.listCustomers;
export const deleteCustomer = impl.deleteCustomer;
export const getCustomerById = impl.getCustomerById;
export const updateCustomer = impl.updateCustomer;
export const listCustomerAddresses = impl.listCustomerAddresses;
export const createCustomerAddress = impl.createCustomerAddress;
export const updateCustomerAddress = impl.updateCustomerAddress;
export const deleteCustomerAddress = impl.deleteCustomerAddress;
export const listCustomerOrders = impl.listCustomerOrders;
export const clearCustomerOrderHistory = impl.clearCustomerOrderHistory;
// Notificações push + campanhas automáticas (Fase 4, itens 27-30)
export const createPushSubscription = impl.createPushSubscription;
export const deletePushSubscriptionByEndpoint = impl.deletePushSubscriptionByEndpoint;
export const deletePushSubscriptionsByIds = impl.deletePushSubscriptionsByIds;
export const listPushSubscriptions = impl.listPushSubscriptions;
export const listNotificationCampaigns = impl.listNotificationCampaigns;
export const getNotificationCampaignById = impl.getNotificationCampaignById;
export const listAllActiveCampaigns = impl.listAllActiveCampaigns;
export const createNotificationCampaign = impl.createNotificationCampaign;
export const updateNotificationCampaign = impl.updateNotificationCampaign;
export const deleteNotificationCampaign = impl.deleteNotificationCampaign;
// Assistente de atendimento com IA (Fase 4, itens 32-39)
export const findOrCreateAiConversation = impl.findOrCreateAiConversation;
export const getAiConversation = impl.getAiConversation;
export const listAiConversations = impl.listAiConversations;
export const updateAiConversationStatus = impl.updateAiConversationStatus;
export const addAiMessage = impl.addAiMessage;
export const listAiMessages = impl.listAiMessages;
// Biblioteca de imagens por restaurante
export const createMediaAsset = impl.createMediaAsset;
export const listMediaAssets = impl.listMediaAssets;
export const getMediaAssetById = impl.getMediaAssetById;
export const deleteMediaAsset = impl.deleteMediaAsset;
export const deleteOrder = impl.deleteOrder;
export const clearFinishedOrders = impl.clearFinishedOrders;
export const createAdminLoginLog = impl.createAdminLoginLog;
export const listAdminLoginLogs = impl.listAdminLoginLogs;
export const clearAdminLoginLogs = impl.clearAdminLoginLogs;
export const deleteAdminLoginLog = impl.deleteAdminLoginLog;
export const createErrorLog = impl.createErrorLog;
export const listErrorLogs = impl.listErrorLogs;
export const clearErrorLogs = impl.clearErrorLogs;
export const deleteErrorLog = impl.deleteErrorLog;
export const listPrintJobs = impl.listPrintJobs;
export const createPrintJob = impl.createPrintJob;
export const updatePrintJob = impl.updatePrintJob;
export const claimNextPrintJob = impl.claimNextPrintJob;

export const createRestaurantBackup = impl.createRestaurantBackup;
export const listRestaurantBackups = impl.listRestaurantBackups;
export const getRestaurantBackup = impl.getRestaurantBackup;
export const appendRealtimeEvent = impl.appendRealtimeEvent;
export const listRealtimeEvents = impl.listRealtimeEvents;
