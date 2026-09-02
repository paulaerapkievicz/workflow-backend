// src/helpers/geocode.ts
//
// Geocodificação de endereços via Nominatim (OpenStreetMap) — gratuito, sem chave.
// Uso educado: 1 req/s, User-Agent identificável, cache em memória. Falha => null
// (o check-in simplesmente não valida distância quando a filial não tem coordenadas).

export interface GeoPoint {
  latitude: number
  longitude: number
  displayName: string
}

const cache = new Map<string, GeoPoint | null>()
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const UA = 'WorkFlow/1.0 (+https://localhost)'

let lastCall = 0
async function throttle() {
  const wait = 1100 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const q = (address || '').trim()
  if (!q) return null
  if (cache.has(q)) return cache.get(q) ?? null

  try {
    await throttle()
    const url = `${NOMINATIM}?format=jsonv2&limit=1&addressdetails=0&countrycodes=br&q=${encodeURIComponent(q)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`nominatim ${res.status}`)
    const list = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    const hit = list?.[0]
    if (!hit) {
      cache.set(q, null)
      return null
    }
    const point: GeoPoint = {
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      displayName: hit.display_name,
    }
    cache.set(q, point)
    return point
  } catch {
    // não bloqueia o cadastro por indisponibilidade do serviço externo
    return null
  }
}
