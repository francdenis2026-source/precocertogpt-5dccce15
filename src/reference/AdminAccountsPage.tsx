import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, LoaderCircle, MailCheck, MailWarning, RefreshCw, Search, Send, Trash2, UserCheck, UsersRound } from "lucide-react";
import { supabase } from "../lib/roles";
import "./AdminLicenseManager.css";
import "./AdminCustomersPage.css";
import "./AdminAccountsPage.css";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmt = (v: string | null) => (v ? dt.format(new Date(v)) : "—");

type Account = {
  user_id: string;
  email: string | null;
  name: string | null;
  provider: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  roles: string[];
};

type Filter = "todos" | "pendentes" | "confirmados" | "bloqueados";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  moderator: "Moderador",
  merchant: "Lojista",
};

function isBlocked(a: Account) {
  return Boolean(a.banned_until && Date.parse(a.banned_until) > Date.now());
}

export function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.rpc("admin_list_user_accounts");
    setLoading(false);
    if (err) {
      setError(err.message || "Não foi possível carregar os cadastros.");
      return;
    }
    setAccounts((data as Account[]) || []);
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const week = Date.now() - 7 * 864e5;
    return {
      total: accounts.length,
      confirmed: accounts.filter(a => a.email_confirmed_at).length,
      pending: accounts.filter(a => !a.email_confirmed_at).length,
      blocked: accounts.filter(isBlocked).length,
      lastWeek: accounts.filter(a => Date.parse(a.created_at) >= week).length,
    };
  }, [accounts]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return accounts.filter(a => {
      if (filter === "pendentes" && a.email_confirmed_at) return false;
      if (filter === "confirmados" && !a.email_confirmed_at) return false;
      if (filter === "bloqueados" && !isBlocked(a)) return false;
      if (!q) return true;
      return `${a.name || ""} ${a.email || ""}`.toLocaleLowerCase("pt-BR").includes(q);
    });
  }, [accounts, filter, query]);

  async function run(id: string, action: () => Promise<{ error: { message: string } | null }>, ok: string) {
    setBusy(id);
    setError("");
    setNotice("");
    const { error: err } = await action();
    setBusy(null);
    if (err) {
      setError(err.message || "Não foi possível concluir a ação.");
      return;
    }
    setNotice(ok);
    await load();
  }

  function resend(a: Account) {
    if (!supabase || !a.email) return;
    const client = supabase;
    void run(`resend:${a.user_id}`, async () => {
      const { error: err } = await client.auth.resend({
        type: "signup",
        email: a.email!,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: err };
    }, `E-mail de confirmação reenviado para ${a.email}.`);
  }

  function confirm(a: Account) {
    if (!supabase) return;
    const client = supabase;
    void run(`confirm:${a.user_id}`, async () => client.rpc("admin_confirm_user_email", { _user_id: a.user_id }), `E-mail de ${a.email} confirmado manualmente.`);
  }

  function toggleBlock(a: Account) {
    if (!supabase) return;
    const blocked = isBlocked(a);
    if (!blocked && !window.confirm(`Bloquear ${a.email}? A pessoa será desconectada e não conseguirá entrar até ser desbloqueada.`)) return;
    const client = supabase;
    void run(`block:${a.user_id}`, async () => client.rpc("admin_set_user_blocked", { _user_id: a.user_id, _blocked: !blocked }), blocked ? `${a.email} desbloqueado.` : `${a.email} bloqueado.`);
  }

  function remove(a: Account) {
    if (!supabase) return;
    if (!window.confirm(`Excluir definitivamente a conta ${a.email}? Esta ação não pode ser desfeita.`)) return;
    const client = supabase;
    void run(`delete:${a.user_id}`, async () => client.rpc("admin_delete_user_account", { _user_id: a.user_id }), `Conta ${a.email} excluída.`);
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: stats.total },
    { id: "pendentes", label: "E-mail pendente", count: stats.pending },
    { id: "confirmados", label: "Confirmados", count: stats.confirmed },
    { id: "bloqueados", label: "Bloqueados", count: stats.blocked },
  ];

  return (
    <main className="adm-lic">
      <header className="adm-lic__head">
        <div>
          <span className="adm-lic__eyebrow"><UsersRound aria-hidden="true" /> Cadastros</span>
          <h1>Contas de usuários</h1>
          <p>Todas as pessoas cadastradas na plataforma, com a situação do e-mail e do acesso.</p>
        </div>
        <Link className="adm-lic__back" to="/admin">Voltar ao painel</Link>
      </header>

      <section className="adm-cust__finance" aria-label="Resumo dos cadastros">
        <article><UsersRound aria-hidden="true" /><div><small>Contas</small><strong>{loading ? "—" : stats.total}</strong></div></article>
        <article><MailCheck aria-hidden="true" /><div><small>E-mail confirmado</small><strong>{loading ? "—" : stats.confirmed}</strong></div></article>
        <article><MailWarning aria-hidden="true" /><div><small>E-mail pendente</small><strong>{loading ? "—" : stats.pending}</strong></div></article>
        <article><Ban aria-hidden="true" /><div><small>Bloqueadas</small><strong>{loading ? "—" : stats.blocked}</strong></div></article>
        <article><UserCheck aria-hidden="true" /><div><small>Novas em 7 dias</small><strong>{loading ? "—" : stats.lastWeek}</strong></div></article>
      </section>

      <div className="adm-lic__card">
        <h2>
          Usuários
          <button className="adm-lic__refresh" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Atualizar
          </button>
        </h2>

        <div className="adm-acc__toolbar">
          <label className="adm-acc__search">
            <Search aria-hidden="true" />
            <span className="sr-only">Buscar por nome ou e-mail</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" />
          </label>
          <div className="adm-acc__filters" role="group" aria-label="Filtrar contas">
            {filters.map(f => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="adm-lic__error" role="alert">{error}</p>}
        {notice && <p className="adm-acc__notice" role="status">{notice}</p>}

        {loading ? <p className="adm-lic__muted">Carregando…</p> : !visible.length ? <p className="adm-lic__muted">Nenhuma conta encontrada.</p> : (
          <div className="adm-lic__table-wrap">
            <table className="adm-lic__table adm-acc__table">
              <thead>
                <tr><th>Usuário</th><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {visible.map(a => {
                  const blocked = isBlocked(a);
                  const protectedAccount = a.roles.includes("super_admin");
                  return (
                    <tr key={a.user_id}>
                      <td>
                        <strong className="adm-acc__name">{a.name || "Sem nome"}</strong>
                        <small className="adm-acc__sub">{a.email}</small>
                        {a.roles.length > 0 && (
                          <span className="adm-acc__roles">{a.roles.map(r => <em key={r}>{ROLE_LABEL[r] || r}</em>)}</span>
                        )}
                      </td>
                      <td>
                        {a.email_confirmed_at
                          ? <span className="adm-acc__pill adm-acc__pill--ok"><CheckCircle2 aria-hidden="true" /> Confirmado</span>
                          : <span className="adm-acc__pill adm-acc__pill--warn"><MailWarning aria-hidden="true" /> Pendente</span>}
                        {a.provider !== "email" && <small className="adm-acc__sub">via {a.provider === "google" ? "Google" : a.provider}</small>}
                      </td>
                      <td>{fmt(a.created_at)}</td>
                      <td>{fmt(a.last_sign_in_at)}</td>
                      <td>
                        {blocked
                          ? <span className="adm-acc__pill adm-acc__pill--bad"><Ban aria-hidden="true" /> Bloqueado</span>
                          : <span className="adm-acc__pill">Ativo</span>}
                      </td>
                      <td>
                        {protectedAccount ? <small className="adm-acc__sub">Conta protegida</small> : (
                          <div className="adm-acc__actions">
                            {!a.email_confirmed_at && (
                              <>
                                <button type="button" onClick={() => resend(a)} disabled={busy !== null} title="Reenviar e-mail de confirmação">
                                  {busy === `resend:${a.user_id}` ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Reenviar
                                </button>
                                <button type="button" onClick={() => confirm(a)} disabled={busy !== null} title="Confirmar o e-mail manualmente">
                                  {busy === `confirm:${a.user_id}` ? <LoaderCircle className="spin" aria-hidden="true" /> : <MailCheck aria-hidden="true" />} Confirmar
                                </button>
                              </>
                            )}
                            <button type="button" onClick={() => toggleBlock(a)} disabled={busy !== null}>
                              {busy === `block:${a.user_id}` ? <LoaderCircle className="spin" aria-hidden="true" /> : <Ban aria-hidden="true" />} {blocked ? "Desbloquear" : "Bloquear"}
                            </button>
                            <button type="button" className="adm-acc__danger" onClick={() => remove(a)} disabled={busy !== null}>
                              {busy === `delete:${a.user_id}` ? <LoaderCircle className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
