import { ResolverFactory } from "oxc-resolver";
import path from "node:path";
import { minimatch } from "minimatch";
import type { FileParseResult } from "./parser";
import type { CssParseResult } from "./css-parser";

export interface ImportInfo {
  source: string; // Original request string (e.g., "./utils", "react")
  resolvedPath?: string; // Absolute path if resolved
  importedName: string; // "default", "*", or specific name
  localName: string; // Variable name in this file
  isType: boolean;
}

export interface ExportInfo {
  exportedName: string; // "default" or specific name
  localName?: string; // Local variable name (if applicable)
  isType: boolean;
}

export interface FileNode {
  id: string; // Absolute file path
  type: "js" | "css";
  imports: ImportInfo[];
  exports: ExportInfo[];
  stringLiterals: Set<string>; // Found in JS/TS
  definedCssClasses: Set<string>; // Found in CSS
}

export class ProjectGraph {
  nodes: Map<string, FileNode> = new Map();
  resolver: ResolverFactory;

  constructor(rootPath: string) {
    this.resolver = new ResolverFactory({
      roots: [rootPath],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".d.ts", ".css", ".scss", ".less"],
      conditionNames: ["node", "import", "require", "types", "style"],
    });
  }

  addFile(result: FileParseResult) {
    const { filePath, module, ast } = result;
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    // Process Imports
    if (module.staticImports) {
      for (const imp of module.staticImports) {
        const source = imp.moduleRequest.value;

        if (imp.entries.length === 0) {
          // Side-effect import (e.g. import "./style.css")
          imports.push({
            source,
            importedName: "",
            localName: "",
            isType: false,
          });
        }

        for (const entry of imp.entries) {
          let importedName = "";
          if (entry.importName.kind === "Default") {
            importedName = "default";
          } else if (entry.importName.kind === "NamespaceObject") {
            importedName = "*";
          } else if (entry.importName.kind === "Name") {
            importedName = entry.importName.name || "";
          }

          imports.push({
            source,
            importedName,
            localName: entry.localName.value,
            isType: entry.isType,
          });
        }
      }
    }

    // Process Exports
    if (module.staticExports) {
      for (const exp of module.staticExports) {
        for (const entry of exp.entries) {
          let exportedName = "";
          if (entry.exportName.kind === "Default") {
            exportedName = "default";
          } else if (entry.exportName.kind === "Name") {
            exportedName = entry.exportName.name || "";
          }

          let localName: string | undefined;
          if (entry.localName && entry.localName.kind === "Name") {
            localName = entry.localName.name || undefined;
          }

          exports.push({
            exportedName,
            localName,
            isType: entry.isType,
          });
        }
      }
    }

    // Extract String Literals
    const stringLiterals = new Set<string>();
    this.extractStringLiterals(ast, stringLiterals);

    this.nodes.set(filePath, {
      id: filePath,
      type: "js",
      imports,
      exports,
      stringLiterals,
      definedCssClasses: new Set(),
    });
  }

  addCssFile(result: CssParseResult) {
    this.nodes.set(result.filePath, {
      id: result.filePath,
      type: "css",
      imports: [],
      exports: [],
      stringLiterals: new Set(),
      definedCssClasses: result.classNames,
    });
  }

  extractStringLiterals(node: any, set: Set<string>) {
    if (!node || typeof node !== "object") return;

    if (node.type === "Literal" && typeof node.value === "string") {
      set.add(node.value);
      // Split by space for Tailwind-like usage "foo bar"
      const parts = node.value.split(/\s+/);
      if (parts.length > 1) {
        parts.forEach((s: string) => s && set.add(s));
      }
    } else if (node.type === "StringLiteral" && typeof node.value === "string") {
      set.add(node.value);
      const parts = node.value.split(/\s+/);
      if (parts.length > 1) {
        parts.forEach((s: string) => s && set.add(s));
      }
    }

    for (const key in node) {
      if (key !== "loc" && key !== "range" && key !== "start" && key !== "end" && key !== "span") {
        const val = node[key];
        if (Array.isArray(val)) {
          val.forEach((v) => this.extractStringLiterals(v, set));
        } else {
          this.extractStringLiterals(val, set);
        }
      }
    }
  }

  resolveImports() {
    for (const [filePath, node] of this.nodes) {
      if (node.type === "css") continue;

      const dir = path.dirname(filePath);
      for (const imp of node.imports) {
        try {
          const resolution = this.resolver.sync(dir, imp.source);
          if (resolution.path) {
            imp.resolvedPath = resolution.path;
          }
        } catch {
          // console.warn(`Failed to resolve ${imp.source} from ${filePath}: ${e}`);
        }
      }
    }
  }

  findDeadCode(entryPatterns: string[]) {
    this.resolveImports();

    const reachableFiles = new Set<string>();
    const usedExports = new Map<string, Set<string>>(); // file -> Set<exportedName>

    // 1. Identify Entry Points
    const queue: string[] = [];
    for (const [filePath] of this.nodes) {
      // Normalize separators for minimatch
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
      const isEntry = entryPatterns.some((p) => minimatch(relPath, p));
      if (isEntry) {
        reachableFiles.add(filePath);
        queue.push(filePath);
        // Mark all exports of entry points as used (assume public API)
        const node = this.nodes.get(filePath);
        if (node) {
          const exports = new Set<string>();
          node.exports.forEach((e) => exports.add(e.exportedName));
          usedExports.set(filePath, exports);
        }
      }
    }

    // 2. BFS Reachability
    let head = 0;
    while (head < queue.length) {
      const currentPath = queue[head++];
      if (!currentPath) continue;
      const node = this.nodes.get(currentPath);
      if (!node) continue;

      for (const imp of node.imports) {
        if (imp.resolvedPath && this.nodes.has(imp.resolvedPath)) {
          const targetPath = imp.resolvedPath;

          // Mark file as reachable
          if (!reachableFiles.has(targetPath)) {
            reachableFiles.add(targetPath);
            queue.push(targetPath);
          }

          // Mark export as used
          if (!usedExports.has(targetPath)) {
            usedExports.set(targetPath, new Set());
          }
          usedExports.get(targetPath)!.add(imp.importedName);

          // Handle "export * from '...'" (re-export)
          // If 'importedName' is '*', we need to mark ALL exports of target as used?
          // Or just mark it as "all used".
          if (imp.importedName === "*") {
            // Mark all exports of target as used?
            // For now, let's assume * means everything is potentially used.
            // Or we can be smarter. But * is usually re-export.
            // Let's add a special "*" marker.
            usedExports.get(targetPath)!.add("*");
          }
        }
      }
    }

    // 3. Collect Dead Code
    const deadFiles: string[] = [];
    const deadExports: { file: string; exportName: string }[] = [];

    for (const [filePath, node] of this.nodes) {
      if (!reachableFiles.has(filePath)) {
        deadFiles.push(filePath);
      } else {
        // File is reachable, check exports
        const used = usedExports.get(filePath);
        const isAllUsed = used?.has("*");

        if (!isAllUsed) {
          for (const exp of node.exports) {
            if (!used || !used.has(exp.exportedName)) {
              deadExports.push({
                file: filePath,
                exportName: exp.exportedName,
              });
            }
          }
        }
      }
    }

    // 4. Check CSS usage in REACHABLE files
    // Collect strings only from reachable JS files
    const reachableStrings = new Set<string>();
    for (const filePath of reachableFiles) {
      const node = this.nodes.get(filePath);
      if (node && node.type === "js") {
        for (const s of node.stringLiterals) {
          reachableStrings.add(s);
        }
      }
    }

    const deadCssClasses: { file: string; className: string }[] = [];
    for (const [filePath, node] of this.nodes) {
      if (node.type === "css") {
        // If CSS file is NOT reachable (not imported by any reachable JS), then ALL its classes are dead?
        // Or maybe it's a global CSS included via HTML?
        // User should add global CSS to entry points if so.
        // But CSS files don't have exports in the same way.
        // If it's imported, it's in reachableFiles.

        if (!reachableFiles.has(filePath)) {
          // Entire file is dead
          // We can list all classes as dead, or just report file as dead.
          // Let's report classes for granularity.
          for (const cls of node.definedCssClasses) {
            deadCssClasses.push({ file: filePath, className: cls });
          }
        } else {
          // File is imported, check class usage
          for (const cls of node.definedCssClasses) {
            if (!reachableStrings.has(cls)) {
              deadCssClasses.push({ file: filePath, className: cls });
            }
          }
        }
      }
    }

    return {
      deadFiles,
      deadExports,
      deadCssClasses,
    };
  }
}
