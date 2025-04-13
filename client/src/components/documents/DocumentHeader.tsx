import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Notification } from '@/components/ui/notification';
import { formatRelativeTime } from '@/lib/time-utils';
import { Check, Copy, Download, Menu, CheckCircle, Table } from 'lucide-react';

interface DocumentHeaderProps {
  documentId: string;
  documentTitle: string;
  lastSaved?: Date;
  onToggleSidebar: () => void;
  onTitleChange: (title: string) => void;
  onFormatTable?: () => void;
}

export function DocumentHeader({
  documentId,
  documentTitle,
  lastSaved,
  onToggleSidebar,
  onTitleChange,
  onFormatTable,
}: DocumentHeaderProps) {
  const [title, setTitle] = useState(documentTitle);
  const [editing, setEditing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setTitle(documentTitle);
  }, [documentTitle]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setEditing(false);
    if (title.trim() === '') {
      setTitle('Untitled Document');
    }
    if (title !== documentTitle) {
      onTitleChange(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    }
  };

  const copyLinkToClipboard = async () => {
    const url = `${window.location.origin}/repldocs/${documentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotificationMessage('Link copied to clipboard');
      setNotificationType('success');
      setShowNotification(true);
    } catch (err) {
      setNotificationMessage('Failed to copy link');
      setNotificationType('error');
      setShowNotification(true);
    }
  };

  const downloadMarkdown = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`);
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setNotificationMessage('Document downloaded as Markdown');
      setNotificationType('success');
      setShowNotification(true);
    } catch (err) {
      setNotificationMessage('Failed to download document');
      setNotificationType('error');
      setShowNotification(true);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 shadow-sm z-10">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleSidebar}
          className="text-gray-600 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {editing ? (
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="ml-2 text-xl font-semibold text-gray-800 bg-transparent border-b border-primary focus:outline-none"
            autoFocus
          />
        ) : (
          <h1 
            className="ml-2 text-xl font-semibold text-gray-800 cursor-pointer hover:text-primary"
            onClick={() => setEditing(true)}
          >
            {title}
          </h1>
        )}
        
        {lastSaved && (
          <span className="ml-2 text-gray-500 text-sm">
            • Last saved {formatRelativeTime(lastSaved)}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center space-x-3">
        {onFormatTable && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onFormatTable} 
            title="Format tables"
            className="flex items-center px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 rounded-md"
          >
            <Table className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Format Tables</span>
          </Button>
        )}
        
        <div className="hidden sm:flex items-center px-3 py-1.5 bg-gray-100 rounded-md">
          <span className="text-sm text-gray-600 truncate max-w-xs">
            {`${window.location.origin}/repldocs/${documentId}`}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={copyLinkToClipboard} 
            className="ml-2 text-primary hover:text-primary-dark p-0 h-auto"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={downloadMarkdown} 
          className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          <Download className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Download</span>
        </Button>
        
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
          <span>U</span>
        </div>
      </div>

      <Notification
        message={notificationMessage}
        open={showNotification}
        variant={notificationType === 'success' ? 'success' : 'error'}
        icon={notificationType === 'success' ? <CheckCircle className="h-4 w-4" /> : undefined}
        onClose={() => setShowNotification(false)}
        autoClose={true}
      />
    </header>
  );
}
