import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, LogIn, X } from "lucide-react";
import type { AuthActionPromptDetail } from "../lib/authActionPrompt";
import { loadSessionProfile } from "../lib/roles";
import "./AuthActionPrompt.css";

const AUTH_RETURN_KEY = "precocerto:auth-return-to:v1";
const AUTH_PATHS = new Set(["/login", "/cadastro", "/registrar"]);

function safeInternalDestination(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function AuthActionPrompt() {
  const location = useLocation();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<AuthActionPromptDetail | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const open = (event: Event) => setPrompt((event as CustomEvent<AuthActionPromptDetail>).detail);
    window.addEventListener("pc:auth-action-required", open);
    return () => window.removeEventListener("pc:auth-action-required", open);
  }, []);

  useEffect(() => {
    if (AUTH_PATHS.has(location.pathname)) {
      const redirect = safeInternalDestination(new URLSearchParams(location.search).get("redirect"));
      if (redirect) window.sessionStorage.setItem(AUTH_RETURN_KEY, redirect);
      return;
    }

    const pending = safeInternalDestination(window.sessionStorage.getItem(AUTH_RETURN_KEY));
    if (!pending) return;
    let cancelled = false;

    void loadSessionProfile().then(profile => {
      if (cancelled || !profile) return;
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (current !== pending) navigate(pending, { replace: true });
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!prompt) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const body = document.body;
    const scrollY = window.scrollY;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousLeft = body.style.left;
    const previousRight = body.style.right;
    const previousWidth = body.style.width;
    const previousOverflow = body.style.overflow;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    window.requestAnimationFrame(() => closeRef.current?.focus());

    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPrompt(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') || []);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.left = previousLeft;
      body.style.right = previousRight;
      body.style.width = previousWidth;
      body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
      previousFocus.current?.focus();
    };
  }, [prompt]);

  if (!prompt) return null;
  const destination = safeInternalDestination(prompt.returnTo || `${window.location.pathname}${window.location.search}`) || "/";
  const query = encodeURIComponent(destination);
  const favorite = prompt.action === "favorite";
  const rememberDestination = () => window.sessionStorage.setItem(AUTH_RETURN_KEY, destination);

  return createPortal(<div className="pc-auth-prompt" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPrompt(null); }}>
    <section ref={dialogRef} className="pc-auth-prompt__card" role="dialog" aria-modal="true" aria-labelledby="pc-auth-prompt-title">
      <div className="pc-auth-prompt__hero">
        <img src="/editorial-2026/home-shopping-1280.webp" srcSet="/editorial-2026/home-shopping-640.webp 640w, /editorial-2026/home-shopping-1280.webp 1280w" sizes="380px" width="1280" height="853" alt="" decoding="async" />
        <span className="pc-auth-prompt__hero-badge"><BadgeCheck aria-hidden="true"/> Marketplace local verificado</span>
        <button ref={closeRef} className="pc-auth-prompt__close" type="button" onClick={() => setPrompt(null)} aria-label="Fechar"><X aria-hidden="true"/></button>
      </div>
      <div className="pc-auth-prompt__body">
        <div className="pc-auth-prompt__copy">
          <span>{favorite ? "SALVAR PARA DEPOIS" : "CESTA NA SUA CONTA"}</span>
          <h2 id="pc-auth-prompt-title">Crie sua conta gratuita</h2>
          <p>{favorite ? "Favorite produtos, acompanhe preços e volte para eles quando quiser." : "Monte sua cesta, compare preços e acesse de qualquer dispositivo."}</p>
        </div>
        <div className="pc-auth-prompt__benefits" aria-label="Benefícios da conta">
          <span><Check aria-hidden="true"/> Gratuito</span>
          <span><Check aria-hidden="true"/> Dados sincronizados</span>
        </div>
        <div className="pc-auth-prompt__actions">
          <a className="is-primary" href={`/cadastro?redirect=${query}`} onClick={rememberDestination}>Criar conta grátis <ArrowRight aria-hidden="true"/></a>
          <a href={`/login?redirect=${query}`} onClick={rememberDestination}><LogIn aria-hidden="true"/> Já tenho conta</a>
        </div>
        <small>Após entrar, você voltará para continuar esta ação.</small>
      </div>
    </section>
  </div>, document.body);
}
