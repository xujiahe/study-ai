// CSV 转 JSON 工具 — 将 CSV 数据转换为 JSON 格式
// 用法: echo "csv内容" | node csv-to-json.js [--pretty] [--key <字段名>]

import { createInterface } from "readline";

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    pretty: args.includes("--pretty"),
    key: args.includes("--key") ? args[args.indexOf("--key") + 1] : null,
  };
}

async function readStdin() {
  const rl = createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) lines.push(line);
  return lines;
}

function parseCSV(lines) {
  if (lines.length === 0) return [];

  // 第一行为表头
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 简单 CSV 解析（不处理字段内的逗号）
    const values = line.split(",").map((v) => {
      v = v.trim().replace(/^"|"$/g, "");
      // 尝试转换为数字
      const num = Number(v);
      return !isNaN(num) && v !== "" ? num : v;
    });

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] ?? null;
    });
    records.push(record);
  }

  return records;
}

async function main() {
  const { pretty, key } = parseArgs();
  const lines = await readStdin();

  if (lines.length === 0) {
    console.error("错误: 没有输入内容");
    process.exit(1);
  }

  const records = parseCSV(lines);

  // 如果指定了 key 字段，转换为以该字段为键的对象
  let output;
  if (key) {
    output = {};
    for (const record of records) {
      const keyValue = String(record[key] ?? "");
      output[keyValue] = record;
    }
  } else {
    output = records;
  }

  const json = pretty
    ? JSON.stringify(output, null, 2)
    : JSON.stringify(output);

  console.log(json);
  console.error(`✓ 转换完成: ${records.length} 条记录`);
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
