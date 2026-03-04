const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  port: Number(process.env.MYSQL_PORT || 3306),
  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 5000),
};

const DB_NAME = process.env.MYSQL_DATABASE || "webapp_db";
const CONTACTS_TABLE = "contact_entries";
const PRODUCTS_TABLE = "products";
const AUTH_USERS_TABLE = "auth_users";
const AUTH_SESSIONS_TABLE = "auth_sessions";
const ORDERS_TABLE = "orders";
const ORDER_ITEMS_TABLE = "order_items";
const ORDER_STATUSES = ["draft", "confirmed", "completed", "cancelled"];
const ENABLE_DB_INIT = process.env.ENABLE_DB_INIT === "true";
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@webapp.com";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "0900000000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const ADMIN_ROLE = process.env.ADMIN_ROLE || "admin";
const ALLOW_OFFLINE_LOGIN = process.env.ALLOW_OFFLINE_LOGIN !== "false";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const FRONTEND_DIST_PATH_CANDIDATES = [
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(__dirname, "../frontend/dist"),
];
const FRONTEND_DIST_PATH =
  FRONTEND_DIST_PATH_CANDIDATES.find((candidatePath) => fs.existsSync(candidatePath)) ||
  FRONTEND_DIST_PATH_CANDIDATES[1];
const POS_DIST_PATH_CANDIDATES = [
  path.resolve(__dirname, "../../apps/pos/dist"),
  path.resolve(__dirname, "../pos/dist"),
];
const POS_DIST_PATH =
  POS_DIST_PATH_CANDIDATES.find((candidatePath) => fs.existsSync(candidatePath)) || null;

const normalizePhone = (value) => String(value || "").replace(/\s+/g, "").trim();

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const tryOfflineAdminLogin = (phone, password) => {
  if (!ALLOW_OFFLINE_LOGIN) {
    return null;
  }

  const normalizedPhone = normalizePhone(phone);
  const adminPhone = normalizePhone(ADMIN_PHONE);

  if (!normalizedPhone || normalizedPhone !== adminPhone || password !== ADMIN_PASSWORD) {
    return null;
  }

  const token = jwt.sign(
    {
      sub: "offline-admin",
      sid: `offline-${crypto.randomUUID()}`,
      role: ADMIN_ROLE,
      phone: adminPhone,
      offline: true,
    },
    JWT_SECRET
  );

  return {
    token,
    user: {
      id: "offline-admin",
      phone: adminPhone,
      role: ADMIN_ROLE,
      status: "active",
      contact: null,
    },
  };
};

const getConnection = () =>
  mysql.createConnection({
    ...DB_CONFIG,
    database: DB_NAME,
  });

const initDatabase = async () => {
  const connection = await mysql.createConnection(DB_CONFIG);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.query(`USE \`${DB_NAME}\``);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${CONTACTS_TABLE} (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(30),
      email VARCHAR(190),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.end();
};

const checkDatabaseConnection = async () => {
  const connection = await getConnection();

  try {
    await connection.query("SELECT 1");
  } finally {
    await connection.end();
  }
};

const ensureContactsTable = async () => {
  const connection = await getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${CONTACTS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(30),
        email VARCHAR(190),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } finally {
    await connection.end();
  }
};

const ensureProductsTable = async () => {
  const connection = await getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${PRODUCTS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        price DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_products_product_code (product_code)
      )
    `);
  } finally {
    await connection.end();
  }
};

const ensureAuthTables = async () => {
  await ensureContactsTable();

  const connection = await getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${AUTH_USERS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        contact_id BIGINT UNSIGNED NULL,
        phone VARCHAR(30) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'sales') NOT NULL DEFAULT 'sales',
        status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_auth_users_phone (phone),
        KEY idx_auth_users_contact_id (contact_id),
        CONSTRAINT fk_auth_users_contact
          FOREIGN KEY (contact_id) REFERENCES ${CONTACTS_TABLE}(id)
          ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${AUTH_SESSIONS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        session_id CHAR(36) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP NULL DEFAULT NULL,
        last_seen_at TIMESTAMP NULL DEFAULT NULL,
        UNIQUE KEY uq_auth_sessions_session_id (session_id),
        UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
        KEY idx_auth_sessions_user_id (user_id),
        CONSTRAINT fk_auth_sessions_user
          FOREIGN KEY (user_id) REFERENCES ${AUTH_USERS_TABLE}(id)
          ON DELETE CASCADE
      )
    `);
  } finally {
    await connection.end();
  }
};

const ensureOrdersTables = async () => {
  await ensureAuthTables();
  await ensureProductsTable();

  const connection = await getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${ORDERS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(50) NOT NULL,
        customer_name VARCHAR(150) NULL,
        customer_phone VARCHAR(30) NULL,
        customer_address VARCHAR(255) NULL,
        subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        status ENUM('draft', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
        note TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_orders_order_code (order_code),
        KEY idx_orders_created_by (created_by),
        KEY idx_orders_status (status),
        CONSTRAINT fk_orders_created_by
          FOREIGN KEY (created_by) REFERENCES ${AUTH_USERS_TABLE}(id)
          ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${ORDER_ITEMS_TABLE} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NULL,
        product_code VARCHAR(50) NULL,
        product_name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_order_items_order_id (order_id),
        KEY idx_order_items_product_id (product_id),
        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id) REFERENCES ${ORDERS_TABLE}(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_order_items_product
          FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE}(id)
          ON DELETE SET NULL
      )
    `);
  } finally {
    await connection.end();
  }
};

const ensureAdminAccount = async () => {
  await ensureAuthTables();

  const adminPhone = normalizePhone(ADMIN_PHONE);
  if (!adminPhone) {
    return;
  }

  const connection = await getConnection();

  try {
    const [rows] = await connection.query(
      `SELECT id FROM ${AUTH_USERS_TABLE} WHERE phone = ? LIMIT 1`,
      [adminPhone]
    );

    if (rows.length) {
      await connection.query(
        `UPDATE ${AUTH_USERS_TABLE} SET role = ?, status = 'active' WHERE id = ?`,
        [ADMIN_ROLE, rows[0].id]
      );
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    await connection.query(
      `INSERT INTO ${AUTH_USERS_TABLE} (contact_id, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`,
      [null, adminPhone, passwordHash, ADMIN_ROLE]
    );
  } finally {
    await connection.end();
  }
};

const buildAuthUserResponse = (row) => ({
  id: String(row.id),
  phone: row.phone,
  role: row.role,
  status: row.status,
  contact: row.contact_id
    ? {
        id: String(row.contact_id),
        name: row.contact_name || "",
        email: row.contact_email || "",
      }
    : null,
});

const createSessionToken = async (connection, user) => {
  const sessionId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: String(user.id),
      sid: sessionId,
      role: user.role,
      phone: user.phone,
    },
    JWT_SECRET
  );

  const tokenHash = hashToken(token);

  await connection.query(
    `INSERT INTO ${AUTH_SESSIONS_TABLE} (user_id, session_id, token_hash, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [user.id, sessionId, tokenHash]
  );

  return token;
};

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;

  return authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
};

const authenticateToken = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ message: "Thiếu token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }

  if (!payload?.sid || !payload?.sub) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }

  if (payload.offline === true) {
    const adminPhone = normalizePhone(ADMIN_PHONE);
    const payloadPhone = normalizePhone(payload.phone);

    if (!ALLOW_OFFLINE_LOGIN || payloadPhone !== adminPhone) {
      return res.status(401).json({ message: "Phiên offline không hợp lệ" });
    }

    req.user = {
      id: "offline-admin",
      phone: adminPhone,
      role: payload.role || ADMIN_ROLE,
      sessionId: payload.sid,
      token,
      offline: true,
    };

    next();
    return;
  }

  const connection = await getConnection();

  try {
    const [rows] = await connection.query(
      `
        SELECT s.id, u.id AS user_id, u.phone, u.role, u.status
        FROM ${AUTH_SESSIONS_TABLE} s
        JOIN ${AUTH_USERS_TABLE} u ON u.id = s.user_id
        WHERE s.session_id = ?
          AND s.token_hash = ?
          AND s.revoked_at IS NULL
        LIMIT 1
      `,
      [payload.sid, hashToken(token)]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Phiên đăng nhập không còn hiệu lực" });
    }

    const activeSession = rows[0];
    if (activeSession.status !== "active") {
      return res.status(403).json({ message: "Tài khoản đã bị khóa" });
    }

    await connection.query(
      `UPDATE ${AUTH_SESSIONS_TABLE} SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [activeSession.id]
    );

    req.user = {
      id: String(activeSession.user_id),
      phone: activeSession.phone,
      role: activeSession.role,
      sessionId: payload.sid,
      token,
    };

    next();
  } catch (error) {
    return res.status(503).json({ message: `Không xác thực được phiên: ${error.message}` });
  } finally {
    await connection.end();
  }
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này" });
  }

  next();
};

const authRouter = express.Router();
const contactsRouter = express.Router();
const productsRouter = express.Router();
const ordersRouter = express.Router();

const loginWithPhone = async (phone, password) => {
  await ensureAuthTables();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !password) {
    throw new Error("Vui lòng nhập số điện thoại và mật khẩu");
  }

  const connection = await getConnection();

  try {
    const [rows] = await connection.query(
      `
        SELECT
          u.id,
          u.contact_id,
          u.phone,
          u.password_hash,
          u.role,
          u.status,
          c.name AS contact_name,
          c.email AS contact_email
        FROM ${AUTH_USERS_TABLE} u
        LEFT JOIN ${CONTACTS_TABLE} c ON c.id = u.contact_id
        WHERE u.phone = ?
        LIMIT 1
      `,
      [normalizedPhone]
    );

    if (!rows.length) {
      return { ok: false, code: 401, message: "Sai số điện thoại hoặc mật khẩu" };
    }

    const user = rows[0];
    if (user.status !== "active") {
      return { ok: false, code: 403, message: "Tài khoản đã bị khóa" };
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return { ok: false, code: 401, message: "Sai số điện thoại hoặc mật khẩu" };
    }

    const token = await createSessionToken(connection, user);

    return {
      ok: true,
      token,
      user: buildAuthUserResponse(user),
    };
  } finally {
    await connection.end();
  }
};

authRouter.post("/auth/login-phone", async (req, res) => {
  const phone = req.body?.phone;
  const password = req.body?.password;

  try {
    const result = await loginWithPhone(phone, password);

    if (!result.ok) {
      return res.status(result.code).json({ message: result.message });
    }

    return res.json({
      message: "Đăng nhập thành công",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const offlineLogin = tryOfflineAdminLogin(phone, password);
    if (offlineLogin) {
      return res.json({
        message: "Đăng nhập thành công (offline)",
        token: offlineLogin.token,
        user: offlineLogin.user,
      });
    }

    return res.status(500).json({ message: `Không thể đăng nhập: ${error.message}` });
  }
});

authRouter.post("/auth/login", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const password = req.body?.password;

  if (phone) {
    try {
      const result = await loginWithPhone(phone, password);

      if (!result.ok) {
        return res.status(result.code).json({ message: result.message });
      }

      return res.json({
        message: "Đăng nhập thành công",
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      const offlineLogin = tryOfflineAdminLogin(phone, password);
      if (offlineLogin) {
        return res.json({
          message: "Đăng nhập thành công (offline)",
          token: offlineLogin.token,
          user: offlineLogin.user,
        });
      }

      return res.status(500).json({ message: `Không thể đăng nhập: ${error.message}` });
    }
  }

  const email = String(req.body?.email || "").trim();
  if (!email || !password) {
    return res.status(400).json({ message: "Vui lòng nhập số điện thoại và mật khẩu" });
  }

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Sai thông tin đăng nhập" });
  }

  try {
    await ensureAdminAccount();
    const result = await loginWithPhone(ADMIN_PHONE, ADMIN_PASSWORD);

    if (!result.ok) {
      return res.status(result.code).json({ message: result.message });
    }

    return res.json({
      message: "Đăng nhập thành công",
      token: result.token,
      user: {
        ...result.user,
        email: ADMIN_EMAIL,
      },
    });
  } catch (error) {
    const offlineLogin = tryOfflineAdminLogin(ADMIN_PHONE, ADMIN_PASSWORD);
    if (offlineLogin) {
      return res.json({
        message: "Đăng nhập thành công (offline)",
        token: offlineLogin.token,
        user: {
          ...offlineLogin.user,
          email: ADMIN_EMAIL,
        },
      });
    }

    return res.status(500).json({ message: `Không thể đăng nhập: ${error.message}` });
  }
});

authRouter.get("/auth/me", authenticateToken, async (req, res) => {
  if (req.user.offline) {
    return res.json({
      message: "Token hợp lệ (offline)",
      user: {
        id: req.user.id,
        phone: req.user.phone,
        role: req.user.role,
        status: "active",
        contact: null,
      },
    });
  }

  const connection = await getConnection();

  try {
    const [rows] = await connection.query(
      `
        SELECT
          u.id,
          u.contact_id,
          u.phone,
          u.role,
          u.status,
          c.name AS contact_name,
          c.email AS contact_email
        FROM ${AUTH_USERS_TABLE} u
        LEFT JOIN ${CONTACTS_TABLE} c ON c.id = u.contact_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    return res.json({
      message: "Token hợp lệ",
      user: buildAuthUserResponse(rows[0]),
    });
  } catch (error) {
    return res.status(500).json({ message: `Không tải được thông tin người dùng: ${error.message}` });
  } finally {
    await connection.end();
  }
});

authRouter.post("/auth/logout", authenticateToken, async (req, res) => {
  if (req.user.offline) {
    return res.json({ message: "Đăng xuất thành công" });
  }

  const connection = await getConnection();

  try {
    await connection.query(
      `UPDATE ${AUTH_SESSIONS_TABLE} SET revoked_at = CURRENT_TIMESTAMP WHERE session_id = ? AND revoked_at IS NULL`,
      [req.user.sessionId]
    );

    return res.json({ message: "Đăng xuất thành công" });
  } catch (error) {
    return res.status(500).json({ message: `Không thể đăng xuất: ${error.message}` });
  } finally {
    await connection.end();
  }
});

authRouter.post(
  "/auth/users",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const contactId = Number(req.body?.contactId);
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "sales").trim();

    if (!phone || !password) {
      return res.status(400).json({ message: "Vui lòng nhập số điện thoại và mật khẩu" });
    }

    if (!["admin", "manager", "sales"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }

    const connection = await getConnection();
    try {
      if (Number.isFinite(contactId) && contactId > 0) {
        const [contactRows] = await connection.query(
          `SELECT id FROM ${CONTACTS_TABLE} WHERE id = ? LIMIT 1`,
          [contactId]
        );

        if (!contactRows.length) {
          return res.status(404).json({ message: "Không tìm thấy liên hệ để liên kết tài khoản" });
        }
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await connection.query(
        `INSERT INTO ${AUTH_USERS_TABLE} (contact_id, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`,
        [Number.isFinite(contactId) && contactId > 0 ? contactId : null, phone, passwordHash, role]
      );

      return res.status(201).json({ message: "Tạo tài khoản đăng nhập thành công" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Số điện thoại đã tồn tại" });
      }
      return res.status(500).json({ message: `Không tạo được tài khoản: ${error.message}` });
    } finally {
      await connection.end();
    }
  }
);

contactsRouter.get(
  "/contacts",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    try {
      await ensureContactsTable();

      const connection = await getConnection();

      try {
        const [rows] = await connection.query(
          `SELECT id, name, phone, email, created_at FROM ${CONTACTS_TABLE} ORDER BY created_at DESC`
        );

        return res.json(
          rows.map((row) => ({
            id: String(row.id),
            name: row.name,
            phone: row.phone || "",
            email: row.email || "",
            createdAt: row.created_at,
          }))
        );
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không tải được danh sách liên hệ: ${error.message}` });
    }
  }
);

contactsRouter.post(
  "/contacts",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const phone = normalizePhone(req.body?.phone);
    const email = String(req.body?.email || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vui lòng nhập tên liên hệ" });
    }

    try {
      await ensureContactsTable();

      const connection = await getConnection();

      try {
        const [result] = await connection.query(
          `INSERT INTO ${CONTACTS_TABLE} (name, phone, email) VALUES (?, ?, ?)`,
          [name, phone || null, email || null]
        );

        const [rows] = await connection.query(
          `SELECT id, name, phone, email, created_at FROM ${CONTACTS_TABLE} WHERE id = ? LIMIT 1`,
          [result.insertId]
        );

        const row = rows[0];
        return res.status(201).json({
          id: String(row.id),
          name: row.name,
          phone: row.phone || "",
          email: row.email || "",
          createdAt: row.created_at,
        });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không tạo được liên hệ: ${error.message}` });
    }
  }
);

contactsRouter.put(
  "/contacts/:id",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const contactId = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    const phone = normalizePhone(req.body?.phone);
    const email = String(req.body?.email || "").trim();

    if (!Number.isFinite(contactId) || contactId <= 0) {
      return res.status(400).json({ message: "ID liên hệ không hợp lệ" });
    }

    if (!name) {
      return res.status(400).json({ message: "Tên liên hệ không được để trống" });
    }

    try {
      await ensureContactsTable();

      const connection = await getConnection();

      try {
        const [updateResult] = await connection.query(
          `UPDATE ${CONTACTS_TABLE} SET name = ?, phone = ?, email = ? WHERE id = ?`,
          [name, phone || null, email || null, contactId]
        );

        if (!updateResult.affectedRows) {
          return res.status(404).json({ message: "Không tìm thấy liên hệ" });
        }

        const [rows] = await connection.query(
          `SELECT id, name, phone, email, created_at FROM ${CONTACTS_TABLE} WHERE id = ? LIMIT 1`,
          [contactId]
        );

        const row = rows[0];
        return res.json({
          id: String(row.id),
          name: row.name,
          phone: row.phone || "",
          email: row.email || "",
          createdAt: row.created_at,
        });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không cập nhật được liên hệ: ${error.message}` });
    }
  }
);

contactsRouter.delete(
  "/contacts/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res) => {
    const contactId = Number(req.params.id);

    if (!Number.isFinite(contactId) || contactId <= 0) {
      return res.status(400).json({ message: "ID liên hệ không hợp lệ" });
    }

    try {
      await ensureContactsTable();

      const connection = await getConnection();

      try {
        const [result] = await connection.query(
          `DELETE FROM ${CONTACTS_TABLE} WHERE id = ?`,
          [contactId]
        );

        if (!result.affectedRows) {
          return res.status(404).json({ message: "Không tìm thấy liên hệ" });
        }

        return res.json({ message: "Xóa liên hệ thành công" });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không xóa được liên hệ: ${error.message}` });
    }
  }
);

productsRouter.get(
  "/products",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const keyword = String(req.query?.q || "").trim();

    try {
      await ensureProductsTable();

      const connection = await getConnection();

      try {
        const query = keyword
          ? `
              SELECT id, product_code, name, unit, price, description, created_at
              FROM ${PRODUCTS_TABLE}
              WHERE product_code LIKE ? OR name LIKE ?
              ORDER BY created_at DESC
              LIMIT 50
            `
          : `
              SELECT id, product_code, name, unit, price, description, created_at
              FROM ${PRODUCTS_TABLE}
              ORDER BY created_at DESC
              LIMIT 50
            `;

        const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
        const [rows] = await connection.query(query, params);

        return res.json(
          rows.map((row) => ({
            id: String(row.id),
            productCode: row.product_code,
            name: row.name,
            unit: row.unit,
            price: Number(row.price || 0),
            description: row.description || "",
            createdAt: row.created_at,
          }))
        );
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không tải được danh sách sản phẩm: ${error.message}` });
    }
  }
);

ordersRouter.post(
  "/orders",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const customerName = String(req.body?.customerName || "").trim();
    const customerPhone = normalizePhone(req.body?.customerPhone);
    const customerAddress = String(req.body?.customerAddress || "").trim();
    const note = String(req.body?.note || "").trim();
    const requestedOrderCode = String(req.body?.orderCode || "").trim();
    const status = String(req.body?.status || "confirmed").trim();
    const discountAmount = Number(req.body?.discountAmount || 0);
    const taxAmount = Number(req.body?.taxAmount || 0);

    if (!items.length) {
      return res.status(400).json({ message: "Đơn hàng cần ít nhất 1 sản phẩm" });
    }

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ" });
    }

    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return res.status(400).json({ message: "Giảm giá không hợp lệ" });
    }

    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      return res.status(400).json({ message: "Thuế không hợp lệ" });
    }

    try {
      await ensureOrdersTables();
    } catch (error) {
      return res.status(500).json({ message: `Không khởi tạo được schema đơn hàng: ${error.message}` });
    }

    const connection = await getConnection();
    let transactionStarted = false;

    try {
      const productIds = items
        .map((item) => Number(item?.productId))
        .filter((value) => Number.isFinite(value) && value > 0);

      const productById = new Map();
      if (productIds.length) {
        const [productRows] = await connection.query(
          `
            SELECT id, product_code, name, unit, price
            FROM ${PRODUCTS_TABLE}
            WHERE id IN (?)
          `,
          [Array.from(new Set(productIds))]
        );

        productRows.forEach((row) => {
          productById.set(Number(row.id), row);
        });
      }

      const normalizedItems = [];
      let subtotal = 0;

      for (const [index, item] of items.entries()) {
        const productId = Number(item?.productId);
        const product = Number.isFinite(productId) && productId > 0 ? productById.get(productId) : null;

        if (Number.isFinite(productId) && productId > 0 && !product) {
          return res.status(404).json({ message: `Không tìm thấy sản phẩm tại vị trí dòng ${index + 1}` });
        }

        const productCode = String(item?.productCode || product?.product_code || "").trim();
        const productName = String(item?.productName || product?.name || "").trim();
        const unit = String(item?.unit || product?.unit || "").trim();
        const quantity = Number(item?.quantity);
        const unitPrice =
          item?.unitPrice !== undefined && item?.unitPrice !== null
            ? Number(item.unitPrice)
            : Number(product?.price || 0);

        if (!productName || !unit) {
          return res.status(400).json({ message: `Thiếu tên hoặc đơn vị sản phẩm tại dòng ${index + 1}` });
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          return res.status(400).json({ message: `Số lượng không hợp lệ tại dòng ${index + 1}` });
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return res.status(400).json({ message: `Đơn giá không hợp lệ tại dòng ${index + 1}` });
        }

        const lineTotal = Number((quantity * unitPrice).toFixed(2));
        subtotal += lineTotal;

        normalizedItems.push({
          productId: Number.isFinite(productId) && productId > 0 ? productId : null,
          productCode: productCode || null,
          productName,
          unit,
          quantity,
          unitPrice,
          lineTotal,
          note: String(item?.note || "").trim() || null,
        });
      }

      const roundedSubtotal = Number(subtotal.toFixed(2));
      const totalAmount = Number((roundedSubtotal - discountAmount + taxAmount).toFixed(2));

      if (totalAmount < 0) {
        return res.status(400).json({ message: "Tổng tiền đơn hàng không hợp lệ" });
      }

      const orderCode =
        requestedOrderCode ||
        `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0")}`;

      const createdBy = Number(req.user?.id);

      await connection.beginTransaction();
      transactionStarted = true;

      const [orderResult] = await connection.query(
        `
          INSERT INTO ${ORDERS_TABLE} (
            order_code,
            customer_name,
            customer_phone,
            customer_address,
            subtotal,
            discount_amount,
            tax_amount,
            total_amount,
            status,
            note,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderCode,
          customerName || null,
          customerPhone || null,
          customerAddress || null,
          roundedSubtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          status,
          note || null,
          Number.isFinite(createdBy) && createdBy > 0 ? createdBy : null,
        ]
      );

      for (const item of normalizedItems) {
        await connection.query(
          `
            INSERT INTO ${ORDER_ITEMS_TABLE} (
              order_id,
              product_id,
              product_code,
              product_name,
              unit,
              quantity,
              unit_price,
              line_total,
              note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            orderResult.insertId,
            item.productId,
            item.productCode,
            item.productName,
            item.unit,
            item.quantity,
            item.unitPrice,
            item.lineTotal,
            item.note,
          ]
        );
      }

      await connection.commit();

      return res.status(201).json({
        id: String(orderResult.insertId),
        orderCode,
        customerName: customerName || "",
        customerPhone: customerPhone || "",
        customerAddress: customerAddress || "",
        subtotal: roundedSubtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        status,
        note: note || "",
        items: normalizedItems.map((item) => ({
          productId: item.productId ? String(item.productId) : null,
          productCode: item.productCode || "",
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          note: item.note || "",
        })),
      });
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback();
      }

      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Mã đơn hàng đã tồn tại" });
      }

      return res.status(500).json({ message: `Không tạo được đơn hàng: ${error.message}` });
    } finally {
      await connection.end();
    }
  }
);

ordersRouter.get(
  "/orders",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const status = String(req.query?.status || "").trim();
    const keyword = String(req.query?.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);

    try {
      await ensureOrdersTables();

      const connection = await getConnection();

      try {
        const conditions = [];
        const params = [];

        if (status) {
          if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Trạng thái lọc không hợp lệ" });
          }
          conditions.push("o.status = ?");
          params.push(status);
        }

        if (keyword) {
          conditions.push("(o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)");
          params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [rows] = await connection.query(
          `
            SELECT
              o.id,
              o.order_code,
              o.customer_name,
              o.customer_phone,
              o.customer_address,
              o.subtotal,
              o.discount_amount,
              o.tax_amount,
              o.total_amount,
              o.status,
              o.note,
              o.created_by,
              o.created_at,
              o.updated_at,
              COUNT(oi.id) AS item_count
            FROM ${ORDERS_TABLE} o
            LEFT JOIN ${ORDER_ITEMS_TABLE} oi ON oi.order_id = o.id
            ${whereClause}
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT ?
          `,
          [...params, limit]
        );

        return res.json(
          rows.map((row) => ({
            id: String(row.id),
            orderCode: row.order_code,
            customerName: row.customer_name || "",
            customerPhone: row.customer_phone || "",
            customerAddress: row.customer_address || "",
            subtotal: Number(row.subtotal || 0),
            discountAmount: Number(row.discount_amount || 0),
            taxAmount: Number(row.tax_amount || 0),
            totalAmount: Number(row.total_amount || 0),
            status: row.status,
            note: row.note || "",
            createdBy: row.created_by ? String(row.created_by) : null,
            itemCount: Number(row.item_count || 0),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }))
        );
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không tải được danh sách đơn hàng: ${error.message}` });
    }
  }
);

ordersRouter.get(
  "/orders/:id",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const orderId = Number(req.params.id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    try {
      await ensureOrdersTables();

      const connection = await getConnection();

      try {
        const [orderRows] = await connection.query(
          `
            SELECT
              id,
              order_code,
              customer_name,
              customer_phone,
              customer_address,
              subtotal,
              discount_amount,
              tax_amount,
              total_amount,
              status,
              note,
              created_by,
              created_at,
              updated_at
            FROM ${ORDERS_TABLE}
            WHERE id = ?
            LIMIT 1
          `,
          [orderId]
        );

        if (!orderRows.length) {
          return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        const order = orderRows[0];
        const [itemRows] = await connection.query(
          `
            SELECT
              id,
              product_id,
              product_code,
              product_name,
              unit,
              quantity,
              unit_price,
              line_total,
              note,
              created_at,
              updated_at
            FROM ${ORDER_ITEMS_TABLE}
            WHERE order_id = ?
            ORDER BY id ASC
          `,
          [orderId]
        );

        return res.json({
          id: String(order.id),
          orderCode: order.order_code,
          customerName: order.customer_name || "",
          customerPhone: order.customer_phone || "",
          customerAddress: order.customer_address || "",
          subtotal: Number(order.subtotal || 0),
          discountAmount: Number(order.discount_amount || 0),
          taxAmount: Number(order.tax_amount || 0),
          totalAmount: Number(order.total_amount || 0),
          status: order.status,
          note: order.note || "",
          createdBy: order.created_by ? String(order.created_by) : null,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          items: itemRows.map((item) => ({
            id: String(item.id),
            productId: item.product_id ? String(item.product_id) : null,
            productCode: item.product_code || "",
            productName: item.product_name,
            unit: item.unit,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unit_price || 0),
            lineTotal: Number(item.line_total || 0),
            note: item.note || "",
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })),
        });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không tải được chi tiết đơn hàng: ${error.message}` });
    }
  }
);

ordersRouter.patch(
  "/orders/:id/status",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const orderId = Number(req.params.id);
    const status = String(req.body?.status || "").trim();

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ" });
    }

    try {
      await ensureOrdersTables();

      const connection = await getConnection();

      try {
        const [orderRows] = await connection.query(
          `SELECT id, status FROM ${ORDERS_TABLE} WHERE id = ? LIMIT 1`,
          [orderId]
        );

        if (!orderRows.length) {
          return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        if (orderRows[0].status === status) {
          return res.json({
            message: "Cập nhật trạng thái thành công",
            id: String(orderId),
            status,
          });
        }

        await connection.query(`UPDATE ${ORDERS_TABLE} SET status = ? WHERE id = ?`, [status, orderId]);

        return res.json({
          message: "Cập nhật trạng thái thành công",
          id: String(orderId),
          status,
        });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không cập nhật được trạng thái đơn hàng: ${error.message}` });
    }
  }
);

ordersRouter.post(
  "/orders/:id/cancel",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const orderId = Number(req.params.id);
    const cancelNote = String(req.body?.note || "").trim();

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    try {
      await ensureOrdersTables();

      const connection = await getConnection();

      try {
        const [orderRows] = await connection.query(
          `SELECT id, status, note FROM ${ORDERS_TABLE} WHERE id = ? LIMIT 1`,
          [orderId]
        );

        if (!orderRows.length) {
          return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        const currentStatus = String(orderRows[0].status || "");
        if (currentStatus === "cancelled") {
          return res.json({
            message: "Đơn hàng đã ở trạng thái hủy",
            id: String(orderId),
            status: "cancelled",
          });
        }

        const mergedNote = cancelNote
          ? [String(orderRows[0].note || "").trim(), `Hủy đơn: ${cancelNote}`]
              .filter(Boolean)
              .join(" | ")
          : orderRows[0].note || null;

        await connection.query(
          `UPDATE ${ORDERS_TABLE} SET status = 'cancelled', note = ? WHERE id = ?`,
          [mergedNote, orderId]
        );

        return res.json({
          message: "Hủy đơn hàng thành công",
          id: String(orderId),
          status: "cancelled",
          note: mergedNote || "",
        });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không hủy được đơn hàng: ${error.message}` });
    }
  }
);

ordersRouter.put(
  "/orders/:id",
  authenticateToken,
  authorizeRoles("admin", "manager", "sales"),
  async (req, res) => {
    const orderId = Number(req.params.id);
    const hasItems = Object.prototype.hasOwnProperty.call(req.body || {}, "items");
    const incomingItems = hasItems ? req.body.items : null;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    if (hasItems && (!Array.isArray(incomingItems) || !incomingItems.length)) {
      return res.status(400).json({ message: "Danh sách sản phẩm cập nhật không hợp lệ" });
    }

    const requestedStatus =
      req.body?.status !== undefined && req.body?.status !== null
        ? String(req.body.status).trim()
        : null;

    if (requestedStatus !== null && !ORDER_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ" });
    }

    const requestedDiscount =
      req.body?.discountAmount !== undefined && req.body?.discountAmount !== null
        ? Number(req.body.discountAmount)
        : null;
    const requestedTax =
      req.body?.taxAmount !== undefined && req.body?.taxAmount !== null
        ? Number(req.body.taxAmount)
        : null;

    if (requestedDiscount !== null && (!Number.isFinite(requestedDiscount) || requestedDiscount < 0)) {
      return res.status(400).json({ message: "Giảm giá không hợp lệ" });
    }

    if (requestedTax !== null && (!Number.isFinite(requestedTax) || requestedTax < 0)) {
      return res.status(400).json({ message: "Thuế không hợp lệ" });
    }

    try {
      await ensureOrdersTables();
    } catch (error) {
      return res.status(500).json({ message: `Không khởi tạo được schema đơn hàng: ${error.message}` });
    }

    const connection = await getConnection();
    let transactionStarted = false;

    try {
      const [orderRows] = await connection.query(
        `
          SELECT
            id,
            order_code,
            customer_name,
            customer_phone,
            customer_address,
            subtotal,
            discount_amount,
            tax_amount,
            total_amount,
            status,
            note,
            created_by
          FROM ${ORDERS_TABLE}
          WHERE id = ?
          LIMIT 1
        `,
        [orderId]
      );

      if (!orderRows.length) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }

      const existingOrder = orderRows[0];
      const customerName =
        req.body?.customerName !== undefined ? String(req.body.customerName || "").trim() : existingOrder.customer_name;
      const customerPhone =
        req.body?.customerPhone !== undefined
          ? normalizePhone(req.body.customerPhone)
          : existingOrder.customer_phone;
      const customerAddress =
        req.body?.customerAddress !== undefined
          ? String(req.body.customerAddress || "").trim()
          : existingOrder.customer_address;
      const note = req.body?.note !== undefined ? String(req.body.note || "").trim() : existingOrder.note;
      const status = requestedStatus || existingOrder.status;
      const discountAmount = requestedDiscount !== null ? requestedDiscount : Number(existingOrder.discount_amount || 0);
      const taxAmount = requestedTax !== null ? requestedTax : Number(existingOrder.tax_amount || 0);

      let normalizedItems = null;
      let subtotal = Number(existingOrder.subtotal || 0);

      if (hasItems) {
        const productIds = incomingItems
          .map((item) => Number(item?.productId))
          .filter((value) => Number.isFinite(value) && value > 0);

        const productById = new Map();
        if (productIds.length) {
          const [productRows] = await connection.query(
            `
              SELECT id, product_code, name, unit, price
              FROM ${PRODUCTS_TABLE}
              WHERE id IN (?)
            `,
            [Array.from(new Set(productIds))]
          );

          productRows.forEach((row) => {
            productById.set(Number(row.id), row);
          });
        }

        normalizedItems = [];
        let recalculatedSubtotal = 0;

        for (const [index, item] of incomingItems.entries()) {
          const productId = Number(item?.productId);
          const product = Number.isFinite(productId) && productId > 0 ? productById.get(productId) : null;

          if (Number.isFinite(productId) && productId > 0 && !product) {
            return res.status(404).json({ message: `Không tìm thấy sản phẩm tại vị trí dòng ${index + 1}` });
          }

          const productCode = String(item?.productCode || product?.product_code || "").trim();
          const productName = String(item?.productName || product?.name || "").trim();
          const unit = String(item?.unit || product?.unit || "").trim();
          const quantity = Number(item?.quantity);
          const unitPrice =
            item?.unitPrice !== undefined && item?.unitPrice !== null
              ? Number(item.unitPrice)
              : Number(product?.price || 0);

          if (!productName || !unit) {
            return res.status(400).json({ message: `Thiếu tên hoặc đơn vị sản phẩm tại dòng ${index + 1}` });
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: `Số lượng không hợp lệ tại dòng ${index + 1}` });
          }

          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            return res.status(400).json({ message: `Đơn giá không hợp lệ tại dòng ${index + 1}` });
          }

          const lineTotal = Number((quantity * unitPrice).toFixed(2));
          recalculatedSubtotal += lineTotal;

          normalizedItems.push({
            productId: Number.isFinite(productId) && productId > 0 ? productId : null,
            productCode: productCode || null,
            productName,
            unit,
            quantity,
            unitPrice,
            lineTotal,
            note: String(item?.note || "").trim() || null,
          });
        }

        subtotal = Number(recalculatedSubtotal.toFixed(2));
      }

      const totalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));
      if (totalAmount < 0) {
        return res.status(400).json({ message: "Tổng tiền đơn hàng không hợp lệ" });
      }

      await connection.beginTransaction();
      transactionStarted = true;

      await connection.query(
        `
          UPDATE ${ORDERS_TABLE}
          SET
            customer_name = ?,
            customer_phone = ?,
            customer_address = ?,
            subtotal = ?,
            discount_amount = ?,
            tax_amount = ?,
            total_amount = ?,
            status = ?,
            note = ?
          WHERE id = ?
        `,
        [
          customerName || null,
          customerPhone || null,
          customerAddress || null,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          status,
          note || null,
          orderId,
        ]
      );

      if (normalizedItems) {
        await connection.query(`DELETE FROM ${ORDER_ITEMS_TABLE} WHERE order_id = ?`, [orderId]);

        for (const item of normalizedItems) {
          await connection.query(
            `
              INSERT INTO ${ORDER_ITEMS_TABLE} (
                order_id,
                product_id,
                product_code,
                product_name,
                unit,
                quantity,
                unit_price,
                line_total,
                note
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              orderId,
              item.productId,
              item.productCode,
              item.productName,
              item.unit,
              item.quantity,
              item.unitPrice,
              item.lineTotal,
              item.note,
            ]
          );
        }
      }

      const [updatedItemRows] = await connection.query(
        `
          SELECT
            id,
            product_id,
            product_code,
            product_name,
            unit,
            quantity,
            unit_price,
            line_total,
            note,
            created_at,
            updated_at
          FROM ${ORDER_ITEMS_TABLE}
          WHERE order_id = ?
          ORDER BY id ASC
        `,
        [orderId]
      );

      await connection.commit();

      return res.json({
        id: String(orderId),
        orderCode: existingOrder.order_code,
        customerName: customerName || "",
        customerPhone: customerPhone || "",
        customerAddress: customerAddress || "",
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        status,
        note: note || "",
        createdBy: existingOrder.created_by ? String(existingOrder.created_by) : null,
        items: updatedItemRows.map((item) => ({
          id: String(item.id),
          productId: item.product_id ? String(item.product_id) : null,
          productCode: item.product_code || "",
          productName: item.product_name,
          unit: item.unit,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          lineTotal: Number(item.line_total || 0),
          note: item.note || "",
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      });
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback();
      }

      return res.status(500).json({ message: `Không cập nhật được đơn hàng: ${error.message}` });
    } finally {
      await connection.end();
    }
  }
);

ordersRouter.delete(
  "/orders/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res) => {
    const orderId = Number(req.params.id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    try {
      await ensureOrdersTables();

      const connection = await getConnection();

      try {
        const [result] = await connection.query(`DELETE FROM ${ORDERS_TABLE} WHERE id = ?`, [orderId]);

        if (!result.affectedRows) {
          return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        return res.json({ message: "Xóa đơn hàng thành công" });
      } finally {
        await connection.end();
      }
    } catch (error) {
      return res.status(500).json({ message: `Không xóa được đơn hàng: ${error.message}` });
    }
  }
);

app.get("/api/health", async (req, res) => {
  try {
    await checkDatabaseConnection();

    return res.json({
      status: "ok",
      db: {
        status: "connected",
        name: DB_NAME,
      },
    });
  } catch (error) {
    return res.status(503).json({
      status: "degraded",
      db: {
        status: "disconnected",
        name: DB_NAME,
        error: error.code || error.message,
      },
    });
  }
});

app.use("/api", authRouter);
app.use("/api", contactsRouter);
app.use("/api", productsRouter);
app.use("/api", ordersRouter);
app.use(authRouter);

if (POS_DIST_PATH && fs.existsSync(POS_DIST_PATH)) {
  app.use("/pos", express.static(POS_DIST_PATH));

  app.get("/pos/{*path}", (req, res) => {
    res.sendFile(path.join(POS_DIST_PATH, "index.html"));
  });
}

if (fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));

  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
      next();
      return;
    }

    res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
  });
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (ENABLE_DB_INIT) {
      await initDatabase();
      console.log(`MySQL connected. Database \`${DB_NAME}\` is ready.`);
    } else {
      console.log("MySQL init skipped (ENABLE_DB_INIT=false).");
    }

    try {
      await ensureAuthTables();
      await ensureAdminAccount();
      console.log("Auth schema is ready.");
    } catch (error) {
      console.warn(`Auth schema init skipped: ${error.message}`);
    }

    try {
      await ensureOrdersTables();
      console.log("Order schema is ready.");
    } catch (error) {
      console.warn(`Order schema init skipped: ${error.message}`);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
};

startServer();