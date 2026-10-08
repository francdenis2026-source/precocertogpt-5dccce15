import { useEffect, useMemo, useRef, useState } from "react";
import "./AdminPerformance.css";
import { useGSAP, gsap, ScrollTrigger } from "../lib/lightMotion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeButton } from "./PublicChrome";
import { HeaderRadioPlayer } from "../components/PersistentRadio";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Pencil,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Tag,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { loadSessionProfile, signOut, type SessionProfile } from "../lib/roles";
import {
  cancelOrder,
  loadAdminSnapshot,
  reviewMerchantApplication,
  setUserRole,
  updateMerchant,
  type AdminSnapshot,
} from "../lib/adminPlatform";
import {
  deleteAdminProductPrice,
  loadAdminCatalog,
  loadAdminEstablishmentCatalog,
  setAdminProductPrice,
  type AdminCatalogSnapshot,
} from "../lib/adminCatalog";
import { usePriceVisibility } from "../hooks/usePriceVisibility";
import { setAllPricesVisible } from "../lib/priceVisibility";
import { AdminCampaignManager } from "./AdminCampaignManager";
import { AdminRadioManager } from "./AdminRadioManager";
import { AdminOffersManager } from "./AdminOffersManager";
import "./AdminControlCenter.css";
import "./AdminControlCenterEnhancements.css";
import "./AdminMerchantRedesign2026.css";

gsap.registerPlugin(ScrollTrigger);

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const integer = new Intl.NumberFormat("pt-BR");
const dt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const fmt = (v?: string | null) => (v ? dt.format(new Date(v)) : "—");
const roleLabel: Record<string, string> = {
  super_admin: "Superadministrador",
  admin: "Administrador",
  moderator: "Moderador",
  merchant_owner: "Lojista",
  merchant_staff: "Equipe da loja",
  consumer: "Consumidor",
};
type Section =
  | "overview"
  | "prices"
  | "campaigns"
  | "offers"
  | "radio"
  | "merchants"
  | "orders"
  | "users"
  | "reputation"
  | "audit";
const sectionFromPath = (p: string): Section =>
  p.includes("/ofertas")
    ? "offers"
    : p.includes("/precos")
    ? "prices"
    : p.includes("/banners")
      ? "campaigns"
      : p.includes("/radio")
        ? "radio"
        : p.includes("/comerciantes")
          ? "merchants"
          : p.includes("/pedidos")
            ? "orders"
            : p.includes("/usuarios")
              ? "users"
              : p.includes("/reputacao")
                ? "reputation"
                : p.includes("/auditoria")
                  ? "audit"
                  : "overview";

export function AdminControlCenter() {
  const pageRef = useRef<HTMLDivElement>(null);
  const location = useLocation(),
    navigate = useNavigate(),
    section = sectionFromPath(location.pathname);
  const [profile, setProfile] = useState<SessionProfile | null>(null),
    [authorized, setAuthorized] = useState<boolean | null>(null),
    [data, setData] = useState<AdminSnapshot | null>(null),
    [catalog, setCatalog] = useState<AdminCatalogSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await loadSessionProfile();
      setProfile(p);
      setAuthorized(Boolean(p?.isAdmin));
      if (!p?.isAdmin) {
        setData(null);
        return;
      }
      const [snapshot, cat] = await Promise.all([
        loadAdminSnapshot(),
        loadAdminCatalog(),
      ]);
      setData(snapshot);
      setCatalog(cat);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const act = async (
    key: string,
    fn: () => Promise<{ error: string | null }>,
  ) => {
    setBusy(key);
    const r = await fn();
    setBusy("");
    if (r.error) {
      setError(r.error);
      return;
    }
    await refresh();
  };
  const logout = async () => {
    await signOut();
    navigate("/login");
  };
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const filter = (rows: any[], fields: string[]) =>
    !q
      ? rows
      : rows.filter((r) =>
          fields.some((f) =>
            String(r?.[f] ?? "")
              .toLocaleLowerCase("pt-BR")
              .includes(q),
          ),
        );
  // Entrada suave do cabeçalho do painel e revelação dos cartões/painéis ao
  // rolar, seguindo a convenção usada nas páginas públicas. Só roda quando o
  // conteúdo real do dashboard está montado (autorizado, com dados e sem
  // spinner) — por isso o guard cedo dentro do callback, já que o hook em si
  // precisa vir antes de qualquer return condicional (Rules of Hooks).
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (authorized !== true || !data || (loading && !data)) return;
      gsap.from(".acc-top > *", {
        y: 16,
        opacity: 0,
        duration: 0.55,
        stagger: 0.06,
        ease: "power3.out",
      });
      gsap.utils
        .toArray<HTMLElement>(
          ".acc-cards, .acc-panel, .acc-table-wrap, .acc-application-grid",
        )
        .forEach((section) => {
          gsap.from(section, {
            scrollTrigger: { trigger: section, start: "top 90%", once: true },
            y: 20,
            opacity: 0,
            duration: 0.5,
            ease: "power2.out",
          });
        });
    },
    { scope: pageRef, dependencies: [authorized, loading, data, section] },
  );
  if (authorized === null || (loading && !data))
    return (
      <main className="acc-state">
        <RefreshCw className="spin" />
        <h1>Carregando administração…</h1>
      </main>
    );
  if (!authorized)
    return (
      <main className="acc-state">
        <ShieldCheck />
        <h1>Acesso administrativo restrito</h1>
        <Link to="/login">Entrar</Link>
      </main>
    );
  if (!data)
    return (
      <main className="acc-state">
        <X />
        <h1>Não foi possível abrir o painel</h1>
        <p>{error}</p>
        <button onClick={() => void refresh()}>Tentar novamente</button>
      </main>
    );
  const s = data.summary || {};
  return (
    <div className="acc-shell" ref={pageRef}>
      <aside className="acc-sidebar">
        <Link to="/" className="acc-brand">
          <img src="/logo-preco-certo-inversa.svg" alt="PreçoCerto" />
        </Link>
        <nav>
          <small>INTELIGÊNCIA</small>
          <Nav
            to="/admin"
            active={section === "overview"}
            icon={<LayoutDashboard />}
          >
            Visão geral
          </Nav>
          <Nav
            to="/admin/precos"
            active={section === "prices"}
            icon={<BarChart3 />}
          >
            Mapa de preços
          </Nav>
          <small>CONTEÚDO</small>
          <Nav
            to="/admin/banners"
            active={section === "campaigns"}
            icon={<Megaphone />}
          >
            Banners e propagandas
          </Nav>
          <Nav
            to="/admin/ofertas"
            active={section === "offers"}
            icon={<Tag />}
          >
            Ofertas
          </Nav>
          <Nav to="/admin/radio" active={section === "radio"} icon={<Radio />}>
            Rádio do site
          </Nav>
          <small>CATÁLOGO</small>
          <Nav to="/admin/catalogo" active={false} icon={<Tag />}>
            Produtos e lojas
          </Nav>
          <Nav to="/admin/ambientes" active={false} icon={<ExternalLink />}>
            Ambientes
          </Nav>
          <small>MONETIZAÇÃO</small>
          <Nav to="/admin/licencas" active={false} icon={<KeyRound />}>
            Cesta Inteligente (licenças)
          </Nav>
          <Nav to="/admin/cadastros" active={false} icon={<UsersRound />}>
            Cadastros de usuários
          </Nav>
          <Nav to="/admin/clientes" active={false} icon={<CircleDollarSign />}>
            Clientes e financeiro
          </Nav>
          <small>OPERAÇÕES</small>
          <Nav
            to="/admin/comerciantes"
            active={section === "merchants"}
            icon={<Building2 />}
          >
            Comerciantes <b>{s.pendingApplications || 0}</b>
          </Nav>
          <Nav
            to="/admin/pedidos"
            active={section === "orders"}
            icon={<ShoppingBasket />}
          >
            Pedidos
          </Nav>
          <small>USUÁRIOS</small>
          <Nav
            to="/admin/usuarios"
            active={section === "users"}
            icon={<UsersRound />}
          >
            Usuários
          </Nav>
          <Nav
            to="/admin/reputacao"
            active={section === "reputation"}
            icon={<ListChecks />}
          >
            Atividade
          </Nav>
          <small>SEGURANÇA</small>
          <Nav
            to="/admin/auditoria"
            active={section === "audit"}
            icon={<ClipboardCheck />}
          >
            Auditoria
          </Nav>
        </nav>
        <footer>
          <span>
            <ShieldCheck />
            {profile?.roles.includes("super_admin")
              ? "Superadministrador"
              : "Administrador"}
          </span>
          <button onClick={logout}>
            <LogOut />
            Sair
          </button>
        </footer>
      </aside>
      <main className="acc-main">
        <header className="acc-top">
          <div>
            <small>PAINEL EXECUTIVO</small>
            <h1>{titles[section]}</h1>
            <p>{subtitles[section]}</p>
          </div>
          <div className="acc-top-actions">
            <label>
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nesta área"
              />
            </label>
            <div className="acc-top-actions__radio"><HeaderRadioPlayer /></div>
            <ThemeButton />
            <button onClick={() => void refresh()}>
              <RefreshCw className={loading ? "spin" : ""} />
            </button>
            <Link to="/">Ver site</Link>
          </div>
        </header>
        {error && (
          <div className="acc-error">
            {error}
            <button onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        {section === "overview" && <Overview data={data} />}{" "}
        {section === "prices" && (
          <Prices
            map={catalog?.establishments || []}
            fallbackRows={filter(data.prices, [
              "product_name",
              "category",
              "establishment_name",
              "neighborhood",
            ])}
            setError={setError}
          />
        )}{" "}
        {section === "campaigns" && (
          <AdminCampaignManager query={query} onError={setError} />
        )}{" "}
        {section === "offers" && <AdminOffersManager onError={message => setError(message ?? "")} />}{" "}
        {section === "radio" && <AdminRadioManager onError={setError} />}{" "}
        {section === "merchants" && (
          <Merchants
            applications={filter(data.applications, [
              "business_name",
              "owner_name",
              "email",
              "status",
            ])}
            merchants={filter(data.merchants, [
              "name",
              "business_type",
              "status",
              "email",
            ])}
            busy={busy}
            act={act}
          />
        )}{" "}
        {section === "orders" && (
          <Orders
            rows={filter(data.orders, [
              "order_number",
              "merchant_name",
              "customer_name",
              "status",
            ])}
            busy={busy}
            act={act}
          />
        )}{" "}
        {section === "users" && (
          <Users
            rows={filter(data.users, ["display_name", "email", "profile_role"])}
            superAdmin={Boolean(profile?.roles.includes("super_admin"))}
            busy={busy}
            act={act}
          />
        )}{" "}
        {section === "reputation" && <ActivityView rows={data.activity} />}{" "}
        {section === "audit" && <Audit rows={data.audit} />}
      </main>
    </div>
  );
}

const titles = {
  overview: "Visão geral",
  prices: "Mapa e catálogo por estabelecimento",
  campaigns: "Banners e propagandas",
  offers: "Ofertas",
  radio: "Rádio do site",
  merchants: "Comerciantes e solicitações",
  orders: "Pedidos da plataforma",
  users: "Usuários e permissões",
  reputation: "Atividade e reputação",
  audit: "Auditoria administrativa",
};
const subtitles = {
  overview: "Panorama operacional real do PreçoCerto.",
  prices:
    "Selecione um estabelecimento para visualizar e administrar os produtos cadastrados nele.",
  campaigns: "Crie, agende e controle a comunicação exibida no site.",
  offers: "Cadastre preços promocionais com validade e imagem para as páginas de categoria.",
  radio: "Troque a emissora, o streaming e a API da música atual.",
  merchants: "Aprove cadastros e controle a operação das lojas.",
  orders: "Acompanhe pedidos e intervenha quando necessário.",
  users: "Consulte contas e gerencie permissões.",
  reputation: "Eventos e sinais de uso da plataforma.",
  audit: "Rastreabilidade das ações administrativas.",
};
function Nav({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={active ? "active" : ""}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function PriceVisibilityControl() {
  const { allPricesVisible, loading } = usePriceVisibility();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setSaving(true);
    setError(null);
    const { error: saveError } = await setAllPricesVisible(!allPricesVisible);
    if (saveError) setError(saveError);
    setSaving(false);
  };

  return (
    <section className={`acc-panel wide acc-price-gate${allPricesVisible ? " is-open" : ""}`}>
      <header>
        <div>
          <small>ACESSO PÚBLICO</small>
          <h2>Visibilidade de preços</h2>
        </div>
        {allPricesVisible ? <Eye /> : <EyeOff />}
      </header>
      <div className="acc-price-gate__body">
        <p>
          {allPricesVisible
            ? "Todos os preços do catálogo estão visíveis para qualquer visitante, mesmo sem cadastro ou login."
            : "Visitantes não cadastrados veem apenas uma prévia dos preços; o restante fica bloqueado até criarem conta."}
        </p>
        <button
          type="button"
          className="acc-price-gate__toggle"
          role="switch"
          aria-checked={allPricesVisible}
          disabled={loading || saving}
          onClick={toggle}
        >
          <span className="acc-price-gate__toggle-track"><span className="acc-price-gate__toggle-thumb" /></span>
          <span>{allPricesVisible ? "Liberado para todos" : "Restrito a cadastrados"}</span>
        </button>
      </div>
      <small className="acc-price-gate__hint">
        {saving ? "Salvando…" : "Aplicado em tempo real, no site inteiro, sem precisar publicar."}
      </small>
      {error && <p className="acc-price-gate__error">{error}</p>}
    </section>
  );
}

function Overview({ data }: { data: AdminSnapshot }) {
  const s = data.summary;
  const cards = [
    {
      label: "Comerciantes ativos",
      value: s.activeMerchants,
      icon: Store,
      to: "/admin/comerciantes",
    },
    {
      label: "Solicitações pendentes",
      value: s.pendingApplications,
      icon: Building2,
      to: "/admin/comerciantes",
    },
    {
      label: "Pedidos hoje",
      value: s.ordersToday,
      icon: ShoppingBasket,
      to: "/admin/pedidos",
    },
    {
      label: "Usuários",
      value: s.users,
      icon: UsersRound,
      to: "/admin/usuarios",
    },
    {
      label: "Preços hoje",
      value: s.pricesToday,
      icon: Tag,
      to: "/admin/precos",
    },
    {
      label: "GMV hoje",
      value: money.format(s.gmvToday || 0),
      icon: CircleDollarSign,
      to: "/admin/pedidos",
    },
  ];
  return (
    <>
      <section className="acc-cards acc-cards--links">
        {cards.map((c) => (
          <Link to={c.to} key={c.label}>
            <c.icon />
            <span>{c.label}</span>
            <strong>
              {typeof c.value === "number" ? integer.format(c.value) : c.value}
            </strong>
            <small>Abrir área →</small>
          </Link>
        ))}
      </section>
      <PriceVisibilityControl />
      <section className="acc-grid">
        <article className="acc-panel wide">
          <header>
            <div>
              <small>COBERTURA</small>
              <h2>Operação da plataforma</h2>
            </div>
            <BadgeCheck />
          </header>
          <div className="acc-kpis">
            <Link to="/admin/precos">
              <strong>{integer.format(s.prices || 0)}</strong>
              <span>preços registrados</span>
            </Link>
            <Link to="/admin/comerciantes">
              <strong>{integer.format(s.merchants || 0)}</strong>
              <span>comerciantes</span>
            </Link>
            <Link to="/admin/pedidos">
              <strong>{integer.format(s.orders || 0)}</strong>
              <span>pedidos totais</span>
            </Link>
            <Link to="/admin/catalogo">
              <strong>Gerenciar</strong>
              <span>catálogo e lojas</span>
            </Link>
          </div>
        </article>
        <article className="acc-panel">
          <header>
            <div>
              <small>ATENÇÃO</small>
              <h2>Fila operacional</h2>
            </div>
            <Bell />
          </header>
          <ul className="acc-list">
            <li>
              <span>Cadastros aguardando análise</span>
              <strong>{s.pendingApplications || 0}</strong>
            </li>
            <li>
              <span>Comerciantes ativos</span>
              <strong>{s.activeMerchants || 0}</strong>
            </li>
          </ul>
        </article>
        <article className="acc-panel acc-panel--full">
          <header>
            <div>
              <small>ATALHOS</small>
              <h2>Gestão</h2>
            </div>
            <Eye />
          </header>
          <div className="acc-shortcuts">
            <Link to="/admin/catalogo">Produtos e lojas</Link>
            <Link to="/admin/ambientes">Ambientes</Link>
            <Link to="/admin/auditoria">Auditoria</Link>
          </div>
        </article>
      </section>
    </>
  );
}

function Prices({
  map,
  fallbackRows,
  setError,
}: {
  map: any[];
  fallbackRows: any[];
  setError: (s: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const sortedMap = useMemo(
    () => map.slice().sort((a, b) => (Number(b.product_count) || 0) - (Number(a.product_count) || 0)),
    [map],
  );
  useEffect(() => {
    if (!selected) {
      setRows([]);
      return;
    }
    setLoading(true);
    void loadAdminEstablishmentCatalog(selected)
      .then(setRows)
      .catch((e) =>
        setError(e?.message || "Falha ao carregar estabelecimento."),
      )
      .finally(() => setLoading(false));
  }, [selected]);
  const store = map.find((s) => s.id === selected);
  const address = store?.address && typeof store.address === "object"
    ? [store.address.street, store.address.number, store.address.neighborhood || store.neighborhood, store.address.city]
        .filter(Boolean).join(", ")
    : (typeof store?.address === "string" ? store.address : null);
  const change = async (r: any) => {
    const raw = prompt(`Novo preço de ${r.name}:`, String(r.value || ""));
    if (!raw) return;
    const v = Number(raw.replace(",", "."));
    if (v <= 0) return;
    const x = await setAdminProductPrice(r.product_id, r.establishment_id, v);
    if (x.error) setError(x.error);
    else setRows(await loadAdminEstablishmentCatalog(selected));
  };
  const remove = async (r: any) => {
    if (!confirm(`Remover ${r.name} somente do catálogo de ${store?.name}?`))
      return;
    const x = await deleteAdminProductPrice(r.product_id, r.establishment_id);
    if (x.error) setError(x.error);
    else setRows(await loadAdminEstablishmentCatalog(selected));
  };
  return (
    <>
      <section className="acc-panel acc-store-picker">
        <header>
          <div>
            <small>MAPA DE PREÇOS</small>
            <h2>Selecione o estabelecimento</h2>
          </div>
          <BarChart3 />
        </header>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Visão geral de todos os estabelecimentos</option>
          {sortedMap.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.product_count} produtos
            </option>
          ))}
        </select>
        {selected && (
          <div className="acc-store-tools acc-store-tools--detail">
            <span>
              <strong>{store?.name}</strong>
              <small>{store?.neighborhood || "Feijó"} · {rows.length} produtos</small>
            </span>
            <dl>
              <div><dt>Endereço</dt><dd>{address || "Não informado"}</dd></div>
              <div><dt>Cadastrado em</dt><dd>{fmt(store?.created_at)}</dd></div>
              <div><dt>Última atualização de preço</dt><dd>{fmt(store?.last_price_update)}</dd></div>
              <div><dt>Verificado</dt><dd>{store?.is_verified ? "Sim" : "Não"}</dd></div>
            </dl>
            <Link to={`/admin/catalogo?tab=store&store=${selected}`}>
              Gestão completa <ExternalLink />
            </Link>
          </div>
        )}
      </section>
      {selected ? (
        loading ? (
          <p>Carregando catálogo…</p>
        ) : (
          <Table
            heads={["Produto", "Categoria", "Preço", "Atualizado", "Ações"]}
            rows={rows.map((r) => (
              <tr key={r.product_id}>
                <td>
                  <strong>{r.name}</strong>
                  <small>
                    {[r.brand, r.size, r.unit].filter(Boolean).join(" · ")}
                  </small>
                </td>
                <td>{r.category || "—"}</td>
                <td>
                  <b>{money.format(Number(r.value) || 0)}</b>
                </td>
                <td>{fmt(r.captured_at)}</td>
                <td className="actions">
                  <a
                    href={`/produto/${r.slug || r.product_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye />
                    Ver
                  </a>
                  <Link to={`/admin/catalogo?tab=store&store=${selected}`}>
                    <Pencil />
                    Editar
                  </Link>
                  <button onClick={() => void change(r)}>
                    <Tag />
                    Preço
                  </button>
                  <button className="danger" onClick={() => void remove(r)}>
                    <Trash2 />
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          />
        )
      ) : (
        <>
          <section className="acc-grid">
            <article className="acc-panel wide">
              <header>
                <div>
                  <small>COBERTURA LOCAL</small>
                  <h2>Estabelecimentos com mais produtos monitorados</h2>
                </div>
              </header>
              <div className="acc-bars">
                {sortedMap.slice(0, 15).map((s) => (
                  <button key={s.id} onClick={() => setSelected(s.id)} title="Ver produtos e detalhes deste estabelecimento">
                    <span>
                      <strong>{s.name}</strong>
                      <small>{s.neighborhood || "Feijó"}</small>
                    </span>
                    <i>
                      <b
                        style={{
                          width: `${Math.max(6, Math.min(100, Number(s.product_count) || 0))}%`,
                        }}
                      />
                    </i>
                    <em>{s.product_count}</em>
                  </button>
                ))}
              </div>
            </article>
          </section>
          <p className="acc-bars-hint">Clique em um estabelecimento acima para ver o catálogo completo dele.</p>
        </>
      )}
    </>
  );
}

function Merchants({
  applications,
  merchants,
  busy,
  act,
}: {
  applications: any[];
  merchants: any[];
  busy: string;
  act: any;
}) {
  const pending = applications.filter((a) => a.status === "pending");
  return (
    <>
      <section className="acc-panel">
        <header>
          <div>
            <small>ONBOARDING</small>
            <h2>Solicitações pendentes</h2>
          </div>
          <strong>{pending.length}</strong>
        </header>
        <div className="acc-application-grid">
          {pending.map((a) => (
            <article key={a.id}>
              <div>
                <small>{a.business_type || a.kind || "comércio local"}</small>
                <h3>{a.business_name}</h3>
                <p>
                  {a.owner_name} · {a.email}
                </p>
              </div>
              <div>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    void act(`approve-${a.id}`, () =>
                      reviewMerchantApplication(
                        a.id,
                        "approved",
                        "Aprovado pelo painel",
                      ),
                    )
                  }
                >
                  <Check />
                  Aprovar
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    const reason = prompt("Motivo da rejeição:") || "";
                    if (reason)
                      void act(`reject-${a.id}`, () =>
                        reviewMerchantApplication(a.id, "rejected", reason),
                      );
                  }}
                >
                  <X />
                  Rejeitar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Table
        heads={[
          "Comerciante",
          "Status",
          "Catálogo",
          "Pedidos",
          "Vendas",
          "Ações",
        ]}
        rows={merchants.map((m) => (
          <tr key={m.id}>
            <td>
              <strong>{m.name}</strong>
              <small>{m.business_type}</small>
            </td>
            <td>{m.status}</td>
            <td>{m.product_count}</td>
            <td>{m.order_count}</td>
            <td>{m.online_sales_enabled ? "Ativas" : "Desativadas"}</td>
            <td className="actions">
              <button
                onClick={() =>
                  void act(`status-${m.id}`, () =>
                    updateMerchant(m.id, {
                      status: m.status === "active" ? "suspended" : "active",
                    }),
                  )
                }
              >
                {m.status === "active" ? "Suspender" : "Ativar"}
              </button>
              <button
                onClick={() =>
                  void act(`sales-${m.id}`, () =>
                    updateMerchant(m.id, {
                      onlineSalesEnabled: !m.online_sales_enabled,
                    }),
                  )
                }
              >
                {m.online_sales_enabled ? "Desativar vendas" : "Ativar vendas"}
              </button>
            </td>
          </tr>
        ))}
      />
    </>
  );
}
function Orders({ rows, busy, act }: { rows: any[]; busy: string; act: any }) {
  return (
    <Table
      heads={[
        "Pedido",
        "Comerciante",
        "Cliente",
        "Status",
        "Pagamento",
        "Total",
        "Criado",
        "Ação",
      ]}
      rows={rows.map((o) => (
        <tr key={o.id}>
          <td>
            <strong>{o.order_number}</strong>
          </td>
          <td>{o.merchant_name}</td>
          <td>{o.customer_name}</td>
          <td>{o.status}</td>
          <td>{o.payment_status}</td>
          <td>{money.format(Number(o.total) || 0)}</td>
          <td>{fmt(o.created_at)}</td>
          <td>
            {!["cancelled", "delivered"].includes(o.status) && (
              <button
                className="danger"
                disabled={!!busy}
                onClick={() => {
                  const reason =
                    prompt(
                      "Motivo do cancelamento:",
                      "Intervenção administrativa",
                    ) || "";
                  if (reason)
                    void act(`cancel-${o.id}`, () => cancelOrder(o.id, reason));
                }}
              >
                Cancelar
              </button>
            )}
          </td>
        </tr>
      ))}
    />
  );
}
function Users({
  rows,
  superAdmin,
  busy,
  act,
}: {
  rows: any[];
  superAdmin: boolean;
  busy: string;
  act: any;
}) {
  const admins = rows.filter((u) =>
    Array.isArray(u.roles) && u.roles.includes("admin"),
  ).length;
  const moderators = rows.filter((u) =>
    Array.isArray(u.roles) && u.roles.includes("moderator"),
  ).length;
  const activeWeek = rows.filter((u) => {
    if (!u.last_sign_in_at) return false;
    const days = (Date.now() - new Date(u.last_sign_in_at).getTime()) / 86400000;
    return days <= 7;
  }).length;
  return (
    <>
      <div className="acc-users-hero">
        <div>
          <strong>{rows.length}</strong>
          <span>Contas cadastradas</span>
        </div>
        <div>
          <strong>{admins}</strong>
          <span>Com acesso de admin</span>
        </div>
        <div>
          <strong>{moderators}</strong>
          <span>Moderadores</span>
        </div>
        <div>
          <strong>{activeWeek}</strong>
          <span>Ativos nos últimos 7 dias</span>
        </div>
      </div>
      <Table
        heads={[
          "Usuário",
          "Perfil",
          "Papéis",
          "Cadastro",
          "Último acesso",
          "Permissões",
        ]}
        rows={rows.map((u) => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        return (
          <tr key={u.id}>
            <td>
              <strong>{u.display_name || "Usuário"}</strong>
              <small>{u.email}</small>
            </td>
            <td>{u.profile_role}</td>
            <td>
              {roles.map((r: string) => (
                <span className="acc-chip" key={r}>
                  {roleLabel[r] || r}
                </span>
              ))}
            </td>
            <td>{fmt(u.created_at)}</td>
            <td>{fmt(u.last_sign_in_at)}</td>
            <td>
              {superAdmin && (
                <div className="actions">
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void act(`admin-${u.id}`, () =>
                        setUserRole(u.id, "admin", !roles.includes("admin")),
                      )
                    }
                  >
                    {roles.includes("admin") ? "Remover admin" : "Tornar admin"}
                  </button>
                  <button
                    onClick={() =>
                      void act(`mod-${u.id}`, () =>
                        setUserRole(
                          u.id,
                          "moderator",
                          !roles.includes("moderator"),
                        ),
                      )
                    }
                  >
                    Moderador
                  </button>
                </div>
              )}
            </td>
          </tr>
        );
        })}
      />
    </>
  );
}
function ActivityView({ rows }: { rows: any[] }) {
  return (
    <Table
      heads={["Ação", "Entidade", "Quantidade", "Última ocorrência"]}
      rows={rows.map((r: any, i) => (
        <tr key={i}>
          <td>{r.action}</td>
          <td>{r.entity_type}</td>
          <td>{r.event_count}</td>
          <td>{fmt(r.last_seen)}</td>
        </tr>
      ))}
    />
  );
}
function Audit({ rows }: { rows: any[] }) {
  return (
    <Table
      heads={["Ação", "Entidade", "Responsável", "Comerciante", "Data"]}
      rows={rows.map((r) => (
        <tr key={r.id}>
          <td>
            <strong>{r.action}</strong>
          </td>
          <td>{r.entity_type}</td>
          <td>{r.actor_name || r.actor_email || "Sistema"}</td>
          <td>{r.merchant_name || "—"}</td>
          <td>{fmt(r.created_at)}</td>
        </tr>
      ))}
    />
  );
}
function Table({ heads, rows }: { heads: string[]; rows: React.ReactNode[] }) {
  return (
    <section className="acc-table-wrap">
      <div className="acc-table-scroll">
        <table className="acc-table">
          <thead>
            <tr>
              {heads.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows
            ) : (
              <tr>
                <td colSpan={heads.length}>Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
