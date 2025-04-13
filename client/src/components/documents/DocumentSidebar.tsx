import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatRelativeTime } from '@/lib/time-utils';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Document } from '@shared/schema';
import { Link } from 'wouter';

interface DocumentSidebarProps {
  documents: Document[];
  selectedDocumentId?: string;
  onCreateDocument: () => void;
  onDeleteDocument?: (id: string) => void;
  visible: boolean;
}

export function DocumentSidebar({
  documents,
  selectedDocumentId,
  onCreateDocument,
  onDeleteDocument,
  visible
}: DocumentSidebarProps) {
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const sidebarClass = visible
    ? "w-64 bg-white border-r border-gray-200 pt-4 transition-all duration-300"
    : "hidden lg:block w-64 bg-white border-r border-gray-200 pt-4 transition-all duration-300";
  
  return (
    <aside id="sidebar" className={sidebarClass}>
      <div className="px-4 mb-4">
        <Button 
          className="w-full flex items-center justify-center"
          onClick={onCreateDocument}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Document
        </Button>
      </div>
      
      <div className="px-4 mb-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Documents</h2>
      </div>
      
      <Separator className="mb-2" />
      
      <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
        {documents.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
            No documents yet. Create one to get started.
          </div>
        ) : (
          documents.map((doc) => (
            <Link key={doc.id} href={`/repldocs/${doc.id}`}>
              <div 
                className={`document-item px-4 py-2 hover:bg-gray-100 cursor-pointer border-l-2 ${
                  doc.id === selectedDocumentId 
                    ? 'border-primary bg-blue-50' 
                    : 'border-transparent'
                } transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {doc.title || 'Untitled Document'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {doc.id === selectedDocumentId
                        ? 'Editing now'
                        : `Last edited ${formatRelativeTime(doc.updated_at)}`}
                    </p>
                  </div>
                  {documentToDelete === doc.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onDeleteDocument) {
                            onDeleteDocument(doc.id);
                            setDocumentToDelete(null);
                          }
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDocumentToDelete(null);
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-400 hover:text-red-600 h-6 w-6"
                      onClick={(e) => {
                        e.preventDefault(); 
                        e.stopPropagation();
                        setDocumentToDelete(doc.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}
