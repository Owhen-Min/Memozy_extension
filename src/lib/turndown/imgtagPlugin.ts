import TurndownService from "turndown";

// Helper function to parse style string and extract width/height
function getStyleDimensions(styleString: string | null): {
  width: string | null;
  height: string | null;
} {
  const dimensions: { width: string | null; height: string | null } = { width: null, height: null };
  if (!styleString) {
    return dimensions;
  }
  styleString.split(";").forEach((style) => {
    const [property, value] = style.split(":");
    if (property && value) {
      const prop = property.trim();
      const val = value.trim();
      if (prop === "width") {
        dimensions.width = val;
      }
      if (prop === "height") {
        dimensions.height = val;
      }
    }
  });
  return dimensions;
}

export function imgtagPlugin(turndownService: TurndownService) {
  turndownService.addRule("handleRelativeImagesAndPreserveSize", {
    filter: "img",
    replacement: function (content, node) {
      const imgElement = node as HTMLImageElement;
      const src = imgElement.getAttribute("src");
      const alt = imgElement.getAttribute("alt") || "";

      let finalWidth: string | null = null;
      let finalHeight: string | null = null;

      const attrWidth = imgElement.getAttribute("width");
      const attrHeight = imgElement.getAttribute("height");
      const styleAttribute = imgElement.getAttribute("style");

      let parsedStyleWidth: string | null = null;
      let parsedStyleHeight: string | null = null;

      if (styleAttribute) {
        const styleDims = getStyleDimensions(styleAttribute);
        parsedStyleWidth = styleDims.width;
        parsedStyleHeight = styleDims.height;
      }

      // Prioritize attributes, then style values for width
      let wValue = attrWidth || parsedStyleWidth;
      if (wValue) {
        if (wValue.endsWith("em") || wValue.endsWith("rem")) {
          const computedWidth = imgElement.offsetWidth; // Get rendered pixel width
          if (computedWidth > 0) {
            finalWidth = computedWidth + "px";
          } else {
            finalWidth = wValue; // Fallback to original if offsetWidth is 0
          }
        } else {
          finalWidth = wValue;
        }
      }

      // Prioritize attributes, then style values for height
      let hValue = attrHeight || parsedStyleHeight;
      if (hValue) {
        if (hValue.endsWith("em") || hValue.endsWith("rem")) {
          const computedHeight = imgElement.offsetHeight; // Get rendered pixel height
          if (computedHeight > 0) {
            finalHeight = computedHeight + "px";
          } else {
            finalHeight = hValue; // Fallback to original if offsetHeight is 0
          }
        } else {
          finalHeight = hValue;
        }
      }

      if (src && (src.startsWith("/") || src.startsWith("./") || src.startsWith("../"))) {
        return "";
      }

      if (src && src.startsWith("#")) {
        return "";
      }

      if (src) {
        if (finalWidth || finalHeight) {
          let htmlImg = `<img src="${src}" alt="${alt}"`;
          if (finalWidth) {
            htmlImg += ` width="${finalWidth}"`;
          }
          if (finalHeight) {
            htmlImg += ` height="${finalHeight}"`;
          }
          htmlImg += `>`;
          return htmlImg;
        } else {
          return `![${alt}](${src})`;
        }
      }

      return "";
    },
  });
}
