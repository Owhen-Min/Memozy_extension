import TurndownService from 'turndown';

export function tablePlugin(turndownService: TurndownService) {
  // Helper function to process cell content recursively
  function processCellContent(node: HTMLElement): string {
    let content = '';
    
    // Process child nodes
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        // Preserve special characters by escaping them
        const text = child.textContent?.trim() || '';
        content += text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        
        switch (element.tagName.toLowerCase()) {
          case 'a':
            const href = element.getAttribute('href') || '';
            const text = processCellContent(element);
            content += `[${text}](${href})`;
            break;
          case 'strong':
          case 'b':
            content += `**${processCellContent(element)}**`;
            break;
          case 'em':
          case 'i':
            content += `*${processCellContent(element)}*`;
            break;
          case 'del':
            content += `~~${processCellContent(element)}~~`;
            break;
          case 'sup':
            content += `^${processCellContent(element)}^`;
            break;
          case 'sub':
            content += `~${processCellContent(element)}~`;
            break;
          case 'div':
          case 'span':
            const innerContent = processCellContent(element);
            if (innerContent.trim()) {
              content += innerContent;
            }
            break;
          default:
            content += processCellContent(element);
        }
      }
    });
    
    return content.trim();
  }

  function buildTableMatrix(tableElement: HTMLElement): string[][] {
    const rows = Array.from(tableElement.querySelectorAll('tr'));
    const matrix: string[][] = [];
    const rowspans: { [key: number]: number } = {};

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (!matrix[rowIndex]) {
        matrix[rowIndex] = [];
      }

      let colIndex = 0;
      
      // Skip columns that are part of a rowspan from previous rows
      while (rowspans[colIndex] > 0) {
        matrix[rowIndex][colIndex] = '';
        rowspans[colIndex]--;
        colIndex++;
      }

      cells.forEach(cell => {
        // Find next available column
        while (matrix[rowIndex][colIndex]) {
          colIndex++;
        }

        const cellElement = cell as HTMLElement;
        const colspan = parseInt(cellElement.getAttribute('colspan') || '1', 10);
        const rowspan = parseInt(cellElement.getAttribute('rowspan') || '1', 10);
        const content = processCellContent(cellElement);

        // Fill current cell and handle colspan
        for (let i = 0; i < colspan; i++) {
          matrix[rowIndex][colIndex + i] = i === 0 ? content : '';
          
          // Handle rowspan
          if (rowspan > 1) {
            for (let j = 1; j < rowspan; j++) {
              if (!matrix[rowIndex + j]) {
                matrix[rowIndex + j] = [];
              }
              matrix[rowIndex + j][colIndex + i] = '';
              if (i === 0) {
                rowspans[colIndex + i] = rowspan - 1;
              }
            }
          }
        }

        colIndex += colspan;
      });
    });

    return matrix;
  }

  turndownService.addRule('table', {
    filter: function(node) {
      return node.nodeName === 'TABLE';
    },
    replacement: function(content, node) {
      try {
        const tableElement = node as HTMLElement;
        const matrix = buildTableMatrix(tableElement);
        
        // Ensure all rows have the same number of columns
        const maxColumns = Math.max(...matrix.map(row => row.length));
        matrix.forEach(row => {
          while (row.length < maxColumns) {
            row.push('');
          }
        });

        // Create header separator
        const separator = Array(maxColumns).fill('---');

        // Build markdown table rows
        const markdownRows = matrix.map((row, index) => {
          const cells = row.map(cell => cell.trim() || ' ');
          return `| ${cells.join(' | ')} |`;
        });

        // Insert separator after the first row
        markdownRows.splice(1, 0, `| ${separator.join(' | ')} |`);

        return '\n\n' + markdownRows.join('\n') + '\n\n';
      } catch (error) {
        console.error('테이블 처리 오류:', error);
        return '\n\n' + content + '\n\n';
      }
    }
  });

  turndownService.addRule('tableRow', {
    filter: ['tr'],
    replacement: function (content: string) {
      return content;
    }
  });

  turndownService.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: function (content: string) {
      return content;
    }
  });
} 