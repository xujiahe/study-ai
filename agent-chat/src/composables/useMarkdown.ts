import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

// 配置 marked 使用 highlight.js 进行代码高亮
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

// 配置 marked 选项
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown（支持表格）
  breaks: false,
});

/**
 * 自定义渲染器：为代码块添加复制按钮
 */
const renderer = new marked.Renderer();

renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(text, { language }).value;
  const langLabel = lang ?? "code";

  // 对代码内容进行 HTML 转义，用于 data-copy 属性
  const escapedCode = text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `<div class="code-block">
  <div class="code-block-header">
    <span class="code-lang">${langLabel}</span>
    <button class="copy-btn" data-copy="${escapedCode}" aria-label="复制代码">复制</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
};

marked.use({ renderer });

/**
 * 将 Markdown 文本渲染为安全的 HTML
 * 1. marked 解析 Markdown → HTML
 * 2. DOMPurify 过滤危险标签和属性（需求 5.6）
 */
export function renderMarkdown(content: string): string {
  // 渲染 Markdown
  const rawHtml = marked.parse(content) as string;

  // XSS 过滤：移除 <script>、<iframe>、内联事件属性等危险内容
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "del",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote",
      "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "a", "img",
      "hr",
      "div", "span",
      "button", // 允许复制按钮
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title",
      "class", "id",
      "data-copy", // 复制按钮的数据属性
      "aria-label",
      "align", // 表格对齐
      "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "style"],
  });

  return cleanHtml;
}

/**
 * useMarkdown composable
 * 提供 Markdown 渲染功能，支持懒加载（需求 8.5）
 */
export function useMarkdown() {
  return {
    renderMarkdown,
  };
}
