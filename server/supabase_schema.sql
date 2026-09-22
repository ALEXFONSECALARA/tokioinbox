-- ==============================================================================
-- NEXORO / TOKIO FOOD SYSTEM — PRODUCTION SUPABASE / POSTGRESQL SCHEMA
-- Multi-restaurante, Autenticação de Clientes por WhatsApp/Telefone,
-- RLS (Row Level Security), Idempotência e Índices de Normalização.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper function for phone normalization in PostgreSQL
-- Converts (22) 99999-9999, +55 22 99999-9999 or 22 99999-9999 to canonical 5522999999999
CREATE OR REPLACE FUNCTION normalize_phone(raw_phone TEXT)
RETURNS TEXT AS $$
DECLARE
    digits_only TEXT;
BEGIN
    IF raw_phone IS NULL THEN
        RETURN NULL;
    END IF;
    -- Remove non-digits
    digits_only := regexp_replace(raw_phone, '\D', '', 'g');
    -- Prepend 55 if Brazilian standard 10 or 11 digits without country code
    IF length(digits_only) = 10 OR length(digits_only) = 11 THEN
        digits_only := '55' || digits_only;
    END IF;
    RETURN digits_only;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 2. CUSTOMERS TABLE (Autenticação sem dependência de E-mail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    raw_phone VARCHAR(30) NOT NULL,
    phone_normalized VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Unique index to strictly prevent duplicate phone accounts regardless of formatting
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_normalized 
ON public.customers (phone_normalized);

-- ==============================================================================
-- 3. CUSTOMER ADDRESSES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title VARCHAR(50) DEFAULT 'Casa',
    street VARCHAR(255) NOT NULL,
    number VARCHAR(30) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'São Paulo',
    complement VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_cust_id 
ON public.customer_addresses (customer_id);

-- ==============================================================================
-- 4. CUSTOMER SECURE SESSIONS TABLE (Tokens de Sessão com Expiração)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token 
ON public.customer_sessions (session_token);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires 
ON public.customer_sessions (expires_at);

-- ==============================================================================
-- 5. PASSWORD RESETS (Recuperação Segura sem E-mail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_normalized VARCHAR(20) NOT NULL,
    verification_code_hash VARCHAR(128) NOT NULL,
    reset_token VARCHAR(128) UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_phone 
ON public.customer_password_resets (phone_normalized, used, expires_at);

-- ==============================================================================
-- 6. RESTAURANTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.restaurants (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'japones', 'italiano', 'pizza', 'hamburgueria'
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    tagline VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. ORDERS TABLE (com Chave de Idempotência e Isolamento por restaurant_id)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(100) PRIMARY KEY,
    short_code VARCHAR(30) NOT NULL,
    restaurant_id VARCHAR(50) NOT NULL REFERENCES public.restaurants(id),
    customer_id UUID REFERENCES public.customers(id),
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_phone_normalized VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'retirada', 'mesa', 'balcao')),
    table_number INT,
    pickup_number INT,
    delivery_address JSONB,
    items JSONB NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) DEFAULT 0,
    discount NUMERIC(10, 2) DEFAULT 0,
    coupon_code VARCHAR(50),
    total NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_details JSONB,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'recebido' CHECK (
        status IN ('recebido', 'aceito', 'em_preparo', 'pronto', 'saiu_para_entrega', 'entregue', 'cancelado')
    ),
    status_history JSONB DEFAULT '[]'::jsonb,
    print_status VARCHAR(20) DEFAULT 'pendente',
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on idempotency_key to guarantee zero duplicate orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency 
ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_restaurant 
ON public.orders (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
ON public.orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_phone_normalized 
ON public.orders (customer_phone_normalized, created_at DESC);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anonymous/Service role can execute backend operations securely via Express backend
CREATE POLICY "Service role full access customers" 
ON public.customers FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access orders" 
ON public.orders FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access addresses" 
ON public.customer_addresses FOR ALL 
USING (auth.role() = 'service_role');
