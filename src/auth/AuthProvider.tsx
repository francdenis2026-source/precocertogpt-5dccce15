import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { adminRoles, invalidateSessionProfile, type AppRole } from "../lib/roles";
import { novoSessionId } from "../lib/deviceIdentity";

export type AuthResult = { error: string | null; needsEmailConfirmation?: boolean };

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isMerchant: boolean;
  /** Identificador deste login. Muda a cada entrada e é o que o
   *  SingleSessionGuard usa para saber qual acesso é o mais recente. */
  sessionId: string | null;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name?: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const merchantRoles: AppRole[] = ["merchant_owner", "merchant_staff"];

/* O id do login fica em localStorage e não em memória porque precisa
   sobreviver a um F5: recarregar a página não é entrar de novo, e se o id
   mudasse a cada recarga o próprio dispositivo se derrubaria. */
const SESSION_ID_KEY = "precocerto:auth-session-id";

function lerSessionId(): string | null {
  try { return localStorage.getItem(SESSION_ID_KEY); } catch { return null; }
}

function gravarSessionId(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_ID_KEY, id);
    else localStorage.removeItem(SESSION_ID_KEY);
  } catch { /* armazenamento bloqueado: a sessão vale só para esta aba */ }
}

const AuthContext = createContext<AuthState | null>(null);

function messageFor(raw: string | undefined): string {
  const text = (raw || "").toLocaleLowerCase("pt-BR");
  if (text.includes("invalid login") || text.includes("invalid credentials"))
    return "E-mail ou senha incorretos. Confira os dados ou crie sua conta.";
  if (text.includes("email not confirmed")) return "Confirme seu e-mail para concluir o acesso.";
  if (text.includes("already registered") || text.includes("already exists"))
    return "Já existe uma conta com este e-mail. Faça login ou recupere sua senha.";
  if (text.includes("password")) return "A senha precisa ter 6 números.";
  return raw || "Não foi possível concluir a operação. Tente novamente.";
}

/**
 * Papéis vindos de fonte segura: `app_metadata` do JWT (definido no servidor)
 * e a tabela `user_roles` protegida por RLS. `user_metadata` é ignorado de
 * propósito — é editável pelo próprio usuário.
 */
async function fetchRoles(user: User | null): Promise<AppRole[]> {
  if (!user || !supabase) return [];
  const fromToken = new Set<AppRole>();
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  const metaRoles = [meta?.roles, meta?.role].flat();
  for (const value of metaRoles) if (typeof value === "string") fromToken.add(value as AppRole);
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!error && data) for (const row of data) if (row?.role) fromToken.add(row.role as AppRole);
  return Array.from(fromToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(() => lerSessionId());
  const alive = useRef(true);

  const applySession = useCallback(async (next: Session | null) => {
    if (!alive.current) return;
    setSession(next);
    const nextRoles = await fetchRoles(next?.user ?? null);
    if (!alive.current) return;
    setRoles(nextRoles);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!supabase) {
      setLoading(false);
      return () => {
        alive.current = false;
      };
    }
    void supabase.auth.getSession().then(({ data }) => void applySession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession ?? null);
    });
    const onLegacyChange = () => {
      if (!supabase) return;
      void supabase.auth.getSession().then(({ data }) => void applySession(data.session ?? null));
    };
    window.addEventListener("pc:auth-changed", onLegacyChange);
    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("pc:auth-changed", onLegacyChange);
    };
  }, [applySession]);

  const announce = useCallback(() => {
    invalidateSessionProfile();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("pc:auth-changed"));
  }, []);

  const signInWithPassword = useCallback<AuthState["signInWithPassword"]>(async (email, password) => {
    if (!supabase) return { error: "Autenticação indisponível: banco não configurado." };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLocaleLowerCase("pt-BR"),
      password,
    });
    if (error || !data.session) {
      const text = (error?.message || "").toLocaleLowerCase("pt-BR");
      const isBadCredentials = text.includes("invalid login") || text.includes("invalid credentials");
      if (isBadCredentials) return { error: "E-mail ou senha incorretos. Confira os dados ou recupere sua senha." };
      return { error: messageFor(error?.message) };
    }

    /* Uma conta, um dispositivo. scope "others" revoga no servidor os refresh
       tokens de todos os outros aparelhos, então a regra vale mesmo que o
       outro esteja desligado agora. Falhar aqui não pode impedir o login: se a
       revogação não passar, o SingleSessionGuard ainda derruba o outro lado em
       tempo real quando ele estiver online. */
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch {
      /* segue o login; a camada de tempo real cobre */
    }

    const novo = novoSessionId();
    gravarSessionId(novo);
    if (alive.current) setSessionId(novo);

    await applySession(data.session);
    announce();
    return { error: null };
  }, [announce, applySession]);

  const signUp = useCallback<AuthState["signUp"]>(async (email, password, name) => {
    if (!supabase) return { error: "Cadastro indisponível: banco não configurado." };
    const cleanName = (name || "").trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLocaleLowerCase("pt-BR"),
      password,
      options: { data: { name: cleanName, full_name: cleanName }, emailRedirectTo: `${window.location.origin}/bem-vindo` },
    });
    if (error) return { error: messageFor(error.message) };
    if (data.session) {
      const novo = novoSessionId();
      gravarSessionId(novo);
      if (alive.current) setSessionId(novo);
      await applySession(data.session);
      announce();
      return { error: null };
    }
    // Sem sessão: o projeto exige confirmação por e-mail antes de liberar o
    // acesso. A conta já existe, mas navegar pra home aqui deixaria a pessoa
    // "deslogada" numa tela que parece não ter acontecido nada — melhor
    // avisar explicitamente o próximo passo.
    return { error: null, needsEmailConfirmation: true };
  }, [announce, applySession]);

  const signInWithGoogle = useCallback<AuthState["signInWithGoogle"]>(async () => {
    if (!supabase) return { error: "Autenticação indisponível: banco não configurado." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { error: messageFor(error.message) };
    // O redirecionamento para o Google acontece aqui; a sessão volta pelo
    // onAuthStateChange já registrado no efeito acima quando o usuário retorna.
    return { error: null };
  }, []);

  const signOutFn = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    gravarSessionId(null);
    if (alive.current) {
      setSession(null);
      setRoles([]);
      setSessionId(null);
      setLoading(false);
    }
    announce();
  }, [announce]);

  const refreshRoles = useCallback(async () => {
    const nextRoles = await fetchRoles(session?.user ?? null);
    if (alive.current) setRoles(nextRoles);
  }, [session]);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    roles,
    isAdmin: roles.some(role => adminRoles.includes(role)),
    isMerchant: roles.some(role => merchantRoles.includes(role)),
    sessionId,
    signInWithPassword,
    signUp,
    signInWithGoogle,
    signOut: signOutFn,
    refreshRoles,
  }), [session, loading, roles, sessionId, signInWithPassword, signUp, signInWithGoogle, signOutFn, refreshRoles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return context;
}

export { merchantRoles };
