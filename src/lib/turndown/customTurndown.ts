import TurndownService from 'turndown';
import { codeBlockPlugin } from './codeBlockPlugin';
import { listPlugin } from './listPlugin';
import { tablePlugin } from './tablePlugin';

export default function customTurndown() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '*',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  turndownService.use(tablePlugin);
  turndownService.use(codeBlockPlugin);
  turndownService.use(listPlugin);
    return turndownService;
}
