import React, { useRef, useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatMarkdown, configureMonacoForMarkdown, debounce } from '@/lib/editor-utils';
import { MessageType } from '@shared/websocket-types';
import { Loader } from 'lucide-react';

interface DocumentEditorProps {
  documentId: string;
  content: string;
  onContentChange: (content: string) => void;
  isPreviewMode: boolean;
}

export function DocumentEditor({
  documentId,
  content,
  onContentChange,
  isPreviewMode
}: DocumentEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  
  // Configure WebSocket for real-time collaboration
  const { isConnected, clientCount, joinDocument, updateContent } = useWebSocket({
    onOpen: () => {
      joinDocument(documentId);
    },
    onMessage: (data) => {
      if (data.type === MessageType.UPDATE_CONTENT && data.documentId === documentId) {
        // Only update content if it's from another client
        setLocalContent(data.content);
        
        if (editorRef.current) {
          const position = editorRef.current.getPosition();
          editorRef.current.getModel().setValue(data.content);
          editorRef.current.setPosition(position);
        }
      }
    }
  });
  
  // Initialize Monaco Editor
  useEffect(() => {
    let cancelMonacoLoad = false;
    
    async function loadMonaco() {
      if (cancelMonacoLoad) return;
      
      const monaco = await import('monaco-editor');
      monacoRef.current = monaco;
      
      if (!editorContainerRef.current || cancelMonacoLoad) return;
      
      // Configure Monaco for Markdown
      configureMonacoForMarkdown(monaco);
      
      // Create editor instance
      editorRef.current = monaco.editor.create(editorContainerRef.current, {
        value: content,
        language: 'markdown',
        theme: 'markdownTheme',
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        renderLineHighlight: 'line',
        renderWhitespace: 'selection',
        tabSize: 2,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          verticalHasArrows: false,
          horizontalHasArrows: false,
          vertical: 'auto',
          horizontal: 'auto',
          useShadows: true,
          verticalScrollbarLeft: 0,
          horizontalScrollbarTop: 0,
        }
      });
      
      // Add event listener for content changes
      editorRef.current.onDidChangeModelContent(debounce(() => {
        const newContent = editorRef.current.getValue();
        setLocalContent(newContent);
        onContentChange(newContent);
        updateContent(documentId, newContent);
      }, 500));
      
      setIsEditorReady(true);
    }
    
    loadMonaco();
    
    return () => {
      cancelMonacoLoad = true;
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);
  
  // Update editor content when prop changes and it's not from local editing
  useEffect(() => {
    if (editorRef.current && content !== localContent) {
      const position = editorRef.current.getPosition();
      editorRef.current.getModel().setValue(content);
      editorRef.current.setPosition(position);
      setLocalContent(content);
    }
  }, [content]);
  
  // Handle formatting via external toolbar
  const handleFormat = (type: string) => {
    if (editorRef.current && monacoRef.current) {
      formatMarkdown(editorRef.current, type);
    }
  };
  
  // Expose formatting function to parent
  React.useImperativeHandle(
    React.createRef(),
    () => ({
      formatMarkdown: handleFormat
    })
  );
  
  // Render markdown preview or editor
  if (isPreviewMode) {
    // Use a markdown preview component here
    return (
      <div className="h-full overflow-auto p-4 markdown-preview prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(localContent) }} />
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-hidden">
      {!isEditorReady && (
        <div className="h-full flex items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div
        ref={editorContainerRef}
        className="h-full font-mono bg-editor-bg editor-scrollbar"
        style={{ display: isEditorReady ? 'block' : 'none' }}
      />
    </div>
  );
}

// Simple markdown renderer (in a real app, use a proper markdown library)
function renderMarkdown(markdown: string): string {
  // This is a very simplified implementation
  // In a real app, use a library like marked or remark
  let html = markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gm, '<em>$1</em>')
    .replace(/\n/gm, '<br />');
    
  return html;
}
