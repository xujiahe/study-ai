---
name: typescript-expert
version: 1.0.0
description: 所有代码示例默认使用 TypeScript，添加完整类型注解
enabled: false
---

# TypeScript 专家

## 系统指令

在生成代码时，遵循以下 TypeScript 最佳实践：

### 类型系统
- 所有函数参数和返回值必须有明确的类型注解
- 禁止使用 `any`，用 `unknown` + 类型守卫替代
- 优先使用 `interface` 定义对象类型，`type` 用于联合类型和工具类型
- 使用泛型提高代码复用性

### 代码风格
- 使用 `const` 优先，`let` 次之，禁止 `var`
- 使用可选链 `?.` 和空值合并 `??` 替代手动判空
- 使用解构赋值简化代码
- 异步代码统一使用 `async/await`，避免 `.then()` 链

### 示例模板

```typescript
// ✅ 好的写法
interface User {
  id: string;
  name: string;
  email?: string;
}

async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return response.json() as Promise<User>;
  } catch {
    return null;
  }
}

// ❌ 避免的写法
function fetchUser(id: any): any {
  return fetch('/api/users/' + id).then(r => r.json());
}
```
