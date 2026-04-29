"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, FileSpreadsheet, MinusCircle, Puzzle, Save, Users } from "lucide-react";
import StatusTypeCell from "@/components/StatusTypeCell";
import { getCampaignStats, listCampaigns, type Campaign } from "@/lib/campaigns";
import {
  getMediaplan,
  listMediaplans,
  saveMediaplan,
  splitList,
  type MediaplanRecord,
  type PlacementRow,
} from "@/lib/mediaplan";

function formatInt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.trunc(value || 0)));
}

function formatDate(raw?: string): string {
  if (!raw) return "—";
  const dotDate = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const date = dotDate ? new Date(Number(dotDate[3]), Number(dotDate[2]) - 1, Number(dotDate[1])) : new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ru-RU");
}

function metricCtr(clicks: number, imps: number): string {
  if (!imps) return "0,00%";
  return `${((clicks / imps) * 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function findMediaplanForCampaign(campaign: Campaign): MediaplanRecord | null {
  if (campaign.mediaplanId) return getMediaplan(campaign.mediaplanId);
  const campaignName = campaign.name.trim().toLowerCase();
  const advertiser = campaign.advertiser.trim().toLowerCase();
  return (
    listMediaplans().find((item) => {
      const itemName = (item.campaignName || item.title || "").trim().toLowerCase();
      const itemAdvertiser = (item.advertiser || "").trim().toLowerCase();
      return itemName === campaignName && (!advertiser || itemAdvertiser === advertiser);
    }) || null
  );
}

function rowTitle(row: PlacementRow, index: number): string {
  return row.platform_name || row.banner_name || `Сценарий ${index + 1}`;
}

function metaValue(value?: string | string[]): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return value?.trim() || "—";
}

function delegationKey(index: number, name: string): string {
  return `${index}:${name.trim().toLowerCase()}`;
}

function delegationText(values?: string[]): string {
  return (values || []).join(", ");
}

function normalizeDelegationInput(value: string): string {
  return splitList(value).join(", ");
}

function AccessStatusIcon(props: { dirty: boolean; delegated: boolean }) {
  if (props.dirty) {
    return (
      <Clock3
        className="h-4 w-4 text-amber-600"
        aria-label="Есть несохранённые изменения"
      />
    );
  }
  if (props.delegated) {
    return (
      <CheckCircle2
        className="h-4 w-4 text-emerald-600"
        aria-label="Делегировано"
      />
    );
  }
  return (
    <MinusCircle
      className="h-4 w-4 text-slate-400"
      aria-label="Не делегировано"
    />
  );
}

function buildPositionStats(params: {
  campaignId: number;
  scenarioNames: string[];
  rows: PlacementRow[];
  totalImps: number;
  totalClicks: number;
}): Record<string, { imps: number; clicks: number }> {
  const { campaignId, scenarioNames, rows, totalImps, totalClicks } = params;
  if (!scenarioNames.length || totalImps <= 0) return {};

  const weights = scenarioNames.map((name, index) => {
    const row = rows[index];
    const formatK = row?.format === "video" ? 1.18 : 1;
    const supplierK = 0.72 + hashUnit(`${campaignId}:${name}:${row?.supplier || ""}`) * 0.76;
    return Math.max(0.1, formatK * supplierK);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  let allocatedImps = 0;
  let allocatedClicks = 0;
  const result: Record<string, { imps: number; clicks: number }> = {};

  scenarioNames.forEach((name, index) => {
    const isLast = index === scenarioNames.length - 1;
    const share = weights[index] / totalWeight;
    const imps = isLast ? Math.max(0, totalImps - allocatedImps) : Math.max(0, Math.round(totalImps * share));
    const baseCtr = totalImps > 0 ? totalClicks / totalImps : 0;
    const ctrK = 0.72 + hashUnit(`${campaignId}:${name}:ctr`) * 0.62;
    const clicks = isLast ? Math.max(0, totalClicks - allocatedClicks) : Math.max(0, Math.round(imps * baseCtr * ctrK));

    allocatedImps += imps;
    allocatedClicks += clicks;
    result[delegationKey(index, name)] = {
      imps,
      clicks: Math.min(clicks, imps),
    };
  });

  return result;
}

export default function CampaignCardPage() {
  const params = useParams<{ id: string }>();
  const campaignId = Number(params.id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [mediaplan, setMediaplan] = useState<MediaplanRecord | null>(null);
  const [campaignDelegationText, setCampaignDelegationText] = useState("");
  const [savedCampaignDelegationText, setSavedCampaignDelegationText] = useState("");
  const [scenarioDelegationTexts, setScenarioDelegationTexts] = useState<Record<string, string>>({});
  const [savedScenarioDelegationTexts, setSavedScenarioDelegationTexts] = useState<Record<string, string>>({});
  const [saveNotice, setSaveNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const foundCampaign = listCampaigns().find((item) => item.id === campaignId) || null;
    const foundMediaplan = foundCampaign ? findMediaplanForCampaign(foundCampaign) : null;
    const foundRows = foundMediaplan?.import?.rows || [];
    const foundScenarioNames =
      foundMediaplan?.scenarioNames?.length
        ? foundMediaplan.scenarioNames
        : foundRows.map((row, index) => rowTitle(row, index));
    const delegationTexts = foundScenarioNames.reduce<Record<string, string>>((acc, name, index) => {
      const rowDelegates = foundRows[index]?.delegate_suppliers || [];
      const savedDelegates = foundMediaplan?.scenarioDelegations?.[delegationKey(index, name)] || [];
      acc[delegationKey(index, name)] = delegationText(rowDelegates.length ? rowDelegates : savedDelegates);
      return acc;
    }, {});

    setCampaign(foundCampaign);
    setMediaplan(foundMediaplan);
    const campaignDelegation = delegationText(
      foundMediaplan?.campaignDelegateAccounts?.length
        ? foundMediaplan.campaignDelegateAccounts
        : foundMediaplan?.import?.meta.delegate_accounts
    );
    setCampaignDelegationText(campaignDelegation);
    setSavedCampaignDelegationText(campaignDelegation);
    setScenarioDelegationTexts(delegationTexts);
    setSavedScenarioDelegationTexts(delegationTexts);
    setSaveNotice("");
    setReady(true);
  }, [campaignId]);

  const stats = useMemo(() => (campaign ? getCampaignStats(campaign) : null), [campaign]);
  const rows = useMemo(() => mediaplan?.import?.rows || [], [mediaplan?.import?.rows]);
  const scenarioNames =
    mediaplan?.scenarioNames?.length
      ? mediaplan.scenarioNames
      : rows.map((row, index) => rowTitle(row, index));
  const canEditDelegation = Boolean(mediaplan);
  const positionStatsByKey = useMemo(
    () =>
      buildPositionStats({
        campaignId,
        scenarioNames,
        rows,
        totalImps: stats?.total.imps || 0,
        totalClicks: stats?.total.clicks || 0,
      }),
    [campaignId, scenarioNames, rows, stats?.total.imps, stats?.total.clicks]
  );
  const isDelegationDirty = useMemo(() => {
    if (normalizeDelegationInput(campaignDelegationText) !== normalizeDelegationInput(savedCampaignDelegationText)) {
      return true;
    }
    return scenarioNames.some((name, index) => {
      const key = delegationKey(index, name);
      return normalizeDelegationInput(scenarioDelegationTexts[key] || "") !== normalizeDelegationInput(savedScenarioDelegationTexts[key] || "");
    });
  }, [campaignDelegationText, savedCampaignDelegationText, scenarioDelegationTexts, savedScenarioDelegationTexts, scenarioNames]);

  function handleScenarioDelegationChange(key: string, value: string) {
    setScenarioDelegationTexts((current) => ({ ...current, [key]: value }));
    setSaveNotice("");
  }

  function handleSaveDelegation() {
    if (!mediaplan) return;

    const campaignDelegateAccounts = splitList(campaignDelegationText);
    const scenarioDelegations = scenarioNames.reduce<Record<string, string[]>>((acc, name, index) => {
      const delegates = splitList(scenarioDelegationTexts[delegationKey(index, name)]);
      if (delegates.length) acc[delegationKey(index, name)] = delegates;
      return acc;
    }, {});

    const nextImport = mediaplan.import
      ? {
          ...mediaplan.import,
          meta: {
            ...mediaplan.import.meta,
            delegate_accounts: campaignDelegateAccounts,
          },
          rows: mediaplan.import.rows.map((row, index) => {
            const name = scenarioNames[index] || rowTitle(row, index);
            return {
              ...row,
              delegate_suppliers: splitList(scenarioDelegationTexts[delegationKey(index, name)]),
            };
          }),
        }
      : mediaplan.import || null;

    const updated = saveMediaplan({
      ...mediaplan,
      campaignDelegateAccounts,
      scenarioDelegations,
      import: nextImport,
    });

    setMediaplan(updated);
    setCampaignDelegationText(delegationText(campaignDelegateAccounts));
    setSavedCampaignDelegationText(delegationText(campaignDelegateAccounts));
    const nextScenarioTexts = scenarioNames.reduce<Record<string, string>>((acc, name, index) => {
        acc[delegationKey(index, name)] = delegationText(scenarioDelegations[delegationKey(index, name)]);
        return acc;
      }, {});
    setScenarioDelegationTexts(nextScenarioTexts);
    setSavedScenarioDelegationTexts(nextScenarioTexts);
    setSaveNotice("Настройки делегирования сохранены.");
  }

  if (!ready) {
    return <div className="p-8 text-sm text-[color:var(--adr-text-muted)]">Загрузка карточки кампании…</div>;
  }

  if (!campaign) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm text-[color:var(--adr-blue)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          К списку рекламных кампаний
        </Link>
        <section className="mt-6 rounded-xl border border-[color:var(--adr-border)] bg-white p-6">
          <h1 className="text-xl font-semibold text-[color:var(--adr-text)]">Кампания не найдена</h1>
          <p className="mt-2 text-sm text-[color:var(--adr-text-muted)]">В локальном списке нет рекламной кампании с ID {params.id}.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--adr-surface)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm text-[color:var(--adr-blue)] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            К списку рекламных кампаний
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard?ids=${campaign.id}`} className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--adr-blue)] px-4 text-sm font-medium text-white">
              <BarChart3 className="h-4 w-4" />
              Дашборд
            </Link>
            <Link href={`/builder?ids=${campaign.id}`} className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]">
              <Puzzle className="h-4 w-4" />
              Конструктор
            </Link>
            {mediaplan ? (
              <Link href={`/mediaplan/${mediaplan.id}?returnCampaign=${campaign.id}`} className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]">
                <FileSpreadsheet className="h-4 w-4" />
                Медиаплан
              </Link>
            ) : null}
          </div>
        </div>

        <section className="rounded-xl border border-[color:var(--adr-border)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusTypeCell type={campaign.type} status={campaign.status} />
                <span className="rounded-full bg-[color:var(--adr-surface)] px-2.5 py-1 text-xs text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">
                  ID {campaign.id}
                </span>
                {mediaplan ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200">
                    из медиаплана {mediaplan.id}
                  </span>
                ) : null}
              </div>
              <h1 className="break-words text-2xl font-semibold leading-tight text-[color:var(--adr-text)] sm:text-3xl">
                {campaign.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[color:var(--adr-text-muted)]">
                <span>Рекламодатель: {campaign.advertiser || "—"}</span>
                <span>·</span>
                <span>Бренд: {campaign.brand || "—"}</span>
                <span>·</span>
                <span>Создана: {formatDate(campaign.createdAt)}</span>
              </div>
            </div>

            {stats ? (
              <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[420px]">
                <div className="rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-3 py-2">
                  <div className="text-xs text-[color:var(--adr-text-muted)]">Показы</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--adr-text)]">{formatInt(stats.total.imps)}</div>
                </div>
                <div className="rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-3 py-2">
                  <div className="text-xs text-[color:var(--adr-text-muted)]">Клики</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--adr-text)]">{formatInt(stats.total.clicks)}</div>
                </div>
                <div className="rounded-lg border border-[color:var(--adr-green)]/35 bg-[color:var(--adr-green)]/10 px-3 py-2">
                  <div className="text-xs text-[color:var(--adr-green)]">CTR</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--adr-green)]">{metricCtr(stats.total.clicks, stats.total.imps)}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--adr-border)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--adr-text)]">Сценарии и размещения</h2>
                <p className="mt-1 text-sm text-[color:var(--adr-text-muted)]">
                  {scenarioNames.length ? `${scenarioNames.length} объектов из медиаплана` : "Объекты появятся после заведения медиаплана."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mediaplan?.fileName ? (
                  <span className="rounded-full bg-[color:var(--adr-surface)] px-3 py-1 text-xs text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">
                    {mediaplan.fileName}
                  </span>
                ) : null}
                {mediaplan ? (
                  <button
                    type="button"
                    onClick={handleSaveDelegation}
                    disabled={!isDelegationDirty}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--adr-blue)] px-4 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Save className="h-4 w-4" />
                    Сохранить изменения
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--adr-blue)]/10 text-[color:var(--adr-blue)]">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[color:var(--adr-text)]">Доступ ко всей кампании</div>
                    <p className="mt-0.5 text-xs leading-5 text-[color:var(--adr-text-muted)]">
                      Эти аккаунты видят всю РК. Доступ к отдельным сценариям настраивается в колонке «Доступ».
                    </p>
                  </div>
                </div>
                {canEditDelegation ? (
                  <label className="min-w-0 lg:w-[420px]">
                    <span className="sr-only">ID аккаунтов для всей рекламной кампании</span>
                    <input
                      value={campaignDelegationText}
                      onChange={(event) => {
                        setCampaignDelegationText(event.target.value);
                        setSaveNotice("");
                      }}
                      placeholder="acc_123456, acc_654321"
                      className="w-full rounded-lg border border-[color:var(--adr-border)] bg-white px-3 py-2 text-sm text-[color:var(--adr-text)] outline-none focus:border-[color:var(--adr-blue)]"
                    />
                    <span className="mt-1 block text-[11px] text-[color:var(--adr-text-muted)]">
                      Разделители: запятая, точка с запятой или |
                    </span>
                  </label>
                ) : (
                  <div className="rounded-lg border border-dashed border-[color:var(--adr-border)] bg-white px-3 py-2 text-sm text-[color:var(--adr-text-muted)]">
                    Для настройки делегирования сначала привяжите или создайте медиаплан.
                  </div>
                )}
              </div>
            </div>

            {rows.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[880px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-y border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">
                      <th className="px-3 py-2 font-medium">Сценарий</th>
                      <th className="px-3 py-2 font-medium">Поставщик</th>
                      <th className="px-3 py-2 font-medium">Формат</th>
                      <th className="px-3 py-2 font-medium">Среда</th>
                      <th className="px-3 py-2 font-medium">Период</th>
                      <th className="px-3 py-2 text-right font-medium">Показы</th>
                      <th className="px-3 py-2 text-right font-medium">Клики</th>
                      <th className="px-3 py-2 text-right font-medium">CTR</th>
                      <th className="px-3 py-2 font-medium">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const title = rowTitle(row, index);
                      const key = delegationKey(index, title);
                      const delegationValue = scenarioDelegationTexts[key] || "";
                      const delegates = splitList(delegationValue);
                      const rowDirty = normalizeDelegationInput(delegationValue) !== normalizeDelegationInput(savedScenarioDelegationTexts[key] || "");
                      const positionStats = positionStatsByKey[key] || { imps: 0, clicks: 0 };
                      return (
                        <tr key={`${title}-${index}`} className="border-b border-[color:var(--adr-border)] last:border-b-0">
                          <td className="px-3 py-3 font-medium text-[color:var(--adr-text)]">{title}</td>
                          <td className="px-3 py-3 text-[color:var(--adr-text-muted)]">{row.supplier || "—"}</td>
                          <td className="px-3 py-3 text-[color:var(--adr-text-muted)]">{row.placement_type || row.format || "—"}</td>
                          <td className="px-3 py-3 text-[color:var(--adr-text-muted)]">{row.environment || "—"}</td>
                          <td className="px-3 py-3 text-[color:var(--adr-text-muted)]">
                            {formatDate(row.time_start)} — {formatDate(row.time_end)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-[color:var(--adr-text)]">{formatInt(positionStats.imps)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[color:var(--adr-text)]">{formatInt(positionStats.clicks)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-[color:var(--adr-text)]">
                            {metricCtr(positionStats.clicks, positionStats.imps)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[170px] items-center gap-2">
                              <input
                                value={delegationValue}
                                onChange={(event) => handleScenarioDelegationChange(key, event.target.value)}
                                placeholder="supplier_123456"
                                aria-label={`ID поставщика для сценария ${title}`}
                                className="w-full rounded-md border border-[color:var(--adr-border)] bg-white px-2 py-1.5 text-sm text-[color:var(--adr-text)] outline-none focus:border-[color:var(--adr-blue)]"
                              />
                              <span
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[color:var(--adr-border)]"
                                title={rowDirty ? "Есть несохранённые изменения" : delegates.length ? "Делегировано" : "Не делегировано"}
                              >
                                <AccessStatusIcon dirty={rowDirty} delegated={delegates.length > 0} />
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : scenarioNames.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-y border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">
                      <th className="px-3 py-2 font-medium">Сценарий</th>
                      <th className="px-3 py-2 text-right font-medium">Показы</th>
                      <th className="px-3 py-2 text-right font-medium">Клики</th>
                      <th className="px-3 py-2 text-right font-medium">CTR</th>
                      <th className="px-3 py-2 font-medium">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioNames.map((name, index) => {
                      const key = delegationKey(index, name);
                      const delegationValue = scenarioDelegationTexts[key] || "";
                      const delegates = splitList(delegationValue);
                      const rowDirty = normalizeDelegationInput(delegationValue) !== normalizeDelegationInput(savedScenarioDelegationTexts[key] || "");
                      const positionStats = positionStatsByKey[key] || { imps: 0, clicks: 0 };
                      return (
                        <tr key={`${name}-${index}`} className="border-b border-[color:var(--adr-border)] last:border-b-0">
                          <td className="px-3 py-3 font-medium text-[color:var(--adr-text)]">{name}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[color:var(--adr-text)]">{formatInt(positionStats.imps)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[color:var(--adr-text)]">{formatInt(positionStats.clicks)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-[color:var(--adr-text)]">
                            {metricCtr(positionStats.clicks, positionStats.imps)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[200px] items-center gap-2">
                              <input
                                value={delegationValue}
                                onChange={(event) => handleScenarioDelegationChange(key, event.target.value)}
                                placeholder="supplier_123456"
                                aria-label={`ID поставщика для сценария ${name}`}
                                className="w-full rounded-md border border-[color:var(--adr-border)] bg-white px-2 py-1.5 text-sm text-[color:var(--adr-text)] outline-none focus:border-[color:var(--adr-blue)]"
                              />
                              <span
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[color:var(--adr-border)]"
                                title={rowDirty ? "Есть несохранённые изменения" : delegates.length ? "Делегировано" : "Не делегировано"}
                              >
                                <AccessStatusIcon dirty={rowDirty} delegated={delegates.length > 0} />
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] p-4 text-sm text-[color:var(--adr-text-muted)]">
                Для этой кампании пока нет привязанного медиаплана.
              </div>
            )}
            {saveNotice ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveNotice}
              </div>
            ) : null}
            <details className="mt-4 rounded-xl border border-[color:var(--adr-border)] bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-[color:var(--adr-text)]">
                Детали кампании и медиаплана
              </summary>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Рекламодатель</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{campaign.advertiser || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Бренд</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{campaign.brand || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Тип</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{campaign.type || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Статус медиаплана</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{mediaplan?.status || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Агентство</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{metaValue(mediaplan?.import?.meta.agency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Продукт</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">{metaValue(mediaplan?.import?.meta.product)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Период РК</dt>
                  <dd className="mt-1 text-[color:var(--adr-text)]">
                    {formatDate(mediaplan?.import?.meta.date_start)} — {formatDate(mediaplan?.import?.meta.date_end)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--adr-text-muted)]">Доступ ко всей РК</dt>
                  <dd className="mt-1 break-words text-[color:var(--adr-text)]">
                    {metaValue(mediaplan?.campaignDelegateAccounts?.length ? mediaplan.campaignDelegateAccounts : mediaplan?.import?.meta.delegate_accounts)}
                  </dd>
                </div>
              </dl>
            </details>
        </section>
      </div>
    </main>
  );
}
