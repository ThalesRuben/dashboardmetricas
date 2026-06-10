// Service Worker mínimo — shell offline + cache de assets.
// Estratégia: network-first com fallback no cache. Mantém a SPA acessível
// se a rede cair (mas tudo que depende do Supabase ainda exige conexão).

const CACHE = 'tbc-shell-v1'
const APP_SHELL = ['/']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // ignora chamadas a APIs externas / supabase — sempre rede
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
  )
})
