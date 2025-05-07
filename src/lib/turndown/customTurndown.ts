import TurndownService from "turndown";
import { codeBlockPlugin } from "./codeBlockPlugin";
import { listPlugin } from "./listPlugin";
import { tablePlugin } from "./tablePlugin";
import { atagPlugin } from "./atagPlugin";
import { imgtagPlugin } from "./imgtagPlugin";
export default function customTurndown() {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "*",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  turndownService.use(atagPlugin);
  turndownService.use(imgtagPlugin);
  turndownService.use(tablePlugin);
  turndownService.use(codeBlockPlugin);
  turndownService.use(listPlugin);
  return turndownService;
}
