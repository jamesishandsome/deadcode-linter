# deadcode-linter

> **Dead Code & Redundant Logic Scanner for Modern JS/TS Projects**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

`deadcode-linter` is a powerful tool designed to solve the problem of source code bloat that Tree-shaking cannot address. It goes beyond simple variable usage analysis by performing **Cross-file Reachability Analysis** and **CSS-JS Linkage Detection**.

## ✨ Features

- **🔍 Cross-file Reachability Analysis**:
  - Starts from entry points (e.g., `main`, `bin`, `vite.config.ts`).
  - Traces all imports/exports recursively to find "Dead Files" (files that are never imported).
  - Detects "Unused Exports" in reachable files.

- **🎨 CSS-JS Linkage**:
  - Parses CSS files to extract class names.
  - Scans reachable JS/TS files for string literals matching CSS classes.
  - Identifies CSS classes defined in your stylesheets but never used in your component logic.
  - Perfect for cleaning up Tailwind, CSS Modules, or global styles.

- **🗑️ Prune Command**:
  - Interactive CLI to safely delete dead files.
  - Supports `--force` mode for CI/CD environments.

- **⚡ High Performance**:
  - Built with `oxc-parser` (Rust-based) for ultra-fast AST parsing.
  - Uses `bun` ecosystem for development speed.

## 📦 Installation

```bash
# Install globally
npm install -g deadcode-linter
# or
bun add -g deadcode-linter

# Or run directly with npx/bunx
npx deadcode-linter scan
```

## 🚀 Usage

### 1. Scan for Dead Code

Run the scanner in your project root:

```bash
deadcode-linter scan
```

**Options:**

- `-p, --path <path>`: Path to the project (default: current directory).
- `--exclude <patterns...>`: Glob patterns to exclude (default: `node_modules/**`, `dist/**`, etc.).
- `--entry <patterns...>`: Entry point patterns (default: `src/index.*`, `package.json`, `vite.config.*`, etc.).

**Example:**

```bash
deadcode-linter scan --entry "src/main.tsx" --exclude "**/*.test.ts"
```

### 2. Prune Dead Files

Delete files identified as unreachable:

```bash
deadcode-linter prune
```

**Options:**

- `-f, --force`: Force delete without confirmation (useful for scripts).

## 🛠️ Configuration

`deadcode-linter` automatically detects entry points from your `package.json` (`main`, `module`, `bin`). You can override this with the `--entry` flag.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
