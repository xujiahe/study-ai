# 数据分析脚本 — 对 JSON/CSV 数据进行统计分析
# 用法: echo '{"data":[...]}' | python analyze.py [--format json|csv] [--output summary|full]

import sys
import json
import csv
import math
import argparse
from io import StringIO


def parse_args():
    parser = argparse.ArgumentParser(description="数据统计分析工具")
    parser.add_argument("--format", choices=["json", "csv", "auto"], default="auto",
                        help="输入数据格式（默认自动检测）")
    parser.add_argument("--output", choices=["summary", "full"], default="full",
                        help="输出详细程度")
    return parser.parse_args()


def read_stdin():
    """从 stdin 读取所有输入"""
    return sys.stdin.read().strip()


def detect_format(data: str) -> str:
    """自动检测数据格式"""
    stripped = data.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return "json"
    return "csv"


def parse_json(data: str) -> list[dict]:
    """解析 JSON 数据，支持数组或 {data: [...]} 格式"""
    parsed = json.loads(data)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        # 尝试找到数组字段
        for key in ["data", "rows", "records", "items", "results"]:
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # 单个对象包装成列表
        return [parsed]
    raise ValueError("JSON 格式不支持：需要数组或包含数组字段的对象")


def parse_csv_data(data: str) -> list[dict]:
    """解析 CSV 数据"""
    reader = csv.DictReader(StringIO(data))
    return list(reader)


def compute_stats(values: list) -> dict:
    """计算数值列表的统计指标"""
    nums = []
    for v in values:
        try:
            nums.append(float(v))
        except (ValueError, TypeError):
            pass

    if not nums:
        return {"type": "non-numeric", "count": len(values), "unique": len(set(str(v) for v in values))}

    n = len(nums)
    mean = sum(nums) / n
    sorted_nums = sorted(nums)
    median = sorted_nums[n // 2] if n % 2 else (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in nums) / n
    std = math.sqrt(variance)

    # 异常值检测（超出均值 ± 2 个标准差）
    outliers = [x for x in nums if abs(x - mean) > 2 * std]

    return {
        "type": "numeric",
        "count": n,
        "mean": round(mean, 4),
        "median": round(median, 4),
        "min": round(min(nums), 4),
        "max": round(max(nums), 4),
        "std": round(std, 4),
        "outliers_count": len(outliers),
        "outliers": [round(x, 4) for x in outliers[:5]],  # 最多显示 5 个
    }


def analyze(records: list[dict], output_mode: str) -> dict:
    """对记录列表进行全面统计分析"""
    if not records:
        return {"error": "数据为空"}

    total = len(records)
    fields = list(records[0].keys()) if records else []

    # 统计缺失值
    missing = {field: sum(1 for r in records if not r.get(field)) for field in fields}

    # 逐字段统计
    field_stats = {}
    for field in fields:
        values = [r.get(field) for r in records if r.get(field) is not None]
        field_stats[field] = compute_stats(values)
        field_stats[field]["missing"] = missing[field]

    result = {
        "overview": {
            "total_records": total,
            "total_fields": len(fields),
            "fields": fields,
        },
        "field_stats": field_stats if output_mode == "full" else {
            k: v for k, v in field_stats.items()
            if v.get("type") == "numeric"  # summary 模式只显示数值字段
        },
    }

    # 生成关键洞察
    insights = []
    for field, stats in field_stats.items():
        if stats.get("type") == "numeric":
            if stats.get("outliers_count", 0) > 0:
                insights.append(f"字段 '{field}' 存在 {stats['outliers_count']} 个异常值")
            if stats.get("missing", 0) > total * 0.1:
                pct = round(stats["missing"] / total * 100, 1)
                insights.append(f"字段 '{field}' 缺失率较高: {pct}%")
        if stats.get("type") == "non-numeric" and stats.get("unique", 0) == 1:
            insights.append(f"字段 '{field}' 所有值相同（可能是常量字段）")

    result["insights"] = insights[:5]  # 最多 5 条洞察
    return result


def main():
    args = parse_args()
    raw = read_stdin()

    if not raw:
        print(json.dumps({"error": "没有输入数据"}))
        sys.exit(1)

    # 检测并解析数据格式
    fmt = args.format if args.format != "auto" else detect_format(raw)
    try:
        if fmt == "json":
            records = parse_json(raw)
        else:
            records = parse_csv_data(raw)
    except Exception as e:
        print(json.dumps({"error": f"数据解析失败: {str(e)}"}))
        sys.exit(1)

    # 执行分析
    result = analyze(records, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
