import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Heading, 
  List, 
  ListOrdered, 
  Code, 
  Link, 
  Image, 
  Eye
} from 'lucide-react';

interface EditorToolbarProps {
  onFormat: (formatType: string) => void;
  isPreviewMode: boolean;
  onTogglePreview: () => void;
}

export function EditorToolbar({ onFormat, isPreviewMode, onTogglePreview }: EditorToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-1 flex items-center space-x-1">
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('heading')}
        title="Heading"
      >
        <Heading className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('bulletList')}
        title="Bulleted List"
      >
        <List className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('numberedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('code')}
        title="Code Block"
      >
        <Code className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('link')}
        title="Link (Ctrl+K)"
      >
        <Link className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        onClick={() => onFormat('image')}
        title="Image"
      >
        <Image className="h-4 w-4" />
      </Button>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      <div className="flex items-center ml-auto">
        <span className="text-sm text-gray-500 mr-2">
          {isPreviewMode ? 'Preview' : 'Editing'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          onClick={onTogglePreview}
          title="Toggle Preview"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
