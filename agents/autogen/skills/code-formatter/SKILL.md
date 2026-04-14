---
name: code-formatter
version: 1.0.0
description: 格式化代码并检查风格问题，支持 JS/TS/JSON
enabled: false
cli: scripts/cli.ts
---

# 代码格式化助手

## 系统指令

当用户要求格式化代码时：

1. 先调用 `format` 脚本工具对代码进行格式化
2. 说明做了哪些格式化改动
3. 返回格式化后的代码

支持的格式化规则：
- 统一使用 2 空格缩进
- 字符串使用双引号
- 语句末尾加分号
- 对象/数组末尾加逗号（trailing comma）
- 每行最大 100 字符

## 使用示例

用户说"帮我格式化这段代码"时，调用 format 脚本处理后返回结果。
