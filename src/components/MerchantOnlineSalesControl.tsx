import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleOff, CreditCard, PackageCheck, RefreshCcw, Rocket, Save, Store, Truck } from "lucide-react";
import { supabase } from "../lib/roles";
import { loadMerchantMembership, loadMerchantPaymentStatus, loadMerchantProducts } from "../lib/merchantPlatform";

const defaultMessage = "Este estabelecimento ainda não oferece vendas online pelo Preço Certo. Você pode consultar e comparar os preços normalmente.";

export function MerchantOnlineSalesControl() {
  const [membership, setMembership] = useState<any>(null);
  const [merchantConfig, setMerchantConfig] = useState<any>(null);
  const [paymentConnected, setPaymentConnected] = useState(false);
  const [activeProducts, setActiveProducts] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const merchant = merchantConfig || membership?.merchants as any;
  const merchantId = membership?.merchant_id || "";
  const channelReady = Boolean(merchant?.delivery_enabled || merchant?.pickup_enabled);
  const merchantActive = merchant?.status === "active";
  const ready = merchantActive && paymentConnected && activeProducts > 0 && channelReady;

  const checklist = useMemo(() => [
    { ok: merchantActive, icon: Store, title: "Estabelecimento aprovado", text: merchantActive ? "Cadastro comercial ativo na plataforma." : "Aguarde a aprovação/ativação do estabelecimento." },
    { ok: activeProducts > 0, icon: PackageCheck, title: "Produtos disponíveis", text: activeProducts > 0 ? `${activeProducts} produto(s) ativo(s) e disponível(is) para venda.` : "Ative pelo menos um produto no catálogo comercial." },
    { ok: channelReady, icon: Truck, title: "Entrega ou retirada", text: channelReady ? "Existe pelo menos uma forma de atendimento habilitada." : "Habilite entrega ou retirada no estabelecimento." },
    { ok: paymentConnected, icon: CreditCard, title: "Mercado Pago conectado", text: paymentConnected ? "Conta de recebimento pronta para checkout." : "Conecte o Mercado Pago antes de publicar vendas." },
  ], [merchantActive, activeProducts, channelReady, paymentConnected]);

  async function load() {
    setLoading(true);
    const member = await loadMerchantMembership();
    setMembership(member);
    if (member?.merchant_id && supabase) {
      const [products, payment, merchantRow] = await Promise.all([
        loadMerchantProducts(member.merchant_id),
        loadMerchantPaymentStatus(member.merchant_id),
        supabase.from("merchants").select("id,name,status,delivery_enabled,pickup_enabled,online_sales_enabled,online_sales_message,online_sales_started_at").eq("id",member.merchant_id).maybeSingle(),
      ]);
      setActiveProducts(products.filter(product => product.active && product.available).length);
      setPaymentConnected(payment?.status === "connected");
      const m = merchantRow.data || member.merchants as any;
      setMerchantConfig(m);
      setEnabled(Boolean(m?.online_sales_enabled));
      setMessage(m?.online_sales_message || defaultMessage);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function save(nextEnabled = enabled) {
    if (!supabase || !merchantId) return;
    if (nextEnabled && !ready) {
      setNotice("Conclua todos os itens do checklist antes de ativar as vendas online.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("merchants").update({
      online_sales_enabled: nextEnabled,
      online_sales_message: message.trim() || defaultMessage,
      online_sales_started_at: nextEnabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", merchantId);
    if (!error) {
      setEnabled(nextEnabled);
      setMerchantConfig((current:any)=>({...current,online_sales_enabled:nextEnabled,online_sales_message:message.trim()||defaultMessage}));
    }
    setNotice(error?.message || (nextEnabled ? "Vendas online ativadas. Os produtos elegíveis já podem receber compras." : "Vendas online pausadas. A comparação de preços continua pública."));
    setSaving(false);
  }

  if (loading) return <main style={s.center}><RefreshCcw size={22}/> Verificando prontidão…</main>;
  // Esta rota só é alcançada com o papel merchant_owner/merchant_staff já
  // concedido (RequireRole em App.tsx). Sem membership aqui, o estabeleci-
  // mento foi aprovado mas o responsável ainda não foi vinculado pelo
  // admin (passo manual em "Ativar acesso", AdminMerchantManagement.tsx)
  // -- mandar pra "/lojista" de novo só duplicava o cadastro.
  if (!membership) return <main style={s.center}><Store size={36}/><h1>Vendas online</h1><p>Seu cadastro foi aprovado, mas o acesso ao painel ainda não foi ativado pela nossa equipe.</p><a href="/fale-conosco">Falar com o PreçoCerto</a></main>;

  return <main className="pc-merchant-page pc-merchant-online" style={s.page}><div style={s.container}>
    <a href="/painel-lojista" style={s.back}><ArrowLeft size={16}/> Voltar ao painel</a>
    <header style={s.header}>
      <div><span style={s.eyebrow}>PUBLICAÇÃO COMERCIAL</span><h1 style={s.h1}>Vendas online</h1><p style={s.lead}>O Preço Certo só libera “Comprar” quando a operação está realmente pronta. A comparação de preços continua funcionando mesmo com vendas pausadas.</p></div>
      <div style={{...s.statusCard,...(enabled && ready ? s.statusLive : {})}}>{enabled && ready ? <><CheckCircle2 size={22}/><span><b>Vendas online ativas</b><small>Compra pública liberada para produtos elegíveis</small></span></> : <><CircleOff size={22}/><span><b>Vendas online não publicadas</b><small>O público continua vendo os preços</small></span></>}</div>
    </header>

    {notice && <div style={s.notice}>{notice}</div>}

    <section style={s.section}>
      <div style={s.sectionHead}><div><span style={s.eyebrow}>CHECKLIST DE PRONTIDÃO</span><h2>Antes de publicar</h2></div><button onClick={()=>void load()} style={s.secondary}><RefreshCcw size={15}/> Verificar novamente</button></div>
      <div style={s.checkGrid}>{checklist.map(item => { const Icon=item.icon; return <article key={item.title} style={{...s.checkCard,...(item.ok?s.checkOk:{})}}><div style={{...s.checkIcon,...(item.ok?s.checkIconOk:{})}}>{item.ok?<CheckCircle2 size={20}/>:<Icon size={20}/>}</div><div><strong>{item.title}</strong><p>{item.text}</p></div></article>; })}</div>
    </section>

    <section style={s.section}>
      <span style={s.eyebrow}>MENSAGEM AO PÚBLICO</span><h2>Quando a venda estiver indisponível</h2><p style={s.hint}>Esta mensagem aparece junto ao aviso visual nas páginas públicas do estabelecimento e no modal do produto.</p>
      <textarea value={message} onChange={event=>setMessage(event.target.value)} rows={4} maxLength={280} style={s.textarea}/>
      <div style={s.messageFoot}><small>{message.length}/280 caracteres</small><button onClick={()=>void save(enabled)} disabled={saving} style={s.secondary}><Save size={15}/> Salvar mensagem</button></div>
    </section>

    <section style={{...s.publish,...(ready?s.publishReady:{})}}>
      <div><span style={s.eyebrow}>STATUS PÚBLICO</span><h2>{ready ? "Operação pronta para venda" : "Ainda existem requisitos pendentes"}</h2><p>{ready ? "Ao ativar, apenas produtos ativos e disponíveis deste estabelecimento receberão o botão Comprar." : "O botão Comprar continuará bloqueado até todos os requisitos acima serem concluídos."}</p></div>
      {enabled ? <button onClick={()=>void save(false)} disabled={saving} style={s.pause}><CircleOff size={17}/> Pausar vendas online</button> : <button onClick={()=>void save(true)} disabled={!ready||saving} style={{...s.primary,...(!ready?s.disabled:{})}}><Rocket size={17}/> Ativar vendas online</button>}
    </section>
  </div></main>;
}

const s:Record<string,React.CSSProperties>={
  page:{minHeight:"100vh",background:"var(--pc-color-background)",color:"var(--pc-color-foreground)",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif",padding:"28px 18px 70px"},container:{maxWidth:1120,margin:"0 auto"},center:{minHeight:"75vh",display:"flex",flexDirection:"column",gap:12,alignItems:"center",justifyContent:"center",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif",textAlign:"center"},back:{display:"inline-flex",alignItems:"center",gap:7,color:"var(--pc-color-muted)",fontWeight:750,textDecoration:"none",marginBottom:24},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:24,marginBottom:20},eyebrow:{display:"block",fontSize:10,fontWeight:900,letterSpacing:".13em",color:"var(--pc-color-primary)"},h1:{fontSize:"clamp(34px,4vw,50px)",lineHeight:1,letterSpacing:"-.05em",margin:"8px 0 12px"},lead:{maxWidth:690,color:"var(--pc-color-muted)",lineHeight:1.65,margin:0},statusCard:{minWidth:275,display:"flex",alignItems:"center",gap:11,border:"1px solid var(--pc-color-border)",borderRadius:17,background:"var(--pc-color-surface)",padding:"14px 16px",color:"var(--pc-color-muted)"},statusLive:{background:"color-mix(in srgb,var(--pc-color-success) 8%,var(--pc-color-surface))",borderColor:"color-mix(in srgb,var(--pc-color-success) 25%,var(--pc-color-border))",color:"var(--pc-color-success)"},section:{background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:20,padding:"22px",marginTop:14,boxShadow:"0 10px 30px rgba(20,51,35,.035)"},sectionHead:{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:16},checkGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10},checkCard:{display:"flex",gap:12,border:"1px solid var(--pc-color-border)",borderRadius:15,padding:15,background:"var(--pc-card-bg)"},checkOk:{background:"var(--pc-card-bg)",borderColor:"var(--pc-color-border)"},checkIcon:{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"var(--pc-color-background)",color:"var(--pc-color-muted)",flex:"0 0 auto"},checkIconOk:{background:"color-mix(in srgb,var(--pc-color-success) 8%,var(--pc-color-surface))",color:"var(--pc-color-success)"},hint:{color:"var(--pc-color-muted)",fontSize:13,lineHeight:1.6},textarea:{width:"100%",boxSizing:"border-box",border:"1px solid var(--pc-color-border)",borderRadius:13,padding:13,font:"inherit",resize:"vertical",marginTop:8},messageFoot:{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,color:"var(--pc-color-muted)"},secondary:{display:"inline-flex",alignItems:"center",gap:7,border:"1px solid var(--pc-color-border)",background:"var(--pc-color-surface)",color:"var(--pc-color-foreground)",borderRadius:11,padding:"9px 12px",fontWeight:750,cursor:"pointer"},publish:{marginTop:14,border:"1px solid var(--pc-color-border)",borderRadius:20,padding:22,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,background:"var(--pc-card-bg)"},publishReady:{background:"linear-gradient(135deg,var(--pc-card-bg),var(--pc-card-bg))",borderColor:"var(--pc-color-border)"},primary:{display:"inline-flex",alignItems:"center",gap:8,border:0,borderRadius:12,padding:"12px 16px",background:"var(--pc-color-primary)",color:"var(--pc-color-primary-foreground)",fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"},pause:{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid color-mix(in srgb,var(--pc-color-danger) 25%,var(--pc-color-border))",borderRadius:12,padding:"12px 16px",background:"color-mix(in srgb,var(--pc-color-danger) 6%,var(--pc-color-surface))",color:"var(--pc-color-danger)",fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"},disabled:{opacity:.45,cursor:"not-allowed"},notice:{padding:"11px 13px",borderRadius:11,background:"var(--pc-card-bg)",border:"1px solid var(--pc-color-border)",color:"var(--pc-color-success)",fontWeight:700,marginBottom:12}
};
