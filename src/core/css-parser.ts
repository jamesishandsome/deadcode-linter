import { parse, walk } from "css-tree";

export interface CssParseResult {
  filePath: string;
  classNames: Set<string>;
  ids: Set<string>;
}

export function parseCss(filePath: string, content: string): CssParseResult {
  const classNames = new Set<string>();
  const ids = new Set<string>();
  // console.log(`Parsing CSS file: ${filePath}, length: ${content.length}`);

  try {
    const ast = parse(content);

    walk(ast, {
      visit: "ClassSelector",
      enter(node) {
        // console.log("  Found class:", node.name);
        classNames.add(node.name);
      },
    });

    walk(ast, {
      visit: "IdSelector",
      enter(node) {
        ids.add(node.name);
      },
    });
  } catch (e) {
    console.error(`Failed to parse CSS ${filePath}:`, e);
  }

  return {
    filePath,
    classNames,
    ids,
  };
}
