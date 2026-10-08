import { lazy, Suspense, useEffect } from "react";
import { FooterSingleton } from "./components/layout/FooterSingleton";
import { AuthProvider } from "./auth/AuthProvider";
import { ForbiddenPage, RedirectIfAuthenticated, RequireAuth, RequireRole } from "./components/access/RouteGuards";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProductCardQuickActions } from "./components/ProductCardQuickActions";
import { PersistentRadioProvider } from "./components/PersistentRadio";
import { DorinhaCommerceEnhancer } from "./components/DorinhaCommerceEnhancer";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { UserAccountHub, UserAccountPage } from "./components/UserAccountExperience";
import { AdminLoginRedirect } from "./components/AdminLoginRedirect";
import { SingleBrowserTabGate } from "./components/SingleBrowserTabGate";
import { AdminProductEditorOverlay } from "./components/AdminProductEditorOverlay";
import { AdminVideoQuickAccess } from "./components/AdminVideoQuickAccess";
import { AuthActionPrompt } from "./components/AuthActionPrompt";
import { SeoRouteManager } from "./components/SeoRouteManager";
import { AdminMaintenanceControl, PlatformMaintenanceGate } from "./components/PlatformMaintenance";
import { FavoritesProvider } from "./features/favorites/FavoritesProvider";
import { StoreFavoritesProvider } from "./features/favorites/StoreFavoritesProvider";
import { HomeNew2026 } from "./pages/HomeNew2026";
import { SubscriberGate } from "./components/access/SubscriberGate";
import { SingleSessionGuard } from "./components/access/SingleSessionGuard";
import { DuplicateTabNotice } from "./components/access/DuplicateTabNotice";
/* As rotas de categoria sao montadas a partir da taxonomia (dado puro), e nao
   da lista pronta de MarketplaceSectors: assim App.tsx nao precisa do objeto
   completo de cada categoria so para declarar um <Route>.
   O chrome (PublicHeader, PublicFooter, AppDock) mora em PublicChrome, que
   todo mundo importa direto. Com isso ReferenceExperience passou a ser so as
   telas dele, e pode entrar sob demanda levando junto o CSS dessas telas. */
import { businessGroups } from "./data/businessTaxonomy";

// Somente CSS técnico/funcional permanece global aqui.
// O sistema visual público antigo foi removido; a identidade ativa vem do
// campaign-theme.css carregado em main.tsx.
import "./reference/FavoritesAndSectorStability.css";
import "./reference/MobileSearchStability.css";
import "./reference/LiveSearchOverlayStackFix2026.css";
import { trackPageView } from "./lib/analytics";
import "./reference/PublicExperiencePolish2026.css";

const SectorHub2026 = lazy(() => import("./reference/SectorHub2026").then(module => ({ default: module.SectorHub2026 })));
const MarketplaceSectorLanding = lazy(() => import("./reference/MarketplaceSectors").then(module => ({ default: module.MarketplaceSectorLanding })));
const KellyBurgueriaPage = lazy(() => import("./pages/KellyBurgueriaPage").then(module => ({ default: module.KellyBurgueriaPage })));
const PontoDoSandubaPage = lazy(() => import("./pages/PontoDoSandubaPage").then(module => ({ default: module.PontoDoSandubaPage })));
const ReferenceAuthPage = lazy(() => import("./reference/ReferenceExperience").then(module => ({ default: module.ReferenceAuthPage })));
const ReferenceFavoritesPage = lazy(() => import("./reference/ReferenceExperience").then(module => ({ default: module.ReferenceFavoritesPage })));
const ReferenceInfoPage = lazy(() => import("./reference/ReferenceExperience").then(module => ({ default: module.ReferenceInfoPage })));
const MerchantPanelLayout = lazy(() => import("./components/MerchantPanelLayout").then(module => ({ default: module.MerchantPanelLayout })));
const ReferenceNotFound = lazy(() => import("./reference/ReferenceExperience").then(module => ({ default: module.ReferenceNotFound })));
const ReferenceStoresPage = lazy(() => import("./reference/ReferenceExperience").then(module => ({ default: module.ReferenceStoresPage })));
const AboutPage = lazy(() => import("./reference/AboutPage").then(module => ({ default: module.AboutPage })));
const SearchDiscovery2026 = lazy(() => import("./reference/SearchDiscovery2026").then(module => ({ default: module.SearchDiscovery2026 })));
const ProductDetailProfessional = lazy(() => import("./reference/ProductDetailLive2026").then(module => ({ default: module.ProductDetailLive2026 })));
const StoreDetailProfessional = lazy(() => import("./reference/StoreDetailProfessional").then(module => ({ default: module.StoreDetailProfessional })));
const FremixProductionsPage = lazy(() => import("./components/FremixProductionsPage").then(module => ({ default: module.FremixProductionsPage })));
const DorinhaEditorialPage = lazy(() => import("./reference/DorinhaEditorialPage").then(module => ({ default: module.DorinhaEditorialPage })));
const MerchantOnboarding = lazy(() => import("./reference/MerchantOnboarding").then(module => ({ default: module.MerchantOnboarding })));
const AdminControlCenter = lazy(() => import("./reference/AdminControlCenter").then(module => ({ default: module.AdminControlCenter })));
const AdminCatalogWorkspace = lazy(() => import("./reference/AdminCatalogWorkspace").then(module => ({ default: module.AdminCatalogWorkspace })));
const AdminEnvironmentsPage = lazy(() => import("./reference/AdminCatalogWorkspace").then(module => ({ default: module.AdminEnvironmentsPage })));
const CityDirectoryPage = lazy(() => import("./pages/CityStoresPage").then(module => ({ default: module.CityDirectoryPage })));
const CityStoresPage = lazy(() => import("./pages/CityStoresPage").then(module => ({ default: module.CityStoresPage })));
const AdminAuthGate = lazy(() => import("./reference/AdminAuthGate").then(module => ({ default: module.AdminAuthGate })));
const AdminVideoStudio = lazy(() => import("./reference/AdminVideoStudio").then(module => ({ default: module.AdminVideoStudio })));
const SmartBasketPage = lazy(() => import("./reference/SmartBasketPage").then(module => ({ default: module.SmartBasketPage })));
const AdminLicenseManager = lazy(() => import("./reference/AdminLicenseManager").then(module => ({ default: module.AdminLicenseManager })));
const AdminCustomersPage = lazy(() => import("./reference/AdminCustomersPage").then(module => ({ default: module.AdminCustomersPage })));
const AdminCustomerDetailPage = lazy(() => import("./reference/AdminCustomerDetailPage").then(module => ({ default: module.AdminCustomerDetailPage })));
const ProfessionalBasketPage = lazy(() => import("./reference/ProfessionalBasketPage").then(module => ({ default: module.ProfessionalBasketPage })));
const ShoppingListsPage = lazy(() => import("./reference/ShoppingListsPage").then(module => ({ default: module.ShoppingListsPage })));
const ShoppingListDetailPage = lazy(() => import("./reference/ShoppingListDetailPage").then(module => ({ default: module.ShoppingListDetailPage })));
const MyLicensesPage = lazy(() => import("./reference/MyLicensesPage").then(module => ({ default: module.MyLicensesPage })));
const SharedShoppingListPage = lazy(() => import("./reference/SharedShoppingListPage").then(module => ({ default: module.SharedShoppingListPage })));
const ResetPasswordPage = lazy(() => import("./reference/ResetPasswordPage").then(module => ({ default: module.ResetPasswordPage })));

function PageViewTracker(){const {pathname}=useLocation();useEffect(()=>{trackPageView(pathname)},[pathname]);return null;}
function AppShellController(){const {pathname}=useLocation();useEffect(()=>{const publicApp=!pathname.startsWith('/admin')&&!pathname.startsWith('/painel-lojista')&&!pathname.startsWith('/lojista')&&!pathname.startsWith('/cadastro-lojista')&&!pathname.startsWith('/quero-vender');document.body.classList.toggle('pc-app-shell',publicApp);document.body.dataset.appRoute=pathname==='/'?'home':pathname.split('/').filter(Boolean)[0]||'home';return()=>{document.body.classList.remove('pc-app-shell');delete document.body.dataset.appRoute}},[pathname]);return null;}
function RouteFocusManager(){const location=useLocation();useEffect(()=>{if(location.pathname.startsWith('/admin'))return;const main=document.querySelector<HTMLElement>("#conteudo-principal, main");if(!main)return;if(!main.id)main.id="conteudo-principal";main.setAttribute("tabindex","-1");main.style.setProperty("outline","none","important");
 /* A rolagem real da maioria das telas publicas e a da janela/documento: os
    wrappers abaixo (.ref-page etc.) sao apenas divs estilizadas, sem
    overflow/altura propria, entao chamar scrollTo so neles nao move nada
    visivel. Zera sempre a janela primeiro; so usa o wrapper como alvo extra
    quando ele de fato tiver sua propria rolagem interna. */
 window.scrollTo({top:0,left:0,behavior:"auto"});
 const appScreen=main.closest<HTMLElement>(".mh26-page,.msearch26-page,.ref-page,.pro-basket-page,.smart-basket-page,.pharmacy-directory-page");
 if(appScreen&&appScreen.scrollHeight>appScreen.clientHeight)appScreen.scrollTo({top:0,left:0,behavior:"auto"});
 window.requestAnimationFrame(()=>main.focus({preventScroll:true}));},[location.pathname]);return null;}
export default function App(){return <BrowserRouter><AuthProvider><SingleBrowserTabGate><PersistentRadioProvider><FavoritesProvider><StoreFavoritesProvider><a className="pc-skip-link" href="#conteudo-principal">Pular para o conteúdo</a><PwaInstallBanner/><SeoRouteManager/><PageViewTracker/><AppShellController/><RouteFocusManager/><DorinhaCommerceEnhancer/><AdminLoginRedirect/><AdminProductEditorOverlay/><AdminMaintenanceControl/><AdminVideoQuickAccess/><ProductCardQuickActions/><AuthActionPrompt/><SingleSessionGuard/><DuplicateTabNotice/><FooterSingleton/><UserAccountHub/><PlatformMaintenanceGate><Suspense fallback={<main className="pc-route-loading" aria-label="Abrindo página" aria-busy="true"/>}><Routes>
<Route path="/" element={<HomeNew2026/>}/><Route path="/buscar" element={<SearchDiscovery2026/>}/><Route path="/explorar" element={<SectorHub2026/>}/>{businessGroups.map(group=><Route key={group.id} path={group.href} element={<MarketplaceSectorLanding sectorId={group.id}/>}/>) }
<Route path="/produto/:identifier" element={<ProductDetailProfessional/>}/><Route path="/estabelecimentos" element={<ReferenceStoresPage/>}/><Route path="/cidades" element={<CityDirectoryPage/>}/><Route path="/cidade/:city" element={<CityStoresPage/>}/><Route path="/kelly-burgueria" element={<KellyBurgueriaPage/>}/><Route path="/estabelecimento/kelly-burgueria-lanchonete" element={<KellyBurgueriaPage/>}/><Route path="/estabelecimento/kelly-burgueria-e-lanchonete" element={<KellyBurgueriaPage/>}/><Route path="/loja/kelly-burgueria-lanchonete" element={<KellyBurgueriaPage/>}/><Route path="/loja/kelly-burgueria-e-lanchonete" element={<KellyBurgueriaPage/>}/><Route path="/beto-burguer" element={<PontoDoSandubaPage/>}/><Route path="/estabelecimento/beto-burguer" element={<PontoDoSandubaPage/>}/><Route path="/loja/beto-burguer" element={<PontoDoSandubaPage/>}/><Route path="/ponto-do-sanduba" element={<PontoDoSandubaPage/>}/><Route path="/estabelecimento/ponto-do-sanduba" element={<PontoDoSandubaPage/>}/><Route path="/loja/ponto-do-sanduba" element={<PontoDoSandubaPage/>}/><Route path="/estabelecimento/dorinha-barroso-livros" element={<Navigate to="/autora/dorinha-barroso" replace/>}/><Route path="/loja/dorinha-barroso-livros" element={<Navigate to="/autora/dorinha-barroso" replace/>}/><Route path="/estabelecimento/fremix-producoes" element={<Navigate to="/fremix-producoes" replace/>}/><Route path="/loja/fremix-producoes" element={<Navigate to="/fremix-producoes" replace/>}/><Route path="/estabelecimento/:identifier" element={<StoreDetailProfessional/>}/><Route path="/loja/:identifier" element={<StoreDetailProfessional/>}/><Route path="/cesta" element={<ProfessionalBasketPage/>}/><Route path="/cesta-basica" element={<ProfessionalBasketPage/>}/><Route path="/cesta-inteligente" element={<RequireAuth><SubscriberGate tool="A Cesta Inteligente"><SmartBasketPage/></SubscriberGate></RequireAuth>}/><Route path="/minhas-listas" element={<RequireAuth><ShoppingListsPage/></RequireAuth>}/><Route path="/lista/:id" element={<RequireAuth><ShoppingListDetailPage/></RequireAuth>}/><Route path="/minhas-licencas" element={<RequireAuth><MyLicensesPage/></RequireAuth>}/><Route path="/lista-compartilhada/:token" element={<SharedShoppingListPage/>}/><Route path="/favoritos" element={<RequireAuth><ReferenceFavoritesPage/></RequireAuth>}/><Route path="/minha-conta" element={<RequireAuth><UserAccountPage/></RequireAuth>}/>
<Route path="/redefinir-senha" element={<ResetPasswordPage/>}/><Route path="/login" element={<RedirectIfAuthenticated><ReferenceAuthPage mode="login"/></RedirectIfAuthenticated>}/><Route path="/cadastro" element={<RedirectIfAuthenticated><ReferenceAuthPage mode="register"/></RedirectIfAuthenticated>}/><Route path="/registrar" element={<RedirectIfAuthenticated><ReferenceAuthPage mode="register"/></RedirectIfAuthenticated>}/><Route path="/lojista" element={<MerchantOnboarding/>}/><Route path="/cadastro-lojista" element={<MerchantOnboarding/>}/><Route path="/quero-vender" element={<MerchantOnboarding/>}/><Route path="/403" element={<ForbiddenPage/>}/><Route path="/painel-lojista/*" element={<RequireRole allow="merchant" message="Esta área é exclusiva de estabelecimentos autorizados. Solicite acesso pelo cadastro de lojista."><MerchantPanelLayout/></RequireRole>}/><Route path="/admin/catalogo" element={<AdminAuthGate><AdminCatalogWorkspace/></AdminAuthGate>}/><Route path="/admin/ambientes" element={<AdminAuthGate><AdminEnvironmentsPage/></AdminAuthGate>}/><Route path="/admin/videos" element={<AdminAuthGate><AdminVideoStudio/></AdminAuthGate>}/><Route path="/admin/licencas" element={<AdminAuthGate><AdminLicenseManager/></AdminAuthGate>}/><Route path="/admin/clientes" element={<AdminAuthGate><AdminCustomersPage/></AdminAuthGate>}/><Route path="/admin/clientes/:userId" element={<AdminAuthGate><AdminCustomerDetailPage/></AdminAuthGate>}/><Route path="/admin/*" element={<AdminAuthGate><AdminControlCenter/></AdminAuthGate>}/>
<Route path="/sobre" element={<AboutPage/>}/><Route path="/colaborar" element={<ReferenceInfoPage kind="collaborate"/>}/><Route path="/contato" element={<ReferenceInfoPage kind="contact"/>}/><Route path="/fale-conosco" element={<ReferenceInfoPage kind="contact"/>}/><Route path="/meus-pedidos" element={<RequireAuth><ReferenceInfoPage kind="orders"/></RequireAuth>}/><Route path="/cultura/*" element={<ReferenceInfoPage kind="culture"/>}/><Route path="/fremix-producoes" element={<FremixProductionsPage/>}/><Route path="/autora/*" element={<DorinhaEditorialPage/>}/><Route path="/dorinha-barroso" element={<DorinhaEditorialPage/>}/><Route path="*" element={<ReferenceNotFound/>}/>
</Routes></Suspense></PlatformMaintenanceGate></StoreFavoritesProvider></FavoritesProvider></PersistentRadioProvider></SingleBrowserTabGate></AuthProvider></BrowserRouter>}
