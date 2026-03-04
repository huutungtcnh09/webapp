import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('pos_token') || '')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [activeMenu, setActiveMenu] = useState('create-order')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [productKeyword, setProductKeyword] = useState('')
  const [products, setProducts] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [productStatus, setProductStatus] = useState('')
  const [contacts, setContacts] = useState([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [contactsStatus, setContactsStatus] = useState('')
  const [createOrderStatus, setCreateOrderStatus] = useState('')
  const [createOrderStatusType, setCreateOrderStatusType] = useState('')
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [isProductLoading, setIsProductLoading] = useState(false)
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [createContactStatus, setCreateContactStatus] = useState('')
  const [createContactStatusType, setCreateContactStatusType] = useState('')
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [customerRevenue, setCustomerRevenue] = useState(0)
  const [isRevenueLoading, setIsRevenueLoading] = useState(false)
  const [orders, setOrders] = useState([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(false)
  const [ordersStatus, setOrdersStatus] = useState('')
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false)
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null)
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false)
  const [orderDetailStatus, setOrderDetailStatus] = useState('')
  const [isOrderEditOpen, setIsOrderEditOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [editOrderStatusValue, setEditOrderStatusValue] = useState('confirmed')
  const [editOrderNote, setEditOrderNote] = useState('')
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [editOrderStatus, setEditOrderStatus] = useState('')
  const [editOrderStatusType, setEditOrderStatusType] = useState('')
  const [isContactsDashboardLoading, setIsContactsDashboardLoading] = useState(false)
  const [contactsDashboardStatus, setContactsDashboardStatus] = useState('')
  const [contactsDashboard, setContactsDashboard] = useState({
    totalContacts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    revenueByStatus: {
      draft: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    },
  })

  const menuItems = [
    { key: 'create-order', label: 'Tạo đơn bán hàng', icon: '🧾' },
    { key: 'order-list', label: 'Danh sách đơn hàng', icon: '📋' },
    { key: 'contacts', label: 'Liên hệ', icon: '📇' },
  ]

  const ORDER_STATUSES = ['draft', 'confirmed', 'completed', 'cancelled']

  const headerByMenu = {
    'create-order': {
      title: 'Tạo đơn bán hàng',
      subtitle: 'Đơn mới tại quầy',
    },
    'order-list': {
      title: 'Danh sách đơn hàng',
      subtitle: 'Tra cứu và theo dõi đơn hàng đã tạo',
    },
    contacts: {
      title: 'Liên hệ',
      subtitle: 'Thông tin liên hệ phục vụ bán hàng',
    },
  }

  const currentHeader = headerByMenu[activeMenu] || {
    title: 'POS',
    subtitle: '',
  }

  const contactsRevenueChartRows = [
    { key: 'draft', label: 'Nháp' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'completed', label: 'Hoàn tất' },
    { key: 'cancelled', label: 'Đã hủy' },
  ].map((item) => ({
    ...item,
    value: Number(contactsDashboard?.revenueByStatus?.[item.key] || 0),
  }))

  const contactsRevenueMax = Math.max(...contactsRevenueChartRows.map((item) => item.value), 0)

  const filteredProducts = useMemo(() => products.slice(0, 8), [products])

  const hasSearchKeyword = productKeyword.trim().length > 0
  const selectedContact = useMemo(
    () => contacts.find((item) => String(item.id) === String(selectedContactId)) || null,
    [contacts, selectedContactId]
  )

  const totalAmount = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [orderItems]
  )

  const normalizePhone = (value) => String(value || '').replace(/\s+/g, '').trim()

  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => [])
      if (!response.ok) {
        setContacts([])
        if (response.status === 401 || response.status === 403) {
          setContactsStatus('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')
        } else {
          setContactsStatus(data?.message || 'Không tải được danh sách liên hệ')
        }
        return
      }

      const rows = Array.isArray(data) ? data : []
      setContacts(rows)
      if (rows.length) {
        setSelectedContactId((prev) => prev || String(rows[0].id))
        setContactsStatus('')
      } else {
        setContactsStatus('Chưa có dữ liệu liên hệ trong DB')
      }
    } catch {
      setContacts([])
      setContactsStatus('Không tải được danh sách liên hệ')
    }
  }

  const loadOrders = async () => {
    if (!token) {
      return
    }

    try {
      setIsOrdersLoading(true)
      setOrdersStatus('')

      const response = await fetch('/api/orders?limit=200', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => [])
      if (!response.ok) {
        setOrders([])
        setOrdersStatus(data?.message || 'Không tải được danh sách đơn hàng')
        return
      }

      const rows = Array.isArray(data) ? data : []
      setOrders(rows)
      if (!rows.length) {
        setOrdersStatus('Chưa có đơn hàng nào')
      }
    } catch {
      setOrders([])
      setOrdersStatus('Không tải được danh sách đơn hàng')
    } finally {
      setIsOrdersLoading(false)
    }
  }

  const loadContactsDashboard = async () => {
    if (!token) {
      return
    }

    try {
      setIsContactsDashboardLoading(true)
      setContactsDashboardStatus('')

      const [contactsResponse, ordersResponse] = await Promise.all([
        fetch('/api/contacts', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/orders?limit=200', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const contactsData = await contactsResponse.json().catch(() => [])
      const ordersData = await ordersResponse.json().catch(() => [])

      if (!contactsResponse.ok || !ordersResponse.ok) {
        setContactsDashboard({
          totalContacts: 0,
          totalOrders: 0,
          totalRevenue: 0,
          revenueByStatus: {
            draft: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
          },
        })
        setContactsDashboardStatus('Không tải được dữ liệu tổng quan liên hệ')
        return
      }

      const contactsRows = Array.isArray(contactsData) ? contactsData : []
      const ordersRows = Array.isArray(ordersData) ? ordersData : []
      const revenue = ordersRows.reduce((sum, item) => sum + Number(item?.totalAmount || 0), 0)
      const revenueByStatus = {
        draft: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      }

      ordersRows.forEach((order) => {
        const status = String(order?.status || '').trim()
        if (Object.prototype.hasOwnProperty.call(revenueByStatus, status)) {
          revenueByStatus[status] += Number(order?.totalAmount || 0)
        }
      })

      setContactsDashboard({
        totalContacts: contactsRows.length,
        totalOrders: ordersRows.length,
        totalRevenue: revenue,
        revenueByStatus,
      })

      if (!contactsRows.length) {
        setContactsDashboardStatus('Chưa có dữ liệu liên hệ trong DB')
      }
    } catch {
      setContactsDashboard({
        totalContacts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        revenueByStatus: {
          draft: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
        },
      })
      setContactsDashboardStatus('Không tải được dữ liệu tổng quan liên hệ')
    } finally {
      setIsContactsDashboardLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      return
    }

    const loadInitialProducts = async () => {
      try {
        const response = await fetch('/api/products', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json().catch(() => [])
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setProductStatus('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')
          } else {
            setProductStatus(data?.message || 'Không tải được sản phẩm')
          }
          return
        }

        const rows = Array.isArray(data) ? data : []
        if (!rows.length) {
          setProductStatus('Chưa có dữ liệu sản phẩm trong DB')
        } else {
          setProductStatus('')
        }
      } catch {
        setProductStatus('Không tải được sản phẩm')
      }
    }

    loadInitialProducts()
  }, [token])

  useEffect(() => {
    if (!token) {
      return
    }

    const keyword = productKeyword.trim()
    if (!keyword) {
      setProducts([])
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      try {
        setIsProductLoading(true)
        const response = await fetch(`/api/products?q=${encodeURIComponent(keyword)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        const data = await response.json().catch(() => [])
        if (!response.ok) {
          setProducts([])
          if (response.status === 401 || response.status === 403) {
            setProductStatus('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')
          } else {
            setProductStatus(data?.message || 'Không tải được sản phẩm')
          }
          return
        }

        const rows = Array.isArray(data) ? data : []
        setProducts(rows)
        setProductStatus(rows.length ? '' : 'Không tìm thấy sản phẩm trong DB')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setProducts([])
          setProductStatus('Không tải được sản phẩm')
        }
      } finally {
        setIsProductLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [token, productKeyword])

  useEffect(() => {
    if (!token) {
      return
    }

    loadContacts()
  }, [token])

  useEffect(() => {
    if (activeMenu !== 'order-list' || !token) {
      return
    }

    loadOrders()
  }, [activeMenu, token])

  useEffect(() => {
    if (activeMenu !== 'contacts' || !token) {
      return
    }

    loadContactsDashboard()
  }, [activeMenu, token])

  useEffect(() => {
    if (!token || !selectedContact) {
      setCustomerRevenue(0)
      return
    }

    const loadCustomerRevenue = async () => {
      const contactPhone = normalizePhone(selectedContact.phone)
      const contactName = String(selectedContact.name || '').trim()

      if (!contactPhone && !contactName) {
        setCustomerRevenue(0)
        return
      }

      try {
        setIsRevenueLoading(true)

        const q = contactPhone || contactName
        const response = await fetch(`/api/orders?q=${encodeURIComponent(q)}&limit=200`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json().catch(() => [])
        if (!response.ok) {
          setCustomerRevenue(0)
          return
        }

        const rows = Array.isArray(data) ? data : []
        const matchedRows = rows.filter((row) => {
          const rowPhone = normalizePhone(row?.customerPhone)
          if (contactPhone && rowPhone) {
            return rowPhone === contactPhone
          }

          if (contactName) {
            return String(row?.customerName || '').trim().toLowerCase() === contactName.toLowerCase()
          }

          return false
        })

        const sum = matchedRows.reduce((acc, row) => acc + Number(row?.totalAmount || 0), 0)
        setCustomerRevenue(sum)
      } catch {
        setCustomerRevenue(0)
      } finally {
        setIsRevenueLoading(false)
      }
    }

    loadCustomerRevenue()
  }, [token, selectedContact])

  const handleSelectProduct = (product) => {
    setOrderItems((prev) => {
      const existed = prev.find((item) => item.id === product.id)
      if (existed) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      }

      return [
        ...prev,
        {
          id: product.id,
          productCode: product.productCode,
          name: product.name,
          unit: product.unit,
          quantity: 1,
          price: Number(product.price || 0),
        },
      ]
    })

    setProductKeyword('')
  }

  const handleCreateOrder = async () => {
    if (!selectedContact) {
      setCreateOrderStatus('Vui lòng chọn khách hàng')
      setCreateOrderStatusType('error')
      return
    }

    if (!orderItems.length) {
      setCreateOrderStatus('Vui lòng chọn ít nhất 1 sản phẩm')
      setCreateOrderStatusType('error')
      return
    }

    setIsCreatingOrder(true)
    setCreateOrderStatus('')
    setCreateOrderStatusType('')

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: selectedContact.name || '',
          customerPhone: selectedContact.phone || '',
          items: orderItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            unit: item.unit || 'cái',
          })),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setCreateOrderStatus(data?.message || 'Không tạo được đơn hàng')
        setCreateOrderStatusType('error')
        return
      }

      setCreateOrderStatus(`Tạo đơn thành công: ${data?.orderCode || ''}`.trim())
      setCreateOrderStatusType('success')
      setOrderItems([])
      setProductKeyword('')
      setProducts([])
    } catch {
      setCreateOrderStatus('Không thể kết nối máy chủ để tạo đơn hàng')
      setCreateOrderStatusType('error')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const openCreateContactDialog = () => {
    setCreateContactStatus('')
    setCreateContactStatusType('')
    setNewContactName('')
    setNewContactPhone('')
    setNewContactEmail('')
    setIsContactDialogOpen(true)
  }

  const handleCreateContact = async (event) => {
    event.preventDefault()

    const name = String(newContactName || '').trim()
    const phoneValue = String(newContactPhone || '').trim()
    const emailValue = String(newContactEmail || '').trim()

    if (!name) {
      setCreateContactStatus('Vui lòng nhập tên liên hệ')
      setCreateContactStatusType('error')
      return
    }

    setIsCreatingContact(true)
    setCreateContactStatus('')
    setCreateContactStatusType('')

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone: phoneValue,
          email: emailValue,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setCreateContactStatus(data?.message || 'Không tạo được liên hệ')
        setCreateContactStatusType('error')
        return
      }

      await loadContacts()
      if (data?.id) {
        setSelectedContactId(String(data.id))
      }
      setCreateContactStatus('Tạo liên hệ thành công')
      setCreateContactStatusType('success')
      setIsContactDialogOpen(false)
    } catch {
      setCreateContactStatus('Không thể kết nối máy chủ để tạo liên hệ')
      setCreateContactStatusType('error')
    } finally {
      setIsCreatingContact(false)
    }
  }

  const handleViewOrderDetail = async (orderId) => {
    try {
      setIsOrderDetailOpen(true)
      setIsOrderDetailLoading(true)
      setOrderDetailStatus('')
      setSelectedOrderDetail(null)

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setOrderDetailStatus(data?.message || 'Không tải được chi tiết đơn hàng')
        return
      }

      setSelectedOrderDetail(data)
    } catch {
      setOrderDetailStatus('Không tải được chi tiết đơn hàng')
    } finally {
      setIsOrderDetailLoading(false)
    }
  }

  const openEditOrder = (order) => {
    setEditingOrder(order)
    setEditOrderStatusValue(order?.status || 'confirmed')
    setEditOrderNote(order?.note || '')
    setEditOrderStatus('')
    setEditOrderStatusType('')
    setIsOrderEditOpen(true)
  }

  const handleSaveOrderEdit = async (event) => {
    event.preventDefault()

    if (!editingOrder?.id) {
      setEditOrderStatus('Không xác định được đơn hàng cần sửa')
      setEditOrderStatusType('error')
      return
    }

    if (!ORDER_STATUSES.includes(editOrderStatusValue)) {
      setEditOrderStatus('Trạng thái đơn hàng không hợp lệ')
      setEditOrderStatusType('error')
      return
    }

    try {
      setIsSavingOrder(true)
      setEditOrderStatus('')
      setEditOrderStatusType('')

      const response = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: editOrderStatusValue,
          note: editOrderNote,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setEditOrderStatus(data?.message || 'Không cập nhật được đơn hàng')
        setEditOrderStatusType('error')
        return
      }

      setEditOrderStatus('Cập nhật đơn hàng thành công')
      setEditOrderStatusType('success')
      await loadOrders()
      setIsOrderEditOpen(false)
    } catch {
      setEditOrderStatus('Không cập nhật được đơn hàng')
      setEditOrderStatusType('error')
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setStatus('')
    setStatusType('')

    try {
      const response = await fetch('/api/auth/login-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(data?.message || 'Đăng nhập thất bại')
        setStatusType('error')
        return
      }

      localStorage.setItem('pos_token', data.token)
      setToken(data.token)
      setStatus('Đăng nhập thành công')
      setStatusType('success')
    } catch {
      setStatus('Không kết nối được tới máy chủ')
      setStatusType('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
    } finally {
      localStorage.removeItem('pos_token')
      setToken('')
      setActiveMenu('create-order')
      setStatus('Đã đăng xuất')
      setStatusType('success')
    }
  }

  if (!token) {
    return (
      <main className="pos-root">
        <section className="panel">
          <h1>POS TMS</h1>
          <p>Đăng nhập dành cho nhân viên bán hàng</p>
          <form onSubmit={handleLogin}>
            <div className="form-row">
              <label htmlFor="phone">Số điện thoại</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0900000000"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
            {status && <p className={`status ${statusType}`}>{status}</p>}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="pos-layout">
      <aside className={`pos-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          >
            {isSidebarCollapsed ? '☰' : 'POS'}
          </button>
        </div>

        <nav className="pos-menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`pos-menu-item ${activeMenu === item.key ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <span className="pos-menu-icon">{item.icon}</span>
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="pos-sidebar-bottom">
          <button className="logout" type="button" onClick={handleLogout} title="Đăng xuất">
            <span>⏻</span>
            {!isSidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      <section className="pos-content">
        <header className="top-header">
          <h1>{currentHeader.title}</h1>
          <div className="top-header-actions">
            <span>{currentHeader.subtitle}</span>
            <button type="button" className="header-contact-btn" onClick={openCreateContactDialog}>
              Tạo liên hệ mới
            </button>
          </div>
        </header>

        <div className="pos-content-body">
          {activeMenu === 'create-order' && (
            <div className="create-order-shell">
              <div className="content-split">
                <section className="main-panel">
                  <div className="product-search-panel">
                    <input
                      id="product-search"
                      type="text"
                      placeholder="Tìm theo mã hoặc tên sản phẩm..."
                      value={productKeyword}
                      onChange={(event) => setProductKeyword(event.target.value)}
                    />
                    {hasSearchKeyword && (
                      <div className="product-suggestion-list">
                        {isProductLoading ? (
                          <div className="product-suggestion-empty">Đang tìm sản phẩm...</div>
                        ) : filteredProducts.length ? (
                          filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              className="product-suggestion-item"
                              onClick={() => handleSelectProduct(product)}
                            >
                              <span>
                                {product.productCode} - {product.name}
                              </span>
                              <strong>{Number(product.price || 0).toLocaleString('vi-VN')}đ</strong>
                            </button>
                          ))
                        ) : (
                          <div className="product-suggestion-empty">
                            {productStatus || 'Không có sản phẩm phù hợp'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="product-list-panel">
                    <div className="product-list-head">
                      <span>Sản phẩm</span>
                      <span>SL</span>
                      <span>Đơn giá</span>
                      <span>Thành tiền</span>
                    </div>
                    <div className="product-list-body">
                      {orderItems.length ? (
                        orderItems.map((item) => (
                          <div key={item.id} className="product-row">
                            <span>
                              {item.productCode} - {item.name}
                            </span>
                            <span>{item.quantity}</span>
                            <span>{item.price.toLocaleString('vi-VN')}đ</span>
                            <span>{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))
                      ) : (
                        <div className="product-row">
                          <span>Chưa có sản phẩm trong đơn</span>
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <aside className="side-panel">
                  <h3>Tóm tắt đơn</h3>
                  <div className="contact-block">
                    <label htmlFor="contact-select">Khách hàng</label>
                    <select
                      id="contact-select"
                      className="contact-select"
                      value={selectedContactId}
                      onChange={(event) => setSelectedContactId(event.target.value)}
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}{contact.phone ? ` - ${contact.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    {contactsStatus && <p className="status error">{contactsStatus}</p>}

                    {selectedContact && (
                      <div className="contact-info">
                        <p>
                          <strong>Tên:</strong> {selectedContact.name || '-'}
                        </p>
                        <p>
                          <strong>Điện thoại:</strong> {selectedContact.phone || '-'}
                        </p>
                        <p>
                          <strong>Email:</strong> {selectedContact.email || '-'}
                        </p>
                        <p>
                          <strong>Tổng doanh số:</strong>{' '}
                          {isRevenueLoading
                            ? 'Đang tải...'
                            : `${Number(customerRevenue || 0).toLocaleString('vi-VN')}đ`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="dashboard-card">Tạm tính: {totalAmount.toLocaleString('vi-VN')}đ</div>
                  <div className="dashboard-card">Giảm giá: 0đ</div>
                  <div className="dashboard-card">Tổng thanh toán: {totalAmount.toLocaleString('vi-VN')}đ</div>

                  <button
                    type="button"
                    className="create-order-button"
                    onClick={handleCreateOrder}
                    disabled={isCreatingOrder}
                  >
                    {isCreatingOrder ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
                  </button>
                  {createOrderStatus && <p className={`status ${createOrderStatusType}`}>{createOrderStatus}</p>}
                </aside>
              </div>
            </div>
          )}

          {activeMenu === 'order-list' && (
            <div className="order-list-shell">
              <div className="order-table-wrap">
                <div className="order-table-head">
                  <span>Mã đơn</span>
                  <span>Khách hàng</span>
                  <span>Điện thoại</span>
                  <span>Tổng tiền</span>
                  <span>Trạng thái</span>
                  <span>Thao tác</span>
                </div>

                <div className="order-table-body">
                  {isOrdersLoading ? (
                    <div className="order-table-row order-table-empty">Đang tải danh sách đơn hàng...</div>
                  ) : orders.length ? (
                    orders.map((order) => (
                      <div key={order.id} className="order-table-row">
                        <span>{order.orderCode || '-'}</span>
                        <span>{order.customerName || '-'}</span>
                        <span>{order.customerPhone || '-'}</span>
                        <span>{Number(order.totalAmount || 0).toLocaleString('vi-VN')}đ</span>
                        <span className={`order-status status-${order.status}`}>{order.status || '-'}</span>
                        <span className="order-actions">
                          <button
                            type="button"
                            className="order-action-btn"
                            onClick={() => handleViewOrderDetail(order.id)}
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            className="order-action-btn secondary"
                            onClick={() => openEditOrder(order)}
                          >
                            Sửa đơn hàng
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="order-table-row order-table-empty">{ordersStatus || 'Chưa có đơn hàng nào'}</div>
                  )}
                </div>
              </div>
              {ordersStatus && !orders.length && !isOrdersLoading && (
                <p className="status error">{ordersStatus}</p>
              )}
            </div>
          )}

          {activeMenu === 'contacts' && (
            <div className="contacts-dashboard-shell">
              <div className="contacts-dashboard-grid">
                <div className="dashboard-card contacts-kpi">
                  <h3>Tổng liên hệ</h3>
                  <strong>{Number(contactsDashboard.totalContacts || 0).toLocaleString('vi-VN')}</strong>
                </div>
                <div className="dashboard-card contacts-kpi">
                  <h3>Tổng đơn hàng</h3>
                  <strong>{Number(contactsDashboard.totalOrders || 0).toLocaleString('vi-VN')}</strong>
                </div>
                <div className="dashboard-card contacts-kpi">
                  <h3>Tổng doanh số</h3>
                  <strong>{Number(contactsDashboard.totalRevenue || 0).toLocaleString('vi-VN')}đ</strong>
                </div>
              </div>

              {isContactsDashboardLoading ? (
                <div className="dashboard-card">Đang tải dashboard liên hệ...</div>
              ) : (
                <div className="dashboard-card contacts-summary-card">
                  Dashboard tổng quan liên hệ và doanh số theo dữ liệu đơn hàng hiện có.
                </div>
              )}

              {!isContactsDashboardLoading && (
                <div className="dashboard-card contacts-chart-card">
                  <h3>Doanh số theo trạng thái đơn</h3>
                  <div className="contacts-revenue-chart">
                    {contactsRevenueChartRows.map((row) => {
                      const widthPercent = contactsRevenueMax > 0 ? (row.value / contactsRevenueMax) * 100 : 0
                      return (
                        <div key={row.key} className="contacts-revenue-row">
                          <span className="contacts-revenue-label">{row.label}</span>
                          <div className="contacts-revenue-bar-track">
                            <div className={`contacts-revenue-bar status-${row.key}`} style={{ width: `${widthPercent}%` }} />
                          </div>
                          <strong className="contacts-revenue-value">{row.value.toLocaleString('vi-VN')}đ</strong>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {contactsDashboardStatus && <p className="status error">{contactsDashboardStatus}</p>}
            </div>
          )}
        </div>
      </section>

      {isContactDialogOpen && (
        <div className="contact-dialog-overlay" onClick={() => setIsContactDialogOpen(false)}>
          <section className="contact-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="contact-dialog-head">
              <h2>Tạo liên hệ mới</h2>
              <button type="button" className="contact-dialog-close" onClick={() => setIsContactDialogOpen(false)}>
                ✕
              </button>
            </div>

            <form className="contact-dialog-form" onSubmit={handleCreateContact}>
              <div className="form-row">
                <label htmlFor="new-contact-name">Tên liên hệ</label>
                <input
                  id="new-contact-name"
                  type="text"
                  value={newContactName}
                  onChange={(event) => setNewContactName(event.target.value)}
                  placeholder="Nhập tên liên hệ"
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="new-contact-phone">Số điện thoại</label>
                <input
                  id="new-contact-phone"
                  type="tel"
                  value={newContactPhone}
                  onChange={(event) => setNewContactPhone(event.target.value)}
                  placeholder="0900000000"
                />
              </div>

              <div className="form-row">
                <label htmlFor="new-contact-email">Email</label>
                <input
                  id="new-contact-email"
                  type="email"
                  value={newContactEmail}
                  onChange={(event) => setNewContactEmail(event.target.value)}
                  placeholder="ten@congty.vn"
                />
              </div>

              {createContactStatus && <p className={`status ${createContactStatusType}`}>{createContactStatus}</p>}

              <button type="submit" disabled={isCreatingContact}>
                {isCreatingContact ? 'Đang lưu...' : 'Lưu liên hệ'}
              </button>
            </form>
          </section>
        </div>
      )}

      {isOrderDetailOpen && (
        <div className="order-modal-overlay" onClick={() => setIsOrderDetailOpen(false)}>
          <section className="order-modal" onClick={(event) => event.stopPropagation()}>
            <div className="order-modal-head">
              <h2>Chi tiết đơn hàng</h2>
              <button type="button" className="order-modal-close" onClick={() => setIsOrderDetailOpen(false)}>
                ✕
              </button>
            </div>

            {isOrderDetailLoading ? (
              <p>Đang tải chi tiết đơn hàng...</p>
            ) : orderDetailStatus ? (
              <p className="status error">{orderDetailStatus}</p>
            ) : selectedOrderDetail ? (
              <div className="order-detail-body">
                <p>
                  <strong>Mã đơn:</strong> {selectedOrderDetail.orderCode || '-'}
                </p>
                <p>
                  <strong>Khách hàng:</strong> {selectedOrderDetail.customerName || '-'}
                </p>
                <p>
                  <strong>Điện thoại:</strong> {selectedOrderDetail.customerPhone || '-'}
                </p>
                <p>
                  <strong>Trạng thái:</strong> {selectedOrderDetail.status || '-'}
                </p>
                <p>
                  <strong>Tổng tiền:</strong>{' '}
                  {Number(selectedOrderDetail.totalAmount || 0).toLocaleString('vi-VN')}đ
                </p>
                <div className="order-detail-items">
                  <h3>Sản phẩm trong đơn</h3>
                  {Array.isArray(selectedOrderDetail.items) && selectedOrderDetail.items.length ? (
                    selectedOrderDetail.items.map((item) => (
                      <div key={item.id || `${item.productCode}-${item.productName}`} className="order-detail-item-row">
                        <span>{item.productCode || '-'} - {item.productName || '-'}</span>
                        <span>{Number(item.quantity || 0)} x {Number(item.unitPrice || 0).toLocaleString('vi-VN')}đ</span>
                        <strong>{Number(item.lineTotal || 0).toLocaleString('vi-VN')}đ</strong>
                      </div>
                    ))
                  ) : (
                    <p>Không có chi tiết sản phẩm</p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {isOrderEditOpen && (
        <div className="order-modal-overlay" onClick={() => setIsOrderEditOpen(false)}>
          <section className="order-modal" onClick={(event) => event.stopPropagation()}>
            <div className="order-modal-head">
              <h2>Sửa đơn hàng</h2>
              <button type="button" className="order-modal-close" onClick={() => setIsOrderEditOpen(false)}>
                ✕
              </button>
            </div>

            <form className="order-edit-form" onSubmit={handleSaveOrderEdit}>
              <div className="form-row">
                <label htmlFor="edit-order-status">Trạng thái</label>
                <select
                  id="edit-order-status"
                  className="contact-select"
                  value={editOrderStatusValue}
                  onChange={(event) => setEditOrderStatusValue(event.target.value)}
                >
                  {ORDER_STATUSES.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {statusValue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="edit-order-note">Ghi chú</label>
                <input
                  id="edit-order-note"
                  type="text"
                  value={editOrderNote}
                  onChange={(event) => setEditOrderNote(event.target.value)}
                  placeholder="Nhập ghi chú đơn hàng"
                />
              </div>

              {editOrderStatus && <p className={`status ${editOrderStatusType}`}>{editOrderStatus}</p>}

              <button type="submit" disabled={isSavingOrder}>
                {isSavingOrder ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          </section>
        </div>
      )}

      {isCreatingOrder && (
        <div className="creating-order-overlay">
          <div className="creating-order-box">
            <p>Đang tạo đơn hàng...</p>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
