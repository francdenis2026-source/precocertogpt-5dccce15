import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Layers3, PackagePlus, Plus, RefreshCcw, Save, Settings2, Trash2 } from "lucide-react";
import { supabase } from "../lib/roles";
import { loadMerchantMembership } from "../lib/merchantPlatform";
import { businessProfiles, type BusinessType } from "../config/businessProfiles";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Product = {
  id: string; product_name: string; price: number; promotional_price: number | null; active: boolean; available: boolean;
  item_type?: string; unit_mode?: string; preparation_minutes?: number | null; prescription_requirement?: string;
};
type Variant = { id:string; merchant_product_id:string; name:string; price_delta:number; price_override:number|null; active:boolean };
type Group = { id:string; merchant_id:string; name:string; description:string|null; required:boolean; min_select:number; max_select:number; active:boolean; modifier_options?: Option[] };
type Option = { id:string; modifier_group_id:string; name:string; price_delta:number; active:boolean };

type Tab = "products" | "variants" | "modifiers" | "compliance";

export function MerchantCatalogStudio() {
  const [membership, setMembership] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [newProduct, setNewProduct] = useState({ name:"", price:"", itemType:"product", unitMode:"unit", prep:"" });
  const [newVariant, setNewVariant] = useState({ name:"", delta:"" });
  const [newGroup, setNewGroup] = useState({ name:"", required:false, min:"0", max:"1" });
  const [newOption, setNewOption] = useState<Record<string,{name:string;delta:string}>>({});

  const merchantId = membership?.merchant_id || "";
  const merchant = membership?.merchants as any;
  const businessType = (merchant?.business_type || "grocery") as BusinessType;
  const profile = businessProfiles[businessType] || businessProfiles.other;
  const capabilities = new Set(profile.capabilities);
  const currentProduct = useMemo(() => products.find(p => p.id === selectedProduct), [products, selectedProduct]);

  async function refresh() {
    if (!supabase || !merchantId) return;
    const [{ data:p }, { data:v }, { data:g }] = await Promise.all([
      supabase.from("merchant_products").select("id,product_name,price,promotional_price,active,available,item_type,unit_mode,preparation_minutes,prescription_requirement").eq("merchant_id",merchantId).order("product_name"),
      supabase.from("product_variants").select("id,merchant_product_id,name,price_delta,price_override,active").order("sort_order"),
      supabase.from("modifier_groups").select("id,merchant_id,name,description,required,min_select,max_select,active,modifier_options(id,modifier_group_id,name,price_delta,active)").eq("merchant_id",merchantId).order("sort_order"),
    ]);
    const rows = (p ?? []).map((r:any)=>({...r,price:Number(r.price||0),promotional_price:r.promotional_price==null?null:Number(r.promotional_price)}));
    setProducts(rows);
    setVariants((v ?? []).map((r:any)=>({...r,price_delta:Number(r.price_delta||0),price_override:r.price_override==null?null:Number(r.price_override)})));
    setGroups((g ?? []).map((r:any)=>({...r,min_select:Number(r.min_select),max_select:Number(r.max_select),modifier_options:(r.modifier_options??[]).map((o:any)=>({...o,price_delta:Number(o.price_delta||0)}))})));
    if (!selectedProduct && rows.length) setSelectedProduct(rows[0].id);
  }

  useEffect(() => { void (async()=>{ setLoading(true); const member=await loadMerchantMembership(); setMembership(member); setLoading(false); })(); },[]);
  useEffect(() => { if(merchantId) void refresh(); },[merchantId]);

  async function createProduct() {
    if(!supabase || !merchantId || !newProduct.name.trim()) return;
    const price=Number(newProduct.price.replace(",","."));
    const { error }=await supabase.from("merchant_products").insert({merchant_id:merchantId,product_name:newProduct.name.trim(),product_slug:`custom-${crypto.randomUUID()}`,price:Number.isFinite(price)?price:0,item_type:newProduct.itemType,unit_mode:newProduct.unitMode,preparation_minutes:newProduct.prep?Number(newProduct.prep):null,stock_quantity:0,active:true,available:true});
    setNotice(error?error.message:"Item criado no catálogo."); if(!error){setNewProduct({name:"",price:"",itemType:"product",unitMode:"unit",prep:""});await refresh();}
  }

  async function createVariant() {
    if(!supabase || !selectedProduct || !newVariant.name.trim()) return;
    const delta=Number(newVariant.delta.replace(",","."));
    const { error }=await supabase.from("product_variants").insert({merchant_product_id:selectedProduct,name:newVariant.name.trim(),price_delta:Number.isFinite(delta)?delta:0});
    setNotice(error?error.message:"Variação adicionada."); if(!error){setNewVariant({name:"",delta:""});await refresh();}
  }

  async function createGroup() {
    if(!supabase || !merchantId || !newGroup.name.trim()) return;
    const { error }=await supabase.from("modifier_groups").insert({merchant_id:merchantId,name:newGroup.name.trim(),required:newGroup.required,min_select:Number(newGroup.min)||0,max_select:Math.max(1,Number(newGroup.max)||1)});
    setNotice(error?error.message:"Grupo de adicionais criado."); if(!error){setNewGroup({name:"",required:false,min:"0",max:"1"});await refresh();}
  }

  async function addOption(groupId:string) {
    if(!supabase) return; const draft=newOption[groupId]||{name:"",delta:""}; if(!draft.name.trim())return;
    const delta=Number(draft.delta.replace(",","."));
    const { error }=await supabase.from("modifier_options").insert({modifier_group_id:groupId,name:draft.name.trim(),price_delta:Number.isFinite(delta)?delta:0});
    setNotice(error?error.message:"Opção adicionada."); if(!error){setNewOption(s=>({...s,[groupId]:{name:"",delta:""}}));await refresh();}
  }

  async function attachGroup(groupId:string) {
    if(!supabase || !selectedProduct)return;
    const { error }=await supabase.from("product_modifier_groups").upsert({merchant_product_id:selectedProduct,modifier_group_id:groupId},{onConflict:"merchant_product_id,modifier_group_id"});
    setNotice(error?error.message:`Grupo aplicado a ${currentProduct?.product_name||"produto"}.`);
  }

  async function deleteVariant(id:string){if(!supabase)return;await supabase.from("product_variants").delete().eq("id",id);await refresh();}
  async function deleteGroup(id:string){if(!supabase)return;await supabase.from("modifier_groups").delete().eq("id",id);await refresh();}

  async function saveCompliance(values:{prescription:string;controlled:boolean;review:boolean;remote:boolean;registration:string}){
    if(!supabase||!selectedProduct)return;
    await supabase.from("merchant_products").update({regulated_item:values.prescription!=="none",prescription_requirement:values.controlled?"blocked_remote_sale":values.prescription}).eq("id",selectedProduct);
    const {error}=await supabase.from("pharmacy_product_compliance").upsert({merchant_product_id:selectedProduct,anvisa_registration:values.registration||null,prescription_required:values.prescription!=="none",controlled_special:values.controlled,pharmacist_review_required:values.review,remote_sale_allowed:values.remote&&!values.controlled,updated_at:new Date().toISOString()},{onConflict:"merchant_product_id"});
    setNotice(error?error.message:"Conformidade salva.");await refresh();
  }

  if(loading)return <main style={styles.center}><RefreshCcw size={22}/> Carregando estúdio…</main>;
  // Esta rota só é alcançada com o papel merchant_owner/merchant_staff já
  // concedido (RequireRole em App.tsx). Sem membership aqui, o estabeleci-
  // mento foi aprovado mas o responsável ainda não foi vinculado pelo admin
  // (passo manual em "Ativar acesso", AdminMerchantManagement.tsx).
  if(!membership)return <main style={styles.center}>Seu cadastro foi aprovado, mas o acesso ao painel ainda não foi ativado pela nossa equipe. <a href="/fale-conosco" style={styles.primary}>Falar com o PreçoCerto</a></main>;

  const tabs:Array<[Tab,string]>=[["products",profile.catalogLabel],["variants","Tamanhos e variações"],["modifiers","Adicionais e opções"]];
  if(businessType==="pharmacy")tabs.push(["compliance","Conformidade farmacêutica"]);

  return <main className="pc-merchant-page pc-merchant-catalog" style={styles.page}><div style={styles.container}>
    <a href="/painel-lojista" style={styles.back}><ArrowLeft size={16}/> Voltar ao painel</a>
    <header style={styles.header}><div><span style={styles.eyebrow}>ESTÚDIO DE CATÁLOGO</span><h1 style={styles.h1}>{profile.catalogLabel}</h1><p style={styles.lead}>{profile.label} · gerencie itens, configurações e personalizações do seu negócio.</p></div><button onClick={()=>void refresh()} style={styles.secondary}><RefreshCcw size={16}/> Atualizar</button></header>
    {notice&&<div style={styles.notice}><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    <div style={styles.tabs}>{tabs.map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{...styles.tab,...(tab===key?styles.tabActive:{})}}>{label}</button>)}</div>

    {tab==="products"&&<section style={styles.grid2}>
      <article style={styles.card}><h2>Novo item</h2><p>Crie um produto próprio do estabelecimento.</p><input style={styles.input} placeholder="Nome do item" value={newProduct.name} onChange={e=>setNewProduct(s=>({...s,name:e.target.value}))}/><input style={styles.input} placeholder="Preço, ex.: 39,90" value={newProduct.price} onChange={e=>setNewProduct(s=>({...s,price:e.target.value}))}/><div style={styles.row}><select style={styles.input} value={newProduct.itemType} onChange={e=>setNewProduct(s=>({...s,itemType:e.target.value}))}><option value="product">Produto</option><option value="prepared_food">Alimento preparado</option><option value="bakery_item">Padaria/confeitaria</option><option value="medicine">Medicamento</option><option value="service">Serviço</option></select><select style={styles.input} value={newProduct.unitMode} onChange={e=>setNewProduct(s=>({...s,unitMode:e.target.value}))}><option value="unit">Unidade</option><option value="weight">Peso</option><option value="portion">Porção</option><option value="volume">Volume</option><option value="service">Serviço</option></select></div><input style={styles.input} type="number" min={0} placeholder="Preparo em minutos" value={newProduct.prep} onChange={e=>setNewProduct(s=>({...s,prep:e.target.value}))}/><button style={styles.primary} onClick={()=>void createProduct()}><PackagePlus size={17}/> Criar item</button></article>
      <article style={styles.card}><h2>Itens do estabelecimento</h2><div style={styles.list}>{products.map(p=><button key={p.id} onClick={()=>setSelectedProduct(p.id)} style={{...styles.product,...(selectedProduct===p.id?styles.productActive:{})}}><span><strong>{p.product_name}</strong><small>{p.item_type||"product"} · {p.unit_mode||"unit"}</small></span><b>{brl.format(p.promotional_price??p.price)}</b><ChevronRight size={16}/></button>)}{!products.length&&<div style={styles.empty}>Nenhum item cadastrado.</div>}</div></article>
    </section>}

    {tab==="variants"&&<section style={styles.grid2}><article style={styles.card}><h2>Produto</h2><select style={styles.input} value={selectedProduct} onChange={e=>setSelectedProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.product_name}</option>)}</select><h3>Adicionar variação</h3><p>Ex.: Pequena, Média, Grande; 300ml, 500ml; 1kg, 2kg.</p><input style={styles.input} placeholder="Nome da variação" value={newVariant.name} onChange={e=>setNewVariant(s=>({...s,name:e.target.value}))}/><input style={styles.input} placeholder="Acréscimo no preço" value={newVariant.delta} onChange={e=>setNewVariant(s=>({...s,delta:e.target.value}))}/><button style={styles.primary} onClick={()=>void createVariant()}><Plus size={17}/> Adicionar variação</button></article><article style={styles.card}><h2>Variações atuais</h2><div style={styles.list}>{variants.filter(v=>v.merchant_product_id===selectedProduct).map(v=><div key={v.id} style={styles.line}><span><strong>{v.name}</strong><small>{v.price_delta>=0?"+":""}{brl.format(v.price_delta)}</small></span><button style={styles.iconBtn} onClick={()=>void deleteVariant(v.id)}><Trash2 size={16}/></button></div>)}{!variants.some(v=>v.merchant_product_id===selectedProduct)&&<div style={styles.empty}>Sem variações.</div>}</div></article></section>}

    {tab==="modifiers"&&capabilities.has("modifiers")&&<section style={styles.grid2}><article style={styles.card}><h2>Novo grupo</h2><p>Ex.: Bordas, adicionais, ponto da carne, retirar ingredientes.</p><input style={styles.input} placeholder="Nome do grupo" value={newGroup.name} onChange={e=>setNewGroup(s=>({...s,name:e.target.value}))}/><label style={styles.checkbox}><input type="checkbox" checked={newGroup.required} onChange={e=>setNewGroup(s=>({...s,required:e.target.checked}))}/> Obrigatório</label><div style={styles.row}><input style={styles.input} type="number" min={0} value={newGroup.min} onChange={e=>setNewGroup(s=>({...s,min:e.target.value}))}/><input style={styles.input} type="number" min={1} value={newGroup.max} onChange={e=>setNewGroup(s=>({...s,max:e.target.value}))}/></div><button style={styles.primary} onClick={()=>void createGroup()}><Layers3 size={17}/> Criar grupo</button></article><article style={styles.card}><h2>Grupos e opções</h2><div style={styles.list}>{groups.map(g=><div key={g.id} style={styles.group}><div style={styles.groupHead}><div><strong>{g.name}</strong><small>{g.required?"Obrigatório":"Opcional"} · {g.min_select}–{g.max_select} escolhas</small></div><div style={styles.actions}><button style={styles.secondarySmall} onClick={()=>void attachGroup(g.id)}>Aplicar ao produto</button><button style={styles.iconBtn} onClick={()=>void deleteGroup(g.id)}><Trash2 size={15}/></button></div></div>{(g.modifier_options??[]).map(o=><div key={o.id} style={styles.option}><span>{o.name}</span><b>{o.price_delta?`${o.price_delta>0?"+":""}${brl.format(o.price_delta)}`:"Incluso"}</b></div>)}<div style={styles.row}><input style={styles.input} placeholder="Nova opção" value={newOption[g.id]?.name||""} onChange={e=>setNewOption(s=>({...s,[g.id]:{name:e.target.value,delta:s[g.id]?.delta||""}}))}/><input style={styles.input} placeholder="Acréscimo" value={newOption[g.id]?.delta||""} onChange={e=>setNewOption(s=>({...s,[g.id]:{name:s[g.id]?.name||"",delta:e.target.value}}))}/><button style={styles.iconBtnPrimary} onClick={()=>void addOption(g.id)}><Plus size={17}/></button></div></div>)}{!groups.length&&<div style={styles.empty}>Nenhum grupo de adicionais.</div>}</div></article></section>}
    {tab==="modifiers"&&!capabilities.has("modifiers")&&<section style={styles.card}><h2>Personalização não necessária neste perfil</h2><p>O nicho {profile.label} não ativa adicionais por padrão. Você pode alterar o tipo do negócio em “Configurar meu negócio”.</p></section>}

    {tab==="compliance"&&businessType==="pharmacy"&&<ComplianceEditor product={currentProduct} onSave={saveCompliance}/>} 
  </div></main>;
}

function ComplianceEditor({product,onSave}:{product:Product|undefined;onSave:(v:{prescription:string;controlled:boolean;review:boolean;remote:boolean;registration:string})=>void}){
  const [prescription,setPrescription]=useState("review_required"),[controlled,setControlled]=useState(false),[review,setReview]=useState(true),[remote,setRemote]=useState(true),[registration,setRegistration]=useState("");
  if(!product)return <section style={styles.card}>Selecione um produto.</section>;
  return <section style={styles.card}><h2>Conformidade · {product.product_name}</h2><p>Classifique o item antes de habilitá-lo para solicitação remota. Itens controlados ficam bloqueados no fluxo comum.</p><label style={styles.label}>Registro Anvisa<input style={styles.input} value={registration} onChange={e=>setRegistration(e.target.value)} placeholder="Número de registro, quando aplicável"/></label><label style={styles.label}>Exigência<select style={styles.input} value={prescription} onChange={e=>setPrescription(e.target.value)}><option value="none">Sem receita</option><option value="review_required">Revisão farmacêutica</option><option value="prescription_required">Receita obrigatória</option><option value="blocked_remote_sale">Não permitir venda remota</option></select></label><label style={styles.checkbox}><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> Exigir revisão do farmacêutico</label><label style={styles.checkbox}><input type="checkbox" checked={controlled} onChange={e=>{setControlled(e.target.checked);if(e.target.checked)setRemote(false)}}/> Medicamento sujeito a controle especial</label><label style={styles.checkbox}><input type="checkbox" checked={remote} disabled={controlled} onChange={e=>setRemote(e.target.checked)}/> Elegível para fluxo remoto</label><button style={styles.primary} onClick={()=>onSave({prescription,controlled,review,remote,registration})}><Save size={17}/> Salvar conformidade</button></section>
}

const styles:Record<string,any>={page:{minHeight:"100vh",background:"var(--pc-color-background)",padding:"30px 18px 70px",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif",color:"var(--pc-color-foreground)"},container:{maxWidth:1180,margin:"0 auto"},center:{minHeight:"70vh",display:"flex",gap:10,alignItems:"center",justifyContent:"center",fontFamily:"'Manrope Variable',Manrope,system-ui,sans-serif"},back:{display:"inline-flex",alignItems:"center",gap:7,textDecoration:"none",color:"var(--pc-color-muted)",fontWeight:800,marginBottom:24},header:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:20},eyebrow:{fontSize:11,fontWeight:900,letterSpacing:1.6,color:"var(--pc-color-primary)"},h1:{fontSize:"clamp(30px,4vw,46px)",margin:"7px 0",letterSpacing:-1.2},lead:{color:"var(--pc-color-muted)",margin:0},tabs:{display:"flex",gap:8,overflowX:"auto",margin:"24px 0 15px"},tab:{border:"1px solid var(--pc-color-border)",background:"var(--pc-color-surface)",borderRadius:12,padding:"10px 14px",fontWeight:800,whiteSpace:"nowrap",cursor:"pointer"},tabActive:{background:"var(--pc-color-primary)",color:"var(--pc-color-surface)",borderColor:"var(--pc-color-primary)"},grid2:{display:"grid",gridTemplateColumns:"minmax(280px,.8fr) minmax(360px,1.2fr)",gap:15},card:{background:"var(--pc-color-surface)",border:"1px solid var(--pc-color-border)",borderRadius:20,padding:20,boxShadow:"0 10px 32px rgba(15,23,42,.035)"},input:{width:"100%",boxSizing:"border-box",border:"1px solid var(--pc-color-border)",borderRadius:11,padding:"10px 11px",margin:"5px 0",background:"var(--pc-color-surface)"},row:{display:"flex",gap:7,alignItems:"center"},primary:{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:0,borderRadius:12,padding:"11px 14px",background:"var(--pc-color-success)",color:"var(--pc-color-primary-foreground)",fontWeight:900,cursor:"pointer",marginTop:8},secondary:{display:"inline-flex",alignItems:"center",gap:7,border:"1px solid var(--pc-color-border)",borderRadius:12,padding:"10px 13px",background:"var(--pc-color-surface)",fontWeight:800,cursor:"pointer"},secondarySmall:{border:"1px solid var(--pc-color-border)",borderRadius:9,padding:"6px 8px",background:"var(--pc-color-surface)",fontSize:11,fontWeight:800,cursor:"pointer"},notice:{marginTop:16,display:"flex",alignItems:"center",gap:8,background:"color-mix(in srgb,var(--pc-color-success) 8%,var(--pc-color-surface))",border:"1px solid color-mix(in srgb,var(--pc-color-success) 24%,var(--pc-color-border))",color:"var(--pc-color-success)",padding:"11px 13px",borderRadius:12,fontWeight:750},list:{display:"flex",flexDirection:"column",gap:7,maxHeight:560,overflowY:"auto"},product:{border:"1px solid var(--pc-color-border)",borderRadius:13,padding:"11px",background:"var(--pc-color-surface)",display:"grid",gridTemplateColumns:"1fr auto auto",alignItems:"center",gap:10,textAlign:"left",cursor:"pointer"},productActive:{borderColor:"var(--pc-color-primary)",background:"var(--pc-card-bg)"},line:{border:"1px solid var(--pc-color-border)",borderRadius:12,padding:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"},group:{border:"1px solid var(--pc-color-border)",borderRadius:14,padding:12},groupHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8},actions:{display:"flex",gap:5},option:{display:"flex",justifyContent:"space-between",padding:"7px 3px",borderTop:"1px solid var(--pc-color-background)"},iconBtn:{border:0,background:"var(--pc-color-background)",width:34,height:34,borderRadius:9,display:"grid",placeItems:"center",cursor:"pointer"},iconBtnPrimary:{border:0,background:"var(--pc-color-primary)",color:"var(--pc-color-surface)",width:38,height:38,borderRadius:10,display:"grid",placeItems:"center",cursor:"pointer"},checkbox:{display:"flex",alignItems:"center",gap:8,padding:"8px 0",fontWeight:700},label:{display:"flex",flexDirection:"column",gap:4,fontWeight:800,marginBottom:8},empty:{padding:18,textAlign:"center",color:"var(--pc-color-muted)",border:"1px dashed var(--pc-color-border)",borderRadius:12}}
