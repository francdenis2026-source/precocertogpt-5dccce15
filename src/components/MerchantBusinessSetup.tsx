import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CookingPot,
  HeartPulse,
  PackageSearch,
  Pizza,
  Save,
  Settings2,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import { supabase } from "../lib/roles";
import { loadMerchantMembership } from "../lib/merchantPlatform";
import { businessProfileList, businessProfiles, type BusinessType } from "../config/businessProfiles";

const iconByType: Partial<Record<BusinessType, any>> = {
  grocery: ShoppingBasket,
  supermarket: Store,
  pizzeria: Pizza,
  snack_bar: UtensilsCrossed,
  bakery: Wheat,
  pharmacy: HeartPulse,
  restaurant: CookingPot,
  services: ClipboardCheck,
};

const labels: Record<string, string> = {
  catalog: "Catálogo",
  inventory: "Estoque",
  price_comparison: "Comparação de preços",
  delivery: "Entrega",
  pickup: "Retirada",
  scheduled_orders: "Agendamento",
  variants: "Tamanhos e variações",
  modifiers: "Adicionais e personalização",
  production: "Produção por etapas",
  kitchen_display: "Painel de produção",
  weight_products: "Venda por peso",
  table_service: "Atendimento em mesa",
  counter_service: "Balcão",
  pharmacy_compliance: "Conformidade farmacêutica",
  prescription_review: "Análise de receita",
  financial: "Financeiro",
  payments: "Pagamentos",
  team: "Equipe",
};

export function MerchantBusinessSetup() {
  const [membership, setMembership] = useState<any>(null);
  const [selected, setSelected] = useState<BusinessType>("grocery");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [averagePreparation, setAveragePreparation] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const profile = useMemo(() => businessProfiles[selected], [selected]);
  const merchant = membership?.merchants as any;

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const member = await loadMerchantMembership();
      setMembership(member);
      const m = member?.merchants as any;
      if (m?.business_type && businessProfiles[m.business_type as BusinessType]) setSelected(m.business_type as BusinessType);
      if (typeof m?.delivery_enabled === "boolean") setDeliveryEnabled(m.delivery_enabled);
      if (typeof m?.pickup_enabled === "boolean") setPickupEnabled(m.pickup_enabled);
      if (m?.service_settings) {
        setSchedulingEnabled(Boolean(m.service_settings.scheduling_enabled));
        setAveragePreparation(Number(m.service_settings.average_preparation_minutes ?? 30));
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!supabase || !membership?.merchant_id) return;
    setSaving(true);
    setNotice("");
    const capabilities = Object.fromEntries(profile.capabilities.map(capability => [capability, true]));
    const serviceSettings = {
      scheduling_enabled: schedulingEnabled,
      average_preparation_minutes: Math.max(0, averagePreparation),
      operational_stages: profile.operationalStages,
      catalog_label: profile.catalogLabel,
      order_label: profile.orderLabel,
    };

    const { error } = await supabase
      .from("merchants")
      .update({
        business_type: selected,
        business_capabilities: capabilities,
        service_settings: serviceSettings,
        delivery_enabled: deliveryEnabled && profile.capabilities.includes("delivery"),
        pickup_enabled: pickupEnabled && profile.capabilities.includes("pickup"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.merchant_id);

    if (error) {
      setNotice(`Não foi possível salvar: ${error.message}`);
      setSaving(false);
      return;
    }

    if (profile.recommendedStations.length && profile.capabilities.includes("production")) {
      const { data: existing } = await supabase
        .from("production_stations")
        .select("name")
        .eq("merchant_id", membership.merchant_id);
      const known = new Set((existing ?? []).map((row: any) => String(row.name).toLowerCase()));
      const missing = profile.recommendedStations
        .filter(name => !known.has(name.toLowerCase()))
        .map((name, index) => ({ merchant_id: membership.merchant_id, name, station_type: "recommended", sort_order: index }));
      if (missing.length) await supabase.from("production_stations").insert(missing);
    }

    setNotice("Configuração aplicada. O painel agora está preparado para este tipo de negócio.");
    setSaving(false);
  }

  if (loading) return <main style={styles.center}>Carregando configuração…</main>;
  // Esta rota só é alcançada com o papel merchant_owner/merchant_staff já
  // concedido (RequireRole em App.tsx). Sem membership aqui, o estabeleci-
  // mento foi aprovado mas o responsável ainda não foi vinculado pelo
  // admin (passo manual em "Ativar acesso", AdminMerchantManagement.tsx)
  // -- mandar pra "/lojista" de novo só duplicava o cadastro.
  if (!membership) return <main style={styles.center}><Building2 size={40} /><h1>Configuração do negócio</h1><p>Seu cadastro foi aprovado, mas o acesso ao painel ainda não foi ativado pela nossa equipe.</p><a href="/fale-conosco" style={styles.primary}>Falar com o PreçoCerto</a></main>;

  return (
    <main className="pc-merchant-page pc-merchant-setup" style={styles.page}>
      <div style={styles.container}>
        <a href="/painel-lojista" style={styles.back}><ArrowLeft size={16} /> Voltar ao painel</a>
        <header style={styles.header}>
          <div><span style={styles.eyebrow}>CONFIGURAÇÃO PROFISSIONAL</span><h1 style={styles.h1}>Defina como o seu negócio opera</h1><p style={styles.lead}>O Preço Certo ativa automaticamente as ferramentas certas para {merchant?.name || "seu estabelecimento"}, sem misturar funções desnecessárias.</p></div>
          <div style={styles.storeBadge}><Store size={19} /><div><strong>{merchant?.name || "Meu estabelecimento"}</strong><small>{merchant?.plan_code || "Plano ativo"}</small></div></div>
        </header>

        {notice && <div style={styles.notice}><CheckCircle2 size={18} /> {notice}</div>}

        <section style={styles.section}>
          <div style={styles.sectionTitle}><span style={styles.step}>1</span><div><h2>Tipo de estabelecimento</h2><p>Escolha o modelo mais próximo da operação real.</p></div></div>
          <div style={styles.profileGrid}>
            {businessProfileList.map(item => {
              const Icon = iconByType[item.type] || Building2;
              const active = selected === item.type;
              return <button key={item.type} onClick={() => setSelected(item.type)} style={{ ...styles.profileCard, ...(active ? styles.profileActive : {}) }}>
                <div style={{ ...styles.profileIcon, ...(active ? styles.profileIconActive : {}) }}><Icon size={22} /></div>
                <strong>{item.label}</strong><span>{item.description}</span>
                {active && <CheckCircle2 size={20} style={styles.check} />}
              </button>;
            })}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionTitle}><span style={styles.step}>2</span><div><h2>Recursos ativados para {profile.shortLabel}</h2><p>O painel adapta catálogo, pedidos e operação ao nicho selecionado.</p></div></div>
          <div style={styles.capabilityGrid}>
            {profile.capabilities.map(capability => <div key={capability} style={styles.capability}><CheckCircle2 size={16} /><span>{labels[capability] || capability}</span></div>)}
          </div>
          <div style={styles.previewGrid}>
            <article style={styles.preview}><PackageSearch size={20} /><span>Catálogo</span><strong>{profile.catalogLabel}</strong><small>{profile.examples.join(" · ")}</small></article>
            <article style={styles.preview}><Settings2 size={20} /><span>Fluxo operacional</span><strong>{profile.orderLabel}</strong><small>{profile.operationalStages.join(" → ")}</small></article>
            <article style={styles.preview}><CookingPot size={20} /><span>Estações sugeridas</span><strong>{profile.recommendedStations.length || "—"}</strong><small>{profile.recommendedStations.join(" · ") || "Sem produção por estação"}</small></article>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionTitle}><span style={styles.step}>3</span><div><h2>Atendimento e preparo</h2><p>Ajuste as regras usadas no carrinho e no acompanhamento do pedido.</p></div></div>
          <div style={styles.formGrid}>
            <Toggle label="Entrega própria ou parceira" helper="Permite calcular taxa e prazo de entrega." checked={deliveryEnabled} onChange={setDeliveryEnabled} disabled={!profile.capabilities.includes("delivery")} />
            <Toggle label="Retirada no estabelecimento" helper="Cliente pode retirar sem entrega." checked={pickupEnabled} onChange={setPickupEnabled} disabled={!profile.capabilities.includes("pickup")} />
            <Toggle label="Pedidos agendados" helper="Útil para encomendas, padarias, restaurantes e serviços." checked={schedulingEnabled} onChange={setSchedulingEnabled} disabled={!profile.capabilities.includes("scheduled_orders")} />
            <label style={styles.field}><span><Clock3 size={17} /> Tempo médio de preparo</span><div><input type="number" min={0} max={1440} value={averagePreparation} onChange={event => setAveragePreparation(Number(event.target.value))} style={styles.input} /><b>min</b></div></label>
          </div>
        </section>

        {selected === "pharmacy" && <section style={styles.pharmacy}>
          <HeartPulse size={24} /><div><strong>Fluxo farmacêutico protegido</strong><p>Itens sujeitos à receita podem exigir análise do farmacêutico. Itens marcados como controlados ou não autorizados à venda remota não avançam pelo checkout comum. Os campos regulatórios ficam separados do catálogo comercial.</p></div>
        </section>}

        <footer style={styles.footer}>
          <div><strong>Pronto para configurar</strong><span>Você poderá alterar o nicho e as regras depois, respeitando os pedidos já registrados.</span></div>
          <button onClick={() => void save()} disabled={saving} style={styles.primary}>{saving ? "Salvando…" : "Aplicar configuração"} <Save size={17} /></button>
        </footer>
      </div>
    </main>
  );
}

function Toggle({ label, helper, checked, onChange, disabled = false }: { label: string; helper: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={() => !disabled && onChange(!checked)} style={{ ...styles.toggle, ...(checked && !disabled ? styles.toggleActive : {}), ...(disabled ? styles.disabled : {}) }}>
    <div><strong>{label}</strong><span>{helper}</span></div><i style={{ ...styles.switch, ...(checked && !disabled ? styles.switchActive : {}) }}><b style={{ ...styles.knob, ...(checked && !disabled ? styles.knobActive : {}) }} /></i>
  </button>;
}

const styles: Record<string, any> = {
  page:{minHeight:"100vh",background:"var(--pc-color-background)",color:"var(--pc-color-foreground)",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif",padding:"32px 18px 70px"},
  container:{maxWidth:1180,margin:"0 auto"},center:{minHeight:"70vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif"},
  back:{display:"inline-flex",alignItems:"center",gap:7,color:"var(--pc-color-muted)",fontWeight:700,textDecoration:"none",marginBottom:26},
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:28,marginBottom:28},eyebrow:{fontSize:11,fontWeight:900,letterSpacing:1.7,color:"var(--pc-color-primary)"},h1:{fontSize:"clamp(30px,4vw,48px)",lineHeight:1.05,letterSpacing:-1.5,margin:"8px 0 12px",maxWidth:720},lead:{color:"var(--pc-color-muted)",fontSize:16,lineHeight:1.65,maxWidth:760,margin:0},
  storeBadge:{display:"flex",gap:11,alignItems:"center",background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:18,padding:"13px 16px",minWidth:210,boxShadow:"0 8px 30px rgba(15,23,42,.05)"},
  section:{background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:24,padding:"25px",marginTop:18,boxShadow:"0 12px 35px rgba(15,23,42,.035)"},sectionTitle:{display:"flex",gap:13,alignItems:"flex-start",marginBottom:20},step:{display:"grid",placeItems:"center",width:30,height:30,borderRadius:10,background:"var(--pc-color-primary-foreground)",color:"var(--pc-color-surface)",fontWeight:900},
  profileGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12},profileCard:{position:"relative",textAlign:"left",border:"1px solid var(--pc-color-border)",background:"var(--pc-color-surface)",borderRadius:18,padding:17,cursor:"pointer",display:"flex",flexDirection:"column",gap:8,minHeight:180},profileActive:{border:"2px solid var(--pc-color-primary)",background:"var(--pc-card-bg)",padding:16},profileIcon:{width:40,height:40,borderRadius:12,display:"grid",placeItems:"center",background:"var(--pc-color-background)",color:"var(--pc-color-foreground)"},profileIconActive:{background:"var(--pc-color-primary)",color:"var(--pc-color-surface)"},check:{position:"absolute",right:13,top:13,color:"var(--pc-color-primary)"},
  capabilityGrid:{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18},capability:{display:"flex",alignItems:"center",gap:6,padding:"8px 11px",borderRadius:999,background:"color-mix(in srgb,var(--pc-color-success) 8%,var(--pc-color-surface))",color:"var(--pc-color-success)",fontWeight:750,fontSize:13},previewGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12},preview:{border:"1px solid var(--pc-color-border)",borderRadius:17,padding:16,display:"flex",flexDirection:"column",gap:6},
  formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12},toggle:{border:"1px solid var(--pc-color-border)",borderRadius:17,background:"var(--pc-color-surface)",padding:15,display:"flex",alignItems:"center",justifyContent:"space-between",gap:15,textAlign:"left",cursor:"pointer"},toggleActive:{borderColor:"color-mix(in srgb,var(--pc-color-primary) 24%,var(--pc-color-border))",background:"var(--pc-card-bg)"},disabled:{opacity:.45,cursor:"not-allowed"},switch:{width:44,height:25,borderRadius:999,background:"var(--pc-color-border)",padding:3,display:"block",transition:".2s"},switchActive:{background:"var(--pc-color-primary)"},knob:{width:19,height:19,borderRadius:999,background:"var(--pc-color-surface)",display:"block",transition:".2s"},knobActive:{transform:"translateX(19px)"},field:{border:"1px solid var(--pc-color-border)",borderRadius:17,padding:15,display:"flex",alignItems:"center",justifyContent:"space-between",gap:15},input:{width:78,border:"1px solid var(--pc-color-border)",borderRadius:10,padding:"8px 10px",fontWeight:800},
  pharmacy:{marginTop:18,display:"flex",gap:14,alignItems:"flex-start",background:"var(--pc-color-surface)",border:"1px solid color-mix(in srgb,var(--pc-color-accent) 25%,var(--pc-color-border))",borderRadius:20,padding:18,color:"var(--pc-color-accent)"},footer:{marginTop:22,background:"var(--pc-color-foreground)",color:"var(--pc-color-surface)",borderRadius:22,padding:20,display:"flex",justifyContent:"space-between",alignItems:"center",gap:20},primary:{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,border:0,borderRadius:13,padding:"12px 17px",background:"var(--pc-color-success)",color:"var(--pc-color-primary-foreground)",fontWeight:900,textDecoration:"none",cursor:"pointer",whiteSpace:"nowrap"},notice:{display:"flex",alignItems:"center",gap:8,background:"color-mix(in srgb,var(--pc-color-success) 8%,var(--pc-color-surface))",border:"1px solid color-mix(in srgb,var(--pc-color-success) 24%,var(--pc-color-border))",color:"var(--pc-color-success)",borderRadius:14,padding:"12px 15px",fontWeight:750},
};
