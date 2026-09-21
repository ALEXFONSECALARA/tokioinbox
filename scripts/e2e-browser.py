"""
Teste de ponta a ponta no navegador (Playwright + Chromium).
Pré-requisitos: npm run build (gera dist/) e `pip install playwright` com chromium instalado.
Uso: python3 scripts/e2e-browser.py
"""
import re, json, os, signal, time, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 4777
BASE = f"http://127.0.0.1:{PORT}"
ADMIN_PASS = "Test-Pass-12345"
results = []

def check(name, ok, extra=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else f"  -> {extra}"))

def start():
    env = dict(os.environ, NODE_ENV="production", PORT=str(PORT), ADMIN_PASSWORD=ADMIN_PASS, GEMINI_API_KEY="")
    log = open("/tmp/e2e-server.log", "w")
    p = subprocess.Popen(["npx", "tsx", "server.ts"], cwd=ROOT, env=env, stdout=log, stderr=log, preexec_fn=os.setsid)
    for _ in range(80):
        try:
            urllib.request.urlopen(BASE + "/api/health", timeout=1); return p
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("servidor não subiu: " + open("/tmp/e2e-server.log").read()[-800:])

def stop(p):
    try: os.killpg(os.getpgid(p.pid), signal.SIGTERM)
    except Exception: pass

def api(path, method="GET", data=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(data).encode() if data is not None else None)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

FORBIDDEN = ["admin", "painel", "equipe", "pdv", "kds", "supabase", "paleta", "design system", "cozinha (", "caixa"]

def staff_login(page, user, pwd):
    page.fill('input[autocomplete="username"]', user)
    page.fill('input[autocomplete="current-password"]', pwd)
    page.get_by_role("button", name="Entrar").click()

p = start()
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        # ================= CLIENTE =================
        cctx = b.new_context(viewport={"width": 1280, "height": 900})
        cust = cctx.new_page()
        errors = []; cust.on("pageerror", lambda e: errors.append(str(e)[:160]))
        calls = []
        cust.on("response", lambda r: calls.append((r.request.method, r.url.replace(BASE, "").split("?")[0], r.status)) if "/api/" in r.url else None)

        cust.goto(BASE + "/"); cust.wait_for_timeout(2000)
        text = cust.inner_text("body").lower()
        bad = [w for w in FORBIDDEN if w in text]
        check("cliente: home não mostra nada de painel/admin/KDS/PDV", not bad, str(bad))
        check("cliente: home lista os restaurantes do servidor", "sakura" in text and "cantina" in text)

        cust.keyboard.press("Alt+A"); cust.wait_for_timeout(400)
        logo = cust.get_by_role("button", name="NEXORO FOOD SYSTEM").first
        for _ in range(4): logo.click(); cust.wait_for_timeout(120)
        cust.wait_for_timeout(500)
        t2 = cust.inner_text("body").lower()
        check("cliente: Alt+A e clique repetido no logo não abrem nada interno",
              cust.url.rstrip("/") == BASE and cust.locator('input[autocomplete="current-password"]').count() == 0 and "acesso da equipe" not in t2)

        keys = cust.evaluate("() => [Object.keys(localStorage), Object.keys(sessionStorage)]")
        allkeys = " ".join(keys[0] + keys[1])
        check("cliente: sem sessão/usuário de painel no navegador", "tokio_staff_token" not in allkeys and "tokio_current_user" not in allkeys, allkeys)

        # link direto do restaurante
        cust.goto(BASE + "/SakuraSushiHouse"); cust.wait_for_timeout(2200)
        if cust.get_by_role("button", name="Pular").count(): cust.get_by_role("button", name="Pular").first.click()
        check("cliente: link direto /SakuraSushiHouse abre o cardápio", cust.get_by_role("button", name="Adicionar").count() > 0)

        # pedido completo
        cust.get_by_role("button", name="Retirar no Balcão").first.click()
        cust.get_by_role("button", name="Adicionar").first.click(); cust.wait_for_timeout(700)
        cust.get_by_role("button", name="Adicionar ao Pedido").click(); cust.wait_for_timeout(600)
        cust.get_by_role("button", name="Ver Carrinho de Pedidos").click(); cust.wait_for_timeout(600)
        cust.get_by_role("button", name="Finalizar Pedido").click(); cust.wait_for_timeout(700)
        cust.get_by_placeholder("Ex: Carlos Eduardo").fill("Cliente E2E")
        cust.get_by_placeholder("(11) 98765-4321").fill("22 99887-7665")
        cust.get_by_role("button", name="Dinheiro").first.click()
        with cust.expect_response(lambda r: r.url.endswith("/api/orders") and r.request.method == "POST") as resp_info:
            cust.get_by_role("button", name="Confirmar e Enviar Pedido").click()
        resp = resp_info.value
        body = resp.json()
        check("cliente: pedido criado (HTTP 201)", resp.status == 201 and body.get("success"), f"{resp.status} {body}")
        order = body.get("order", {})
        check("cliente: preço veio do catálogo do servidor", abs(order.get("subtotal", 0) - 84.90) < 0.01, str(order.get("subtotal")))
        cust.wait_for_timeout(1500)
        mine = cust.evaluate("() => localStorage.getItem('nx_my_orders_v1')")
        check("cliente: token de rastreio guardado neste aparelho", bool(mine) and order.get("id", "x") in mine, str(mine))
        page_txt = cust.inner_text("body")
        check("cliente: rastreio mostra o código do pedido", order.get("shortCode", "??") in page_txt, order.get("shortCode", ""))

        # após recarregar continua rastreando só o próprio pedido
        cust.goto(BASE + "/"); cust.wait_for_timeout(1500)
        cust.get_by_role("button", name="Rastrear").first.click(); cust.wait_for_timeout(1500)
        check("cliente: após recarregar, 'Rastrear' ainda encontra o próprio pedido", order.get("shortCode", "??") in cust.inner_text("body"))

        forbidden_calls = [c for c in calls if (c[0] == "GET" and c[1] == "/api/orders") or c[1].startswith(("/api/print-agent", "/api/auth", "/api/admin", "/api/users", "/api/catalog", "/api/audit-logs", "/api/fiscal/documents"))]
        check("cliente: nenhuma chamada a rotas internas do painel", not forbidden_calls, str(forbidden_calls))
        check("cliente: nenhuma chamada recusada (401/403) durante o uso", not [c for c in calls if c[2] in (401, 403)], str([c for c in calls if c[2] in (401, 403)]))
        check("cliente: sem erros de JavaScript", not errors, str(errors))

        # ================= PAINEL: acesso =================
        # 1) cliente tentando entrar em /PAINELRESTAURANTE só vê o login
        pctx = b.new_context(viewport={"width": 1280, "height": 900})
        pan = pctx.new_page()
        pan.goto(BASE + "/PAINELRESTAURANTE"); pan.wait_for_timeout(1500)
        check("painel: sem login só aparece a tela de acesso", pan.locator('input[autocomplete="current-password"]').count() == 1
              and "dashboard" not in pan.inner_text("body").lower())

        # 2) sessão FALSA plantada no navegador (era a brecha do "Modo Teste") é derrubada
        pan.evaluate("""() => {
          sessionStorage.setItem('tokio_current_user_v25', JSON.stringify({id:'x',name:'Falso',username:'admin',role:'super_admin',restaurantSlug:'all',isActive:true,permissions:{}}));
          sessionStorage.setItem('tokio_staff_token', 'nx-staff-' + 'a'.repeat(64));
        }""")
        pan.reload(); pan.wait_for_timeout(2500)
        check("painel: sessão falsificada no navegador é rejeitada pelo servidor", pan.locator('input[autocomplete="current-password"]').count() == 1)

        # 3) senha errada / padrão
        pan.evaluate("() => sessionStorage.clear()"); pan.reload(); pan.wait_for_timeout(800)
        staff_login(pan, "admin", "admin123"); pan.wait_for_timeout(1200)
        check("painel: senha padrão admin123 é recusada", "inválidos" in pan.inner_text("body").lower())

        # 4) login correto
        pan.fill('input[autocomplete="current-password"]', ADMIN_PASS)
        pan.get_by_role("button", name="Entrar").click(); pan.wait_for_timeout(3000)
        check("painel: login correto abre o painel administrativo", pan.locator('input[autocomplete="current-password"]').count() == 0 and pan.url.lower().endswith("/painelrestaurante"), pan.url)

        adm = pan.inner_text("body")
        check("painel: dashboard sem números/alertas de exemplo e sem IDs de nuvem fixos",
              not any(x in adm for x in ["#8472", "27.480", "nqnutmc7", "ojztmcng", "Impressora offline"]), adm[:200])
        pan.get_by_role("button", name="Auditor Sênior").first.click(); pan.wait_for_timeout(1800)
        aud = pan.inner_text("body")
        check("painel: Auditor Sênior mostra checagens reais do servidor",
              "Auditoria de segurança e configuração" in aud and "Contas com senha padrão" in aud and "Integração real com a SEFAZ" in aud, aud[:200])

        # 5) pedido do cliente aparece na equipe
        pan.goto(BASE + "/kanban"); pan.wait_for_timeout(3500)
        check("painel: pedido feito pelo cliente aparece no kanban da equipe", "Cliente E2E" in pan.inner_text("body") or order.get("shortCode", "??") in pan.inner_text("body"))

        # tempo real: pedido criado por outra pessoa aparece sem recarregar
        cat0 = api("/api/public/catalog")[1]
        it0 = next(i for i in cat0["menuItems"] if i["restaurantSlug"] == "japones" and not any(g.get("required") for g in i.get("optionGroups", [])))
        api("/api/orders", "POST", {"restaurantSlug": "japones", "customerName": "Realtime E2E", "customerPhone": "22999990000", "orderType": "retirada", "paymentMethod": "pix", "items": [{"menuItemId": it0["id"], "quantity": 1}]})
        seen = False
        for _ in range(30):
            if "Realtime E2E" in pan.inner_text("body"): seen = True; break
            pan.wait_for_timeout(300)
        check("painel: pedido novo aparece em tempo real (sem recarregar)", seen)

        # ================= PERFIL LIMITADO =================
        tok = api("/api/auth/login", "POST", {"username": "admin", "password": ADMIN_PASS})[1]["token"]
        st, cu = api("/api/users", "POST", {"name": "Cozinheiro E2E", "username": "cozinha_e2e", "password": "Cozinha-Forte-77", "role": "cozinha", "restaurantSlug": "all", "isActive": True}, tok)
        check("api: administrador cria usuário de cozinha com senha própria", st in (200, 201), f"{st} {cu}")
        kctx = b.new_context(viewport={"width": 1280, "height": 900}); k = kctx.new_page()
        k.goto(BASE + "/PAINELRESTAURANTE"); k.wait_for_timeout(1000)
        staff_login(k, "cozinha_e2e", "Cozinha-Forte-77"); k.wait_for_timeout(2500)
        kt = k.inner_text("body").lower()
        check("perfil cozinha: /PAINELRESTAURANTE mostra 'Acesso não autorizado'", "acesso não autorizado" in kt, kt[:200])
        k.goto(BASE + "/cozinha"); k.wait_for_timeout(2500)
        check("perfil cozinha: /cozinha abre normalmente", "acesso não autorizado" not in k.inner_text("body").lower() and k.locator('input[autocomplete="current-password"]').count() == 0)
        s2, _ = api("/api/users", "GET", None, api("/api/auth/login", "POST", {"username": "cozinha_e2e", "password": "Cozinha-Forte-77"})[1]["token"])
        check("api: perfil cozinha não lista usuários", s2 in (401, 403), str(s2))

        # ================= CARDÁPIO EDITADO PELO ADMIN CHEGA AO CLIENTE =================
        s3, full = api("/api/catalog", "GET", None, tok)
        item = next(i for i in full["menuItems"] if i["restaurantSlug"] == "japones" and i.get("available", True))
        item["price"] = 123.45; item.pop("promoPrice", None)
        s4, _ = api("/api/catalog", "PUT", full, tok)
        cust2 = cctx.new_page(); cust2.goto(BASE + "/SakuraSushiHouse"); cust2.wait_for_timeout(2500)
        check("cardápio: preço alterado no painel aparece para o cliente", "123.45" in cust2.inner_text("body").replace(",", "."), str(s4))


        # ================= TODAS AS ÁREAS DO PAINEL RENDERIZAM =================
        area_errors = []
        pan.on("pageerror", lambda e: area_errors.append(str(e)[:160]))
        for path, must in [("/kanban", None), ("/cozinha", None), ("/sushibar", None), ("/bar", None), ("/pdv", None),
                           ("/balcao", None), ("/delivery", None), ("/caixa", "abrir caixa"), ("/entregador", "portal do entregador"),
                           ("/PAINELRESTAURANTE", None)]:
            pan.goto(BASE + path); pan.wait_for_timeout(2200)
            txt = pan.inner_text("body").lower()
            ok = len(txt) > 300 and "acesso não autorizado" not in txt and (must is None or must in txt)
            check(f"painel: área {path} renderiza conteúdo", ok, txt[:120])
        check("painel: nenhuma área gerou erro de JavaScript", not area_errors, str(area_errors))

        # ================= CAIXA COMPARTILHADO ENTRE APARELHOS =================
        def new_admin_device():
            c = b.new_context(viewport={"width": 1440, "height": 900}); pg = c.new_page()
            pg.goto(BASE + "/PAINELRESTAURANTE"); pg.wait_for_timeout(700)
            staff_login(pg, "admin", ADMIN_PASS); pg.wait_for_timeout(2200)
            return pg
        devA = new_admin_device(); devB = new_admin_device()
        devA.goto(BASE + "/caixa"); devA.wait_for_timeout(1800)
        devB.goto(BASE + "/caixa"); devB.wait_for_timeout(1800)
        check("caixa: começa fechado (sem turno de exemplo)", "abrir caixa" in devA.inner_text("body").lower() and "nenhum caixa aberto" in devA.inner_text("body").lower())
        devA.get_by_test_id("cash-initial-amount").fill("150")
        devA.get_by_test_id("cash-open-button").click()
        seen_open = False
        for _ in range(40):
            if "caixa aberto" in devB.inner_text("body").lower() and "nenhum caixa aberto" not in devB.inner_text("body").lower(): seen_open = True; break
            devB.wait_for_timeout(250)
        check("caixa: abrir no aparelho A aparece no aparelho B sem recarregar", seen_open)

        # B lança sangria pela tela
        devB.get_by_role("button", name="Sangria / Suprimento").click(); devB.wait_for_timeout(500)
        devB.get_by_role("button", name="Sangria (Retirada)").click()
        devB.get_by_placeholder("0,00").fill("20")
        devB.get_by_placeholder("Ex: Troco extra, pagamento de fornecedor...").fill("Sangria do B")
        devB.get_by_role("button", name="Confirmar Lançamento").click(); devB.wait_for_timeout(1500)
        st, doc = api("/api/state/cashShift", "GET", None, tok)
        descs = [m["description"] for m in (doc.get("value") or {}).get("movements", [])]
        check("caixa: lançamento feito no aparelho B foi gravado no servidor", "Sangria do B" in descs, str(descs))
        devA.get_by_role("button", name="📜 HISTÓRICO & EXTRATO").click()
        seen_mov = False
        for _ in range(40):
            if "Sangria do B" in devA.inner_text("body"): seen_mov = True; break
            devA.wait_for_timeout(250)
        check("caixa: lançamento do B aparece no A em tempo real", seen_mov)

        # conflito: A fica "cego" (não consegue ler o servidor) enquanto B grava; A lança e o servidor deve ficar com AMBOS
        devA.route("**/api/state**", lambda route: route.abort() if route.request.method == "GET" else route.continue_())
        st, cur = api("/api/state/cashShift", "GET", None, tok)
        val = cur["value"]; val["movements"] = [{"id": "mov-api-1", "type": "sangria", "amount": 5, "description": "Lançamento via outro aparelho", "timestamp": "10:00", "operator": "api"}] + val["movements"]
        s5, r5 = api("/api/state/cashShift", "PUT", {"value": val, "baseVersion": cur["version"]}, tok)
        devA.get_by_role("button", name="Sangria / Suprimento").click(); devA.wait_for_timeout(500)
        devA.get_by_role("button", name="Sangria (Retirada)").click()
        devA.get_by_placeholder("0,00").fill("7")
        devA.get_by_placeholder("Ex: Troco extra, pagamento de fornecedor...").fill("Lançamento do A em conflito")
        devA.get_by_role("button", name="Confirmar Lançamento").click(); devA.wait_for_timeout(2500)
        st, fin = api("/api/state/cashShift", "GET", None, tok)
        fd = [m["description"] for m in fin["value"]["movements"]]
        check("caixa: conflito de gravação é resolvido sem perder nenhum lançamento",
              "Lançamento do A em conflito" in fd and "Lançamento via outro aparelho" in fd and "Sangria do B" in fd, str(fd))

        # fechar caixa arquiva no histórico
        devA.unroute("**/api/state**")
        devB.get_by_role("button", name="Fechar Turno").click(); devB.wait_for_timeout(600)
        devB.get_by_role("button", name="Sim, Fechar Caixa").click(); devB.wait_for_timeout(1800)
        st, hist = api("/api/state/cashShiftHistory", "GET", None, tok)
        st2, shf = api("/api/state/cashShift", "GET", None, tok)
        check("caixa: fechamento arquiva o turno e deixa o caixa fechado", bool(hist.get("value")) and shf["value"]["isClosed"] is True, str(hist)[:160])

        # CRM derivado dos pedidos reais (o cliente do teste fez um pedido pelo cardápio)
        crm_ok = False
        for _ in range(20):
            st, crm = api("/api/state/customers", "GET", None, tok)
            rec = next((c for c in (crm.get("value") or []) if "22998877665" in "".join(ch for ch in c.get("phone", "") if ch.isdigit())), None)
            if rec and rec["totalOrders"] >= 1 and rec["totalSpent"] > 0: crm_ok = True; break
            time.sleep(0.5)
        check("CRM: cliente que pediu pelo cardápio entra na base da equipe com totais corretos", crm_ok, str(crm)[:200])

        # entregadores: começa vazio (sem nomes de exemplo) e o cadastro é compartilhado
        st, ds0 = api("/api/state/deliveryStaff", "GET", None, tok)
        base_names = [d["name"] for d in (ds0.get("value") or [])]
        check("entregadores: nenhum entregador de exemplo", not any(n in base_names for n in ["Carlos Oliveira (Moto 01)", "Matheus Santos (Moto 02)"]), str(base_names))
        devA.goto(BASE + "/PAINELRESTAURANTE"); devA.wait_for_timeout(2500)
        devA.get_by_role("button", name=re.compile("Despacho")).first.click(); devA.wait_for_timeout(1200)
        devA.get_by_test_id("courier-name").fill("Entregador E2E Real")
        devA.get_by_test_id("courier-add").click(); devA.wait_for_timeout(1800)
        st, ds1 = api("/api/state/deliveryStaff", "GET", None, tok)
        check("entregadores: cadastro pela tela grava no servidor", any(d["name"] == "Entregador E2E Real" for d in (ds1.get("value") or [])), str(ds1)[:200])
        devB.goto(BASE + "/PAINELRESTAURANTE"); devB.wait_for_timeout(2500)
        devB.get_by_role("button", name=re.compile("Despacho")).first.click(); devB.wait_for_timeout(1500)
        check("entregadores: outro aparelho enxerga o cadastro", "Entregador E2E Real" in devB.inner_text("body"))

        # mesas do salão compartilhadas
        api("/api/state/salonTables", "PUT", {"value": [{"id": 1, "status": "ocupada", "capacity": 4, "customerName": "Mesa compartilhada E2E"}], "baseVersion": api("/api/state/salonTables", "GET", None, tok)[1]["version"]}, tok)
        st, sal = api("/api/state/salonTables", "GET", None, tok)
        check("salão: mesas ficam no servidor (não no navegador)", sal["version"] >= 1 and sal["value"][0]["customerName"] == "Mesa compartilhada E2E")

        b.close()
except Exception:
    import traceback
    traceback.print_exc()
    results.append(False)
    print("FAIL  erro inesperado no teste (veja acima)")
finally:
    stop(p)
    print(f"\n{sum(results)} passaram, {len(results) - sum(results)} falharam")
    sys.exit(0 if all(results) else 1)
