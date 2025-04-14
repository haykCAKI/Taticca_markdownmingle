// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

// server/storage.ts
import duckdb from "duckdb";
import { randomUUID } from "crypto";
var DuckDBStorage = class {
  db;
  dbPath;
  initialized = false;
  currentUserId = 1;
  constructor(dbPath = "data.duckdb") {
    this.dbPath = dbPath;
    this.db = new duckdb.Database(this.dbPath);
    this.initializeDatabase();
  }
  async initializeDatabase() {
    if (this.initialized) return;
    await new Promise((resolve, reject) => {
      console.log("Creating documents table if not exists...");
      this.db.all(
        `CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR PRIMARY KEY,
          title VARCHAR NOT NULL DEFAULT 'Untitled Document',
          content TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
          if (err) {
            console.error("Error creating documents table:", err);
            reject(err);
          } else {
            console.log("Documents table created or already exists");
            resolve();
          }
        }
      );
    });
    await new Promise((resolve, reject) => {
      this.db.all(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          username VARCHAR NOT NULL UNIQUE,
          password VARCHAR NOT NULL
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    this.initialized = true;
  }
  async createDocument(document) {
    await this.initializeDatabase();
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    console.log("Creating document with parameters:", {
      id,
      title: document.title,
      content: document.content,
      created_at: now,
      updated_at: now
    });
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO documents (id, title, content, created_at, updated_at)
         VALUES ('${id}', '${document.title}', '${document.content}', '${now.toISOString()}', '${now.toISOString()}')`,
        (err) => {
          if (err) {
            console.error("Error creating document:", err);
            reject(err);
          } else {
            this.db.all(
              `SELECT id, title, content, created_at, updated_at FROM documents WHERE id = '${id}'`,
              (err2, rows) => {
                if (err2) {
                  console.error("Error retrieving created document:", err2);
                  reject(err2);
                } else if (!rows || rows.length === 0) {
                  console.error("No rows returned after document insertion");
                  reject(new Error("Failed to create document: No rows returned"));
                } else {
                  console.log("Document created successfully:", rows[0]);
                  resolve(rows[0]);
                }
              }
            );
          }
        }
      );
    });
  }
  async getDocument(id) {
    await this.initializeDatabase();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, title, content, created_at, updated_at
         FROM documents
         WHERE id = ?`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }
  async updateDocument(id, updateData) {
    await this.initializeDatabase();
    console.log("Updating document with ID:", id, "Data:", updateData);
    const now = /* @__PURE__ */ new Date();
    let updateQuery = "UPDATE documents SET ";
    const setStatements = [];
    if (updateData.title !== void 0) {
      setStatements.push(`title = '${updateData.title}'`);
    }
    if (updateData.content !== void 0) {
      setStatements.push(`content = '${updateData.content}'`);
    }
    setStatements.push(`updated_at = '${now.toISOString()}'`);
    if (setStatements.length === 0) {
      throw new Error("No fields to update");
    }
    updateQuery += setStatements.join(", ");
    updateQuery += ` WHERE id = '${id}'`;
    return new Promise((resolve, reject) => {
      this.db.run(updateQuery, (err) => {
        if (err) {
          console.error("Error updating document:", err);
          reject(err);
        } else {
          this.db.all(
            `SELECT id, title, content, created_at, updated_at 
             FROM documents 
             WHERE id = '${id}'`,
            (err2, rows) => {
              if (err2) {
                console.error("Error retrieving updated document:", err2);
                reject(err2);
              } else if (!rows || rows.length === 0) {
                console.error("No document found with ID:", id);
                resolve(void 0);
              } else {
                console.log("Document updated successfully:", rows[0]);
                resolve(rows[0]);
              }
            }
          );
        }
      });
    });
  }
  async getAllDocuments() {
    await this.initializeDatabase();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, title, content, created_at, updated_at
         FROM documents
         ORDER BY updated_at DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  async deleteDocument(id) {
    await this.initializeDatabase();
    return new Promise((resolve, reject) => {
      this.db.all(
        `DELETE FROM documents
         WHERE id = ?`,
        [id],
        (err, result) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }
  // User operations from original interface
  async getUser(id) {
    await this.initializeDatabase();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, password
         FROM users
         WHERE id = ?`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }
  async getUserByUsername(username) {
    await this.initializeDatabase();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, password
         FROM users
         WHERE username = ?`,
        [username],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }
  async createUser(insertUser) {
    await this.initializeDatabase();
    const id = this.currentUserId++;
    return new Promise((resolve, reject) => {
      this.db.all(
        `INSERT INTO users (id, username, password)
         VALUES (?, ?, ?)
         RETURNING id, username, password`,
        [id, insertUser.username, insertUser.password],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }
};
var storage = new DuckDBStorage();

// server/routes.ts
import { z as z2 } from "zod";

// shared/schema.ts
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Untitled Document"),
  content: text("content").notNull().default(""),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow()
});
var insertDocumentSchema = createInsertSchema(documents).pick({
  title: true,
  content: true
});
var updateDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  updated_at: z.union([z.string(), z.date()]).optional()
});
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});

// server/routes.ts
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const documentClients = /* @__PURE__ */ new Map();
  wss.on("connection", (ws) => {
    let currentDocumentId = null;
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        switch (data.type) {
          case "JOIN_DOCUMENT" /* JOIN_DOCUMENT */: {
            const documentId = data.documentId;
            const document = await storage.getDocument(documentId);
            if (!document) {
              ws.send(JSON.stringify({
                type: "ERROR" /* ERROR */,
                message: `Document ${documentId} not found`
              }));
              return;
            }
            if (currentDocumentId && documentClients.has(currentDocumentId)) {
              const clients = documentClients.get(currentDocumentId);
              clients.delete(ws);
              broadcastClientCount(currentDocumentId);
            }
            currentDocumentId = documentId;
            if (!documentClients.has(documentId)) {
              documentClients.set(documentId, /* @__PURE__ */ new Set());
            }
            documentClients.get(documentId).add(ws);
            broadcastClientCount(documentId);
            break;
          }
          case "LEAVE_DOCUMENT" /* LEAVE_DOCUMENT */: {
            if (currentDocumentId && documentClients.has(currentDocumentId)) {
              const clients = documentClients.get(currentDocumentId);
              clients.delete(ws);
              broadcastClientCount(currentDocumentId);
              currentDocumentId = null;
            }
            break;
          }
          case "UPDATE_CONTENT" /* UPDATE_CONTENT */: {
            if (!currentDocumentId) return;
            await storage.updateDocument(data.documentId, {
              content: data.content,
              updated_at: /* @__PURE__ */ new Date()
            });
            if (documentClients.has(data.documentId)) {
              const clients = documentClients.get(data.documentId);
              clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: "UPDATE_CONTENT" /* UPDATE_CONTENT */,
                    documentId: data.documentId,
                    content: data.content,
                    cursor: data.cursor
                  }));
                }
              });
            }
            break;
          }
          case "UPDATE_TITLE" /* UPDATE_TITLE */: {
            if (!currentDocumentId) return;
            await storage.updateDocument(data.documentId, {
              title: data.title,
              updated_at: /* @__PURE__ */ new Date()
            });
            if (documentClients.has(data.documentId)) {
              const clients = documentClients.get(data.documentId);
              clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: "UPDATE_TITLE" /* UPDATE_TITLE */,
                    documentId: data.documentId,
                    title: data.title
                  }));
                }
              });
            }
            break;
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({
          type: "ERROR" /* ERROR */,
          message: "Invalid message format"
        }));
      }
    });
    ws.on("close", () => {
      if (currentDocumentId && documentClients.has(currentDocumentId)) {
        const clients = documentClients.get(currentDocumentId);
        clients.delete(ws);
        broadcastClientCount(currentDocumentId);
      }
    });
    function broadcastClientCount(documentId) {
      if (!documentClients.has(documentId)) return;
      const clients = documentClients.get(documentId);
      const count = clients.size;
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "CLIENT_COUNT_UPDATE" /* CLIENT_COUNT_UPDATE */,
            documentId,
            count
          }));
        }
      });
    }
  });
  app2.post("/api/documents", async (req, res) => {
    try {
      console.log("Creating document with data:", req.body);
      const validatedData = insertDocumentSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const document = await storage.createDocument(validatedData);
      console.log("Document created:", document);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        console.error("Error details:", error);
        res.status(500).json({ message: "Failed to create document", error: String(error) });
      }
    }
  });
  app2.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve document" });
    }
  });
  app2.put("/api/documents/:id", async (req, res) => {
    try {
      const validatedData = updateDocumentSchema.parse(req.body);
      const document = await storage.updateDocument(req.params.id, validatedData);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update document" });
      }
    }
  });
  app2.get("/api/documents", async (_req, res) => {
    try {
      const documents2 = await storage.getAllDocuments();
      res.json(documents2);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve documents" });
    }
  });
  app2.delete("/api/documents/:id", async (req, res) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });
  app2.get("/api/documents/:id/download", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const filename = `${document.title.replace(/\s+/g, "_")}.md`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/markdown");
      res.send(document.content);
    } catch (error) {
      res.status(500).json({ message: "Failed to download document" });
    }
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
