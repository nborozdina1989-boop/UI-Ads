'use client';
import { useEffect, useMemo, useState } from 'react';

export default function CreateMediaplanPage() {
  const [name, setName] = useState('');
  const [advertiser, setAdvertiser] = useState('');
  const [brand, setBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [codeType, setCodeType] = useState('');
  const [landing, setLanding] = useState('');
  const [scenariosText, setScenariosText] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('mp:create-draft');
    if (raw) {
      const d = JSON.parse(raw);
      setName(d.name || '');
      setAdvertiser(d.advertiser || '');
      setBrand(d.brand || '');
      setSupplier(d.supplier || '');
      setCodeType(d.codeType || '');
      setLanding(d.landing || '');
      setScenariosText((d.scenarios || []).join('\n'));
    }
  }, []);

  const scenarios = useMemo(
    () => scenariosText.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
    [scenariosText]
  );

  const canCreate =
    name.trim().length > 0 &&
    advertiser.trim().length > 0 &&
    brand.trim().length > 0 &&
    landing.trim().length > 0 &&
    scenarios.length > 0;

  const saveDraft = () => {
    const draft = { name, advertiser, brand, supplier, codeType, landing, scenarios };
    localStorage.setItem('mp:create-draft', JSON.stringify(draft));
    alert('Черновик сохранён');
  };

  const createCampaign = () => {
    if (!canCreate) {
      alert('Заполните обязательные поля: Название РК, Рекламодатель, Бренд, Посадочная страница и список Сценариев.');
      return;
    }
    const payload = { name, advertiser, brand, supplier, codeType, landing, scenarios };
    localStorage.setItem('mp:last-created', JSON.stringify(payload));
    alert('Рекламная кампания создана (демо). Перейдите к генерации кодов.');
  };

  const card = 'rounded-xl border p-4 bg-white';
  const label = 'block text-sm font-medium text-slate-700';
  const input = 'mt-1 w-full rounded-md border px-3 py-2';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Создать медиаплан</h1>
        <a href="/mediaplan/upload" className="text-[#0078D7] underline">← Загрузить Excel</a>
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold text-slate-700 mb-3">Обязательные поля (для всей РК)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Название РК</label>
            <input className={input} required value={name} onChange={e=>setName(e.target.value)} placeholder="Осень-25 / Старт продаж"/>
          </div>
          <div>
            <label className={label}>Рекламодатель</label>
            <input className={input} required value={advertiser} onChange={e=>setAdvertiser(e.target.value)} placeholder="ООО «Ромашка»"/>
          </div>
          <div>
            <label className={label}>Бренд</label>
            <input className={input} required value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Romashka"/>
          </div>
          <div>
            <label className={label}>Поставщик</label>
            <input className={input} value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Yandex / VK / другое"/>
          </div>
          <div>
            <label className={label}>Тип кода</label>
            <input className={input} value={codeType} onChange={e=>setCodeType(e.target.value)} placeholder="Аудит, VAST, IVT и т.п."/>
          </div>
          <div className="md:col-span-2">
            <label className={label}>Посадочная страница</label>
            <input className={input} required value={landing} onChange={e=>setLanding(e.target.value)} placeholder="https://example.ru/landing"/>
          </div>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold text-slate-700 mb-3">Сценарии</h3>
        <p className="text-sm text-slate-500 mb-2">Каждый сценарий — на новой строке.</p>
        <textarea className="w-full rounded-md border px-3 py-2" rows={6}
          value={scenariosText} onChange={e=>setScenariosText(e.target.value)}
          placeholder={'Сценарий 1\nСценарий 2\n...'} />
        <div className="mt-2 text-sm text-slate-500">Будет создано сценариев: {scenarios.length}</div>
      </div>

      <div className="flex gap-3">
        <button onClick={createCampaign} disabled={!canCreate}
          className="rounded-lg px-4 py-2 bg-[#0078D7] text-white disabled:opacity-50">
          Создать рекламную кампанию
        </button>
        <button onClick={saveDraft} className="rounded-lg px-4 py-2 border">
          Сохранить в черновики
        </button>
      </div>
    </div>
  );
}
