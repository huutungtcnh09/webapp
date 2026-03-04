const defaultBaseUrl = '/api'

export const createApiClient = (baseUrl = defaultBaseUrl) => {
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, options)
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.message || 'API request failed')
    }

    return payload
  }

  return {
    get: (path, token) =>
      request(path, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    post: (path, body, token) =>
      request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
      }),
  }
}
