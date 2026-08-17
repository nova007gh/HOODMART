export type Theme = 'gold' | 'white'

const THEME_KEY = 'hoodmart_theme'

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'gold'
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'gold'
  } catch {
    return 'gold'
  }
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'white') {
    root.classList.add('theme-white')
  } else {
    root.classList.remove('theme-white')
  }
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
  applyTheme(theme)
}
