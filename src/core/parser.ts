import { parseSync, type ParseResult, type ParserOptions } from "oxc-parser";

export interface FileParseResult {
  filePath: string;
  ast: ParseResult["program"];
  module: ParseResult["module"];
  errors: ParseResult["errors"];
}

export function parseFile(filePath: string, content: string): FileParseResult {
  const options: ParserOptions = {
    sourceType: "module",
  };

  const result = parseSync(filePath, content, options);

  return {
    filePath,
    ast: result.program,
    module: result.module,
    errors: result.errors,
  };
}
