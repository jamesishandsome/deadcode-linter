#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { glob } from "glob";
import fs from "node:fs/promises";
import path from "node:path";
import prompts from "prompts";
import { parseFile } from "./core/parser";
import { parseCss } from "./core/css-parser";
import { ProjectGraph } from "./core/graph";

const program = new Command();

program
  .name("deadcode-linter")
  .description("Dead code and redundant logic scanner")
  .version("0.0.1");

async function scanProject(projectPath: string, options: any) {
  const graph = new ProjectGraph(projectPath);

  // Auto-detect entry points from package.json
  const entryPatterns = [...options.entry];
  try {
    const pkgPath = path.join(projectPath, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);

    if (pkg.main) entryPatterns.push(pkg.main);
    if (pkg.module) entryPatterns.push(pkg.module);
    if (pkg.types) entryPatterns.push(pkg.types);
    if (pkg.bin) {
      if (typeof pkg.bin === "string") {
        entryPatterns.push(pkg.bin);
      } else {
        Object.values(pkg.bin).forEach((p: any) => entryPatterns.push(p));
      }
    }
  } catch {
    // Ignore if package.json not found or invalid
  }

  // 1. Find all files
  const files = await glob("**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,css}", {
    cwd: projectPath,
    ignore: options.exclude,
    absolute: true,
  });

  console.log(chalk.green(`Found ${files.length} files.`));

  // 2. Parse files
  console.log(chalk.blue("Parsing files..."));
  for (const file of files) {
    const content = await fs.readFile(file, "utf-8");
    const ext = path.extname(file);

    try {
      if (ext === ".css") {
        const result = parseCss(file, content);
        graph.addCssFile(result);
      } else {
        const result = parseFile(file, content);
        graph.addFile(result);
      }
    } catch (e) {
      console.error(chalk.red(`Failed to parse ${file}: ${String(e)}`));
    }
  }

  console.log(chalk.green("Parsing complete. Analyzing reachability..."));

  // 3. Analyze
  return graph.findDeadCode(entryPatterns);
}

program
  .command("scan")
  .description("Scan the project for dead code")
  .option("-p, --path <path>", "Path to the project", ".")
  .option("--exclude <patterns...>", "Glob patterns to exclude", [
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
  ])
  .option("--entry <patterns...>", "Entry point patterns", [
    "src/index.*",
    "src/main.*",
    "src/cli.*",
    "vite.config.*",
    "next.config.*",
    "bun.lock",
    "package.json",
  ])
  .action(async (options) => {
    const projectPath = path.resolve(options.path);
    console.log(chalk.blue(`Scanning project at: ${projectPath}`));

    try {
      const { deadFiles, deadExports, deadCssClasses } = await scanProject(projectPath, options);

      // 4. Report

      // Dead Files
      if (deadFiles.length > 0) {
        console.log(chalk.red.bold("\n--- Dead Files (Unreachable) ---"));
        for (const file of deadFiles) {
          console.log(path.relative(projectPath, file));
        }
      } else {
        console.log(chalk.green("\n--- No Dead Files Found ---"));
      }

      // Dead Exports
      if (deadExports.length > 0) {
        console.log(chalk.yellow.bold("\n--- Unused Exports (in reachable files) ---"));
        const byFile = new Map<string, string[]>();
        for (const item of deadExports) {
          if (!byFile.has(item.file)) byFile.set(item.file, []);
          byFile.get(item.file)!.push(item.exportName);
        }
        for (const [file, exports] of byFile) {
          const relativePath = path.relative(projectPath, file);
          console.log(chalk.bold(`${relativePath}:`));
          for (const exp of exports) console.log(`  - ${chalk.red(exp)}`);
        }
      } else {
        console.log(chalk.green("\n--- No Unused Exports Found ---"));
      }

      // Dead CSS
      if (deadCssClasses.length > 0) {
        console.log(chalk.cyan.bold("\n--- Unused CSS Classes ---"));
        const byFile = new Map<string, string[]>();
        for (const item of deadCssClasses) {
          if (!byFile.has(item.file)) byFile.set(item.file, []);
          byFile.get(item.file)!.push(item.className);
        }
        for (const [file, classes] of byFile) {
          const relativePath = path.relative(projectPath, file);
          console.log(chalk.bold(`${relativePath}:`));
          for (const cls of classes) console.log(`  - ${chalk.red(cls)}`);
        }
      } else {
        console.log(chalk.green("\n--- No Unused CSS Classes Found ---"));
      }
    } catch (error) {
      console.error(chalk.red("Error during scan:"), error);
    }
  });

program
  .command("prune")
  .description("Delete dead files found in the project")
  .option("-p, --path <path>", "Path to the project", ".")
  .option("--exclude <patterns...>", "Glob patterns to exclude", [
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
  ])
  .option("--entry <patterns...>", "Entry point patterns", [
    "src/index.*",
    "src/main.*",
    "src/cli.*",
    "vite.config.*",
    "next.config.*",
    "bun.lock",
    "package.json",
  ])
  .option("-f, --force", "Force delete without confirmation", false)
  .action(async (options) => {
    const projectPath = path.resolve(options.path);
    console.log(chalk.blue(`Scanning project at: ${projectPath} for pruning...`));

    try {
      const { deadFiles } = await scanProject(projectPath, options);

      if (deadFiles.length === 0) {
        console.log(chalk.green("No dead files to prune!"));
        return;
      }

      console.log(chalk.red.bold(`\nFound ${deadFiles.length} dead files:`));
      for (const file of deadFiles) {
        console.log(path.relative(projectPath, file));
      }

      if (!options.force) {
        const response = await prompts({
          type: "confirm",
          name: "value",
          message: `Are you sure you want to delete these ${deadFiles.length} files?`,
          initial: false,
        });

        if (!response.value) {
          console.log(chalk.yellow("Prune cancelled."));
          return;
        }
      }

      console.log(chalk.red("\nDeleting files..."));
      for (const file of deadFiles) {
        try {
          await fs.unlink(file);
          console.log(chalk.gray(`Deleted: ${path.relative(projectPath, file)}`));
        } catch (e) {
          console.error(chalk.red(`Failed to delete ${file}: ${String(e)}`));
        }
      }
      console.log(chalk.green("Prune complete."));
    } catch (error) {
      console.error(chalk.red("Error during prune:"), error);
    }
  });

program.parse();
