// Cookies are shared between Safari and the PWA standalone context on iOS;
// localStorage is not. Use these for simple boolean/string flags that must
// survive the Safari → PWA transition.
const _secure = location.protocol === 'https:' ? '; Secure' : ''

export function getCookie(key) {
  return document.cookie.split('; ').some(c => c.startsWith(key + '='))
}

export function setCookie(key) {
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString()
  document.cookie = `${key}=1; expires=${exp}; path=/; SameSite=Lax${_secure}`
}

export function removeCookie(key) {
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${_secure}`
}
