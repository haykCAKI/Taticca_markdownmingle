import duckdb from 'duckdb';
import { randomUUID } from 'crypto';
import { 
  documents, 
  Document, 
  InsertDocument, 
  UpdateDocument,
  users,
  User,
  InsertUser
} from '@shared/schema';

// Interface for storage operations
export interface IStorage {
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  updateDocument(id: string, updateData: UpdateDocument): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  deleteDocument(id: string): Promise<boolean>;
  
  // User operations from original interface
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// DuckDB implementation of the storage interface
export class DuckDBStorage implements IStorage {
  private db: any;
  private dbPath: string;
  private initialized: boolean = false;
  private currentUserId: number = 1;

  constructor(dbPath: string = 'data.duckdb') {
    this.dbPath = dbPath;
    this.db = new duckdb.Database(this.dbPath);
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    if (this.initialized) return;

    await new Promise<void>((resolve, reject) => {
      console.log("Creating documents table if not exists...");
      this.db.all(
        `CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR PRIMARY KEY,
          title VARCHAR NOT NULL DEFAULT 'Untitled Document',
          content TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        (err: Error | null) => {
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

    await new Promise<void>((resolve, reject) => {
      this.db.all(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          username VARCHAR NOT NULL UNIQUE,
          password VARCHAR NOT NULL
        )`,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    this.initialized = true;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    await this.initializeDatabase();
    
    const id = randomUUID();
    const now = new Date();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `INSERT INTO documents (id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, title, content, created_at, updated_at`,
        [id, document.title, document.content, now, now],
        (err: Error | null, rows: any[]) => {
          if (err) {
            console.error("Error creating document:", err);
            reject(err);
          } else {
            if (!rows || rows.length === 0) {
              console.error("No rows returned after document insertion");
              reject(new Error("Failed to create document: No rows returned"));
            } else {
              resolve(rows[0] as Document);
            }
          }
        }
      );
    });
  }

  async getDocument(id: string): Promise<Document | undefined> {
    await this.initializeDatabase();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, title, content, created_at, updated_at
         FROM documents
         WHERE id = ?`,
        [id],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0] as Document | undefined);
        }
      );
    });
  }

  async updateDocument(id: string, updateData: UpdateDocument): Promise<Document | undefined> {
    await this.initializeDatabase();
    
    const now = new Date();
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updateData.title !== undefined) {
      setClauses.push('title = ?');
      values.push(updateData.title);
    }
    
    if (updateData.content !== undefined) {
      setClauses.push('content = ?');
      values.push(updateData.content);
    }
    
    // Always update the updated_at timestamp
    setClauses.push('updated_at = ?');
    values.push(now);
    
    // Add the id as the last parameter
    values.push(id);
    
    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `UPDATE documents
         SET ${setClauses.join(', ')}
         WHERE id = ?
         RETURNING id, title, content, created_at, updated_at`,
        values,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0] as Document | undefined);
        }
      );
    });
  }

  async getAllDocuments(): Promise<Document[]> {
    await this.initializeDatabase();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, title, content, created_at, updated_at
         FROM documents
         ORDER BY updated_at DESC`,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows as Document[]);
        }
      );
    });
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.initializeDatabase();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `DELETE FROM documents
         WHERE id = ?`,
        [id],
        (err: Error | null, result: any) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  // User operations from original interface
  async getUser(id: number): Promise<User | undefined> {
    await this.initializeDatabase();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, password
         FROM users
         WHERE id = ?`,
        [id],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0] as User | undefined);
        }
      );
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.initializeDatabase();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, password
         FROM users
         WHERE username = ?`,
        [username],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0] as User | undefined);
        }
      );
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.initializeDatabase();
    
    const id = this.currentUserId++;
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `INSERT INTO users (id, username, password)
         VALUES (?, ?, ?)
         RETURNING id, username, password`,
        [id, insertUser.username, insertUser.password],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0] as User);
        }
      );
    });
  }
}

// Create and export a storage instance
export const storage = new DuckDBStorage();
