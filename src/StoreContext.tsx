import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  RestaurantConfig, RestaurantSlug, MenuCategory, MenuItem, Order, CartItem, CartItemOptionSelected,
  OrderType, OrderStatus, PaymentMethod, CustomerRecord, PrinterSettings,
} from '../types/restaurant';
import { INITIAL_RESTAURANTS, INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../data/seedData';
import { adminLogin as apiAdminLogin, adminLogout as apiAdminLogout, apiFetch, hasAdminToken, openAdminEvents } from '../utils/api';

interface Coupon { code:string; type:'percent'|'fixed'; value:number; minSubtotal?:number; }
const VALID_COUPONS: Coupon[]=[
  {code:'BEMVINDO10',type:'percent',value:10,minSubtotal:30},
  {code:'TOKIO5',type:'fixed',value:5,minSubtotal:25},
  {code:'PRIMEIRACOMPRA',type:'percent',value:15,minSubtotal:40},
];
const DEFAULT_PRINTER_SETTINGS: PrinterSettings={paperWidth:'80mm',autoPrintOnNewOrder:false,soundAlert:true,showQrCode:true,numberOfCopies:1,enableSmartTicketAI:true,defaultPrinterName:'Impressora Cozinha ESC/POS'};

type StoreContextType={
 restaurants:Record<string,RestaurantConfig>; categories:MenuCategory[]; menuItems:MenuItem[]; orders:Order[]; customers:CustomerRecord[]; cart:CartItem[]; orderType:OrderType; selectedTable:number|null; activeRestaurantSlug:RestaurantSlug; isCartOpen:boolean; appliedCoupon:Coupon|null; trackingOrderId:string|null; currentRestaurant:RestaurantConfig; cartItemCount:number; cartTotal:number; printerSettings:PrinterSettings; isLoading:boolean; isAdminAuthenticated:boolean;
 setActiveRestaurantSlug:(slug:RestaurantSlug)=>void; setOrderType:(type:OrderType)=>void; setSelectedTable:(table:number|null)=>void; setIsCartOpen:(open:boolean)=>void; setTrackingOrderId:(id:string|null)=>void;
 addToCart:(item:MenuItem,quantity:number,selectedOptions:CartItemOptionSelected[],notes?:string)=>void; updateCartItemQuantity:(id:string,delta:number)=>void; removeFromCart:(id:string)=>void; clearCart:()=>void; applyCoupon:(code:string)=>{success:boolean;message:string}; removeCoupon:()=>void;
 createOrder:(data:any)=>Promise<Order>; updateOrderStatus:(id:string,status:OrderStatus,note?:string)=>Promise<void>; updateOrderPrintStatus:(id:string,status:'pendente'|'imprimindo'|'impresso')=>Promise<void>; deleteOrder:(id:string)=>Promise<void>; clearOrdersHistory:(slug?:RestaurantSlug,mode?:'finished'|'all')=>Promise<void>; clearAllOrders:()=>Promise<void>;
 clearCustomersData:()=>Promise<void>; deleteCustomer:(id:string)=>Promise<void>; addCustomer:(data:Omit<CustomerRecord,'id'|'createdAt'>)=>Promise<void>; updateCustomerNotes:(id:string,notes:string)=>Promise<void>;
 updatePrinterSettings:(settings:Partial<PrinterSettings>)=>Promise<void>; updateMenuItem:(item:MenuItem)=>Promise<void>; addMenuItem:(item:Omit<MenuItem,'id'>)=>Promise<void>; deleteMenuItem:(id:string)=>Promise<void>; updateRestaurantConfig:(slug:RestaurantSlug,updates:Partial<RestaurantConfig>)=>Promise<void>; resetToDefaultData:()=>void;
 adminLogin:(password:string)=>Promise<void>; adminLogout:()=>void; refreshAdminData:()=>Promise<void>;
};
const StoreContext=createContext<StoreContextType|null>(null);

function orderFromApi(o:any):Order{return o as Order;}
export const StoreProvider=({children}:{children:ReactNode})=>{
 const [restaurants,setRestaurants]=useState<Record<string,RestaurantConfig>>(INITIAL_RESTAURANTS);
 const [categories,setCategories]=useState<MenuCategory[]>(INITIAL_CATEGORIES);
 const [menuItems,setMenuItems]=useState<MenuItem[]>(INITIAL_MENU_ITEMS);
 const [orders,setOrders]=useState<Order[]>([]);
 const [customers,setCustomers]=useState<CustomerRecord[]>([]);
 const [cart,setCart]=useState<CartItem[]>(()=>{try{return JSON.parse(localStorage.getItem('tokio_cart')||'[]')}catch{return[]}});
 const [activeRestaurantSlug,setActiveRestaurantSlug]=useState<RestaurantSlug>('japones');
 const [orderType,setOrderType]=useState<OrderType>('delivery'); const [selectedTable,setSelectedTable]=useState<number|null>(null); const [isCartOpen,setIsCartOpen]=useState(false); const [appliedCoupon,setAppliedCoupon]=useState<Coupon|null>(null); const [trackingOrderId,setTrackingOrderId]=useState<string|null>(null); const [printerSettings,setPrinterSettings]=useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS); const [isLoading,setIsLoading]=useState(true); const [isAdminAuthenticated,setIsAdminAuthenticated]=useState(hasAdminToken());
 const refreshPublic=async(slug:RestaurantSlug)=>{try{const data=await apiFetch<any>(`/api/public/${slug}`);setRestaurants(p=>({...p,[slug]:data.restaurant}));setCategories(p=>[...p.filter(c=>c.restaurantSlug!==slug),...data.categories]);setMenuItems(p=>[...p.filter(i=>i.restaurantSlug!==slug),...data.menuItems]);}catch(e){console.warn('Public API indisponível, usando dados locais.',e);}};
 const refreshAdminData=async()=>{try{const data=await apiFetch<any>('/api/admin/bootstrap');setRestaurants(data.restaurants);setCategories(data.categories);setMenuItems(data.menuItems);setOrders(data.orders);setCustomers(data.customers);const cfg=data.restaurants[activeRestaurantSlug];if(cfg?.printerSettings)setPrinterSettings({...DEFAULT_PRINTER_SETTINGS,...cfg.printerSettings});setIsAdminAuthenticated(true);}catch(e){setIsAdminAuthenticated(false);throw e;}finally{setIsLoading(false);}};
 useEffect(()=>{(async()=>{setIsLoading(true);await Promise.all((Object.keys(INITIAL_RESTAURANTS) as RestaurantSlug[]).map(refreshPublic));if(hasAdminToken())try{await refreshAdminData()}catch{}setIsLoading(false)})();},[]);
 useEffect(()=>{localStorage.setItem('tokio_cart',JSON.stringify(cart));},[cart]);
 useEffect(()=>{if(!isAdminAuthenticated)return;const close=openAdminEvents((event,payload)=>{if(event==='order-created'){setOrders(prev=>[orderFromApi(payload),...prev.filter(o=>o.id!==payload.id)]);}else if(event==='order-updated'){setOrders(prev=>prev.map(o=>o.id===payload.id?orderFromApi(payload):o));}else if(event==='order-deleted'){setOrders(prev=>prev.filter(o=>o.id!==payload.id));}else if(event==='history-cleared'){if(payload.scope==='all')setOrders([]);else setOrders(prev=>prev.filter(o=>o.restaurantSlug!==payload.restaurantSlug||!['entregue','cancelado'].includes(o.status)));}else if(event==='menu-updated'||event==='config-updated'){refreshAdminData().catch(()=>{});}});const timer=window.setInterval(()=>{refreshAdminData().catch(()=>{})},4000);return()=>{close();clearInterval(timer);};},[isAdminAuthenticated]);
 const currentRestaurant=restaurants[activeRestaurantSlug]||INITIAL_RESTAURANTS.japones;
 const cartItemCount=cart.reduce((s,i)=>s+i.quantity,0); const subtotal=cart.reduce((s,i)=>s+i.subtotal,0); const discount=appliedCoupon?Math.min(subtotal,appliedCoupon.type==='percent'?subtotal*appliedCoupon.value/100:appliedCoupon.value):0; const cartTotal=Math.max(0,subtotal-discount+(orderType==='delivery'?currentRestaurant.deliveryFee:0));
 const addToCart=(item:MenuItem,quantity:number,selectedOptions:CartItemOptionSelected[],notes?:string)=>{if(cart.length&&cart[0].menuItem.restaurantSlug!==item.restaurantSlug){const old=restaurants[cart[0].menuItem.restaurantSlug]?.name||'outro restaurante';if(!window.confirm(`Seu carrinho possui itens de "${old}". Deseja limpar para pedir em "${restaurants[item.restaurantSlug]?.name}"?`))return;setCart([]);}const optionsPrice=selectedOptions.reduce((s,o)=>s+o.price,0);const unit=(item.promoPrice??item.price)+optionsPrice;setCart(prev=>[...prev,{id:`${item.id}-${Date.now()}`,menuItem:item,quantity,selectedOptions,notes,unitTotalPrice:unit,subtotal:unit*quantity}]);setIsCartOpen(true);};
 const updateCartItemQuantity=(id:string,delta:number)=>setCart(p=>p.map(i=>i.id===id?({...i,quantity:i.quantity+delta,subtotal:i.unitTotalPrice*(i.quantity+delta)}):i).filter(i=>i.quantity>0));
 const removeFromCart=(id:string)=>setCart(p=>p.filter(i=>i.id!==id)); const clearCart=()=>{setCart([]);setAppliedCoupon(null);};
 const applyCoupon=(code:string)=>{const found=VALID_COUPONS.find(c=>c.code===code.trim().toUpperCase());if(!found)return{success:false,message:'Cupom inválido ou expirado.'};if(found.minSubtotal&&subtotal<found.minSubtotal)return{success:false,message:`Este cupom exige pedido mínimo de R$ ${found.minSubtotal.toFixed(2)}.`};setAppliedCoupon(found);return{success:true,message:'Cupom aplicado com sucesso!'};}; const removeCoupon=()=>setAppliedCoupon(null);
 const createOrder=async(data:any)=>{const body={...data,discount:discount,couponCode:appliedCoupon?.code,items:cart.map(c=>({id:c.id,name:c.menuItem.name,quantity:c.quantity,unitPrice:c.unitTotalPrice,totalPrice:c.subtotal,selectedOptions:c.selectedOptions,notes:c.notes}))};const order=await apiFetch<Order>(`/api/${activeRestaurantSlug}/orders`,{method:'POST',body:JSON.stringify(body)});setOrders(p=>[order,...p.filter(o=>o.id!==order.id)]);setTrackingOrderId(order.id);clearCart();return order;};
 const updateOrderStatus=async(id,status,note)=>{const order=orders.find(o=>o.id===id);if(!order)return;const updated=await apiFetch<Order>(`/api/${order.restaurantSlug}/orders/${id}/status`,{method:'PATCH',body:JSON.stringify({status,note})});setOrders(p=>p.map(o=>o.id===id?updated:o));};
 const updateOrderPrintStatus=async(id,status)=>{const order=orders.find(o=>o.id===id);if(!order)return;setOrders(p=>p.map(o=>o.id===id?{...o,printStatus:status}:o));};
 const deleteOrder=async(id)=>{const order=orders.find(o=>o.id===id);if(!order)return;await apiFetch(`/api/${order.restaurantSlug}/orders/${id}`,{method:'DELETE'});setOrders(p=>p.filter(o=>o.id!==id));};
 const clearOrdersHistory=async(slug,mode='finished')=>{if(slug){await apiFetch(`/api/${slug}/orders/history`,{method:'DELETE'});setOrders(p=>p.filter(o=>o.restaurantSlug!==slug||!['entregue','cancelado'].includes(o.status)));}else if(mode==='finished'){for(const s of Object.keys(restaurants) as RestaurantSlug[])await apiFetch(`/api/${s}/orders/history`,{method:'DELETE'});setOrders(p=>p.filter(o=>!['entregue','cancelado'].includes(o.status)));}else{await clearAllOrders();}};
 const clearAllOrders=async()=>{await apiFetch('/api/admin/orders',{method:'DELETE'});setOrders([]);};
 const clearCustomersData=async()=>{const all=await apiFetch<CustomerRecord[]>('/api/admin/customers');for(const c of all)await apiFetch(`/api/admin/customers/${c.id}`,{method:'DELETE'});setCustomers([]);};
 const deleteCustomer=async(id)=>{await apiFetch(`/api/admin/customers/${id}`,{method:'DELETE'});setCustomers(p=>p.filter(c=>c.id!==id));};
 const addCustomer=async(data:any)=>{const c=await apiFetch<CustomerRecord>('/api/admin/customers',{method:'POST',body:JSON.stringify(data)});setCustomers(p=>[c,...p]);};
 const updateCustomerNotes=async(id,notes)=>{const c=await apiFetch<CustomerRecord>(`/api/admin/customers/${id}`,{method:'PATCH',body:JSON.stringify({notes})});setCustomers(p=>p.map(x=>x.id===id?c:x));};
 const updatePrinterSettings=async(updates)=>{const merged={...printerSettings,...updates};setPrinterSettings(merged);await updateRestaurantConfig(activeRestaurantSlug,{printerSettings:merged} as any);};
 const updateMenuItem=async(item)=>{const saved=await apiFetch<MenuItem>(`/api/${item.restaurantSlug}/menu-items/${item.id}`,{method:'PATCH',body:JSON.stringify(item)});setMenuItems(p=>p.map(x=>x.id===saved.id?saved:x));};
 const addMenuItem=async(item)=>{const saved=await apiFetch<MenuItem>(`/api/${item.restaurantSlug}/menu-items`,{method:'POST',body:JSON.stringify(item)});setMenuItems(p=>[...p,saved]);};
 const deleteMenuItem=async(id)=>{const item=menuItems.find(i=>i.id===id);if(!item)return;await apiFetch(`/api/${item.restaurantSlug}/menu-items/${id}`,{method:'DELETE'});setMenuItems(p=>p.filter(x=>x.id!==id));};
 const updateRestaurantConfig=async(slug,updates)=>{const cfg=await apiFetch<RestaurantConfig>(`/api/${slug}/config`,{method:'PATCH',body:JSON.stringify(updates)});setRestaurants(p=>({...p,[slug]:cfg}));if(slug===activeRestaurantSlug&&cfg.printerSettings)setPrinterSettings({...DEFAULT_PRINTER_SETTINGS,...cfg.printerSettings});};
 const resetToDefaultData=()=>{setRestaurants(INITIAL_RESTAURANTS);setCategories(INITIAL_CATEGORIES);setMenuItems(INITIAL_MENU_ITEMS);};
 const login=async(password:string)=>{await apiAdminLogin(password);setIsAdminAuthenticated(true);await refreshAdminData();}; const logout=()=>{apiAdminLogout();setIsAdminAuthenticated(false);setOrders([]);setCustomers([]);};
 const value=useMemo(()=>({restaurants,categories,menuItems,orders,customers,cart,orderType,selectedTable,activeRestaurantSlug,isCartOpen,appliedCoupon,trackingOrderId,currentRestaurant,cartItemCount,cartTotal,printerSettings,isLoading,isAdminAuthenticated,setActiveRestaurantSlug,setOrderType,setSelectedTable,setIsCartOpen,setTrackingOrderId,addToCart,updateCartItemQuantity,removeFromCart,clearCart,applyCoupon,removeCoupon,createOrder,updateOrderStatus,updateOrderPrintStatus,deleteOrder,clearOrdersHistory,clearAllOrders,clearCustomersData,deleteCustomer,addCustomer,updateCustomerNotes,updatePrinterSettings,updateMenuItem,addMenuItem,deleteMenuItem,updateRestaurantConfig,resetToDefaultData,adminLogin:login,adminLogout:logout,refreshAdminData}),[restaurants,categories,menuItems,orders,customers,cart,orderType,selectedTable,activeRestaurantSlug,isCartOpen,appliedCoupon,trackingOrderId,currentRestaurant,cartItemCount,cartTotal,printerSettings,isLoading,isAdminAuthenticated]);
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};
export const useStore=()=>{const ctx=useContext(StoreContext);if(!ctx)throw new Error('useStore deve ser usado dentro de StoreProvider');return ctx;};
