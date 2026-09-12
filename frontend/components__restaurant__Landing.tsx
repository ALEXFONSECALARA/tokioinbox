import React, { useEffect, useState } from 'react';
import { fetchCustomerProfile } from './utils__api';
import { CustomerAccount } from './types';
import { CustomerAccountModal } from './components__customer__CustomerAccountModal';
import { fetchRestaurants, fetchPlatformSettings, RestaurantSummary, PlatformSettings } from './utils__api';
import { RestaurantCard } from './components__restaurant__RestaurantCard';
import { ArrowDown, Sparkles, UserRound } from 'lucide-react';

export const Landing: React.FC = () => {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [customerToken, setCustomerToken] = useState<string | null>(() => localStorage.getItem('tokioinbox_customer_token'));
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  useEffect(() => {
    if (customerToken) {
      fetchCustomerProfile(customerToken).then(setCustomer).catch(() => { localStorage.removeItem('tokioinbox_customer_token'); setCustomerToken(null); setCustomer(null); });
    }
    Promise.all([fetchRestaurants(), fetchPlatformSettings().catch(() => null)])
      .then(([list, settings]) => {
        setRestaurants(list);
        setPlatform(settings || { landingTitle:'Escolha onde pedir', landingSubtitle:'Lojas independentes, cardápios próprios e atendimento direto.', landingLayout:'galeria-gourmet' as any });
      })
      .catch(err => setError(err.message || 'Não foi possível carregar as lojas.'))
      .finally(() => setLoading(false));
  }, []);
  const heroPhotos = restaurants.map(r => r.bannerImage || r.logo).filter(Boolean).slice(0,4);
  return <div className="min-h-screen bg-[#060908] text-[#f4f0e5]">
    <section className="relative min-h-[52vh] overflow-hidden">
      {heroPhotos.length ? <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-4">{heroPhotos.map((src,i)=><img key={src+i} src={src} alt="" className="w-full h-full object-cover"/>)}</div> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#173533,transparent_55%)]"/>}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/70 to-[#060908]"/>
      <div className="relative z-10 max-w-6xl mx-auto px-5 py-12 sm:py-16 flex min-h-[52vh] flex-col items-center justify-center text-center">
        <img src="/tokioinbox-mark.svg" alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mb-5 shadow-2xl"/>
        <p className="text-[#e2c55d] text-[10px] uppercase tracking-[.35em] font-black flex items-center gap-2"><Sparkles size={13}/> Delivery digital</p>
        <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-tight max-w-3xl">{platform?.landingTitle || 'Escolha onde pedir'}</h1>
        <p className="mt-4 max-w-xl text-sm sm:text-base text-white/70">{platform?.landingSubtitle || 'Cada loja possui sua própria identidade, cardápio e experiência de pedido.'}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2"><button onClick={()=>document.getElementById('stores')?.scrollIntoView({behavior:'smooth'})} className="mt-7 rounded-2xl bg-[#c9a227] text-[#080a0a] px-6 py-3.5 min-h-[48px] font-black text-sm flex items-center gap-2 shadow-xl">Ver lojas <ArrowDown size={17}/></button><button onClick={()=>setAccountOpen(true)} className="rounded-2xl border border-white/15 bg-white/5 text-white px-5 py-3.5 min-h-[48px] font-black text-sm flex items-center gap-2"><UserRound size={17}/> {customer ? `Olá, ${customer.name.split(' ')[0]}` : 'Login cliente'}</button></div>
      </div>
    </section>
    <section id="stores" className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      <div className="mb-7"><p className="text-[#c9a227] text-[10px] uppercase tracking-[.28em] font-black">Escolha sua loja</p><h2 className="text-2xl sm:text-3xl font-black mt-1">Cada restaurante é uma experiência própria</h2><p className="text-sm text-white/55 mt-2">Ao entrar em uma loja, você vê somente o cardápio e o atendimento daquele restaurante.</p></div>
      {loading && <div className="py-16 text-center text-white/50">Carregando lojas...</div>}
      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
      {!loading && !error && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{restaurants.map(r=><RestaurantCard key={r.slug} restaurant={{slug:r.slug,name:r.name,tagline:r.tagline,photo:r.bannerImage||r.logo,color:r.color,secondaryColor:r.secondaryColor,layout:r.layout,bannerPositionX:r.bannerPositionX,bannerPositionY:r.bannerPositionY,bannerZoom:r.bannerZoom}}/>)}</div>}
    </section>
    <CustomerAccountModal
      isOpen={accountOpen}
      onClose={()=>setAccountOpen(false)}
      token={customerToken}
      customer={customer}
      onLoggedIn={(token, account)=>{localStorage.setItem('tokioinbox_customer_token', token); setCustomerToken(token); setCustomer(account);}}
      onLoggedOut={()=>{localStorage.removeItem('tokioinbox_customer_token'); setCustomerToken(null); setCustomer(null);}}
    />
    <footer className="border-t border-white/10 py-8 text-center text-[10px] text-white/35">Escolha uma loja para continuar seu pedido.</footer>
  </div>;
};
