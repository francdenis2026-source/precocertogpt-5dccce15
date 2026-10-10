import {
  Heart,
  LayoutGrid,
  Menu,
  Moon,
  ShoppingBasket,
  Store,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Product } from "../../data/catalog";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useSiteTheme } from "../../hooks/useSiteTheme";
import { HeaderRadioPlayer } from "../PersistentRadio";
import { OnlinePresence } from "../OnlinePresence";
import { prefetchRoute } from "../../lib/routePrefetch";
import { useCurrentProfile } from "../UserAccountExperience";
import { LiveProductSearch } from "./LiveProductSearch";
import "./HeaderPro2026.css";

function HeaderThemeToggle() {
  const { theme, toggleTheme } = useSiteTheme();
  const dark = theme === "dark";
  // Ícone do modo já ativo (lua = escuro, sol = claro) + fundo colorido
  // (âmbar/azul) indicando visualmente qual opção está selecionada.
  return (
    <button
      className="pcx-header__theme"
      type="button"
      data-active-theme={dark ? "dark" : "light"}
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? "Tema escuro ativo — trocar para o tema claro" : "Tema claro ativo — trocar para o tema escuro"}
    >
      {dark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}

const navItems = [
  { to: "/estabelecimentos", label: "Estabelecimentos", icon: Store },
  { to: "/explorar", label: "Categorias", icon: LayoutGrid },
] as const;

export function Header({ products = [] }: { products?: Product[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 8,
  );
  // A home já tem uma busca completa no hero; mostrar a busca compacta do
  // header ao mesmo tempo (mesma tela, mesmo propósito) confundia qual usar.
  // 420px é uma estimativa de "já passou do hero" — não precisa ser exata,
  // só evitar as duas buscas visíveis juntas na primeira dobra.
  const [pastHero, setPastHero] = useState(
    () => typeof window !== "undefined" && window.scrollY > 420,
  );
  const { pathname } = useLocation();
  const [lastPathname, setLastPathname] = useState(pathname);
  const { profile } = useCurrentProfile();

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useBodyScrollLock(menuOpen);

  useEffect(() => {
    const syncScrolledState = () => {
      setScrolled(window.scrollY > 8);
      setPastHero(window.scrollY > 420);
    };
    syncScrolledState();
    window.addEventListener("scroll", syncScrolledState, { passive: true });
    return () => window.removeEventListener("scroll", syncScrolledState);
  }, []);

  const isCurrent = (to: string) =>
    to === "/"
      ? pathname === "/"
      : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <header
      className={`pcx-header${scrolled ? " is-scrolled" : ""}`}
      data-glass-header="true"
    >
      <div className="pcx-header__bar">
        <Link
          className="pcx-header__brand"
          to="/"
          aria-label="Preço Certo - página inicial"
        >
          <img src="/preco-certo-mark.svg?v=17" alt="" width="34" height="34" />
          <span>
            <strong>Preço Certo</strong>
            <small>Feijó · Acre</small>
          </span>
        </Link>

        {pastHero && (
          <div className="pcx-header__search">
            <LiveProductSearch id="header-search" products={products} compact />
          </div>
        )}

        <nav
          id="pcx-navigation"
          className={`pcx-header__nav${menuOpen ? " is-open" : ""}`}
          aria-label="Navegação principal"
        >
          {/* .pcx-header__login some em telas estreitas (≤640px) e vira só um
              ícone entre 641-860px — sem esta entrada, quem não estava logado
              ficava sem nenhum jeito de chegar em /login no mobile. */}
          {!profile && (
            <Link className="pcx-header__nav-login" to="/login" onClick={() => setMenuOpen(false)}>
              <UserRound aria-hidden="true" />
              <span>Entrar ou criar conta</span>
            </Link>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isCurrent(item.to) ? "page" : undefined}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                onTouchStart={() => prefetchRoute(item.to)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Fora de .pcx-header__tools de propósito: no mobile essa faixa vira
            uma linha própria, cheia (nome da rádio/música legível), em vez de
            um círculo espremido entre os outros ícones — ver breakpoint em
            HomeProfessionalRedesign2026.css. */}
        <div className="pcx-header__radio-slot">
          <HeaderRadioPlayer />
        </div>

        <div className="pcx-header__tools" role="group" aria-label="Ações da conta">
          {/* Itens decorativos/opcionais ficam num sub-contêiner com rolagem
              própria: em telas estreitas, o que não cabe rola aqui dentro em
              vez de empurrar tema/menu (controles essenciais, sempre visíveis
              inteiros) para fora da área visível do header. */}
          <div className="pcx-header__tools-scroll">
            {/* O contador existia no projeto mas não aparecia em lugar nenhum: era
                renderizado só dentro do PublicHeader, que a home não usa. */}
            <OnlinePresence />
            <Link className="pcx-header__icon" to="/favoritos" aria-label="Favoritos" title="Favoritos" onMouseEnter={() => prefetchRoute("/favoritos")} onFocus={() => prefetchRoute("/favoritos")}>
              <Heart aria-hidden="true" />
            </Link>
            <Link className="pcx-header__icon" to="/cesta-inteligente" aria-label="Minha cesta" title="Minha cesta">
              <ShoppingBasket aria-hidden="true" />
            </Link>
          </div>
          <HeaderThemeToggle />
          {!profile && (
            <Link className="pcx-header__login" to="/login">
              <UserRound aria-hidden="true" />
              <span>Entrar</span>
            </Link>
          )}
          {!profile && <Link className="pcx-header__signup" to="/cadastro">Criar conta grátis</Link>}

          <button
            className="pcx-header__menu"
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="pcx-navigation"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
