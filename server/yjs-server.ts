import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import { Server, IncomingMessage } from 'http';
import { storage } from './storage';

// In-memory document store for Yjs documents
const docs = new Map<string, Y.Doc>();

// Simple file-based persistence for Yjs
const STORAGE_DIR = './yjs-data';

// Create storage directory if it doesn't exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR);
}

// WebSocket data handler
interface WSSharedDoc {
  doc: Y.Doc;
  name: string;
  clients: Set<WebSocket>;
  awareness: Map<number, any>;
}

const wsSharedDocs = new Map<string, WSSharedDoc>();

function getSharedDoc(docName: string): WSSharedDoc {
  let sharedDoc = wsSharedDocs.get(docName);
  
  if (!sharedDoc) {
    const doc = new Y.Doc();
    sharedDoc = {
      doc,
      name: docName,
      clients: new Set(),
      awareness: new Map()
    };
    wsSharedDocs.set(docName, sharedDoc);
    
    // Load document from file if it exists
    const storagePath = path.join(STORAGE_DIR, `${docName}.yjs`);
    if (fs.existsSync(storagePath)) {
      try {
        const content = fs.readFileSync(storagePath);
        const update = new Uint8Array(content);
        Y.applyUpdate(doc, update);
        console.log(`Loaded document '${docName}' from storage`);
      } catch (err) {
        console.error(`Error loading document '${docName}':`, err);
      }
    }
    
    // Handle document updates for persistence
    doc.on('update', (update: Uint8Array) => {
      // Save document state
      const storagePath = path.join(STORAGE_DIR, `${docName}.yjs`);
      try {
        // Save Yjs document
        const state = Y.encodeStateAsUpdate(doc);
        fs.writeFileSync(storagePath, state);
        
        // Also sync to our main storage
        const content = doc.getText('content').toString();
        
        // Update the content in the main database
        storage.getDocument(docName).then(document => {
          if (document && document.content !== content) {
            storage.updateDocument(docName, {
              content,
              updated_at: new Date()
            });
          }
        }).catch(err => {
          console.error('Error syncing document to main database:', err);
        });
      } catch (err) {
        console.error(`Error saving document '${docName}':`, err);
      }
    });
  }
  
  return sharedDoc;
}

// Initialize y-websocket server
export function setupYjsWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/yjs' });
  
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract documentId from URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const docName = url.searchParams.get('documentId');
    
    if (!docName) {
      ws.close();
      return;
    }
    
    // Get or create document
    const sharedDoc = getSharedDoc(docName);
    sharedDoc.clients.add(ws);
    
    // Set up client message handler
    ws.on('message', (message: Buffer) => {
      try {
        // Handle message
        if (message.toString().startsWith('{"type":"sync"')) {
          // Handle sync message - send current state to client
          const state = Y.encodeStateAsUpdate(sharedDoc.doc);
          ws.send(state);
        } else {
          // Handle update message - apply update to document
          const update = new Uint8Array(message);
          Y.applyUpdate(sharedDoc.doc, update);
          
          // Broadcast update to all other clients
          sharedDoc.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      } catch (err) {
        console.error('Error handling Yjs message:', err);
      }
    });
    
    // Send initial state to client
    try {
      const state = Y.encodeStateAsUpdate(sharedDoc.doc);
      ws.send(state);
    } catch (err) {
      console.error('Error sending initial state:', err);
    }
    
    // Clean up when client disconnects
    ws.on('close', () => {
      sharedDoc.clients.delete(ws);
      
      // If no clients remain, we could potentially cleanup
      if (sharedDoc.clients.size === 0) {
        // For now, we keep the document in memory
        // In a production app, you might want to close/cleanup after some time
      }
    });
  });
  
  console.log('Yjs WebSocket server set up successfully');
}