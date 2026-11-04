import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  PackageSearch,
  RefreshCcw,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  getMercadoPagoConnectUrl,
  loadMerchantMembership,
  loadMerchantOrders,
  loadMerchantSummary,
  reviewPharmacyOrder,
  subscribeMerchantOrders,
  updateOrderStatus,
  type MerchantOrder,
  type MerchantSummary,
  type OrderStatus,
} from "../lib/merchantPlatform";
import { businessProfiles, type BusinessType } from "../config/businessProfiles";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const statusLabel: Record<OrderStatus, string> = {
  pending_review: "Aguardando análise farmacêutica",
  pending_payment: "Aguardando pagamento",
  paid: "Novo pedido",
  accepted: "Aceito",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Em entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

const nextLabel: Partial<Record<OrderStatus, string>> = {
  paid: "Aceitar pedido",
  accepted: "Iniciar atendimento",
  preparing: "Marcar como pronto",
  ready: "Saiu para entrega",
  out_for_delivery: "Confirmar entrega",
};

type Tab = "overview" | "orders" | "catalog" | "finance" | "delivery" | "payments" | "team" | "settings";

const emptySummary: MerchantSummary = {
  merchantId: "",
  merchantName: "Painel do Comerciante",
  todayGross: 0,
  todayOrders: 0,
  pendingOrders: 0,
  preparingOrders: 0,
  deliveryOrders: 0,
  averageTicket: 0,
  lowStock: 0,
};

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: any }) {
  return (
    <article style={styles.metric}>
      <div style={styles.metricIcon}><Icon size={18} /></div>
      <div><span style={styles.eyebrow}>{label}</span><strong style={styles.metricValue}>{value}</strong><small style={styles.muted}>{helper}</small></div>
    </article>
  );
}

function ItemDescription({ item }: { item: NonNullable<MerchantOrder["items"]>[number] }) {
  const variant = item.variant_snapshot as any;
  const modifiers = Array.isArray(item.modifier_snapshot) ? item.modifier_snapshot : [];
  return <span>
    {item.quantity}× {item.product_name}
    {variant?.name ? <small style={styles.itemMeta}> · {variant.name}</small> : null}
    {modifiers.length ? <small style={styles.itemMeta}> · {modifiers.map((m:any) => m.name).join(", ")}</small> : null}
    {item.item_notes ? <small style={styles.itemNote}> · “{item.item_notes}”</small> : null}
  </span>;
}

function OrderCard({ order, onAdvance, onReview }: { order: MerchantOrder; onAdvance: (order: MerchantOrder) => void; onReview: (order: MerchantOrder, decision: "approve" | "reject") => void }) {
  const address = order.delivery_address;
  return (
    <article style={{...styles.orderCard,...(order.status === "pending_review" ? styles.reviewCard : {})}}>
      <div style={styles.orderTop}>
        <div>
          <span style={styles.orderNumber}>#{order.order_number}</span>
          <h3 style={styles.orderTitle}>{order.customer_name}</h3>
          <small style={styles.muted}>{dateTime.format(new Date(order.created_at))}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{...styles.status,...(order.status === "pending_review" ? styles.reviewStatus : {})}}>{statusLabel[order.status] || order.status}</span>
          <strong style={styles.orderTotal}>{brl.format(order.total)}</strong>
        </div>
      </div>
      <div style={styles.orderInfoGrid}>
        <div><span style={styles.eyebrow}>Contato</span><strong>{order.customer_phone || order.customer_email || "Não informado"}</strong></div>
        <div><span style={styles.eyebrow}>Entrega</span><strong>{order.delivery_type === "pickup" ? "Retirada no estabelecimento" : address ? `${address.street ?? ""}, ${address.number ?? ""} · ${address.neighborhood ?? ""}` : "Endereço não informado"}</strong></div>
        <div><span style={styles.eyebrow}>Pagamento</span><strong>{order.status === "pending_review" ? "Bloqueado até análise" : `${order.payment_provider || "A definir"} · ${order.payment_status}`}</strong></div>
      </div>
      {!!order.items?.length && (
        <div style={styles.itemList}>
          {order.items.slice(0, 6).map(item => <div key={item.id} style={styles.itemRow}><ItemDescription item={item} /><strong>{brl.format(item.total_price)}</strong></div>)}
          {order.items.length > 6 && <small style={styles.muted}>+ {order.items.length - 6} itens</small>}
        </div>
      )}
      <div style={styles.orderFooter}>
        <div style={styles.totalBreakdown}><span>Produtos {brl.format(order.subtotal)}</span><span>Entrega {brl.format(order.delivery_fee)}</span></div>
        {order.status === "pending_review" ? <div style={styles.reviewActions}>
          <button style={styles.rejectButton} onClick={() => onReview(order,"reject")}><XCircle size={16}/> Rejeitar</button>
          <button style={styles.primaryButton} onClick={() => onReview(order,"approve")}><CheckCircle2 size={16}/> Aprovar análise</button>
        </div> : nextStatus[order.status] && <button style={styles.primaryButton} onClick={() => onAdvance(order)}>{nextLabel[order.status]} <ChevronRight size={16} /></button>}
      </div>
    </article>
  );
}

export function MerchantDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [membership, setMembership] = useState<any>(null);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [summary, setSummary] = useState<MerchantSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const merchantId = membership?.merchant_id ?? "";
  const merchant = membership?.merchants as any;
  const merchantName = merchant?.name || "Meu estabelecimento";
  const businessType = (merchant?.business_type || "grocery") as BusinessType;
  const profile = businessProfiles[businessType] || businessProfiles.other;

  async function refresh() {
    if (!merchantId) return;
    const [orderRows, summaryRow] = await Promise.all([
      loadMerchantOrders(merchantId),
      loadMerchantSummary(merchantId, merchantName),
    ]);
    setOrders(orderRows);
    setSummary(summaryRow);
  }

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      setLoading(true);
      const member = await loadMerchantMembership();
      setMembership(member);
      setLoading(false);
      if (!member?.merchant_id) return;
      const memberMerchant = member.merchants as any;
      const [orderRows, summaryRow] = await Promise.all([
        loadMerchantOrders(member.merchant_id),
        loadMerchantSummary(member.merchant_id, memberMerchant?.name || "Meu estabelecimento"),
      ]);
      setOrders(orderRows);
      setSummary(summaryRow);
      cleanup = subscribeMerchantOrders(member.merchant_id, () => { void refresh(); });
    })();
    return () => { if (cleanup) cleanup(); };
  }, [merchantId]);

  const grouped = useMemo(() => ({
    review: orders.filter(order => order.status === "pending_review"),
    new: orders.filter(order => ["paid", "accepted"].includes(order.status)),
    preparing: orders.filter(order => order.status === "preparing"),
    ready: orders.filter(order => order.status === "ready"),
    delivery: orders.filter(order => order.status === "out_for_delivery"),
  }), [orders]);

  async function advance(order: MerchantOrder) {
    const status = nextStatus[order.status];
    if (!status) return;
    const result = await updateOrderStatus(order.id, status);
    setNotice(result.error ? `Não foi possível atualizar: ${result.error}` : `Pedido #${order.order_number} atualizado.`);
    await refresh();
  }

  async function review(order: MerchantOrder, decision: "approve" | "reject") {
    const result = await reviewPharmacyOrder(order.id,decision);
    setNotice(result.error ? `Não foi possível concluir a análise: ${result.error}` : decision === "approve" ? `Solicitação #${order.order_number} aprovada e liberada para pagamento.` : `Solicitação #${order.order_number} rejeitada.`);
    await refresh();
  }

  async function connectMercadoPago() {
    if (!merchantId) return;
    const result = await getMercadoPagoConnectUrl(merchantId);
    if (result.url) window.location.assign(result.url);
    else setNotice(result.error || "Integração ainda não configurada no backend.");
  }

  const nav: Array<[Tab, string, any]> = [
    ["overview", "Visão geral", LayoutDashboard], ["orders", profile.orderLabel, ShoppingBag], ["catalog", profile.catalogLabel, Boxes],
    ["finance", "Financeiro", CircleDollarSign], ["delivery", "Entregas", Truck], ["payments", "Pagamentos", CreditCard],
    ["team", "Equipe", Users], ["settings", "Configurações", Settings],
  ];

  if (loading) return <main style={styles.center}><RefreshCcw className="spin" /> Carregando painel…</main>;
  // Chegar aqui sem membership não é "conta sem loja" -- esta rota só é
  // alcançada com o papel merchant_owner/merchant_staff já concedido
  // (RequireRole em App.tsx barra o resto antes). Faltar membership nesse
  // ponto significa que o estabelecimento foi aprovado, mas o responsável
  // ainda não foi vinculado pelo admin (passo manual e separado em
  // "Ativar acesso", ver AdminMerchantManagement.tsx) -- mandar a pessoa
  // pra "/lojista" de novo criava um cadastro duplicado e não resolvia
  // nada, já que o vínculo é feito do lado do admin, não pelo lojista.
  if (!membership) return <main style={styles.center}><Store size={42} /><h1>Painel do Comerciante</h1><p>Seu cadastro foi aprovado, mas o acesso ao painel ainda não foi ativado pela nossa equipe. Fale com o PreçoCerto para concluir a liberação.</p><a href="/fale-conosco" style={styles.primaryButton}>Falar com o PreçoCerto</a></main>;

  return (
    <div className="pc-merchant-shell" style={styles.shell}>
      <aside className="pc-merchant-sidebar" style={styles.sidebar}>
        <a href="/" style={styles.brand}><img src="/logo-preco-certo-inversa.svg" alt="Preço Certo" style={{ width: 150 }} /></a>
        <div style={styles.storeIdentity}><div style={styles.storeAvatar}><Store size={20} /></div><div><strong>{merchantName}</strong><small style={styles.sidebarMuted}>{profile.label} · {merchant?.plan_code || "Plano ativo"}</small></div></div>
        <nav style={styles.nav}>{nav.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} style={{ ...styles.navButton, ...(tab === key ? styles.navActive : {}) }}><Icon size={18} /> {label}</button>)}</nav>
        <a href="/" style={styles.backLink}>← Voltar ao Preço Certo</a>
      </aside>

      <main className="pc-merchant-main" style={styles.main}>
        <header style={styles.header}><div><span style={styles.eyebrow}>CENTRAL DO COMERCIANTE · {profile.shortLabel.toUpperCase()}</span><h1 style={styles.h1}>{tab === "overview" ? "Operação em tempo real" : nav.find(x => x[0] === tab)?.[1]}</h1><p style={styles.muted}>{merchantName} · {profile.operationalStages.join(" → ")}</p></div><button style={styles.secondaryButton} onClick={() => void refresh()}><RefreshCcw size={16} /> Atualizar</button></header>
        {notice && <div style={styles.notice}>{notice}<button onClick={() => setNotice("")} style={styles.close}>×</button></div>}

        {tab === "overview" && <>
          <section style={styles.metrics}>
            <Metric label="VENDAS HOJE" value={brl.format(summary.todayGross)} helper={`${summary.todayOrders} pedidos hoje`} icon={BadgeDollarSign} />
            <Metric label="TICKET MÉDIO" value={brl.format(summary.averageTicket)} helper="pedidos efetivados" icon={WalletCards} />
            <Metric label={businessType === "pharmacy" ? "PARA ANALISAR" : "AGUARDANDO"} value={String(businessType === "pharmacy" ? grouped.review.length : summary.pendingOrders)} helper={businessType === "pharmacy" ? "solicitações farmacêuticas" : "pedidos para agir"} icon={businessType === "pharmacy" ? HeartPulse : Clock3} />
            <Metric label="EM ENTREGA" value={String(summary.deliveryOrders)} helper={`${summary.lowStock} itens com estoque baixo`} icon={Truck} />
          </section>
          {grouped.review.length > 0 && <section style={{...styles.section,...styles.reviewSection}}><div style={styles.sectionHead}><div><span style={styles.eyebrow}>ANÁLISE FARMACÊUTICA</span><h2 style={styles.h2}>Solicitações aguardando avaliação</h2></div><strong>{grouped.review.length}</strong></div><div style={styles.orderGrid}>{grouped.review.map(order => <OrderCard key={order.id} order={order} onAdvance={advance} onReview={review}/>)}</div></section>}
          <section style={styles.section}><div style={styles.sectionHead}><div><span style={styles.eyebrow}>LIVE</span><h2 style={styles.h2}>Fila operacional</h2></div><span style={styles.live}><i /> atualizando em tempo real</span></div>
            <div style={styles.kanban}>
              {[ ["Novos", grouped.new, ShoppingBag], ["Preparando", grouped.preparing, PackageSearch], ["Prontos", grouped.ready, PackageCheck], ["Em entrega", grouped.delivery, Truck] ].map(([label, rows, Icon]: any) => <div key={label} style={styles.kanbanCol}><div style={styles.kanbanTitle}><span><Icon size={16} /> {label}</span><b>{rows.length}</b></div>{rows.slice(0, 5).map((order: MerchantOrder) => <button key={order.id} onClick={() => setTab("orders")} style={styles.miniOrder}><span><strong>#{order.order_number}</strong><small>{order.customer_name}</small></span><b>{brl.format(order.total)}</b></button>)}{!rows.length && <div style={styles.empty}>Nenhum pedido</div>}</div>)}
            </div>
          </section>
        </>}

        {tab === "orders" && <section style={styles.section}><div style={styles.sectionHead}><div><span style={styles.eyebrow}>PEDIDOS</span><h2 style={styles.h2}>{profile.orderLabel}</h2></div><strong>{orders.length} recentes</strong></div><div style={styles.orderGrid}>{orders.map(order => <OrderCard key={order.id} order={order} onAdvance={advance} onReview={review} />)}{!orders.length && <div style={styles.emptyLarge}>Os novos pedidos aparecerão aqui assim que forem criados.</div>}</div></section>}

        {tab === "catalog" && <InfoPage icon={Boxes} title={profile.catalogLabel} description={`Gestão especializada para ${profile.label.toLowerCase()}.`} bullets={["Cadastrar e ativar itens", "Definir preço, promoção e disponibilidade", profile.capabilities.includes("variants") ? "Criar tamanhos e variações" : "Controlar estoque e disponibilidade", profile.capabilities.includes("modifiers") ? "Configurar adicionais e personalizações" : "Acompanhar itens indisponíveis"]} action="/painel-lojista/catalogo" actionLabel="Abrir Estúdio de Catálogo" />}
        {tab === "finance" && <InfoPage icon={CircleDollarSign} title="Financeiro" description="Visão financeira exclusiva do estabelecimento, sem acesso operacional do administrador da plataforma." bullets={["Vendas brutas, líquidas, taxas e comissões", "Diário, semanal, mensal e anual", "Pagamentos, reembolsos e cancelamentos", "Ticket médio e produtos mais vendidos"]} action="/painel-lojista/gestao" actionLabel="Abrir gestão financeira" />}
        {tab === "delivery" && <InfoPage icon={MapPin} title="Entregas" description="Regras de entrega calculadas antes do pagamento e compartilhadas com cliente e estabelecimento." bullets={["Taxa por bairro ou zona", "Pedido mínimo e entrega grátis por faixa", "Retirada ou entrega própria", "Prazo estimado e linha do tempo"]} action="/painel-lojista/gestao" actionLabel="Configurar entregas" />}
        {tab === "payments" && <section style={styles.section}><div style={styles.paymentHero}><div style={styles.paymentIcon}><CreditCard size={28} /></div><div><span style={styles.eyebrow}>RECEBIMENTOS</span><h2 style={styles.h2}>Conectar conta Mercado Pago</h2><p style={styles.muted}>A conexão usa OAuth. Credenciais secretas do lojista não são digitadas nem armazenadas no navegador.</p></div><button style={styles.primaryButton} onClick={() => void connectMercadoPago()}>Conectar Mercado Pago <ChevronRight size={16} /></button></div><div style={styles.infoGrid}><InfoBox title="Split do marketplace" text="Estrutura preparada para separar comissão da plataforma e valor destinado ao vendedor." /><InfoBox title="Webhooks" text="Mudanças de pagamento alimentam o status do pedido e o painel ao vivo." /><InfoBox title="Conciliação" text="Cada pagamento registra provedor, ID externo, valores, taxas e situação." /></div></section>}
        {tab === "team" && <InfoPage icon={Users} title="Equipe e permissões" description="Funcionários usam contas próprias, sem compartilhar a senha do proprietário." bullets={["Proprietário: acesso completo", "Gerente: operação e estoque", "Pedidos: atendimento e produção", "Estoque/financeiro: permissões específicas"]} action="/painel-lojista/gestao" actionLabel="Gerenciar equipe" />}
        {tab === "settings" && <InfoPage icon={Settings} title="Configurações do negócio" description="Tipo de estabelecimento, capacidades, horários e regras operacionais." bullets={[profile.label, `Catálogo: ${profile.catalogLabel}`, `Fluxo: ${profile.operationalStages.join(" → ")}`, "Entrega, retirada e agendamento por capacidade"]} action="/painel-lojista/configurar-negocio" actionLabel="Configurar meu negócio" />}
      </main>
    </div>
  );
}

function InfoPage({ icon: Icon, title, description, bullets, action, actionLabel }: { icon: any; title: string; description: string; bullets: string[]; action?: string; actionLabel?: string }) {
  return <section style={styles.section}><div style={styles.infoHero}><div style={styles.bigIcon}><Icon size={30} /></div><div><span style={styles.eyebrow}>MÓDULO COMERCIAL</span><h2 style={styles.h2}>{title}</h2><p style={styles.muted}>{description}</p></div>{action && <a href={action} style={styles.primaryButton}>{actionLabel || "Abrir módulo"}<ChevronRight size={16}/></a>}</div><div style={styles.infoGrid}>{bullets.map((text, index) => <InfoBox key={text} title={`${String(index + 1).padStart(2, "0")}`} text={text} />)}</div></section>;
}

function InfoBox({ title, text }: { title: string; text: string }) { return <article style={styles.infoBox}><strong>{title}</strong><p>{text}</p><CheckCircle2 size={18} /></article>; }

const styles: Record<string, React.CSSProperties> = {
  shell:{minHeight:"100vh",display:"grid",gridTemplateColumns:"224px minmax(0,1fr)",background:"var(--pc-color-background)",color:"var(--pc-color-foreground)",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif"},
  sidebar:{background:"var(--pc-color-primary-hover)",color:"var(--pc-color-primary-foreground)",padding:"22px 16px",display:"flex",flexDirection:"column",gap:20,minHeight:"100vh",position:"sticky",top:0,height:"100vh"},brand:{display:"block",padding:"6px 8px"},storeIdentity:{display:"flex",alignItems:"center",gap:10,padding:"14px 10px",border:"1px solid color-mix(in srgb,var(--pc-color-primary-foreground) 12%,transparent)",borderRadius:14,background:"color-mix(in srgb,var(--pc-color-primary-foreground) 5%,transparent)"},storeAvatar:{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"var(--pc-color-accent)",color:"var(--pc-color-primary-hover)"},sidebarMuted:{display:"block",opacity:.62,marginTop:3},nav:{display:"grid",gap:5},navButton:{border:0,background:"transparent",color:"color-mix(in srgb,var(--pc-color-primary-foreground) 78%,transparent)",borderRadius:10,padding:"11px 12px",display:"flex",alignItems:"center",gap:10,textAlign:"left",cursor:"pointer",fontWeight:650},navActive:{background:"var(--pc-color-accent)",color:"var(--pc-color-primary-hover)"},backLink:{marginTop:"auto",color:"color-mix(in srgb,var(--pc-color-primary-foreground) 74%,transparent)",textDecoration:"none",padding:10,fontSize:13},main:{padding:"22px clamp(16px,2.5vw,34px)",minWidth:0},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,marginBottom:22},h1:{fontSize:"clamp(27px,3vw,40px)",letterSpacing:"-.04em",margin:"5px 0"},h2:{fontSize:"clamp(21px,2vw,28px)",letterSpacing:"-.03em",margin:"4px 0 7px"},eyebrow:{display:"block",fontSize:10,fontWeight:850,letterSpacing:".12em",opacity:.55},muted:{color:"var(--pc-color-muted)",fontSize:13},secondaryButton:{border:"1px solid var(--pc-color-border)",background:"var(--pc-color-surface)",borderRadius:11,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontWeight:700},primaryButton:{border:0,background:"var(--pc-color-primary)",color:"var(--pc-color-primary-foreground)",borderRadius:11,padding:"11px 15px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,cursor:"pointer",fontWeight:800,textDecoration:"none"},rejectButton:{border:"1px solid color-mix(in srgb,var(--pc-color-danger) 32%,var(--pc-color-border))",background:"color-mix(in srgb,var(--pc-color-danger) 6%,var(--pc-color-surface))",color:"var(--pc-color-danger)",borderRadius:11,padding:"10px 13px",display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",fontWeight:800},notice:{padding:"12px 14px",background:"color-mix(in srgb,var(--pc-color-success) 10%,var(--pc-color-surface))",border:"1px solid color-mix(in srgb,var(--pc-color-success) 30%,var(--pc-color-border))",borderRadius:12,marginBottom:16,display:"flex",justifyContent:"space-between"},close:{border:0,background:"transparent",cursor:"pointer",fontSize:18},metrics:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:16},metric:{background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:12,padding:18,display:"flex",gap:13,boxShadow:"0 6px 24px rgba(17,41,29,.04)"},metricIcon:{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"color-mix(in srgb,var(--pc-color-primary) 8%,var(--pc-color-surface))",color:"var(--pc-color-primary)"},metricValue:{display:"block",fontSize:22,margin:"4px 0 3px",letterSpacing:"-.03em"},section:{background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:14,padding:"clamp(16px,2.2vw,26px)",boxShadow:"0 8px 30px rgba(17,41,29,.04)",marginBottom:16},reviewSection:{borderColor:"color-mix(in srgb,var(--pc-color-accent) 38%,var(--pc-color-border))",background:"color-mix(in srgb,var(--pc-color-accent) 6%,var(--pc-color-surface))"},sectionHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,marginBottom:18},live:{display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:700,color:"var(--pc-color-success)"},kanban:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10},kanbanCol:{padding:10,background:"var(--pc-color-background)",borderRadius:14,minHeight:180},kanbanTitle:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 4px 10px",fontSize:13,fontWeight:800},miniOrder:{width:"100%",border:"1px solid var(--pc-color-border)",background:"var(--pc-color-surface)",borderRadius:10,padding:"10px",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",marginBottom:7,cursor:"pointer"},empty:{padding:22,textAlign:"center",fontSize:12,color:"var(--pc-color-muted)"},orderGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:14},orderCard:{border:"1px solid var(--pc-color-border)",borderRadius:15,padding:17,background:"var(--pc-color-surface)"},reviewCard:{borderColor:"var(--pc-color-accent)"},orderTop:{display:"flex",justifyContent:"space-between",gap:14},orderNumber:{fontSize:11,fontWeight:850,color:"var(--pc-color-success)"},orderTitle:{fontSize:18,margin:"3px 0"},status:{display:"inline-block",fontSize:11,fontWeight:800,background:"color-mix(in srgb,var(--pc-color-success) 10%,var(--pc-color-surface))",padding:"5px 8px",borderRadius:999},reviewStatus:{background:"var(--pc-color-surface)",color:"var(--pc-color-accent)"},orderTotal:{display:"block",fontSize:18,marginTop:7},orderInfoGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,margin:"15px 0",padding:"12px 0",borderTop:"1px solid var(--pc-color-border)",borderBottom:"1px solid var(--pc-color-border)",fontSize:12},itemList:{display:"grid",gap:7},itemRow:{display:"flex",justifyContent:"space-between",gap:8,fontSize:12},itemMeta:{color:"var(--pc-color-muted)"},itemNote:{color:"var(--pc-color-accent)"},orderFooter:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginTop:15,flexWrap:"wrap"},reviewActions:{display:"flex",gap:7,flexWrap:"wrap"},totalBreakdown:{display:"grid",gap:3,fontSize:11,color:"var(--pc-color-muted)"},emptyLarge:{padding:50,textAlign:"center",color:"var(--pc-color-muted)",gridColumn:"1/-1"},infoHero:{display:"flex",alignItems:"center",gap:16,marginBottom:22,flexWrap:"wrap"},bigIcon:{width:58,height:58,borderRadius:14,display:"grid",placeItems:"center",background:"var(--pc-color-accent)",color:"var(--pc-color-accent-foreground)"},infoGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12},infoBox:{position:"relative",border:"1px solid var(--pc-color-border)",borderRadius:14,padding:17,minHeight:120},paymentHero:{display:"flex",alignItems:"center",gap:16,justifyContent:"space-between",marginBottom:24,flexWrap:"wrap"},paymentIcon:{width:58,height:58,borderRadius:14,display:"grid",placeItems:"center",background:"color-mix(in srgb,var(--pc-color-primary) 8%,var(--pc-color-surface))",color:"var(--pc-color-primary)"},center:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:30,textAlign:"center",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif"}
};
