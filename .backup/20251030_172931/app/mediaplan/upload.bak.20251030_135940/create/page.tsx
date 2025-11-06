'use client';
import React, { useEffect, useMemo, useState } from "react";

type SupplierKey =
  | "hybrid" | "vk" | "mytarget" | "yandex" | "google" | "ozon" | "sber" | "other";

const SUPPLIER_LABEL: Record<SupplierKey, string> = {
  hybrid: "Hybrid",
  vk: "VK",
  mytarget: "myTarget",
  yandex: "Яндекс",
  google: "Google",
  ozon: "Ozon",
  sber: "Сбер",
  other: "Другое",
};

type FormatKey = "media" | "video" | "mraid";
const FORMAT_LABEL: Record<FormatKey, string> = {
  media: "Медиа",
  video: "Видео",
  mraid: "MRAID",
};

type CampaignForm = {
  advertiser: string;
  brand: string;
  start: string; // ISO yyyy-mm-dd
  end: string;   // ISO yyyy-mm-dd
  baseUrl: string;
};

type ScenarioRow = {
  id: string;
  name: string;
  format: FormatKey;
  supplier?: SupplierKey | "";
  url: string;
  error?: string;
};

const AUTOSAVE_KEY = "mp_create_draft_autosave";
const DRAFTS_KEY = "mp_drafts";
const SESSION_KEY = "mp_created_session";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CreateMediaPlanPage() {
  // Ввод названий сценариев
  const [raw, setRaw] = useState("");
  // Форма кампании
  const [campaign, setCampaign] = useState<CampaignForm>({
    advertiser: "",
    brand: "",
    start: "",
    end: "",
    baseUrl: "",
  });
  // Табличные строки сценариев (после «Предпросмотр»)
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [previewed, setPreviewed] = useState(false);

  // Восстановление автосейва
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj?.raw) setRaw(String(obj.raw));
        if (obj?.campaign) setCampaign(obj.campaign);
        if (Array.isArray(obj.rows)) setRows(obj.rows);
        if (obj?.previewed) setPreviewed(!!obj.previewed);
      }
    } catch {}
  }, []);

  // Автосейв
  useEffect(() => {
    const payload = JSON.stringify({ raw, campaign, rows, previewed: previewed ? 1 : 0 });
    localStorage.setItem(AUTOSAVE_KEY, payload);
  }, [raw, campaign, rows, previewed]);

  // Парсинг строк
  function parseLines(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function onPreview() {
    const names = Array.from(new Set(parseLines(raw)));
    const next: ScenarioRow[] = names.map(n => {
      const existed = rows.find(r => r.name === n);
      return existed ?? {
        id: genId(),
        name: n,
        format: "media",
        supplier: "",
        url: campaign.baseUrl || "",
      };
    });
    setRows(next);
    setPreviewed(true);
  }

  function onClear() {
    const snapshot = { raw, campaign, rows };
    // простое undo: хранить в памяти на этот рендер
    setRaw("");
    setRows([]);
    setPreviewed(false);
    // тост можно добавить позже; для прототипа достаточно очистки
    console.log("Очистка. Было:", snapshot);
  }

  // Валидация
  const campaignValid = useMemo(() => {
    if (!campaign.advertiser.trim()) return false;
    if (!campaign.brand.trim()) return false;
    if (!campaign.start || !campaign.end) return false;
    if (campaign.end < campaign.start) return false;
    try {
      new URL(campaign.baseUrl);
    } catch {
      return false;
    }
    return true;
  }, [campaign]);

  const rowsValid = useMemo(() => {
    if (!rows.length) return false;
    for (const r of rows) {
      if (!r.name.trim()) return false;
      try {
        new URL(r.url);
      } catch {
        return false;
      }
    }
    return true;
  }, [rows]);

  const canCreate = campaignValid && rowsValid;

  function saveDraft() {
    const drafts = (() => {
      try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]"); } catch { return []; }
    })();
    const id = genId();
    const name = `РК ${campaign.brand || "Без бренда"} — ${new Date().toLocaleDateString()}`;
    const draft = {
      id, name, updatedAt: new Date().toISOString(), campaign, rows, raw,
    };
    drafts.unshift(draft);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, 50)));
    alert("Сохранено в черновики.");
  }

  function createCampaign() {
    if (!canCreate) return;
    const session = {
      source: "create_mediaplan_v1",
      campaign,
      scenarios: rows.map(r => ({
        title: r.name,
        supplier: r.supplier || null,
        url: r.url,
        // Тип кода на /generation выставится рандомно согласно договоренностям
      })),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.location.href = "/generation";
  }

  return (
    <div className="space-y-6">
      {/* Ввод сценариев */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Сценарии</h2>
        <p className="text-sm text-gray-600">
          Вставьте по одному сценарию на строку (поддерживается вставка из Excel/Google Sheets).
        </p>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder="Сценарий 1\nСценарий 2\n..."
          className="w-full h-32 border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button onClick={onClear} className="px-3 py-2 border rounded">Очистить</button>
          <button
            onClick={onPreview}
            disabled={parseLines(raw).length === 0}
            className="px-3 py-2 rounded text-white"
            style={{ background: "#0078D7", opacity: parseLines(raw).length ? 1 : 0.6 }}
          >
            Предпросмотр
          </button>
        </div>
      </section>

      {/* Обязательные поля для РК */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Рекламная кампания (обязательное)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Рекламодатель *</span>
            <input className="border rounded px-3 py-2"
              value={campaign.advertiser}
              onChange={e => setCampaign({ ...campaign, advertiser: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Бренд *</span>
            <input className="border rounded px-3 py-2"
              value={campaign.brand}
              onChange={e => setCampaign({ ...campaign, brand: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Дата начала *</span>
            <input type="date" className="border rounded px-3 py-2"
              value={campaign.start}
              onChange={e => setCampaign({ ...campaign, start: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Дата окончания *</span>
            <input type="date" className="border rounded px-3 py-2"
              value={campaign.end}
              onChange={e => setCampaign({ ...campaign, end: e.target.value })} />
          </label>
          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="text-sm">Базовая ссылка (по умолчанию для сценариев) *</span>
            <input className="border rounded px-3 py-2" placeholder="https://example.com/landing"
              value={campaign.baseUrl}
              onChange={e => setCampaign({ ...campaign, baseUrl: e.target.value })} />
          </label>
        </div>
        {!campaignValid && (
          <p className="text-sm text-red-600">Заполните обязательные поля корректно.</p>
        )}
      </section>

      {/* Таблица сценариев */}
      {previewed && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Сценарии: предпросмотр</h2>
            <div className="text-sm text-gray-600">
              {rows.length} сценариев • {rowsValid ? "готово к созданию" : "проверьте поля"}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border bg-white">
              <thead className="bg-gray-50">
                <tr>
                    <th className="text-left p-2 border">#</th>
                    <th className="text-left p-2 border">Название сценария</th>
                    <th className="text-left p-2 border">Формат *</th>
                    <th className="text-left p-2 border">Поставщик</th>
                    <th className="text-left p-2 border">Целевая ссылка *</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{idx + 1}</td>
                    <td className="p-2 border">{r.name}</td>
                    <td className="p-2 border">
                      <select
                        className="border rounded px-2 py-1 bg-white"
                        value={r.format}
                        onChange={e => {
                          const v = e.target.value as FormatKey;
                          setRows(prev => {
                            const c = [...prev]; c[idx] = { ...c[idx], format: v }; return c;
                          });
                        }}
                      >
                        {(Object.keys(FORMAT_LABEL) as FormatKey[]).map(k => (
                          <option key={k} value={k}>{FORMAT_LABEL[k]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 border">
                      <select
                        className="border rounded px-2 py-1 bg-white"
                        value={r.supplier || ""}
                        onChange={e => {
                          const v = e.target.value as SupplierKey | "";
                          setRows(prev => {
                            const c = [...prev]; c[idx] = { ...c[idx], supplier: v }; return c;
                          });
                        }}
                      >
                        <option value="">—</option>
                        {(Object.keys(SUPPLIER_LABEL) as SupplierKey[]).map(k => (
                          <option key={k} value={k}>{SUPPLIER_LABEL[k]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 border">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={r.url}
                        onChange={e => {
                          const v = e.target.value;
                          setRows(prev => {
                            const c = [...prev]; c[idx] = { ...c[idx], url: v }; return c;
                          });
                        }}
                        placeholder={campaign.baseUrl || "https://..."}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Действия */}
      <section className="flex flex-wrap gap-2">
        <button onClick={saveDraft} className="px-3 py-2 border rounded">
          Сохранить в черновики
        </button>
        <button
          onClick={createCampaign}
          disabled={!canCreate}
          className="px-4 py-2 rounded text-white"
          style={{ background: "#0078D7", opacity: canCreate ? 1 : 0.6 }}
        >
          Создать рекламную кампанию
        </button>
      </section>
    </div>
  );
}
