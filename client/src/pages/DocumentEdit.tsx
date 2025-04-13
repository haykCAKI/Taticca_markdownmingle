import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Document, UpdateDocument } from '@shared/schema';
import { useParams } from 'wouter';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { DocumentSidebar } from '@/components/documents/DocumentSidebar';
// EditorToolbar removed as requested
import { DocumentEditor } from '@/components/documents/DocumentEditor';
import { Notification } from '@/components/ui/notification';
import { debounce } from '@/lib/editor-utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader, CheckCircle, WifiOff, Users } from 'lucide-react';

interface DocumentParams {
  id: string;
}

export default function DocumentEdit() {
  const { id } = useParams<DocumentParams>();
  const queryClient = useQueryClient();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [notification, setNotification] = useState<{ message: string; visible: boolean; type: 'success' | 'error' }>({
    message: '',
    visible: false,
    type: 'success'
  });
  
  // WebSocket connection for collaboration
  const { isConnected, clientCount, joinDocument, updateTitle, updateContent } = useWebSocket({
    onOpen: () => {
      if (id) joinDocument(id);
    }
  });

  // Get current document
  const { 
    data: document, 
    isLoading: isDocumentLoading 
  } = useQuery<Document>({
    queryKey: [`/api/documents/${id}`],
    enabled: !!id
  });

  // Get all documents for sidebar
  const { 
    data: documents, 
    isLoading: isDocumentsLoading 
  } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });

  // Update document mutation
  const updateDocument = useMutation({
    mutationFn: async (updateData: { id: string; data: UpdateDocument }) => {
      const response = await apiRequest('PUT', `/api/documents/${updateData.id}`, updateData.data);
      return response.json();
    },
    onSuccess: (updatedDocument: Document) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      setNotification({
        message: 'Document saved successfully',
        visible: true,
        type: 'success'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 3000);
    },
    onError: (error) => {
      setNotification({
        message: 'Failed to save document',
        visible: true,
        type: 'error'
      });
    }
  });

  // Create document mutation
  const createDocument = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('POST', '/api/documents', { 
        title, 
        content: '' 
      });
      return response.json();
    },
    onSuccess: (newDocument: Document) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      window.location.href = `/repldocs/${newDocument.id}`;
    }
  });

  // Handle content change with debounce to avoid too many updates
  const handleContentChange = useCallback(
    debounce((newContent: string) => {
      if (id && document) {
        updateDocument.mutate({
          id,
          data: {
            content: newContent,
            updated_at: new Date()
          }
        });
      }
    }, 1000),
    [id, document]
  );

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    if (id && document) {
      updateDocument.mutate({
        id,
        data: {
          title: newTitle,
          updated_at: new Date()
        }
      });
      
      // Also broadcast title change via WebSocket
      updateTitle(id, newTitle);
    }
  };

  // Handle creating a new document
  const handleCreateDocument = () => {
    createDocument.mutate('Untitled Document');
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Preview mode is kept but toolbar removed
  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  if (isDocumentLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Document not found</h2>
          <p className="text-gray-600 mb-4">The document you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <DocumentHeader
        documentId={id}
        documentTitle={document.title}
        lastSaved={new Date(document.updated_at)}
        onToggleSidebar={toggleSidebar}
        onTitleChange={handleTitleChange}
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          documents={documents || []}
          selectedDocumentId={id}
          onCreateDocument={handleCreateDocument}
          visible={sidebarVisible}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <DocumentEditor
            documentId={id}
            content={document.content}
            onContentChange={handleContentChange}
            isPreviewMode={isPreviewMode}
          />

          <div className="bg-gray-100 border-t border-gray-200 px-4 py-1.5 flex items-center text-sm text-gray-600">
            <div className="flex items-center">
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-red-500 mr-1.5" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
            <div className="mx-3 h-4 border-l border-gray-300"></div>
            <div className="flex items-center">
              <Users className="h-3 w-3 mr-1" />
              <span>{clientCount} {clientCount === 1 ? 'editor' : 'editors'}</span>
            </div>
            <div className="ml-auto">
              <span>Auto-saving</span>
            </div>
          </div>
        </main>
      </div>

      <Notification
        message={notification.message}
        open={notification.visible}
        variant={notification.type}
        icon={notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : undefined}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
