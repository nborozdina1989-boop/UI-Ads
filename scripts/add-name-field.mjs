import fs from 'fs';

const targets = [
  'src/app/mediaplan/upload/page.tsx',
  'src/app/mediaplan/upload/full/page.tsx'
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1) Вставляем state: const [name, setName] = useState('');
  if (!s.includes('const [name, setName]')) {
    const lines = s.split('\n');
    let out = [];
    let inserted = false;
    for (let i=0;i<lines.length;i++){
      const L = lines[i];
      if (!inserted && /const\s*\[\s*advertiser\s*,\s*setAdvertiser\s*\]/.test(L)) {
        out.push(`  const [name, setName] = useState('');`);
        inserted = true;
      }
      out.push(L);
    }
    s = out.join('\n');
    if (inserted) changed = true;
  }

  // 2) Вставляем инпут "Название РК" в сетку обязательных полей
  if (!s.includes('>Название РК<')) {
    s = s.replace(
      /(<div className="grid[^"]*gap-4"[^>]*>)/,
      `$1
          <div>
            <label className="block text-sm font-medium text-slate-700">Название РК</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Осень-25 / Старт продаж"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>`
    );
    changed = true;
  }

  // 3) Делам поле обязательным: обновляем canCreate (добавляем проверку name)
  if (s.includes('const canCreate') && !s.includes('name.trim().length > 0')) {
    s = s.replace(
      /(const\s+canCreate\s*=\s*)/,
      `$1name.trim().length > 0 && `
    );
    changed = true;
  }

  // 4) Подсказка при незаполненных полях — добавляем упоминание Названия РК
  if (s.includes('Заполните обязательные поля:') && !s.includes('Название РК')) {
    s = s.replace(
      /Заполните обязательные поля:/,
      'Заполните обязательные поля: Название РК,'
    );
    changed = true;
  }

  // 5) В payload createCampaign — добавляем name
  if (s.includes('const payload = {') && !s.match(/const payload = \{[^}]*\bname\b/)) {
    s = s.replace(/const payload = \{/, 'const payload = { name, ');
    changed = true;
  }

  // 6) В draft save — добавляем name
  if (s.includes('const draft = {') && !s.match(/const draft = \{[^}]*\bname\b/)) {
    s = s.replace(/const draft = \{/, 'const draft = { name, ');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, s);
    console.log(`✔ Patched: ${file}`);
  } else {
    console.log(`= No changes needed: ${file}`);
  }
}
