import TurndownService from 'turndown';

interface TablePluginOptions {
  fence?: string;
}

export function tablePlugin(turndownService: TurndownService) {
  turndownService.addRule('table', {
    filter: function(node) {
      return node.nodeName === 'TABLE';
    },
    replacement: function(content, node) {
      try {
        const tableElement = node as HTMLElement;
        const rows = Array.from(tableElement.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        // Process all rows
        const processedRows = rows.map(row => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          return cells.map(cell => {
            // Handle links and spans within cells
            const links = Array.from(cell.querySelectorAll('a'));
            const spans = Array.from(cell.querySelectorAll('span'));
            
            let cellContent = cell.textContent?.trim() || '';
            
            // Process links
            links.forEach(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              cellContent = cellContent.replace(text, `[${text}](${href})`);
            });
            
            // Process spans
            spans.forEach(span => {
              const spanText = span.textContent?.trim() || '';
              cellContent = cellContent.replace(spanText, spanText);
            });

            return cellContent;
          }).join(' | ');
        });

        // Create header separator
        const separator = processedRows[0].split(' | ').map(() => '---').join(' | ');

        // Combine all rows
        const markdownRows = [
          `| ${processedRows[0]} |`,
          `| ${separator} |`,
          ...processedRows.slice(1).map(row => `| ${row} |`)
        ].join('\n');

        return '\n\n' + markdownRows + '\n\n';
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