import { useEffect, useState } from 'react'

export type RouteKey =
  | 'dashboard'
  | 'tasks'
  | 'prizes'
  | 'records'
  | 'stats'
  | 'parent'

const DEFAULT: RouteKey = 'dashboard'
const VALID: RouteKey[] = ['dashboard', 'tasks', 'prizes', 'records', 'stats', 'parent']

function parseHash(): RouteKey {
  const raw = window.location.hash.replace(/^#\/?/, '') as RouteKey
  return VALID.includes(raw) ? raw : DEFAULT
}

export function navigate(key: RouteKey) {
  window.location.hash = `#/${key}`
}

export function useHashRoute(): RouteKey {
  const [route, setRoute] = useState<RouteKey>(parseHash)
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) navigate(DEFAULT)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
