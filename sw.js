const CACHE_VERSION = "20260915-auto-update-1";
const SHELL_CACHE = `precocerto-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `precocerto-runtime-${CACHE_VERSION}`;
const DADOS_CACHE = `precocerto-dados-${CACHE_VERSION}`;

/* Só a casca mínima entra no precache. Nada de catálogo, nada de foto de
   produto: são mil produtos, e baixar isso na instalação transformaria o
   aplicativo num download pesado antes do primeiro uso. O resto do offline é
   construído a partir do que a pessoa realmente abriu. */
const PRECACHE = [
  "/",
  "/manifest.json",
  "/preco-certo-mark.svg?v=17",
  "/logo-preco-certo.svg?v=17",
  "/logo-preco-certo-inversa.svg?v=17",
  "/pwa-192x192.png?v=17",
  "/pwa-512x512.png?v=17",
];

/* Tetos por cache. Sem isso o armazenamento cresce para sempre e o navegador
   acaba descartando tudo de uma vez, no pior momento possível. */
const LIMITES = {
  [RUNTIME_CACHE]: 160,
  [DADOS_CACHE]: 60,
};

/* Tabelas públicas do catálogo: exatamente os dados que qualquer visitante vê
   sem entrar na conta, então guardá-los no aparelho não expõe nada de ninguém.
   Qualquer outro caminho da API fica de fora. Dados de conta, papéis de usuário
   e envios de preço nunca são gravados, porque o aparelho pode ser dividido
   entre várias pessoas. */
const TABELAS_PUBLICAS = ["/rest/v1/products", "/rest/v1/prices", "/rest/v1/establishments"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("precocerto-") && ![SHELL_CACHE, RUNTIME_CACHE, DADOS_CACHE].includes(key))
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Descarta as entradas mais antigas quando o cache passa do teto. */
async function aparar(nomeDoCache) {
  const limite = LIMITES[nomeDoCache];
  if (!limite) return;
  const cache = await caches.open(nomeDoCache);
  const chaves = await cache.keys();
  if (chaves.length <= limite) return;
  // keys() devolve na ordem de inserção, então as primeiras são as mais velhas.
  await Promise.all(chaves.slice(0, chaves.length - limite).map(chave => cache.delete(chave)));
}

async function guardar(nomeDoCache, request, response) {
  const cache = await caches.open(nomeDoCache);
  await cache.put(request, response);
  await aparar(nomeDoCache);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) void guardar(RUNTIME_CACHE, request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    /* Só uma navegação pode receber a casca como resposta. Devolver HTML para
       um pedido de script ou de estilo faria o navegador tentar executar uma
       página como código: em vez de degradar, a tela fica branca. */
    if (request.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request, nomeDoCache = RUNTIME_CACHE) {
  const cache = await caches.open(nomeDoCache);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response.ok) void guardar(nomeDoCache, request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    void refresh;
    return cached;
  }
  const response = await refresh;
  return response || new Response("", { status: 503, statusText: "Offline" });
}

/* Catálogo: rede primeiro, cache como rede de segurança.
 *
 * Preço errado é pior que preço ausente, então com internet a resposta vem
 * sempre da rede, nunca do disco. O cache existe para quando não há internet
 * nenhuma: aí é melhor ver o preço da última visita, com o aviso de que o
 * aparelho está offline, do que abrir uma tela vazia. */
async function catalogo(request) {
  try {
    const response = await fetch(request);
    if (response.ok) void guardar(DADOS_CACHE, request, response.clone());
    return response;
  } catch (erro) {
    const cache = await caches.open(DADOS_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw erro;
  }
}

function ehCatalogoPublico(url) {
  return TABELAS_PUBLICAS.some(caminho => url.pathname.startsWith(caminho));
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    /* A API fica em outro domínio, então precisa ser tratada aqui de propósito.
       Antes o worker desistia de tudo que fosse externo, e por isso não havia
       dado nenhum disponível offline: a casca abria vazia. */
    if (ehCatalogoPublico(url)) event.respondWith(catalogo(request));
    return;
  }

  // Login e sessão: sempre da rede, nunca gravado.
  if (url.pathname.startsWith("/auth/v1/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Código e estilos NUNCA podem vir de cache velho: senão o site continua
  // exibindo uma versão antiga depois de cada deploy. Aqui o cache é só o
  // plano B para quando a rede falha.
  if (["style", "script", "document"].includes(request.destination)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["font", "image"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
