import { expect, test, describe } from "bun:test";
import { parseFile } from "../src/core/parser";

describe("Parser", () => {
  test("should parse simple TS file", () => {
    const code = `
      import { foo } from "./bar";
      export const baz = 1;
    `;
    const result = parseFile("test.ts", code);

    expect(result.filePath).toBe("test.ts");
    expect(result.errors.length).toBe(0);
    expect(result.module.staticImports.length).toBe(1);
    expect(result.module.staticExports.length).toBe(1);
  });

  test("should handle syntax errors", () => {
    const code = `
      const x = ;
    `;
    const result = parseFile("error.ts", code);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
