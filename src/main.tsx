import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Duas familias, nao tres: Outfit para titulos e Manrope para texto. Inter
// saiu porque so restava em um punhado de rotulos e ainda assim custava 47 KB
// de woff2 no caminho critico da home.
import "./styles/fonts.css";
import "./styles/AppReset.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initializePwaRuntime } from "./lib/pwaRuntime";
import { initializeSiteTheme } from "./lib/siteTheme";
import { initializeImageLoadFade } from "./lib/imageLoadFade";
import { prefetchSectorCatalog } from "./data/sectorCatalog";

// Dispara a busca do catálogo real antes de o React sequer montar a árvore,
// em vez de só começar dentro do useEffect da home — encolhe a janela em
// que a home mostra o skeleton cinza (ou o catálogo estático de fallback,
// dominado pelos dois únicos negócios cadastrados manualmente).
prefetchSectorCatalog();

// Sistema visual público central. Estas folhas antes eram injetadas por
// <link> em runtime (11 requisições bloqueantes, sem minificação nem hash).
// Agora entram no bundle. A ordem abaixo é a mesma cascata anterior e, por
// vir depois de `App`, continua tendo a última palavra sobre o CSS de página.
import "./styles/global/light-professional-2026.css";
import "./styles/global/logo-integration-2026.css";
import "./styles/global/typography-contrast-2026.css";
import "./styles/global/light-icon-contrast-2026.css";
import "./styles/global/glass-shell-2026.css";
import "./styles/global/mobile-app-shell-2026.css";
import "./styles/global/pwa-install-2026.css";
import "./styles/global/interaction-hover-2026.css";
import "./styles/global/app-shell-professional-2026.css";
import "./styles/global/search-refinement-2026.css";
import "./styles/global/taste-auth-2026.css";
import "./styles/global/glass-app-shell-v3-2026.css";
// Camada final profissional: dona da busca, header, ritmo de seções e rodapé.
import "./styles/global/pro-experience-2026.css";
import "./styles/global/member-experience-2026.css";
// Piso de feedback ao toque/teclado. Entra por ultimo de proposito, mas com
// seletores de especificidade zero: acrescenta onde nao havia nada e nunca
// sobrepoe o que cada pagina ja define.
import "./styles/global/touch-feedback-2026.css";
// Aviso de conexão: o elemento era criado sem nenhuma regra de estilo.
import "./styles/global/network-status-2026.css";
import "./styles/global/responsive-review-2026.css";
import "./styles/global/home-refinement-2026.css";



initializeSiteTheme();
initializeImageLoadFade();
document.documentElement.classList.remove("pc-prepaint");
document.documentElement.classList.add("pc-styles-ready");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);

const startNotifications = () => {
  if (!navigator.onLine) return;
  void import("./lib/paymentNotifications")
    .then(({ startPaymentNotifications }) => startPaymentNotifications())
    .catch(() => {});
};

window.setTimeout(startNotifications, 1_500);
window.addEventListener("online", startNotifications, { once: true });

// Centraliza o ciclo do service worker. O runtime também remove registros
// antigos em previews/iframes, evitando HTML ou chunks obsoletos e tela branca.
initializePwaRuntime();

// Toda página troca de rota carregando um pedaço de código sob demanda
// (lazy import). Depois de um novo deploy, o arquivo antigo que o navegador
// tinha em mente simplesmente não existe mais no servidor — a busca falha,
// a promise do import() nunca resolve, e a tela fica presa para sempre no
// "carregando" (fundo cinza, sem erro visível, sem reação a clique: "trava
// cinza" na prática). Um recarregamento único e automático resolve, porque
// ele busca o HTML novo com os nomes de arquivo certos.
(() => {
  const RELOAD_GUARD_KEY = "pc:stale-chunk-reload";
  const isStaleChunkError = (message: unknown) =>
    typeof message === "string" &&
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message);

  const reloadOnce = () => {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    window.location.reload();
  };

  // Evento nativo do Vite para exatamente este caso.
  window.addEventListener("vite:preloadError", reloadOnce);

  window.addEventListener("unhandledrejection", (event) => {
    if (isStaleChunkError(event.reason?.message)) reloadOnce();
  });
  window.addEventListener("error", (event) => {
    if (isStaleChunkError(event.message)) reloadOnce();
  });

  // Depois de uma navegação bem-sucedida, libera a trava — assim um problema
  // real e persistente (não só o deploy antigo) não vira loop de recarga.
  window.setTimeout(() => window.sessionStorage.removeItem(RELOAD_GUARD_KEY), 10_000);
})();

import "./styles/global/public-palette-search-2026.css";
import "./styles/global/hero-cleanup-2026.css";
import "./styles/global/catalog-polish-2026.css";

import "./styles/global/public-pages-layout-2026.css";

import "./styles/global/campaign-heroes-2026.css";
import "./styles/global/native-select-contrast-2026.css";
