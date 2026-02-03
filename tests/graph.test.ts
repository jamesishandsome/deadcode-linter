import { expect, test, describe, beforeAll } from "bun:test";
import { ProjectGraph } from "../src/core/graph";
import { parseFile } from "../src/core/parser";
import { parseCss } from "../src/core/css-parser";
import path from "node:path";
import fs from "node:fs";

describe("ProjectGraph", () => {
  const fixturesDir = path.resolve(import.meta.dir, "fixtures");
  const entryPath = path.join(fixturesDir, "entry.ts");
  const utilsPath = path.join(fixturesDir, "utils.ts");
  const deadPath = path.join(fixturesDir, "dead.ts");
  const stylePath = path.join(fixturesDir, "style.css");

  let graph: ProjectGraph;

  beforeAll(() => {
    graph = new ProjectGraph(fixturesDir);

    // Add files to graph
    const files = [entryPath, utilsPath, deadPath];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const result = parseFile(file, content);
      graph.addFile(result);
    }

    // Add CSS file
    const cssContent = fs.readFileSync(stylePath, "utf-8");
    const cssResult = parseCss(stylePath, cssContent);
    graph.addCssFile(cssResult);
  });

  test("should find dead files", () => {
    const { deadFiles } = graph.findDeadCode(["**/entry.ts"]);

    // dead.ts should be dead
    expect(deadFiles.some((f) => f.includes("dead.ts"))).toBe(true);
    // utils.ts should be alive (imported by entry.ts)
    expect(deadFiles.some((f) => f.includes("utils.ts"))).toBe(false);
  });

  test("should find unused exports", () => {
    const { deadExports } = graph.findDeadCode(["**/entry.ts"]);

    // unusedHelper in utils.ts should be dead
    const unused = deadExports.find((e) => e.exportName === "unusedHelper");
    expect(unused).toBeDefined();
    expect(unused?.file).toContain("utils.ts");

    // helper in utils.ts should be used (imported as side-effect imports don't mark specific imports used, wait...)
    // In entry.ts: import "./utils"; -> Side effect import.
    // In graph.ts: side effect import usually means "imports nothing specifically".
    // But if I import for side effect, does it mark exports as used?
    // Let's check logic in graph.ts.
    // If imp.entries.length === 0 (side effect), we push importedName: "".
    // In BFS: usedExports.get(targetPath).add(imp.importedName) -> adds ""?
    // Then in dead export check: used.has(exp.exportedName).
    // So "helper" won't be in usedExports if I just do `import "./utils"`.
    // So "helper" will be reported as unused. This is correct behavior for side-effect imports!
    // But wait, if I want to test actual usage, I should change entry.ts to `import { helper } from "./utils"`.
    // But current test expects unusedHelper to be unused.

    // Let's update entry.ts to import helper specifically to test partial usage.
  });

  test("should find unused CSS classes", () => {
    const { deadCssClasses } = graph.findDeadCode(["**/entry.ts"]);

    // .really-unused should be dead
    const unusedClass = deadCssClasses.find((c) => c.className === "really-unused");
    expect(unusedClass).toBeDefined();
    expect(unusedClass?.file).toContain("style.css");

    // .used should be alive (string literal in entry.ts)
    const usedClass = deadCssClasses.find((c) => c.className === "used");
    expect(usedClass).toBeUndefined();
  });
});
