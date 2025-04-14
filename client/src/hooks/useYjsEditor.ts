import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

// Custom WebSocket provider for Yjs since we can't use the standard one
class SimpleWebSocketProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private url: string;
  private connected: boolean = false;
  private callbacks: { [key: string]: Function[] } = {
    'status': [],
    'sync': [],
    'update': []
  };
  
  constructor(url: string, docName: string, doc: Y.Doc) {
    this.doc = doc;
    this.url = `${url}?documentId=${docName}`;
    this.connect();
  }
  
  get isConnected() {
    return this.connected;
  }
  
  private connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.connected = true;
        this.callbacks['status'].forEach(cb => cb(true));
        
        // Sync request to get initial state
        this.sendSync();
      };
      
      this.ws.onclose = () => {
        this.connected = false;
        this.callbacks['status'].forEach(cb => cb(false));
        
        // Retry connection after delay
        setTimeout(() => this.connect(), 3000);
      };
      
      this.ws.onmessage = (event) => {
        try {
          // Handle incoming message
          if (typeof event.data === 'string' && event.data.startsWith('{')) {
            // Handle JSON message (likely awareness or metadata)
            const data = JSON.parse(event.data);
            this.callbacks['sync'].forEach(cb => cb(data));
          } else {
            // Handle binary message (Yjs update)
            const update = new Uint8Array(event.data);
            Y.applyUpdate(this.doc, update);
            this.callbacks['update'].forEach(cb => cb(update));
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };
      
      // Subscribe to Yjs document updates
      this.doc.on('update', (update: Uint8Array) => {
        if (this.ws && this.connected) {
          // Send update to server
          this.ws.send(update);
        }
      });
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.connected = false;
      setTimeout(() => this.connect(), 3000);
    }
  }
  
  private sendSync() {
    if (this.ws && this.connected) {
      const syncMsg = JSON.stringify({ type: 'sync' });
      this.ws.send(syncMsg);
    }
  }
  
  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }
  
  off(event: string, callback: Function) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }
  
  destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Clear all callbacks
    Object.keys(this.callbacks).forEach(key => {
      this.callbacks[key] = [];
    });
  }
}

// This hook sets up Yjs with Monaco editor for real-time collaboration
export function useYjsEditor({
  documentId,
  editor,
  initialContent,
  username = 'Anonymous'
}: {
  documentId: string;
  editor: any;
  initialContent: string;
  username?: string;
}) {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SimpleWebSocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Set up Yjs CRDT and WebSocket connection
  useEffect(() => {
    if (!editor || !documentId) return;
    
    // Clean up previous document if it exists
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    
    if (docRef.current) {
      docRef.current.destroy();
      docRef.current = null;
    }
    
    // Create a new Y.Doc
    const doc = new Y.Doc();
    docRef.current = doc;
    
    // Set up text type for the document content
    const yText = doc.getText('content');
    
    // Initialize with current content
    if (initialContent && yText.toString() === '') {
      yText.insert(0, initialContent);
    }
    
    // Determine WebSocket protocol based on current connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/yjs`;
    
    // Set up WebSocket provider
    const provider = new SimpleWebSocketProvider(wsUrl, documentId, doc);
    providerRef.current = provider;
    
    // Update connection status
    provider.on('status', (connected: boolean) => {
      setIsConnected(connected);
    });
    
    // Create a binding between the Yjs document and Monaco editor
    try {
      const binding = new MonacoBinding(
        yText,
        editor.getModel(),
        new Set([editor])
      );
      bindingRef.current = binding;
    } catch (error) {
      console.error('Error creating Monaco binding:', error);
    }
    
    // Clean up on unmount
    return () => {
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (error) {
          console.error('Error destroying Monaco binding:', error);
        }
        bindingRef.current = null;
      }
      
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
    };
  }, [documentId, editor, initialContent, username]);
  
  return {
    isConnected,
    isActive: !!bindingRef.current,
    doc: docRef.current
  };
}