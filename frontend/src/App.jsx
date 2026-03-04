import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [userEmail, setUserEmail] = useState('')
  const [activeScreen, setActiveScreen] = useState('create-contact')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('neutral')
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState([])
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' })
  const [editingContactId, setEditingContactId] = useState('')
  const [editContactForm, setEditContactForm] = useState({ name: '', phone: '', email: '' })
  const [searchKeyword, setSearchKeyword] = useState('')

  const screenItems = [
    { key: 'create-contact', label: 'Tạo liên hệ', icon: '➕' },
    { key: 'contact-list', label: 'Danh sách liên hệ', icon: '📋' },
    { key: 'contact-dashboard', label: 'Dashbroad liên hệ', icon: '📊' },
  ]

  const currentScreen = screenItems.find((item) => item.key === activeScreen)

  const fetchContacts = async (activeToken = token) => {
    if (!activeToken) {
      setContacts([])
      return
    }

    const response = await fetch('/api/contacts', {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    })

    const data = await response.json().catch(() => [])

    if (!response.ok) {
      throw new Error(data?.message || 'Không tải được danh sách liên hệ')
    }

    setContacts(Array.isArray(data) ? data : [])
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    setStatusType('neutral')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus(data.message || 'Đăng nhập thất bại')
        setStatusType('error')
        return
      }

      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUserEmail(data?.user?.email || email)
      setActiveScreen('create-contact')
      setIsSidebarCollapsed(true)
      await fetchContacts(data.token)
      setStatus('Đăng nhập thành công')
      setStatusType('success')
    } catch {
      setStatus('Không kết nối được backend')
      setStatusType('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        return
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          localStorage.removeItem('token')
          setToken('')
          setUserEmail('')
          setStatus('Phiên đăng nhập đã hết hạn')
          setStatusType('error')
          return
        }

        const data = await response.json()
        setUserEmail(data?.user?.email || '')
        await fetchContacts(token)
      } catch {
        setStatus('Không kiểm tra được phiên đăng nhập')
        setStatusType('error')
      }
    }

    checkToken()
  }, [token])
  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken('')
    setUserEmail('')
    setContacts([])
    setIsSidebarCollapsed(true)
    setStatus('Đã đăng xuất')
    setStatusType('neutral')
  }

  const handleChangeScreen = (screenKey) => {
    setActiveScreen(screenKey)
    if (screenKey === 'create-contact') {
      setIsSidebarCollapsed(true)
      return
    }

    setIsSidebarCollapsed(false)
  }

  const handleAddContact = async (event) => {
    event.preventDefault()

    if (!newContact.name.trim()) {
      setStatus('Vui lòng nhập tên liên hệ')
      setStatusType('error')
      return
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
          email: newContact.email.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(data.message || 'Thêm liên hệ thất bại')
        setStatusType('error')
        return
      }

      setContacts((prevContacts) => [data, ...prevContacts])
      setNewContact({ name: '', phone: '', email: '' })
      setStatus('Thêm liên hệ mới thành công')
      setStatusType('success')
    } catch {
      setStatus('Không thể kết nối API tạo liên hệ')
      setStatusType('error')
    }
  }

  const handleStartEdit = (contact) => {
    setEditingContactId(String(contact.id))
    setEditContactForm({
      name: contact.name || '',
      phone: contact.phone || '',
      email: contact.email || '',
    })
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()

    if (!editContactForm.name.trim()) {
      setStatus('Tên liên hệ không được để trống')
      setStatusType('error')
      return
    }

    try {
      const response = await fetch(`/api/contacts/${editingContactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editContactForm.name.trim(),
          phone: editContactForm.phone.trim(),
          email: editContactForm.email.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(data.message || 'Cập nhật liên hệ thất bại')
        setStatusType('error')
        return
      }

      setContacts((prevContacts) =>
        prevContacts.map((contact) => {
          if (String(contact.id) !== editingContactId) {
            return contact
          }

          return data
        }),
      )

      setEditingContactId('')
      setEditContactForm({ name: '', phone: '', email: '' })
      setStatus('Cập nhật liên hệ thành công')
      setStatusType('success')
    } catch {
      setStatus('Không thể kết nối API cập nhật liên hệ')
      setStatusType('error')
    }
  }

  const handleCloseEditDialog = () => {
    setEditingContactId('')
    setEditContactForm({ name: '', phone: '', email: '' })
  }

  const handleDeleteContact = async (contactId) => {
    const normalizedId = String(contactId)
    const targetContact = contacts.find((contact) => String(contact.id) === normalizedId)
    if (!targetContact) {
      return
    }

    const isConfirmed = window.confirm(`Bạn có chắc muốn xóa liên hệ "${targetContact.name}" không?`)
    if (!isConfirmed) {
      return
    }

    try {
      const response = await fetch(`/api/contacts/${normalizedId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(data.message || 'Xóa liên hệ thất bại')
        setStatusType('error')
        return
      }

      setContacts((prevContacts) =>
        prevContacts.filter((contact) => String(contact.id) !== normalizedId),
      )
    } catch {
      setStatus('Không thể kết nối API xóa liên hệ')
      setStatusType('error')
      return
    }

    if (editingContactId === normalizedId) {
      handleCloseEditDialog()
    }

    setStatus('Xóa liên hệ thành công')
    setStatusType('success')
  }

  const normalizedKeyword = searchKeyword.trim().toLowerCase()
  const filteredContacts = contacts.filter((contact) => {
    if (!normalizedKeyword) {
      return true
    }

    const combinedContent = `${contact.name || ''} ${contact.phone || ''}`.toLowerCase()
    return combinedContent.includes(normalizedKeyword)
  })

  const totalContacts = contacts.length
  const contactsWithEmail = contacts.filter((contact) => contact.email).length
  const contactsWithPhone = contacts.filter((contact) => contact.phone).length
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const newContactsInWeek = contacts.filter((contact) => {
    const createdTime = new Date(contact.createdAt).getTime()
    return Number.isFinite(createdTime) && createdTime >= sevenDaysAgo
  }).length

  const renderScreen = () => {
    if (activeScreen === 'create-contact') {
      return (
        <div className="content-card">
          <h2>Tạo liên hệ</h2>
          <p>Thêm một liên hệ mới vào hệ thống quản lý.</p>
          <form className="quick-form" onSubmit={handleAddContact}>
            <input
              type="text"
              placeholder="Tên liên hệ"
              value={newContact.name}
              onChange={(event) =>
                setNewContact((prevState) => ({ ...prevState, name: event.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Số điện thoại"
              value={newContact.phone}
              onChange={(event) =>
                setNewContact((prevState) => ({ ...prevState, phone: event.target.value }))
              }
            />
            <input
              type="email"
              placeholder="Email"
              value={newContact.email}
              onChange={(event) =>
                setNewContact((prevState) => ({ ...prevState, email: event.target.value }))
              }
            />
            <button type="submit">Thêm liên hệ mới</button>
          </form>
        </div>
      )
    }

    if (activeScreen === 'contact-list') {
      return (
        <div className="content-card">
          <h2>Danh sách liên hệ</h2>
          <p>Quản lý danh sách liên hệ và chỉnh sửa thông tin khi cần.</p>

          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm theo tên hoặc số điện thoại"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </div>

          {contacts.length === 0 ? (
            <p className="empty-note">Chưa có liên hệ nào. Hãy tạo liên hệ mới trước.</p>
          ) : filteredContacts.length === 0 ? (
            <p className="empty-note">Không tìm thấy liên hệ phù hợp với từ khóa tìm kiếm.</p>
          ) : (
            <div className="contact-table-wrapper">
              <table className="contact-table">
                <thead>
                  <tr>
                    <th>Tên liên hệ</th>
                    <th>Số điện thoại</th>
                    <th>Email</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.name || '-'}</td>
                      <td>{contact.phone || '-'}</td>
                      <td>{contact.email || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="table-action-btn" onClick={() => handleStartEdit(contact)}>
                            Chỉnh sửa
                          </button>
                          <button type="button" className="table-delete-btn" onClick={() => handleDeleteContact(contact.id)}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editingContactId && (
            <div className="dialog-backdrop" role="presentation" onClick={handleCloseEditDialog}>
              <div
                className="edit-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Chỉnh sửa thông tin liên hệ"
                onClick={(event) => event.stopPropagation()}
              >
                <h3>Chỉnh sửa liên hệ</h3>
                <form className="dialog-form" onSubmit={handleSaveEdit}>
                  <input
                    type="text"
                    placeholder="Tên liên hệ"
                    value={editContactForm.name}
                    onChange={(event) =>
                      setEditContactForm((prevState) => ({ ...prevState, name: event.target.value }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Số điện thoại"
                    value={editContactForm.phone}
                    onChange={(event) =>
                      setEditContactForm((prevState) => ({ ...prevState, phone: event.target.value }))
                    }
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={editContactForm.email}
                    onChange={(event) =>
                      setEditContactForm((prevState) => ({ ...prevState, email: event.target.value }))
                    }
                  />

                  <div className="dialog-actions">
                    <button type="button" className="secondary-btn" onClick={handleCloseEditDialog}>
                      Hủy
                    </button>
                    <button type="submit">Lưu thay đổi</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="content-card">
        <h2>Dashbroad liên hệ</h2>
        <p>Các thống kê tổng hợp dựa trên dữ liệu liên hệ hiện có.</p>

        <div className="stats-grid">
          <div className="stat-card">
            <p>Tổng liên hệ</p>
            <h3>{totalContacts}</h3>
          </div>
          <div className="stat-card">
            <p>Có email</p>
            <h3>{contactsWithEmail}</h3>
          </div>
          <div className="stat-card">
            <p>Có số điện thoại</p>
            <h3>{contactsWithPhone}</h3>
          </div>
          <div className="stat-card">
            <p>Thêm mới trong 7 ngày</p>
            <h3>{newContactsInWeek}</h3>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={token ? 'app-wrapper' : 'login-wrapper'}>
      {!token ? (
        <div className="card">
          <div className="card-header">
            <span className="badge">WebApp</span>
            <h1>Đăng nhập hệ thống</h1>
            <p>Nhập tài khoản để truy cập trang quản trị.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="admin@webapp.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {status && <p className={`status-text ${statusType}`}>{status}</p>}
        </div>
      ) : (
        <div className="dashboard-layout">
          <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div>
              <div className="menu-head">
                {!isSidebarCollapsed && <h3 className="menu-title">Menu</h3>}
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  aria-label={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                  title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                >
                  {isSidebarCollapsed ? '☰' : '⟨'}
                </button>
              </div>

              <nav className="menu-list">
                {screenItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`menu-item ${activeScreen === item.key ? 'active' : ''}`}
                    onClick={() => handleChangeScreen(item.key)}
                  >
                    <span className="menu-icon" aria-hidden="true">{item.icon}</span>
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </button>
                ))}
              </nav>
            </div>

            <div className="account-box">
              {!isSidebarCollapsed && <p className="account-title">Thiết đặt tài khoản đăng nhập</p>}
              {!isSidebarCollapsed && <p className="account-email">{userEmail}</p>}
              <button type="button" className="logout-btn" onClick={handleLogout}>
                <span className="menu-icon" aria-hidden="true">↩</span>
                {!isSidebarCollapsed && <span>Đăng xuất</span>}
              </button>
            </div>
          </aside>

          <main className="content-area">
            <header className="content-header">
              <h1>{currentScreen?.label}</h1>
              <p>Tối ưu không gian làm việc theo kiểu web app.</p>
            </header>
            {renderScreen()}
            {status && <p className={`status-text ${statusType}`}>{status}</p>}
          </main>
        </div>
      )}
    </div>
  )
}

export default App
