export const createAuthStore = (storageKey = 'auth_token') => ({
  getToken: () => localStorage.getItem(storageKey) || '',
  setToken: (token) => {
    if (!token) {
      localStorage.removeItem(storageKey)
      return
    }
    localStorage.setItem(storageKey, token)
  },
  clear: () => {
    localStorage.removeItem(storageKey)
  },
})

export const createAuthHeaders = (token) =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
