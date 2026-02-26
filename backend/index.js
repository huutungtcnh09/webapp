const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
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
};

const DB_NAME = process.env.MYSQL_DATABASE || "webapp_db";
const ENABLE_DB_INIT = process.env.ENABLE_DB_INIT === "true";
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@webapp.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const FRONTEND_DIST_PATH = path.resolve(__dirname, "../frontend/dist");

const initDatabase = async () => {
  const connection = await mysql.createConnection(DB_CONFIG);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.query(`USE \`${DB_NAME}\``);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(20),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await connection.end();
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Thiếu token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

const authRouter = express.Router();

authRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu" });
  }

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
  return res.json({
    message: "Đăng nhập thành công",
    token,
    user: { email },
  });
});

authRouter.get("/auth/me", authenticateToken, (req, res) => {
  return res.json({
    message: "Token hợp lệ",
    user: { email: req.user.email },
  });
});

app.use("/api", authRouter);
app.use(authRouter);

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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
