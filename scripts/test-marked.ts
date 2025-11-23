import { marked } from 'marked';

(async () => {
  const markdown = `# 標題

這是一段測試文字。

## 小標題

- 列表項 1
- 列表項 2
`;

  const html = await marked.parse(markdown, {
    async: true,
    gfm: true,
    breaks: false,
  });

  console.log('Markdown:');
  console.log(markdown);
  console.log('\nHTML:');
  console.log(html);
  console.log('\n是否為 HTML:', html.includes('<h1>'));
})();
