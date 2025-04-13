import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { updateDocumentSchema, insertDocumentSchema } from "@shared/schema";
import { MessageType, WebSocketMessage } from "@shared/websocket-types";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time collaboration
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Map to track document clients
  const documentClients = new Map<string, Set<WebSocket>>();
  
  wss.on('connection', (ws) => {
    let currentDocumentId: string | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage;
        
        switch (data.type) {
          case MessageType.JOIN_DOCUMENT: {
            // Check if the document exists
            const documentId = data.documentId;
            const document = await storage.getDocument(documentId);
            
            if (!document) {
              ws.send(JSON.stringify({
                type: MessageType.ERROR,
                message: `Document ${documentId} not found`
              }));
              return;
            }
            
            // Leave the current document if any
            if (currentDocumentId && documentClients.has(currentDocumentId)) {
              const clients = documentClients.get(currentDocumentId)!;
              clients.delete(ws);
              
              // Broadcast updated count to remaining clients
              broadcastClientCount(currentDocumentId);
            }
            
            // Join the new document
            currentDocumentId = documentId;
            
            if (!documentClients.has(documentId)) {
              documentClients.set(documentId, new Set());
            }
            
            documentClients.get(documentId)!.add(ws);
            
            // Broadcast updated count to all clients
            broadcastClientCount(documentId);
            break;
          }
          
          case MessageType.LEAVE_DOCUMENT: {
            if (currentDocumentId && documentClients.has(currentDocumentId)) {
              const clients = documentClients.get(currentDocumentId)!;
              clients.delete(ws);
              
              // Broadcast updated count to remaining clients
              broadcastClientCount(currentDocumentId);
              currentDocumentId = null;
            }
            break;
          }
          
          case MessageType.UPDATE_CONTENT: {
            if (!currentDocumentId) return;
            
            // Update content in the database
            await storage.updateDocument(data.documentId, {
              content: data.content,
              updated_at: new Date()
            });
            
            // Broadcast to all other clients
            if (documentClients.has(data.documentId)) {
              const clients = documentClients.get(data.documentId)!;
              
              clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: MessageType.UPDATE_CONTENT,
                    documentId: data.documentId,
                    content: data.content,
                    cursor: data.cursor
                  }));
                }
              });
            }
            break;
          }
          
          case MessageType.UPDATE_TITLE: {
            if (!currentDocumentId) return;
            
            // Update title in the database
            await storage.updateDocument(data.documentId, {
              title: data.title,
              updated_at: new Date()
            });
            
            // Broadcast to all other clients
            if (documentClients.has(data.documentId)) {
              const clients = documentClients.get(data.documentId)!;
              
              clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: MessageType.UPDATE_TITLE,
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
          type: MessageType.ERROR,
          message: "Invalid message format"
        }));
      }
    });
    
    ws.on('close', () => {
      // Clean up when a client disconnects
      if (currentDocumentId && documentClients.has(currentDocumentId)) {
        const clients = documentClients.get(currentDocumentId)!;
        clients.delete(ws);
        
        // Broadcast updated count to remaining clients
        broadcastClientCount(currentDocumentId);
      }
    });
    
    // Helper function to broadcast client count
    function broadcastClientCount(documentId: string) {
      if (!documentClients.has(documentId)) return;
      
      const clients = documentClients.get(documentId)!;
      const count = clients.size;
      
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: MessageType.CLIENT_COUNT_UPDATE,
            documentId,
            count
          }));
        }
      });
    }
  });

  // API routes
  // Create a new document
  app.post('/api/documents', async (req: Request, res: Response) => {
    try {
      console.log("Creating document with data:", req.body);
      const validatedData = insertDocumentSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const document = await storage.createDocument(validatedData);
      console.log("Document created:", document);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        console.error("Error details:", error);
      res.status(500).json({ message: 'Failed to create document', error: String(error) });
      }
    }
  });

  // Get a document by ID
  app.get('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve document' });
    }
  });

  // Update a document
  app.put('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateDocumentSchema.parse(req.body);
      const document = await storage.updateDocument(req.params.id, validatedData);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update document' });
      }
    }
  });

  // Get all documents
  app.get('/api/documents', async (_req: Request, res: Response) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve documents' });
    }
  });

  // Delete a document
  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });

  // Download a document as markdown
  app.get('/api/documents/:id/download', async (req: Request, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const filename = `${document.title.replace(/\s+/g, '_')}.md`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/markdown');
      res.send(document.content);
    } catch (error) {
      res.status(500).json({ message: 'Failed to download document' });
    }
  });

  return httpServer;
}
