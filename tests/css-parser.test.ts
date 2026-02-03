import { expect, test, describe } from "bun:test";
import { parseCss } from "../src/core/css-parser";

describe("CSS Parser", () => {
  test("should extract classes and ids", () => {
    const css = `
      .foo { color: red; }
      #bar { color: blue; }
      div { color: green; }
      .baz:hover { color: yellow; }
    `;
    const result = parseCss("style.css", css);

    expect(result.classNames.has("foo")).toBe(true);
    expect(result.classNames.has("baz")).toBe(true);
    expect(result.ids.has("bar")).toBe(true);
    expect(result.classNames.size).toBe(2);
    expect(result.ids.size).toBe(1);
  });

  test("should handle empty content", () => {
    const result = parseCss("empty.css", "");
    expect(result.classNames.size).toBe(0);
    expect(result.ids.size).toBe(0);
  });
});
