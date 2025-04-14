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
        .map((line: string) => `- ${line}`)
        .join('\n');
      break;
    case 'numberedList':
      // Split text into lines and prefix each with a number
      newText = selectedText
        .split('\n')
        .map((line: string, i: number) => `${i + 1}. ${line}`)
        .join('\n');
      break;
    case 'table':
      // Create or format a markdown table
      newText = formatMarkdownTable(selectedText);
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

/**
 * Formats a markdown table with proper spacing
 * If the selection is not already a table, it creates a sample table
 */
export function formatMarkdownTable(text: string): string {
  // Check if the text is already a table
  const tableRegex = /^\|(.+)\|\s*\n\|([-:| ]+)\|\s*\n(\|.+\|\s*\n)+/m;
  
  if (tableRegex.test(text)) {
    // Format existing table
    return formatExistingTable(text);
  } else {
    // Create a new sample table
    return `| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |`;
  }
}

/**
 * Formats an existing markdown table with proper spacing
 */
function formatExistingTable(tableText: string): string {
  const lines = tableText.trim().split('\n');
  const rows = lines.map(line => 
    line.split('|')
      .filter(cell => cell.trim() !== '') // Remove empty cells from split
      .map(cell => cell.trim()) // Trim whitespace
  );
  
  // Calculate the maximum width for each column
  const columnWidths: number[] = [];
  rows.forEach(row => {
    row.forEach((cell, colIndex) => {
      columnWidths[colIndex] = Math.max(columnWidths[colIndex] || 0, cell.length);
    });
  });
  
  // Format each row with proper spacing
  const formattedRows = rows.map((row, rowIndex) => {
    let formattedRow = '|';
    
    row.forEach((cell, colIndex) => {
      // Determine padding based on column width
      const padding = ' '.repeat(columnWidths[colIndex] - cell.length);
      
      // For header separator row (row index 1), handle alignment syntax
      if (rowIndex === 1) {
        if (cell.startsWith(':') && cell.endsWith(':')) {
          // Center alignment
          const dashedPart = '-'.repeat(columnWidths[colIndex] - 2);
          formattedRow += ` :${dashedPart}: |`;
        } else if (cell.endsWith(':')) {
          // Right alignment
          const dashedPart = '-'.repeat(columnWidths[colIndex] - 1);
          formattedRow += ` ${dashedPart}: |`;
        } else {
          // Left alignment (default)
          const dashedPart = '-'.repeat(columnWidths[colIndex]);
          formattedRow += ` ${dashedPart} |`;
        }
      } else {
        // Regular cell or header
        formattedRow += ` ${cell}${padding} |`;
      }
    });
    
    return formattedRow;
  });
  
  return formattedRows.join('\n');
}

// Configure Monaco Editor with Markdown syntax highlighting
export function configureMonacoForMarkdown(monaco: any): void {
  // Define a custom theme based on Dracula theme
  monaco.editor.defineTheme('markdownTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'operator', foreground: 'f8f8f2' },
      { token: 'variable', foreground: '8be9fd' },
      { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'identifier', foreground: 'f8f8f2' },
      
      // Markdown specific tokens
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'keyword.md', foreground: 'ff79c6' },      // Headers
      { token: 'string.link.md', foreground: '8be9fd' },  // Links
      { token: 'variable.md', foreground: 'f1fa8c' },     // Bold text
      { token: 'comment.md', foreground: '6272a4' },      // Lists
    ],
    colors: {
      'editor.background': '#282a36',           // Dracula background
      'editor.foreground': '#f8f8f2',           // Dracula foreground
      'editorCursor.foreground': '#f8f8f2',     // Cursor color
      'editor.lineHighlightBackground': '#44475a', // Current line highlight
      'editorLineNumber.foreground': '#6272a4', // Line numbers
      'editor.selectionBackground': '#44475a',  // Selection background
      'editor.inactiveSelectionBackground': '#6272a4', // Inactive selection
      'editorIndentGuide.background': '#44475a' // Indent guides
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
