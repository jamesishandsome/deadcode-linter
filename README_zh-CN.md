# deadcode-linter

> **现代 JS/TS 项目的死代码与冗余逻辑扫描器**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

`deadcode-linter` 是一款强大的工具，旨在解决 Tree-shaking 无法解决的源代码膨胀问题。它不仅仅是简单的变量使用分析，还执行**跨文件可达性分析**和**CSS-JS 联动检测**。

[English](./README.md) | [简体中文](./README_zh-CN.md)

## ✨ 特性

- **🔍 跨文件可达性分析**:
  - 从入口点（如 `main`, `bin`, `vite.config.ts`）开始扫描。
  - 递归追踪所有 `import`/`export` 以发现“死文件”（从未被导入的文件）。
  - 检测可达文件中的“未使用的导出”。

- **🎨 CSS-JS 联动检测**:
  - 解析 CSS 文件以提取类名。
  - 扫描可达的 JS/TS 文件，查找匹配 CSS 类名的字符串字面量。
  - 识别那些在样式表中定义但在组件逻辑中从未使用的 CSS 类。
  - 非常适合清理 Tailwind、CSS Modules 或全局样式。

- **🗑️ 清理命令 (Prune)**:
  - 交互式 CLI 安全删除死文件。
  - 支持 `--force` 模式，适用于 CI/CD 环境。

- **⚡ 高性能**:
  - 基于 `oxc-parser`（Rust 编写）构建，实现超快 AST 解析。
  - 使用 `bun` 生态系统以获得极致开发速度。

## 📦 安装

```bash
# 全局安装
npm install -g deadcode-linter
# 或
bun add -g deadcode-linter

# 或者直接使用 npx/bunx 运行
npx deadcode-linter scan
```

## 🚀 使用方法

### 1. 扫描死代码

在项目根目录下运行扫描器：

```bash
deadcode-linter scan
```

**选项:**

- `-p, --path <path>`: 项目路径 (默认: 当前目录)。
- `--exclude <patterns...>`: 要排除的 Glob 模式 (默认: `node_modules/**`, `dist/**` 等)。
- `--entry <patterns...>`: 入口点模式 (默认: `src/index.*`, `package.json`, `vite.config.*` 等)。

**示例:**

```bash
deadcode-linter scan --entry "src/main.tsx" --exclude "**/*.test.ts"
```

### 2. 清理死文件

删除被识别为不可达的文件：

```bash
deadcode-linter prune
```

**选项:**

- `-f, --force`: 强制删除无需确认 (适用于脚本)。

## 🛠️ 配置

`deadcode-linter` 会自动从 `package.json` (`main`, `module`, `bin`) 中检测入口点。你可以使用 `--entry` 标志来覆盖默认行为。

## 🗺️ 路线图 (Roadmap)

我们有宏大的计划，致力于使 `deadcode-linter` 成为保持代码库整洁的标准工具：

- [ ] **Vue / Svelte 支持**: 解析 `.vue` 和 `.svelte` 文件进行使用分析。
- [ ] **高级配置**: 支持 `deadcode.config.ts` 以进行细粒度控制。
- [ ] **忽略注释**: 允许使用 `// deadcode-ignore` 抑制误报。
- [ ] **CI 集成**: Github Actions 报告器和错误失败模式。
- [ ] **可视化报告**: 生成带有依赖图谱的 HTML 报告。
- [ ] **插件系统**: 允许自定义解析器和规则。

## 🤝 贡献

欢迎贡献！请随意提交 Pull Request。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件。
