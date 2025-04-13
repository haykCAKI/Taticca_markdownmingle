export function formatMarkdown(editor: any, type: string): void {
  if (!editor) return;
  
  const selection = editor.getSelection();
  const selectedText = editor.getModel().getValueInRange(selection);
  let newText = '';
  let newPosition = selection;
  
  switch (type) {
    case 'bold':
      newText = `**${selectedText}**`;
      break;
    case 'italic':
      newText = `*${selectedText}*`;
      break;
    case 'heading':
      newText = `# ${selectedText}`;
      break;
    case 'link':
      newText = `[${selectedText}](url)`;
      break;
    case 'image':
      newText = `![${selectedText}](image-url)`;
      break;
    case 'code':
      newText = `\`\`\`\n${selectedText}\n\`\`\``;
      break;
    case 'bulletList':
      // Split text into lines and prefix each with "- "
      newText = selectedText
        .split('\n')
        .map(line => `- ${line}`)
        .join('\n');
      break;
    case 'numberedList':
      // Split text into lines and prefix each with a number
      newText = selectedText
        .split('\n')
        .map((line, i) => `${i + 1}. ${line}`)
        .join('\n');
      break;
    default:
      return;
  }
  
  // Replace the current selection with the formatted text
  editor.executeEdits('markdown-formatting', [{
    range: selection,
    text: newText,
    forceMoveMarkers: true
  }]);
  
  // Set focus back to the editor
  editor.focus();
}

// Configure Monaco Editor with Markdown syntax highlighting
export function configureMonacoForMarkdown(monaco: any): void {
  // Define a custom theme with similar colors to VS Code
  monaco.editor.defineTheme('markdownTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955' },
      { token: 'keyword', foreground: '569cd6' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'operator', foreground: 'd4d4d4' },
      { token: 'variable', foreground: '9cdcfe' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'identifier', foreground: 'd4d4d4' },
      
      // Markdown specific tokens
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'keyword.md', foreground: '569cd6' }, // Headers
      { token: 'string.link.md', foreground: '4ec9b0' }, // Links
      { token: 'variable.md', foreground: 'ce9178' }, // Bold text
      { token: 'comment.md', foreground: '6a9955' }, // Lists
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorCursor.foreground': '#d4d4d4',
      'editor.lineHighlightBackground': '#2d2d2d',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
    }
  });
  
  // Set default editor configuration for Markdown
  monaco.editor.getModels().forEach((model: any) => {
    if (model.getLanguageId() === 'markdown') {
      monaco.editor.setModelLanguage(model, 'markdown');
    }
  });
}

// Helper to debounce function calls, used for auto-saving
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function (...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
