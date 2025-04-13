import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageType, WebSocketMessage } from '@shared/websocket-types';

interface UseWebSocketOptions {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onMessage?: (data: WebSocketMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [clientCount, setClientCount] = useState(1);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // Close existing socket if it exists
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      if (options.onOpen) options.onOpen();
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (options.onClose) options.onClose();
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (event) => {
      if (options.onError) options.onError(event);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        
        // Handle client count updates
        if (data.type === MessageType.CLIENT_COUNT_UPDATE) {
          setClientCount(data.count);
        }
        
        if (options.onMessage) options.onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }, [options]);

  const joinDocument = useCallback((documentId: string) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      connect();
      // Wait for connection before sending join message
      setTimeout(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: MessageType.JOIN_DOCUMENT,
            documentId
          }));
        }
      }, 500);
    } else {
      socketRef.current.send(JSON.stringify({
        type: MessageType.JOIN_DOCUMENT,
        documentId
      }));
    }
  }, [connect]);

  const leaveDocument = useCallback((documentId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: MessageType.LEAVE_DOCUMENT,
        documentId
      }));
    }
  }, []);

  const updateContent = useCallback((documentId: string, content: string, cursor?: { line: number; column: number }) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: MessageType.UPDATE_CONTENT,
        documentId,
        content,
        cursor
      }));
    }
  }, []);

  const updateTitle = useCallback((documentId: string, title: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: MessageType.UPDATE_TITLE,
        documentId,
        title
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    clientCount,
    joinDocument,
    leaveDocument,
    updateContent,
    updateTitle
  };
}
