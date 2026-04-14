// 代码格式化 CLI — 从 stdin 读取代码，输出格式化结果
// 用法: echo "代码" | tsx cli.ts [--lang js|ts|json]

import { createInterface } from "readline";

/** 解析命令行参数 */
function parseArgs(): { lang: string } {
  const args = process.argv.slice(2);
  const langIdx = args.indexOf("--lang");
  const lang = langIdx !== -1 ? args[langIdx + 1] : "js";
  return { lang };
}

/** 简单的代码格式化（不依赖 prettier，纯规则替换） */
function formatCode(code: string, lang: string): string {
  let result = code;

  if (lang === "json") {
    // JSON 格式化：解析后重新序列化
    try {
      result = JSON.stringify(JSON.parse(code), null, 2);
      return result;
    } catch (e) {
      process.stderr.write(`JSON 解析失败: ${(e as Error).message}\n`);
      return code;
    }
  }

  // JS/TS 基础格式化规则
  const lines = result.split("\n");
  const formatted: string[] = [];
  let indentLevel = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) { formatted.push(""); continue; }

    // 减少缩进：遇到 } 或 ] 先减
    if (line.startsWith("}") || line.startsWith("]") || line.startsWith(")")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // 应用缩进（2 空格）
    formatted.push("  ".repeat(indentLevel) + line);

    // 增加缩进：遇到 { 或 [ 后增
    const opens = (line.match(/[{[(]/g) ?? []).length;
    const closes = (line.match(/[}\])]/g) ?? []).length;
    indentLevel = Math.max(0, indentLevel + opens - closes);
  }

  result = formatted.join("\n");

  // 统一单引号 → 双引号（简单替换，不处理嵌套）
  result = result.replace(/'/g, '"');

  // 确保语句末尾有分号（简单规则：非 { } 结尾的行）
  result = result.split("\n").map((line) => {
    const trimmed = line.trimEnd();
    if (
      trimmed &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(",") &&
      !trimmed.endsWith(";") &&
      !trimmed.endsWith("(") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("*")
    ) {
      return trimmed + ";";
    }
    return trimmed;
  }).join("\n");

  return result;
}

/** 从 stdin 读取所有输入 */
async function readStdin(): Promise<string> {
  const rl = createInterface({ input: process.stdin });
  const lines: string[] = [];
  for await (const line of rl) lines.push(line);
  return lines.join("\n");
}

async function main() {
  const { lang } = parseArgs();
  const input = await readStdin();

  if (!input.trim()) {
    process.stderr.write("错误: 没有输入内容\n");
    process.exit(1);
  }

  const output = formatCode(input, lang);
  process.stdout.write(output + "\n");

  // 输出统计信息到 stderr（不影响 stdout 的代码输出）
  const inputLines = input.split("\n").length;
  const outputLines = output.split("\n").length;
  process.stderr.write(`✓ 格式化完成 (${inputLines} → ${outputLines} 行, lang: ${lang})\n`);
}

main().catch((err) => {
  process.stderr.write(`错误: ${err.message}\n`);
  process.exit(1);
});
