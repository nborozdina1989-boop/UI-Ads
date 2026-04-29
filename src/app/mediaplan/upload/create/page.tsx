'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { appendScenariosToMediaplan, getMediaplan, saveMediaplanScenarioHighlight, upsertCreatedMediaplan } from '@/lib/mediaplan';
import { upsertCampaignFromMediaplan } from '@/lib/campaigns';

function CreateMediaplanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetMediaplanId = searchParams.get('targetMp') || '';
  const isAppendMode = searchParams.get('append') === '1' && Boolean(targetMediaplanId);
  const targetMediaplan = useMemo(
    () => (isAppendMode ? getMediaplan(targetMediaplanId) : null),
    [isAppendMode, targetMediaplanId]
  );
  const appendAccessDenied = isAppendMode && targetMediaplan?.source === 'upload';

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');

  const [agency, setAgency] = useState('');
  const [advertiser, setAdvertiser] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [delegateAccountId, setDelegateAccountId] = useState('');

  const [scenariosText, setScenariosText] = useState('');

  useEffect(() => {
    if (isAppendMode) return;
    const raw = localStorage.getItem('mp:create-draft');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setName(d.name || '');
      setBrand(d.brand || '');
      setAgency(d.agency || '');
      setAdvertiser(d.advertiser || '');
      setStartAt(d.startAt || '');
      setEndAt(d.endAt || '');
      setDelegateAccountId(d.delegateAccountId || '');
      setScenariosText(Array.isArray(d.scenarios) ? d.scenarios.join('\n') : (d.scenariosText || ''));
    } catch {}
  }, [isAppendMode]);

  const scenarios = useMemo(
    () => scenariosText.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
    [scenariosText]
  );

  const canCreate = isAppendMode ? scenarios.length > 0 : Boolean(name.trim() && advertiser.trim() && scenarios.length);

  const label = 'block text-sm font-medium text-slate-700';
  const input = 'mt-1 w-full rounded-md border px-3 py-2';
  const card  = 'rounded-xl border p-4 bg-white';

  const saveDraft = () => {
    const draft = {
      name, brand,
      agency, advertiser,
      startAt, endAt, delegateAccountId,
      scenarios, scenariosText
    };
    localStorage.setItem('mp:create-draft', JSON.stringify(draft));
    alert('Черновик сохранён');
  };

  const saveMediaplan = () => {
    if (appendAccessDenied) return;
    if (!canCreate) {
      alert(
        isAppendMode
          ? 'Добавьте минимум один сценарий.'
          : 'Заполните обязательные поля «Название РК», «Рекламодатель» и добавьте минимум один сценарий.'
      );
      return;
    }
    if (isAppendMode && !targetMediaplan) {
      alert('Целевой медиаплан не найден.');
      return;
    }
    const payload = {
      name, brand,
      agency, advertiser,
      startAt, endAt, delegateAccountId,
      scenarios
    };
    localStorage.setItem('mp:last-created', JSON.stringify(payload));
    if (isAppendMode && targetMediaplan) {
      const record = appendScenariosToMediaplan({
        id: targetMediaplan.id,
        scenarioNames: scenarios,
      });
      upsertCampaignFromMediaplan(record);
      saveMediaplanScenarioHighlight(record.id, scenarios);
      router.push(`/mediaplan/${record.id}?flash=scenarios-added`);
      return;
    }
    const record = upsertCreatedMediaplan({
      title: name,
      advertiser,
      brand,
      agency,
      rowsCount: scenarios.length,
      scenarioNames: scenarios,
      delegateAccounts: delegateAccountId.split(/[,;|]/g).map((item) => item.trim()).filter(Boolean),
      status: 'кампания создана',
    });
    upsertCampaignFromMediaplan(record);
    router.push('/mediaplan');
  };

  if (appendAccessDenied && targetMediaplan) {
    return (
      <section className={card}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Упрощённое добавление недоступно</h2>
            <p className="mt-1 text-sm text-slate-500">
              Медиаплан «{targetMediaplan.title}» был создан через Excel. Новые сценарии можно добавлять только через Excel.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/mediaplan/${targetMediaplan.id}`}
              className="rounded-lg px-4 py-2 border hover:bg-slate-50"
            >
              К карточке медиаплана
            </Link>
            <Link
              href={`/mediaplan/upload?targetMp=${targetMediaplan.id}&append=1`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
            >
              Перейти к добавлению через Excel
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {isAppendMode && targetMediaplan ? (
        <div className={card}>
          <h3 className="mb-3 text-base font-semibold text-slate-700">Медиаплан для дозаведения сценариев</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Название</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{targetMediaplan.title}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">ID / статус</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {targetMediaplan.id} · {targetMediaplan.status}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Рекламодатель</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{targetMediaplan.advertiser || '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Текущий состав</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{targetMediaplan.rowsCount || 0} сценариев</div>
            </div>
          </div>
        </div>
      ) : (
        <div className={card}>
          <h3 className="text-base font-semibold text-slate-700 mb-3">Обязательные поля (для всей РК)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Название рекламной кампании (РК)</label>
              <input className={input} required value={name} onChange={e=>setName(e.target.value)} placeholder="Осень-25 / Старт продаж"/>
            </div>
            <div>
              <label className={label}>Рекламодатель</label>
              <input className={input} required value={advertiser} onChange={e=>setAdvertiser(e.target.value)} placeholder="ООО «Ромашка»"/>
            </div>
          </div>
        </div>
      )}

      {!isAppendMode && (
        <div className={card}>
          <h3 className="text-base font-semibold text-slate-700 mb-3">Дополнительные поля (для всей кампании)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Рекламное агентство</label>
              <input className={input} value={agency} onChange={e=>setAgency(e.target.value)} placeholder="Название агентства"/>
            </div>
            <div>
              <label className={label}>Бренд</label>
              <input className={input} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Название бренда"/>
            </div>
            <div>
              <label className={label}>Старт кампании</label>
              <input className={input} type="date" value={startAt} onChange={e=>setStartAt(e.target.value)} />
            </div>
            <div>
              <label className={label}>Окончание кампании</label>
              <input className={input} type="date" value={endAt} onChange={e=>setEndAt(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Делегирование всей кампании (Account IDs через разделитель)</label>
              <input className={input} value={delegateAccountId} onChange={e=>setDelegateAccountId(e.target.value)} placeholder="acc_123456, acc_654321"/>
            </div>
          </div>
        </div>
      )}

      <div className={card}>
        <h3 className="text-base font-semibold text-slate-700 mb-3">Сценарии</h3>
        <p className="text-sm text-slate-500 mb-2">Каждый сценарий — на новой строке.</p>
        <textarea
          className="w-full rounded-md border px-3 py-2"
          rows={6}
          value={scenariosText}
          onChange={e=>setScenariosText(e.target.value)}
          placeholder={'Сценарий 1\nСценарий 2\n...'}
        />
        <div className="mt-2 text-sm text-slate-500">Будет создано сценариев: {scenarios.length}</div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={saveMediaplan}
          disabled={!canCreate}
          className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isAppendMode ? 'Добавить сценарии в медиаплан' : 'Сохранить медиаплан'}
        </button>
        <button onClick={saveDraft} className="rounded-lg px-4 py-2 border">
          Сохранить в черновики
        </button>
        <Link
          href="/mediaplan"
          className="rounded-lg px-4 py-2 border hover:bg-slate-50"
          aria-label="Вернуться к списку медиапланов"
        >
          К списку медиапланов
        </Link>
        <Link
          href="/mediaplan/drafts"
          className="rounded-lg px-4 py-2 border hover:bg-slate-50"
          aria-label="Перейти к черновикам медиапланов"
        >
          Перейти к черновикам
        </Link>
      </div>
    </div>
  );
}

export default function CreateMediaplanPage() {
  return (
    <Suspense fallback={null}>
      <CreateMediaplanPageContent />
    </Suspense>
  );
}
