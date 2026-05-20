// 檢查翻譯檔案完整性
const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../src/messages');

// 主要基準語系
const zhTW = JSON.parse(fs.readFileSync(path.join(messagesDir, 'zh-TW.json'), 'utf8'));

// 所有需要檢查的語系
const locales = [
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
];

function findMissingKeys(source, target, prefix = '') {
  const missing = [];
  for (const key in source) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      missing.push(fullKey);
    } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      missing.push(...findMissingKeys(source[key], target[key] || {}, fullKey));
    }
  }
  return missing;
}

console.log('=== 翻譯檔案完整性檢查 ===');
console.log('基準語系: zh-TW.json\n');

let totalMissing = 0;

for (const locale of locales) {
  const filePath = path.join(messagesDir, `${locale.code}.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`${locale.code}.json (${locale.name}):`);
    console.log('  ⚠️ 檔案不存在！');
    console.log('');
    continue;
  }

  const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missing = findMissingKeys(zhTW, messages);

  console.log(`${locale.code}.json (${locale.name}) 缺少的 key:`);
  if (missing.length === 0) {
    console.log('  ✅ (完整)');
  } else {
    missing.forEach(k => console.log('  - ' + k));
    totalMissing += missing.length;
  }
  console.log(`  總計: ${missing.length} 個\n`);
}

console.log('=== 總結 ===');
if (totalMissing === 0) {
  console.log('✅ 所有翻譯檔案皆完整！');
} else {
  console.log(`⚠️ 共有 ${totalMissing} 個缺失的翻譯 key`);
}
