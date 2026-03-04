import { useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@webapp/api-client'
import { createAuthStore } from '@webapp/auth'
import { Card, PrimaryButton } from '@webapp/ui'
import './App.css'

function App() {
  const authStore = useMemo(() => createAuthStore('admin_token'), [])
  const api = useMemo(() => createApiClient('/api'), [])
  const [authToken, setAuthToken] = useState(() => authStore.getToken())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [activeScreen, setActiveScreen] = useState('overview')
  const [contactKeyword, setContactKeyword] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' })
  const [createContactStatus, setCreateContactStatus] = useState('')
  const [createContactStatusType, setCreateContactStatusType] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [healthStatus, setHealthStatus] = useState('Đang kiểm tra kết nối API...')
  const [contacts, setContacts] = useState([])
  const [contactsStatus, setContactsStatus] = useState('Đang tải danh sách liên hệ...')
  const [currentUser, setCurrentUser] = useState(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

  const menuItems = [
    { key: 'overview', label: 'Tổng quan', icon: '📊' },
    { key: 'contacts', label: 'Quản lý liên hệ', icon: '📇' },
  ]

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.get('/health')
        const dbState = data?.db?.status || 'unknown'
        setHealthStatus(`API: ${data?.status || 'ok'} | DB: ${dbState}`)
      } catch (error) {
        setHealthStatus(`API lỗi: ${error.message}`)
      }
    }

    const loadContacts = async () => {
      if (!authToken) {
        setContacts([])
        setContactsStatus('Chưa có token đăng nhập admin để tải danh sách liên hệ')
        return
      }

      try {
        const rows = await api.get('/contacts', authToken)
        const normalizedRows = Array.isArray(rows) ? rows : []
        setContacts(normalizedRows)
        setContactsStatus(`Đã tải ${normalizedRows.length} liên hệ`)
      } catch (error) {
        setContacts([])
        setContactsStatus(`Không tải được danh sách liên hệ: ${error.message}`)
      }
    }

    const loadCurrentUser = async () => {
      if (!authToken) {
        setCurrentUser(null)
        return
      }

      try {
        const data = await api.get('/auth/me', authToken)
        setCurrentUser(data?.user || null)
      } catch {
        setCurrentUser(null)
      }
    }

    checkHealth()
    loadCurrentUser()
    loadContacts()
  }, [api, authToken])

  const handleLogout = async () => {
    const token = authToken

    if (token) {
      try {
        await api.post('/auth/logout', {}, token)
      } catch {
      }
    }

    authStore.clear()
    localStorage.removeItem('auth_token')
    setAuthToken('')
    setCurrentUser(null)
    setContacts([])
    setContactsStatus('Đã đăng xuất')
    setActiveScreen('overview')
    setLoginStatus('Đã đăng xuất')
    setIsLogoutDialogOpen(false)
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!loginPhone.trim() || !loginPassword.trim()) {
      setLoginStatus('Vui lòng nhập số điện thoại và mật khẩu')
      return
    }

    try {
      setIsLoggingIn(true)
      setLoginStatus('Đang đăng nhập...')

      const data = await api.post('/auth/login-phone', {
        phone: loginPhone.trim(),
        password: loginPassword,
      })

      const token = data?.token || ''
      if (!token) {
        setLoginStatus('Không nhận được token đăng nhập')
        return
      }

      authStore.setToken(token)
      setAuthToken(token)
      setLoginPassword('')
      setLoginStatus('Đăng nhập thành công')
    } catch (error) {
      setLoginStatus(error.message || 'Đăng nhập thất bại')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const normalizePhone = (value) => String(value || '').replace(/[^0-9]/g, '').trim()

  const handleCreateContact = async (event) => {
    event.preventDefault()

    const name = newContact.name.trim()
    const normalizedPhone = normalizePhone(newContact.phone)
    const email = newContact.email.trim()

    if (!name) {
      setCreateContactStatusType('error')
      setCreateContactStatus('Vui lòng nhập tên liên hệ')
      return
    }

    if (
      normalizedPhone &&
      contacts.some((item) => normalizePhone(item.phone) === normalizedPhone)
    ) {
      setCreateContactStatusType('error')
      setCreateContactStatus('Số điện thoại đã tồn tại, vui lòng kiểm tra lại')
      return
    }

    try {
      const created = await api.post(
        '/contacts',
        {
          name,
          phone: normalizedPhone,
          email,
        },
        authToken
      )

      setContacts((prev) => [created, ...prev])
      setContactsStatus(`Đã tải ${contacts.length + 1} liên hệ`)
      setCreateContactStatusType('success')
      setCreateContactStatus('Tạo liên hệ thành công')
      setNewContact({ name: '', phone: '', email: '' })
      setIsCreateDialogOpen(false)
    } catch (error) {
      const message = error.message || 'Không tạo được liên hệ'
      setCreateContactStatusType('error')
      setCreateContactStatus(message)
    }
  }

  const totalContacts = contacts.length
  const contactsWithPhone = contacts.filter((item) => item.phone).length
  const contactsWithEmail = contacts.filter((item) => item.email).length
  const userDisplayName = currentUser?.contact?.name || currentUser?.phone || 'Chưa đăng nhập'
  const userRole = currentUser?.role || ''
  const avatarLabel = userDisplayName && userDisplayName !== 'Chưa đăng nhập'
    ? userDisplayName.trim().charAt(0).toUpperCase()
    : 'U'
  const filteredContacts = contacts.filter((contact) => {
    const keyword = contactKeyword.trim().toLowerCase()
    if (!keyword) {
      return true
    }

    const searchText = [contact.name, contact.phone, contact.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return searchText.includes(keyword)
  })

  if (!authToken) {
    return (
      <main className="admin-layout logged-out-layout">
        <section className="logged-out-panel">
          <h1 className="title">Bạn đã đăng xuất</h1>
          <p className="desc">Phiên đăng nhập admin đã kết thúc. Vui lòng đăng nhập lại để tiếp tục.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="text"
              className="login-input"
              placeholder="Số điện thoại"
              value={loginPhone}
              onChange={(event) => setLoginPhone(event.target.value)}
              autoComplete="username"
            />
            <input
              type="password"
              className="login-input"
              placeholder="Mật khẩu"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
            />
            <PrimaryButton type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập lại'}
            </PrimaryButton>
          </form>
          {loginStatus && <p className="login-status">{loginStatus}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="admin-layout">
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <PrimaryButton
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          >
            {isSidebarCollapsed ? '☰' : 'TMS'}
          </PrimaryButton>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`menu-item ${activeScreen === item.key ? 'active' : ''}`}
              onClick={() => setActiveScreen(item.key)}
              title={item.label}
            >
              <span className="menu-icon">{item.icon}</span>
              {!isSidebarCollapsed && <span className="menu-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user" title={userDisplayName}>
            <span className="sidebar-avatar">{avatarLabel}</span>
            {!isSidebarCollapsed && (
              <div className="sidebar-user-info">
                <strong>{userDisplayName}</strong>
                <span>{userRole || 'guest'}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={() => setIsLogoutDialogOpen(true)}
            title="Đăng xuất"
          >
            <span>⏻</span>
            {!isSidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      <section className="admin-content">
        {activeScreen === 'overview' ? (
          <>
            <h1 className="title">Dashboard tổng quan liên hệ</h1>
            <p className="desc">Màn hình tổng quan dữ liệu liên hệ trong hệ thống.</p>
            <div className="grid">
              <Card>Tổng liên hệ: {totalContacts}</Card>
              <Card>Liên hệ có số điện thoại: {contactsWithPhone}</Card>
              <Card>Liên hệ có email: {contactsWithEmail}</Card>
              <Card>{healthStatus}</Card>
            </div>
            <Card>{contactsStatus}</Card>
          </>
        ) : (
          <>
            <h1 className="title">Quản lý liên hệ</h1>
            <p className="desc">Danh sách liên hệ hiện có trong hệ thống.</p>
            <div className="contacts-screen">
              <div className="contacts-main">
                <div className="contacts-toolbar">
                  <input
                    type="text"
                    className="contact-search"
                    placeholder="Tìm kiếm theo tên, số điện thoại, email..."
                    value={contactKeyword}
                    onChange={(event) => setContactKeyword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="create-contact-btn"
                    onClick={() => {
                      setIsCreateDialogOpen((prev) => !prev)
                      setCreateContactStatus('')
                      setCreateContactStatusType('')
                    }}
                  >
                    {isCreateDialogOpen ? 'Đóng tạo liên hệ' : 'Tạo liên hệ mới'}
                  </button>
                </div>
                <div className="contacts-list-wrap">
                  <div className="contacts-header-row">
                    <span>Tên liên hệ</span>
                    <span>Số điện thoại</span>
                    <span>Email</span>
                    <span className="actions-col">Chức năng</span>
                  </div>

                  <div className="contacts-list">
                    {filteredContacts.length ? (
                      filteredContacts.map((contact) => (
                        <div key={contact.id} className="contact-item-row">
                          <span className="cell-main">{contact.name || 'Không có tên'}</span>
                          <span>{contact.phone || 'Chưa có số điện thoại'}</span>
                          <span>{contact.email || 'Chưa có email'}</span>
                          <button type="button" className="contact-action-btn" title="Chọn chức năng">
                            ⋮
                          </button>
                        </div>
                      ))
                    ) : contacts.length ? (
                      <Card>Không có liên hệ phù hợp với từ khóa tìm kiếm</Card>
                    ) : (
                      <Card>Chưa có liên hệ để hiển thị</Card>
                    )}
                  </div>
                </div>
              </div>

              {isCreateDialogOpen && (
                <aside className="create-contact-dialog">
                  <h3>Tạo liên hệ mới</h3>
                  <form className="create-contact-form" onSubmit={handleCreateContact}>
                    <input
                      type="text"
                      className="create-contact-input"
                      placeholder="Tên liên hệ"
                      value={newContact.name}
                      onChange={(event) =>
                        setNewContact((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      className="create-contact-input"
                      placeholder="Số điện thoại"
                      value={newContact.phone}
                      onChange={(event) =>
                        setNewContact((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="email"
                      className="create-contact-input"
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(event) =>
                        setNewContact((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                    <button type="submit" className="submit-create-contact-btn">
                      Lưu liên hệ
                    </button>
                    {createContactStatus && (
                      <p className={`create-contact-status ${createContactStatusType}`}>
                        {createContactStatus}
                      </p>
                    )}
                  </form>
                </aside>
              )}
            </div>
            <Card>{contactsStatus}</Card>
          </>
        )}
      </section>

      {isLogoutDialogOpen && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="Xác nhận đăng xuất">
          <div className="dialog-box">
            <h3>Xác nhận đăng xuất</h3>
            <p>Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-cancel-btn"
                onClick={() => setIsLogoutDialogOpen(false)}
              >
                Hủy
              </button>
              <button type="button" className="dialog-confirm-btn" onClick={handleLogout}>
                Xác nhận đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
