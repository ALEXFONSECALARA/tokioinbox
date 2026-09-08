import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_RESTAURANTS, INITIAL_CATEGORIES, INITIAL_MENU_ITEMS, INITIAL_SAMPLE_ORDERS, INITIAL_CUSTOMERS } from './src/data/seedData';
import { OrderStatus, RestaurantSlug } from './src/types/restaurant';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const serverStartTime = Date.now();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ADMIN_PASSWORD;
const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const RESTAURANT_SLUGS = Object.keys(INITIAL_RESTAURANTS) as RestaurantSlug[];

if (process.env.NODE_ENV === 'production' && (!ADMIN_PASSWORD || !SESSION_SECRET)) {
  throw new Error('ADMIN_PASSWORD e SESSION_SECRET são obrigatórios em produção.');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  if (allowedOrigins.includes(req.get('origin') || '')) res.setHeader('Access-Control-Allow-Origin', req.get('origin')!);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const clients = new Set<Response>();
const restaurantClients = new Map<string, Set<Response>>();
function sse(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}
function broadcast(event: string, payload: any, slug?: string) {
  const targets = slug ? restaurantClients.get(slug) || new Set<Response>() : clients;
  targets.forEach(res => { try { sse(res, event, payload); } catch {} });
  if (slug) clients.forEach(res => { try { sse(res, event, payload); } catch {} });
}

function signSession(payload: { sub: string; role: string; exp: number }) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifySession(token: string | undefined) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch { return null; }
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.get('authorization') || '';
  const session = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : undefined);
  if (!session || session.role !== 'superadmin') return res.status(401).json({ error: 'Sessão administrativa inválida ou expirada.', code: 'AUTH_REQUIRED', requestId: (req as any).requestId });
  (req as any).session = session;
  next();
}
function assertSlug(slug: string): asserts slug is RestaurantSlug {
  if (!RESTAURANT_SLUGS.includes(slug as RestaurantSlug)) throw Object.assign(new Error('Restaurante não encontrado.'), { status: 404, code: 'RESTAURANT_NOT_FOUND' });
}
function cleanOrder(row: any): any {
  return {
    ...(row.data || {}),
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    restaurantName: row.restaurant_name,
    status: row.status,
    total: Number(row.total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusHistory: row.status_history || [],
    printStatus: row.print_status || 'pendente',
  };
}

async function dbOrThrow() {
  if (!supabase) throw Object.assign(new Error('Supabase não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'), { status: 503, code: 'SUPABASE_NOT_CONFIGURED' });
  return supabase;
}

async function seedDatabase() {
  const db = await dbOrThrow();
  const { data: existingRestaurants, error } = await db.from('restaurants').select('slug').limit(1);
  if (error) throw new Error(`Falha ao verificar restaurantes: ${error.message}`);
  if ((existingRestaurants || []).length) return { seeded: false };

  for (const restaurant of Object.values(INITIAL_RESTAURANTS)) {
    const { error: e } = await db.from('restaurants').upsert({ slug: restaurant.slug, name: restaurant.name, config: restaurant, updated_at: new Date().toISOString() });
    if (e) throw new Error(`Falha ao semear restaurante ${restaurant.slug}: ${e.message}`);
  }
  const categories = INITIAL_CATEGORIES.map(c => ({ id: c.id, restaurant_slug: c.restaurantSlug, name: c.name, icon: c.icon || null, sort_order: c.order }));
  const { error: ce } = await db.from('menu_categories').upsert(categories);
  if (ce) throw new Error(`Falha ao semear categorias: ${ce.message}`);
  const items = INITIAL_MENU_ITEMS.map(i => ({ id: i.id, restaurant_slug: i.restaurantSlug, category_id: i.categoryId, name: i.name, data: i, available: i.available, updated_at: new Date().toISOString() }));
  const { error: ie } = await db.from('menu_items').upsert(items);
  if (ie) throw new Error(`Falha ao semear cardápio: ${ie.message}`);
  const customers = INITIAL_CUSTOMERS.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email || null, data: c, created_at: c.createdAt, updated_at: c.createdAt }));
  const { error: custErr } = await db.from('customers').upsert(customers);
  if (custErr) throw new Error(`Falha ao semear clientes: ${custErr.message}`);
  // Seed sample orders only when explicitly enabled; production starts clean by default.
  if (process.env.SEED_SAMPLE_ORDERS === 'true') {
    for (const order of INITIAL_SAMPLE_ORDERS) {
      await createOrderViaRpc(db, order);
    }
  }
  return { seeded: true };
}

async function createOrderViaRpc(db: SupabaseClient, order: any) {
  const payload = { ...order };
  const { data, error } = await db.rpc('create_order_atomic', {
    p_order: {
      ...payload,
      restaurantSlug: order.restaurantSlug,
      restaurantName: order.restaurantName,
    },
    p_items: order.items || [],
  });
  if (error) throw error;
  return data;
}

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'not_configured';
  if (supabase) {
    const { error } = await supabase.from('restaurants').select('slug').limit(1);
    dbStatus = error ? 'error' : 'connected';
  }
  res.json({ status: dbStatus === 'connected' ? 'ok' : 'degraded', system: 'Tokio inBox Multicardápio', version: '1.0.0', uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000), database: dbStatus, restaurants: RESTAURANT_SLUGS, realtimeClients: clients.size, timestamp: new Date().toISOString() });
});
app.get('/api/health/ready', async (_req, res) => {
  if (!supabase) return res.status(503).json({ ready: false, code: 'SUPABASE_NOT_CONFIGURED' });
  const { error } = await supabase.from('restaurants').select('slug').limit(1);
  return error ? res.status(503).json({ ready: false, error: error.message }) : res.json({ ready: true });
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD || req.body?.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha administrativa inválida.', code: 'INVALID_CREDENTIALS', requestId: (req as any).requestId });
  const token = signSession({ sub: 'superadmin', role: 'superadmin', exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  res.json({ token, expiresIn: SESSION_TTL_SECONDS });
});
app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ authenticated: true, role: 'superadmin' }));

app.get('/api/public/:slug', async (req, res, next) => {
  try {
    assertSlug(req.params.slug);
    const db = await dbOrThrow();
    const [{ data: r, error: re }, { data: cats, error: ce }, { data: items, error: ie }] = await Promise.all([
      db.from('restaurants').select('slug,name,config').eq('slug', req.params.slug).single(),
      db.from('menu_categories').select('*').eq('restaurant_slug', req.params.slug).order('sort_order'),
      db.from('menu_items').select('*').eq('restaurant_slug', req.params.slug).eq('available', true).order('name'),
    ]);
    if (re || !r) throw Object.assign(new Error(re?.message || 'Restaurante não encontrado'), { status: 404, code: 'RESTAURANT_NOT_FOUND' });
    if (ce) throw ce; if (ie) throw ie;
    res.json({ restaurant: r.config, categories: (cats || []).map(c => ({ id: c.id, restaurantSlug: c.restaurant_slug, name: c.name, icon: c.icon, order: c.sort_order })), menuItems: (items || []).map(i => i.data) });
  } catch (e) { next(e); }
});

app.get('/api/admin/bootstrap', requireAdmin, async (_req, res, next) => {
  try {
    const db = await dbOrThrow();
    const [rs, cs, mi, os, cust] = await Promise.all([
      db.from('restaurants').select('*').order('slug'),
      db.from('menu_categories').select('*').order('restaurant_slug').order('sort_order'),
      db.from('menu_items').select('*').order('restaurant_slug').order('name'),
      db.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
      db.from('customers').select('*').order('updated_at', { ascending: false }).limit(5000),
    ]);
    const err = [rs,cs,mi,os,cust].find(x => x.error)?.error;
    if (err) throw err;
    const restaurants: Record<string, any> = {}; (rs.data || []).forEach(r => { restaurants[r.slug] = r.config; });
    res.json({ restaurants, categories: (cs.data || []).map(c => ({ id:c.id, restaurantSlug:c.restaurant_slug, name:c.name, icon:c.icon, order:c.sort_order })), menuItems:(mi.data||[]).map(i=>i.data), orders:(os.data||[]).map(cleanOrder), customers:(cust.data||[]).map(c=>c.data) });
  } catch (e) { next(e); }
});

app.get('/api/:slug/orders', requireAdmin, async (req,res,next) => {
  try { assertSlug(req.params.slug); const db=await dbOrThrow(); const {data,error}=await db.from('orders').select('*').eq('restaurant_slug',req.params.slug).order('created_at',{ascending:false}).limit(1000); if(error) throw error; res.json((data||[]).map(cleanOrder)); } catch(e){next(e);} 
});
app.get('/api/admin/orders', requireAdmin, async (_req,res,next) => {
  try { const db=await dbOrThrow(); const {data,error}=await db.from('orders').select('*').order('created_at',{ascending:false}).limit(1000); if(error) throw error; res.json((data||[]).map(cleanOrder)); } catch(e){next(e);} 
});

app.post('/api/:slug/orders', async (req,res,next) => {
  try {
    assertSlug(req.params.slug); const db=await dbOrThrow();
    const body=req.body || {}; const cart=Array.isArray(body.items)?body.items:[];
    if(!cart.length) throw Object.assign(new Error('O pedido precisa ter pelo menos um item.'),{status:400,code:'EMPTY_ORDER'});
    const {data:rest,error:re}=await db.from('restaurants').select('config').eq('slug',req.params.slug).single(); if(re||!rest) throw Object.assign(new Error('Restaurante não encontrado.'),{status:404,code:'RESTAURANT_NOT_FOUND'});
    if(rest.config?.isOpen === false) throw Object.assign(new Error('Este restaurante está fechado no momento.'),{status:409,code:'RESTAURANT_CLOSED'});
    const subtotal=cart.reduce((s:number,i:any)=>s+Number(i.totalPrice||0),0); const discount=Math.min(Number(body.discount||0),subtotal); const deliveryFee=body.orderType==='delivery'?Number(rest.config?.deliveryFee||0):0; const total=Math.max(0,subtotal-discount+deliveryFee);
    const order={ id:crypto.randomUUID(), shortCode:`#TK-${Math.floor(1000+Math.random()*9000)}`, restaurantSlug:req.params.slug, restaurantName:rest.config.name, customerName:String(body.customerName||'').trim(), customerPhone:String(body.customerPhone||'').trim(), orderType:body.orderType||'delivery', tableNumber:body.tableNumber, deliveryAddress:body.deliveryAddress, items:cart, subtotal, deliveryFee, discount, couponCode:body.couponCode, total, paymentMethod:body.paymentMethod||'pix', paymentDetails:body.paymentDetails, notes:body.notes, status:'recebido', statusHistory:[{status:'recebido',timestamp:new Date().toISOString(),note:'Pedido recebido pelo cardápio online'}], printStatus:'pendente', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    if(!order.customerName || !order.customerPhone) throw Object.assign(new Error('Nome e telefone são obrigatórios.'),{status:400,code:'CUSTOMER_REQUIRED'});
    const {data,error}=await db.rpc('create_order_atomic',{p_order:order,p_items:cart});
    if(error) throw Object.assign(new Error(error.message),{status:500,code:error.code||'ORDER_CREATE_FAILED'});
    const savedId=typeof data==='string'?data:data?.id||order.id;
    const phone=order.customerPhone.replace(/\D/g,'');
    const {data:existingCustomer}=await db.from('customers').select('*').eq('phone',phone).limit(1);
    const previous=Array.isArray(existingCustomer)?existingCustomer[0]:existingCustomer;
    const customerData={...(previous?.data||{}),id:previous?.id||crypto.randomUUID(),name:order.customerName,phone:order.customerPhone,totalOrders:Number(previous?.data?.totalOrders||0)+1,totalSpent:Number(previous?.data?.totalSpent||0)+Number(order.total),lastOrderAt:order.createdAt,preferredRestaurant:req.params.slug,addresses:previous?.data?.addresses||[]};
    await db.from('customers').upsert({id:customerData.id,name:customerData.name,phone:customerData.phone,email:previous?.email||null,data:customerData,created_at:previous?.created_at||order.createdAt,updated_at:new Date().toISOString()});
    const {data:saved,error:se}=await db.from('orders').select('*').eq('id',savedId).single(); if(se||!saved) throw se||new Error('Pedido criado mas não pôde ser lido');
    broadcast('order-created',cleanOrder(saved),req.params.slug); res.status(201).json(cleanOrder(saved));
  } catch(e){next(e);} 
});

const transitions: Record<OrderStatus, OrderStatus[]> = { recebido:['em_preparo','cancelado'], em_preparo:['pronto','cancelado'], pronto:['saiu_para_entrega','cancelado'], saiu_para_entrega:['entregue','cancelado'], entregue:[], cancelado:[] };
app.patch('/api/:slug/orders/:id/status', requireAdmin, async (req,res,next)=>{
  try { assertSlug(req.params.slug); const db=await dbOrThrow(); const {data:current,error:ce}=await db.from('orders').select('*').eq('id',req.params.id).eq('restaurant_slug',req.params.slug).single(); if(ce||!current) throw Object.assign(new Error('Pedido não encontrado neste restaurante.'),{status:404,code:'ORDER_NOT_FOUND'}); const nextStatus=req.body?.status as OrderStatus; if(!transitions[current.status as OrderStatus]?.includes(nextStatus)) throw Object.assign(new Error(`Transição inválida: ${current.status} → ${nextStatus}`),{status:409,code:'INVALID_ORDER_TRANSITION'}); const history=[...(current.status_history||[]),{status:nextStatus,timestamp:new Date().toISOString(),note:req.body?.note||undefined}]; const patch={status:nextStatus,status_history:history,updated_at:new Date().toISOString(),data:{...(current.data||{}),status:nextStatus,statusHistory:history,updatedAt:new Date().toISOString()}}; const {data,error}=await db.from('orders').update(patch).eq('id',req.params.id).eq('restaurant_slug',req.params.slug).eq('updated_at',current.updated_at).select('*').single(); if(error) throw Object.assign(new Error(error.message),{status:error.code==='PGRST116'?409:500,code:error.code||'ORDER_UPDATE_FAILED'}); broadcast('order-updated',cleanOrder(data),req.params.slug); res.json(cleanOrder(data)); } catch(e){next(e);} 
});
app.delete('/api/:slug/orders/:id', requireAdmin, async (req,res,next)=>{ try{assertSlug(req.params.slug);const db=await dbOrThrow();const {error}=await db.from('orders').delete().eq('id',req.params.id).eq('restaurant_slug',req.params.slug).in('status',['entregue','cancelado']);if(error)throw error;broadcast('order-deleted',{id:req.params.id,restaurantSlug:req.params.slug},req.params.slug);res.status(204).end();}catch(e){next(e);} });
app.delete('/api/:slug/orders/history', requireAdmin, async(req,res,next)=>{try{assertSlug(req.params.slug);const db=await dbOrThrow();const {data,error}=await db.from('orders').delete().eq('restaurant_slug',req.params.slug).in('status',['entregue','cancelado']).select('id');if(error)throw error;broadcast('history-cleared',{restaurantSlug:req.params.slug,count:(data||[]).length},req.params.slug);res.json({deleted:(data||[]).length});}catch(e){next(e);}});

app.patch('/api/:slug/menu-items/:id', requireAdmin, async(req,res,next)=>{try{assertSlug(req.params.slug);const db=await dbOrThrow();const item={...req.body, id:req.params.id, restaurantSlug:req.params.slug};const {data,error}=await db.from('menu_items').update({name:item.name,category_id:item.categoryId,data:item,available:item.available,updated_at:new Date().toISOString()}).eq('id',req.params.id).eq('restaurant_slug',req.params.slug).select('*').single();if(error)throw error;broadcast('menu-updated',{restaurantSlug:req.params.slug,item:data.data},req.params.slug);res.json(data.data);}catch(e){next(e);}});
app.post('/api/:slug/menu-items', requireAdmin, async(req,res,next)=>{try{assertSlug(req.params.slug);const db=await dbOrThrow();const item={...req.body,id:req.body.id||crypto.randomUUID(),restaurantSlug:req.params.slug};const {data,error}=await db.from('menu_items').insert({id:item.id,restaurant_slug:req.params.slug,category_id:item.categoryId,name:item.name,data:item,available:item.available!==false,updated_at:new Date().toISOString()}).select('*').single();if(error)throw error;broadcast('menu-updated',{restaurantSlug:req.params.slug,item:data.data},req.params.slug);res.status(201).json(data.data);}catch(e){next(e);}});
app.delete('/api/:slug/menu-items/:id', requireAdmin, async(req,res,next)=>{try{assertSlug(req.params.slug);const db=await dbOrThrow();const {error}=await db.from('menu_items').delete().eq('id',req.params.id).eq('restaurant_slug',req.params.slug);if(error)throw error;broadcast('menu-updated',{restaurantSlug:req.params.slug,deletedId:req.params.id},req.params.slug);res.status(204).end();}catch(e){next(e);}});

app.patch('/api/:slug/config', requireAdmin, async(req,res,next)=>{try{assertSlug(req.params.slug);const db=await dbOrThrow();const {data:current,error:ce}=await db.from('restaurants').select('config').eq('slug',req.params.slug).single();if(ce)throw ce;const config={...(current?.config||{}),...(req.body||{}),slug:req.params.slug};const {data,error}=await db.from('restaurants').update({name:config.name,config,updated_at:new Date().toISOString()}).eq('slug',req.params.slug).select('*').single();if(error)throw error;broadcast('config-updated',{restaurantSlug:req.params.slug,config:data.config},req.params.slug);res.json(data.config);}catch(e){next(e);}});

app.get('/api/admin/customers',requireAdmin,async(_req,res,next)=>{try{const db=await dbOrThrow();const {data,error}=await db.from('customers').select('*').order('updated_at',{ascending:false});if(error)throw error;res.json((data||[]).map(c=>c.data));}catch(e){next(e);}});
app.delete('/api/admin/customers/:id',requireAdmin,async(req,res,next)=>{try{const db=await dbOrThrow();const {error}=await db.from('customers').delete().eq('id',req.params.id);if(error)throw error;res.status(204).end();}catch(e){next(e);}});
app.post('/api/admin/customers',requireAdmin,async(req,res,next)=>{try{const db=await dbOrThrow();const id=req.body?.id||crypto.randomUUID();const now=new Date().toISOString();const data={...req.body,id,createdAt:req.body?.createdAt||now};const {data:row,error}=await db.from('customers').upsert({id,name:data.name,phone:data.phone,email:data.email||null,data,created_at:data.createdAt,updated_at:now}).select('*').single();if(error)throw error;res.status(201).json(row.data);}catch(e){next(e);}});
app.patch('/api/admin/customers/:id',requireAdmin,async(req,res,next)=>{try{const db=await dbOrThrow();const {data:old,error:oe}=await db.from('customers').select('data').eq('id',req.params.id).single();if(oe)throw oe;const data={...(old?.data||{}),...(req.body||{}),id:req.params.id};const {data:row,error}=await db.from('customers').update({name:data.name,phone:data.phone,email:data.email||null,data,updated_at:new Date().toISOString()}).eq('id',req.params.id).select('*').single();if(error)throw error;res.json(row.data);}catch(e){next(e);}});
app.delete('/api/admin/orders',requireAdmin,async(_req,res,next)=>{try{const db=await dbOrThrow();const {error}=await db.from('orders').delete().neq('id','00000000-0000-0000-0000-000000000000');if(error)throw error;broadcast('history-cleared',{scope:'all'});res.json({deleted:true});}catch(e){next(e);}});

app.get('/api/events', (req,res)=>{const token=String(req.query.token||''); if(!verifySession(token)) return res.status(401).end();res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders?.();clients.add(res);sse(res,'connected',{timestamp:new Date().toISOString()});const timer=setInterval(()=>{try{sse(res,'heartbeat',{timestamp:new Date().toISOString()});}catch{}},20000);req.on('close',()=>{clearInterval(timer);clients.delete(res);});});
app.get('/api/:slug/events', (req,res)=>{const token=String(req.query.token||''); if(!verifySession(token)) return res.status(401).end();assertSlug(req.params.slug);res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders?.();const set=restaurantClients.get(req.params.slug)||new Set<Response>();set.add(res);restaurantClients.set(req.params.slug,set);sse(res,'connected',{restaurantSlug:req.params.slug});const timer=setInterval(()=>{try{sse(res,'heartbeat',{timestamp:new Date().toISOString()});}catch{}},20000);req.on('close',()=>{clearInterval(timer);set.delete(res);});});

// AI endpoints remain server-side only.
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(){if(!geminiClient){if(!process.env.GEMINI_API_KEY)throw new Error('GEMINI_API_KEY não configurada');geminiClient=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});}return geminiClient;}
app.post('/api/ai/recommend',async(req,res)=>{try{if(!process.env.GEMINI_API_KEY)return res.json({recommendation:'Sugestão do Chef: finalize seu pedido com uma bebida ou sobremesa da casa.',fallback:true});const response=await getGeminiClient().models.generateContent({model:process.env.GEMINI_MODEL||'gemini-2.5-flash',contents:`Recomende em 2 frases uma bebida ou sobremesa para ${req.body?.restaurantSlug}, considerando: ${JSON.stringify(req.body?.currentItems||[])}.`});res.json({recommendation:response.text||'Recomendação indisponível.',fallback:false});}catch{res.json({recommendation:'Sugestão do Chef: finalize seu pedido com uma bebida ou sobremesa da casa.',fallback:true});}});
app.post('/api/ai/smart-ticket',async(req,res)=>{try{const order=req.body?.order; if(!order)return res.status(400).json({error:'Dados do pedido são obrigatórios'});if(!process.env.GEMINI_API_KEY)return res.json({stationRouting:['Cozinha / Produção'],allergyWarnings:[order.notes?'Conferir observações do cliente.':'Nenhuma observação crítica.'],preparationSequence:['1. Separar itens','2. Preparar','3. Conferir e embalar'],estimatedPrepMinutes:20,chefMessage:'Feito com carinho!',fallback:true});const response=await getGeminiClient().models.generateContent({model:process.env.GEMINI_MODEL||'gemini-2.5-flash',contents:`Analise este pedido e retorne JSON com stationRouting, allergyWarnings, preparationSequence, estimatedPrepMinutes e chefMessage: ${JSON.stringify(order)}`,config:{responseMimeType:'application/json'}});res.json({...JSON.parse(response.text||'{}'),fallback:false});}catch{res.json({stationRouting:['Cozinha / Produção'],allergyWarnings:['Conferir observações do cliente'],preparationSequence:['1. Preparar','2. Embalar'],estimatedPrepMinutes:20,chefMessage:'Feito com carinho!',fallback:true});}});

app.use((err:any,req:Request,res:Response,_next:NextFunction)=>{const status=Number(err?.status)||500;const code=err?.code||'INTERNAL_ERROR';console.error(`[${code}]`,err?.message||err);if(!res.headersSent)res.status(status).json({error:err?.message||'Erro interno do servidor.',code,requestId:(req as any).requestId});});

async function startServer(){
  if (supabase) { try { const seed=await seedDatabase(); console.log(seed.seeded?'[db] Seed inicial aplicado.':'[db] Banco já inicializado.'); } catch(e){ console.error('[db] Falha na inicialização:',e); if(process.env.NODE_ENV==='production') process.exit(1); } }
  if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);} else {const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>console.log(`Tokio inBox online em 0.0.0.0:${PORT}`));
}
startServer();
