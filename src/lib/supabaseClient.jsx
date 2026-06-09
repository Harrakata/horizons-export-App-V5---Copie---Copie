import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const resolveSupabaseUrl = (value) => {
  if (!value) return ''
  if (value.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${value}`
  }
  return value
}

const supabaseUrl = resolveSupabaseUrl(rawSupabaseUrl)

if (!rawSupabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Configuration Supabase manquante : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env, puis redémarrez le serveur de dev (Vite ne lit le .env qu'au démarrage)."
  )
}

const createScopedClient = (storageKey) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithAuthReadFallback,
    },
  })

const fetchWithoutAuthorization = (input, init = {}) => {
  const headers = new Headers(init.headers || {})
  headers.delete('Authorization')
  headers.delete('authorization')
  return fetch(input, { ...init, headers })
}

const isReadRequest = (init = {}) => {
  const method = String(init.method || 'GET').toUpperCase()
  return method === 'GET' || method === 'HEAD'
}

const fetchWithAuthReadFallback = async (input, init = {}) => {
  const response = await fetch(input, init)

  if (!isReadRequest(init) || (response.status !== 401 && response.status !== 403)) {
    return response
  }

  const clone = response.clone()
  const body = await clone.text().catch(() => '')
  const authErrorBody = body.toLowerCase()

  if (
    !authErrorBody.includes('no suitable key') &&
    !authErrorBody.includes('wrong key type') &&
    !authErrorBody.includes('jwt') &&
    !authErrorBody.includes('unauthorized')
  ) {
    return response
  }

  return fetchWithoutAuthorization(input, init)
}

const defaultSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithAuthReadFallback,
  },
})

const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithoutAuthorization,
  },
})
const exploitationSupabase = createScopedClient('pmu-supabase-auth-exploitation')
const technicienSupabase = createScopedClient('pmu-supabase-auth-technicien')
const guichetiereSupabase = createScopedClient('pmu-supabase-auth-guichetiere')
const chefAgenceSupabase = createScopedClient('pmu-supabase-auth-chef-agence')
const chefSecteurSupabase = createScopedClient('pmu-supabase-auth-chef-secteur')
const validationGainSupabase = createScopedClient('pmu-supabase-auth-validation-gain')
const directeurGeneralSupabase = createScopedClient('pmu-supabase-auth-directeur-general')
const pointageSupabase = createScopedClient('pmu-supabase-auth-pointage')

const getPathname = () =>
  typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/+$/, '')

export const getCurrentSupabaseClient = () => {
  const pathname = getPathname()
  if (pathname === '/maintenance-terminaux' || pathname.startsWith('/espace-technicien')) {
    return technicienSupabase
  }
  if (pathname.startsWith('/espace-exploitation')) {
    return exploitationSupabase
  }
  if (pathname === '/guichetiere' || pathname.startsWith('/espace-guichetiere')) {
    return guichetiereSupabase
  }
  if (
    pathname === '/chef-agence' ||
    pathname === '/paiement-gros-gain' ||
    pathname.startsWith('/espace-chef-agence')
  ) {
    return chefAgenceSupabase
  }
  if (pathname === '/validation-paiement-gain' || pathname.startsWith('/espace-validation-paiement-gain')) {
    return validationGainSupabase
  }
  if (pathname.startsWith('/espace-directeur-general')) {
    return directeurGeneralSupabase
  }
  if (pathname.startsWith('/espace-chef-secteur')) {
    return chefSecteurSupabase
  }
  if (pathname.startsWith('/pointage')) {
    return pointageSupabase
  }
  return defaultSupabase
}

export const getCurrentSupabaseAuthClient = () => {
  const pathname = getPathname()
  if (pathname === '/maintenance-terminaux' || pathname.startsWith('/espace-technicien')) {
    return technicienSupabase
  }
  if (pathname.startsWith('/espace-exploitation')) {
    return exploitationSupabase
  }
  if (pathname === '/guichetiere' || pathname.startsWith('/espace-guichetiere')) {
    return guichetiereSupabase
  }
  if (
    pathname === '/chef-agence' ||
    pathname === '/paiement-gros-gain' ||
    pathname.startsWith('/espace-chef-agence')
  ) {
    return chefAgenceSupabase
  }
  if (pathname === '/validation-paiement-gain' || pathname.startsWith('/espace-validation-paiement-gain')) {
    return validationGainSupabase
  }
  if (pathname.startsWith('/espace-directeur-general')) {
    return directeurGeneralSupabase
  }
  if (pathname.startsWith('/espace-chef-secteur')) {
    return chefSecteurSupabase
  }
  if (pathname.startsWith('/pointage')) {
    return pointageSupabase
  }
  return defaultSupabase
}

export const supabase = new Proxy(defaultSupabase, {
  get(_target, prop) {
    if (prop === 'auth') {
      return getCurrentSupabaseAuthClient().auth
    }

    const client = getCurrentSupabaseClient()
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export {
  publicSupabase,
  defaultSupabase,
  exploitationSupabase,
  technicienSupabase,
  guichetiereSupabase,
  chefAgenceSupabase,
  chefSecteurSupabase,
  validationGainSupabase,
  directeurGeneralSupabase,
  pointageSupabase,
}
