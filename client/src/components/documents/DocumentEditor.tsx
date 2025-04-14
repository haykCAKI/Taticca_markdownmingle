import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useYjsEditor } from '@/hooks/useYjsEditor';
import { formatMarkdown, configureMonacoForMarkdown, debounce, formatMarkdownTable } from '@/lib/editor-utils';
import { MessageType } from '@shared/websocket-types';
import { Loader } from 'lucide-react';

interface DocumentEditorProps {
  documentId: string;
  content: string;
  onContentChange: (content: string) => void;
  isPreviewMode: boolean;
}

export interface DocumentEditorRef {
  getEditor: () => any;
  formatTable: () => void;
}

export const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(({
  documentId,
  content,
  onContentChange,
  isPreviewMode
}, ref) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  
  // Legacy WebSocket for client count and basic features
  const { isConnected: isWSConnected, clientCount, joinDocument, updateContent } = useWebSocket({
    onOpen: () => {
      joinDocument(documentId);
    }
  });
  
  // Yjs CRDT reference for real-time collaboration
  const yjsRef = useRef<any>(null);
  
  // Initialize Yjs CRDT after editor is ready
  useEffect(() => {
    if (editorRef.current && isEditorReady) {
      // Set up Yjs integration
      yjsRef.current = useYjsEditor({
        documentId,
        editor: editorRef.current,
        initialContent: content
      });
    }
  }, [documentId, content, isEditorReady]);
  
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
          useShadows: true
        }
      });
      
      // Add event listener for content changes when not using CRDT
      editorRef.current.onDidChangeModelContent(debounce(() => {
        const newContent = editorRef.current.getValue();
        setLocalContent(newContent);
        onContentChange(newContent);
        // No need to call updateContent here - CRDT will handle real-time sync
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

  // Auto-format tables when user types a table row ending
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const editor = editorRef.current;
      
      // Add keyboard event listener for table formatting
      editor.onKeyUp((e: any) => {
        // When user finishes typing a table row (Enter after |)
        if (e.keyCode === 13) { // Enter key
          const model = editor.getModel();
          const position = editor.getPosition();
          const lineContent = model.getLineContent(position.lineNumber - 1);
          
          // Check if the previous line ends with a pipe character (table row)
          if (lineContent.trim().endsWith('|')) {
            // Get the full document content
            const content = model.getValue();
            
            // Try to detect a table in the content
            const tableRegex = /^\|(.+)\|\s*\n\|([-:| ]+)\|\s*\n(\|.+\|\s*\n)+/gm;
            let match;
            let potentialTable = '';
            
            // Iterate through all tables in the document
            while ((match = tableRegex.exec(content)) !== null) {
              // Get the table text
              const tableText = match[0];
              // Get the table end position
              const tableEnd = match.index + tableText.length;
              // Get the cursor position in the document
              const cursorPosition = model.getOffsetAt(position);
              
              // If cursor is inside or right after a table
              if (match.index <= cursorPosition && cursorPosition <= tableEnd + 1) {
                potentialTable = tableText;
                
                // Format the table
                const formattedTable = formatMarkdownTable(potentialTable);
                
                // Calculate the start position of the table
                const startPos = model.getPositionAt(match.index);
                // Calculate the end position of the table
                const endPos = model.getPositionAt(tableEnd);
                
                // Replace the table with formatted version
                editor.executeEdits('auto-format-table', [{
                  range: {
                    startLineNumber: startPos.lineNumber,
                    startColumn: startPos.column,
                    endLineNumber: endPos.lineNumber,
                    endColumn: endPos.column
                  },
                  text: formattedTable,
                  forceMoveMarkers: true
                }]);
                
                break;
              }
            }
          }
        }
      });
    }
  }, [isEditorReady]);
  
  // Handle formatting via external toolbar
  const handleFormat = (type: string) => {
    if (editorRef.current && monacoRef.current) {
      formatMarkdown(editorRef.current, type);
    }
  };
  
  // Table formatting function
  const formatTable = () => {
    if (editorRef.current && monacoRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      const content = model.getValue();
      
      // Use regex to find tables in the content
      const tableRegex = /^\|(.+)\|\s*\n\|([-:| ]+)\|\s*\n(\|.+\|\s*\n)+/gm;
      let match;
      let formattedContent = content;
      let offset = 0;
      
      // Format all tables in the document
      while ((match = tableRegex.exec(content)) !== null) {
        const tableText = match[0];
        const formattedTable = formatMarkdownTable(tableText);
        
        // Replace the table with the formatted version
        formattedContent = 
          formattedContent.substring(0, match.index + offset) + 
          formattedTable + 
          formattedContent.substring(match.index + offset + tableText.length);
        
        offset += formattedTable.length - tableText.length;
      }
      
      // Update the editor content if changes were made
      if (formattedContent !== content) {
        editor.setValue(formattedContent);
        onContentChange(formattedContent);
      }
    }
  };
  
  // Expose editor and formatting functions to parent
  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    formatTable
  }));
  
  // Render markdown preview or editor
  if (isPreviewMode) {
    // Show markdown preview with enhanced tables and styling
    return (
      <div className="h-full overflow-auto p-4 prose prose-sm max-w-none bg-white">
        <div className="markdown-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(localContent) }} />
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
});

// Simple markdown renderer with enhanced table support
function renderMarkdown(markdown: string): string {
  // Process tables first (before other replacements)
  let html = processMarkdownTables(markdown);
  
  // Then process other markdown elements
  html = html
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gm, '<em>$1</em>')
    .replace(/\n/gm, '<br />');
    
  return html;
}

// Function to specifically handle and enhance table rendering
function processMarkdownTables(markdown: string): string {
  // Regex to detect GitHub-flavored markdown tables
  const tableRegex = /^\|(.+)\|\s*\n\|([-:| ]+)\|\s*\n(\|.+\|\s*\n)+/gm;
  
  return markdown.replace(tableRegex, (tableMatch) => {
    // Split the table into rows
    const rows = tableMatch.trim().split('\n');
    
    // Process header row
    const headerRow = rows[0];
    const headerCells = headerRow
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => `<th>${cell.trim()}</th>`)
      .join('');
    
    // Process alignment row
    const alignRow = rows[1];
    const alignments = alignRow
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => {
        const trimmedCell = cell.trim();
        if (trimmedCell.startsWith(':') && trimmedCell.endsWith(':')) {
          return 'md-align-center';
        } else if (trimmedCell.endsWith(':')) {
          return 'md-align-right';
        } else {
          return 'md-align-left';
        }
      });
    
    // Process content rows
    const contentRows = rows.slice(2).map(row => {
      const cells = row
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map((cell, index) => {
          const alignment = alignments[index] || 'md-align-left';
          return `<td class="${alignment}">${cell.trim()}</td>`;
        })
        .join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');
    
    // Return the full HTML table with responsive layout
    return `<div class="md-table-wrapper">
              <table class="md-table">
                <thead>
                  <tr>${headerCells}</tr>
                </thead>
                <tbody>
                  ${contentRows}
                </tbody>
              </table>
            </div>`;
  });
}
