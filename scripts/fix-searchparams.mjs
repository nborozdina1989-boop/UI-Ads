import fs from 'fs';
import path from 'path';

const root = path.resolve('src/app');
const pagesDir = path.join(root, '_pages');
fs.mkdirSync(pagesDir, { recursive: true });

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,c){ fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p,c); }
function rm(p){ try{ fs.rmSync(p); }catch{} }

function stripComments(code){
  // убираем /* ... */ и // ... до конца строки (грубо, но надёжно для поиска)
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');
}

function pascalCase(seg){
  return seg.replace(/(^.|[-_\/].)/g, s=>s.replace(/[-_\/]/,'').toUpperCase());
}

function findPages(dir, acc=[]){
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.name === '_pages') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) findPages(p, acc);
    else if (entry.isFile() && entry.name === 'page.tsx') acc.push(p);
  }
  return acc;
}

const pages = findPages(root);
const touched = [];

for (const pagePath of pages) {
  const relFromApp = pagePath.replace(root + path.sep, '');
  const code = read(pagePath);
  const noComments = stripComments(code);
  if (!noComments.includes('useSearchParams(')) continue; // не трогаем страницы без реального вызова

  // Готовим имена/пути
  const routeDir = path.dirname(relFromApp); // например "generation" или "generation/codes"
  const componentName = pascalCase(routeDir) + 'ClientPage'; // GenerationClientPage / GenerationCodesClientPage
  const destComp = path.join(pagesDir, `${componentName}.tsx`);

  // 1) Создаём клиентский компонент
  let comp = code;

  // Добавляем 'use client' единожды и в начало
  comp = comp.replace(/^'use client';\s*/g, ''); // убрать дубли, если были
  comp = `'use client';\n` + comp;

  // Починить импорт CSS на стабильный абсолютный путь под alias "@/app/"
  // Любые относительные импорты adriver.module.css -> "@/app/<routeDir>/adriver.module.css"
  const cssAbs = `@/app/${routeDir}/adriver.module.css`;
  comp = comp.replace(/from\s+['"](\.\/|\.\.\/)+adriver\.module\.css['"]/g, `from "${cssAbs}"`);

  write(destComp, comp);

  // 2) Создаём серверный враппер с <Suspense>
  const wrapper = `
import { Suspense } from 'react';
import ${componentName} from '@/app/_pages/${componentName}';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <${componentName} />
    </Suspense>
  );
}
`.trimStart();
  write(pagePath, wrapper);

  touched.push({ routeDir, pagePath, destComp });
}

if (touched.length === 0) {
  console.log('✅ Страницы с реальным useSearchParams() не найдены — ничего не менялось.');
} else {
  console.log('✅ Исправлены страницы:');
  for (const t of touched) {
    console.log('-', t.pagePath, '→', t.destComp);
  }
}
