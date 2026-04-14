// 代码风格检查 — 检测常见风格问题并输出报告
// 用法: node check-style.js <文件路径> 或 echo "代码" | node check-style.js

import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";

/** 风格检查规则 */
const RULES = [
  {
    id: "no-var",
    message: "使用 var 声明变量，建议改用 const 或 let",
    pattern: /\bvar\s+/g,
  },
  {
    id: "single-quote",
    message: "使用单引号，建议统一使用双引号",
    pattern: /(?<![\\])'[^']*'/g,
  },
  {
    id: "no-semicolon",
    message: "语句末尾缺少分号",
    // 匹配不以 ; { } 结尾的非空行（简化规则）
    pattern: /^(?!.*[;{}(,]$)(?!.*\/\/)(?!\s*$).+$/gm,
    lineCheck: true,
  },
  {
    id: "long-line",
    message: "行长度超过 100 字符",
    lineCheck: true,
    check: (line) => line.length > 100,
  },
  {
    id: "console-log",
    message: "包含 console.log（生产代码中应移除）",
    pattern: /console\.log\(/g,
  },
  {
    id: "todo-comment",
    message: "包含 TODO 注释（待处理）",
    pattern: /\/\/\s*TODO/gi,
  },
];

/** 对代码进行风格检查，返回问题列表 */
function checkStyle(code) {
  const issues = [];
  const lines = code.split("\n");

  for (const rule of RULES) {
    if (rule.lineCheck && rule.check) {
      // 逐行检查
      lines.forEach((line, idx) => {
        if (rule.check(line)) {
          issues.push({ rule: rule.id, line: idx + 1, message: rule.message });
        }
      });
    } else if (rule.pattern) {
      // 正则匹配
      const matches = [...code.matchAll(rule.pattern)];
      for (const match of matches) {
        // 计算行号
        const lineNum = code.slice(0, match.index).split("\n").length;
        issues.push({ rule: rule.id, line: lineNum, message: rule.message });
      }
    }
  }

  return issues;
}

async function readInput() {
  // 优先读取命令行参数指定的文件
  const filePath = process.argv[2];
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, "utf-8");
  }
  // 否则从 stdin 读取
  const rl = createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) lines.push(line);
  return lines.join("\n");
}

async function main() {
  const code = await readInput();
  if (!code.trim()) {
    console.error("错误: 没有输入内容");
    process.exit(1);
  }

  const issues = checkStyle(code);

  if (issues.length === 0) {
    console.log("✅ 风格检查通过，未发现问题");
    process.exit(0);
  }

  console.log(`⚠️  发现 ${issues.length} 个风格问题:\n`);
  for (const issue of issues) {
    console.log(`  第 ${issue.line} 行 [${issue.rule}]: ${issue.message}`);
  }

  // 退出码 1 表示有问题（方便 CI 集成）
  process.exit(1);
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
