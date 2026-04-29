"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Puzzle,
  Star,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  addCampaignsToGroup,
  deleteGroup,
  duplicateGroup,
  listCampaigns,
  listGroups,
  MAX_GROUP_CAMPAIGNS,
  removeCampaignFromGroup,
  renameGroup,
  setGroupSharedWith,
  toggleFavGroup,
  type Campaign,
  type Group,
} from "@/lib/campaigns";
import StatusTypeCell from "@/components/StatusTypeCell";
import TabsNav from "./_TabsNav";

function IconBtn({
  icon,
  title,
  href,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    "h-8 w-8 rounded-full border border-[color:var(--adr-border)] text-[color:var(--adr-blue)] flex items-center justify-center " +
    (disabled ? "cursor-not-allowed opacity-45" : "hover:bg-[color:var(--adr-light-blue)]/10");
  const inner = <span className="leading-none">{icon}</span>;
  if (disabled) {
    return (
      <span className={cls} aria-label={title} title={title}>
        {inner}
      </span>
    );
  }
  return href ? (
    <Link href={href} className={cls} aria-label={title} title={title}>
      {inner}
    </Link>
  ) : (
    <button className={cls} aria-label={title} title={title} onClick={onClick}>
      {inner}
    </button>
  );
}

type SortKey =
  | "new"
  | "old"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "size_asc"
  | "status_desc"
  | "status_asc";
type SortField = "name" | "size" | "created" | "status";
type SortDirection = "asc" | "desc" | null;

type GroupView = {
  group: Group;
  existingCampaigns: Campaign[];
  missingIds: number[];
  brandCount: number;
  advertiserCount: number;
  inactiveCount: number;
  hasInactive: boolean;
};

function parseDate(raw: string): Date | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const m = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function dateSortValue(raw: string): number {
  const d = parseDate(raw);
  return d ? d.getTime() : 0;
}

function formatDate(raw: string): string {
  const d = parseDate(raw);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

const sortGroups = (arr: GroupView[], by: SortKey) => {
  const cmp = {
    new: (a: GroupView, b: GroupView) =>
      dateSortValue(b.group.createdAt) - dateSortValue(a.group.createdAt) ||
      a.group.name.localeCompare(b.group.name),
    old: (a: GroupView, b: GroupView) =>
      dateSortValue(a.group.createdAt) - dateSortValue(b.group.createdAt) ||
      a.group.name.localeCompare(b.group.name),
    name_asc: (a: GroupView, b: GroupView) => a.group.name.localeCompare(b.group.name),
    name_desc: (a: GroupView, b: GroupView) => b.group.name.localeCompare(a.group.name),
    size_desc: (a: GroupView, b: GroupView) =>
      b.group.campaignIds.length - a.group.campaignIds.length ||
      b.brandCount - a.brandCount ||
      b.advertiserCount - a.advertiserCount ||
      a.group.name.localeCompare(b.group.name),
    size_asc: (a: GroupView, b: GroupView) =>
      a.group.campaignIds.length - b.group.campaignIds.length ||
      a.brandCount - b.brandCount ||
      a.advertiserCount - b.advertiserCount ||
      a.group.name.localeCompare(b.group.name),
    status_desc: (a: GroupView, b: GroupView) =>
      b.inactiveCount - a.inactiveCount ||
      b.missingIds.length - a.missingIds.length ||
      a.group.name.localeCompare(b.group.name),
    status_asc: (a: GroupView, b: GroupView) =>
      a.inactiveCount - b.inactiveCount ||
      a.missingIds.length - b.missingIds.length ||
      a.group.name.localeCompare(b.group.name),
  }[by];
  return [...arr].sort(cmp);
};

function getSortDirection(sort: SortKey, field: SortField): SortDirection {
  if (field === "name") {
    if (sort === "name_asc") return "asc";
    if (sort === "name_desc") return "desc";
    return null;
  }
  if (field === "size") {
    if (sort === "size_asc") return "asc";
    if (sort === "size_desc") return "desc";
    return null;
  }
  if (field === "created") {
    if (sort === "old") return "asc";
    if (sort === "new") return "desc";
    return null;
  }
  if (sort === "status_asc") return "asc";
  if (sort === "status_desc") return "desc";
  return null;
}

function nextSort(sort: SortKey, field: SortField): SortKey {
  if (field === "name") return sort === "name_asc" ? "name_desc" : "name_asc";
  if (field === "size") return sort === "size_desc" ? "size_asc" : "size_desc";
  if (field === "created") return sort === "new" ? "old" : "new";
  return sort === "status_desc" ? "status_asc" : "status_desc";
}

function parseAccountsInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  value
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(item);
    });
  return result;
}

export default function CampaignGroupsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [groups, setGroups] = useState<Group[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  useEffect(() => {
    if (!mounted) return;
    setGroups(listGroups());
    setCampaigns(listCampaigns());
  }, [mounted]);

  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState<SortKey>("new");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [addSelected, setAddSelected] = useState<Set<number>>(new Set());
  const [groupCampaignQueryById, setGroupCampaignQueryById] = useState<Record<string, string>>({});
  const [groupSelectedCampaignsById, setGroupSelectedCampaignsById] = useState<Record<string, number[]>>({});

  const campaignById = useMemo(() => {
    const map = new Map<number, Campaign>();
    campaigns.forEach((campaign) => {
      map.set(campaign.id, campaign);
    });
    return map;
  }, [campaigns]);

  const groupsWithStats = useMemo(() => {
    return groups.map((group) => {
      const existingCampaigns = group.campaignIds
        .map((id) => campaignById.get(id))
        .filter((campaign): campaign is Campaign => Boolean(campaign));
      const missingIds = group.campaignIds.filter((id) => !campaignById.has(id));
      const brandCount = new Set(
        existingCampaigns.map((campaign) => String(campaign.brand || "").trim() || "Без бренда")
      ).size;
      const advertiserCount = new Set(
        existingCampaigns.map((campaign) => String(campaign.advertiser || "").trim() || "Без рекламодателя")
      ).size;
      const inactiveCount = existingCampaigns.filter((campaign) => campaign.status !== "Активна").length + missingIds.length;
      return {
        group,
        existingCampaigns,
        missingIds,
        brandCount,
        advertiserCount,
        inactiveCount,
        hasInactive: inactiveCount > 0,
      };
    });
  }, [groups, campaignById]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = onlyFav ? groupsWithStats.filter((item) => item.group.favorite) : groupsWithStats;
    return !needle
      ? base
      : base.filter(
          (item) =>
            item.group.name.toLowerCase().includes(needle) || item.group.id.toLowerCase().includes(needle)
        );
  }, [groupsWithStats, q, onlyFav]);

  const shown = useMemo(() => sortGroups(filtered, sort), [filtered, sort]);

  const addingGroup = useMemo(
    () => groups.find((group) => group.id === addingGroupId) || null,
    [groups, addingGroupId]
  );
  const addCapacityLeft = addingGroup ? Math.max(0, MAX_GROUP_CAMPAIGNS - addingGroup.campaignIds.length) : 0;
  const addCandidates = useMemo(() => {
    if (!addingGroup) return [];
    const needle = addQuery.trim().toLowerCase();
    const existing = new Set(addingGroup.campaignIds);
    return campaigns
      .filter((campaign) => {
        if (campaign.status === "archived") return false;
        if (existing.has(campaign.id)) return false;
        if (!needle) return true;
        return String(campaign.id).includes(needle) || campaign.name.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.id - b.id);
  }, [addingGroup, campaigns, addQuery]);

  const allAddCandidatesSelected =
    addCandidates.length > 0 && addCandidates.every((campaign) => addSelected.has(campaign.id));

  const idsToQuery = (ids: number[]) => ids.join(",");
  const sortDir = (field: SortField) => getSortDirection(sort, field);
  const onHeaderSort = (field: SortField) => setSort((prev) => nextSort(prev, field));
  const SortIcon = ({ direction }: { direction: SortDirection }) => {
    if (direction === "asc") {
      return <ChevronDown className="h-3.5 w-3.5 -rotate-180 text-[color:var(--adr-blue)]" />;
    }
    if (direction === "desc") {
      return <ChevronDown className="h-3.5 w-3.5 text-[color:var(--adr-blue)]" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 text-[color:var(--adr-text-muted)]" />;
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const startAddCampaigns = (groupId: string) => {
    setAddingGroupId((prev) => (prev === groupId ? null : groupId));
    setAddQuery("");
    setAddSelected(new Set());
  };

  const toggleAddCandidate = (campaignId: number) => {
    if (!addCapacityLeft) return;
    setAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
        return next;
      }
      if (next.size >= addCapacityLeft) {
        alert(`В группу можно добавить не более ${addCapacityLeft} РК.`);
        return prev;
      }
      next.add(campaignId);
      return next;
    });
  };

  const toggleAllAddCandidates = () => {
    if (!addCandidates.length || !addCapacityLeft) return;
    setAddSelected(() => {
      if (allAddCandidatesSelected) return new Set();
      const next = new Set<number>();
      addCandidates.slice(0, addCapacityLeft).forEach((campaign) => next.add(campaign.id));
      if (addCandidates.length > addCapacityLeft) {
        alert(`Выбраны первые ${addCapacityLeft} РК из результата поиска по лимиту группы.`);
      }
      return next;
    });
  };

  const submitAddCampaigns = () => {
    if (!addingGroupId || !addSelected.size) return;
    try {
      const updated = addCampaignsToGroup(addingGroupId, Array.from(addSelected));
      setGroups(updated);
      setAddSelected(new Set());
      setAddQuery("");
      alert("Выбранные РК добавлены в группу.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось добавить РК в группу.");
    }
  };

  const handleRenameGroup = (group: Group) => {
    const name = prompt("Новое название группы", group.name);
    if (name === null) return;
    try {
      setGroups(renameGroup(group.id, name));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось переименовать группу.");
    }
  };

  const handleDuplicateGroup = (group: Group) => {
    try {
      setGroups(duplicateGroup(group.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось дублировать группу.");
    }
  };

  const handleDeleteGroup = (group: Group) => {
    if (!confirm(`Удалить группу «${group.name}»?`)) return;
    setGroups(deleteGroup(group.id));
    if (expandedGroupId === group.id) setExpandedGroupId(null);
    if (addingGroupId === group.id) setAddingGroupId(null);
  };

  const handleRemoveCampaignFromGroup = (group: Group, campaignId: number, campaignTitle: string) => {
    const ok = confirm(
      `Удалить «${campaignTitle}» из группы «${group.name}»?\n\nЭто действие можно отменить только повторным добавлением РК.`
    );
    if (!ok) return;
    setGroups(removeCampaignFromGroup(group.id, campaignId));
  };

  const handleDelegation = (group: Group) => {
    const value = prompt(
      "Аккаунты для доступа (через запятую или новую строку)",
      group.sharedWith.join(", ")
    );
    if (value === null) return;
    setGroups(setGroupSharedWith(group.id, parseAccountsInput(value)));
    alert("Доступы группы обновлены.");
  };

  const getGroupCampaignQuery = (groupId: string) => groupCampaignQueryById[groupId] ?? "";

  const setGroupCampaignQuery = (groupId: string, value: string) => {
    setGroupCampaignQueryById((prev) => ({ ...prev, [groupId]: value }));
  };

  const getSelectedCampaignIdsForGroup = (
    group: Group,
    source: Record<string, number[]> = groupSelectedCampaignsById
  ): number[] => {
    const selected = source[group.id] ?? [];
    const allowed = new Set(group.campaignIds);
    return selected.filter((campaignId) => allowed.has(campaignId));
  };

  const toggleGroupCampaignSelection = (group: Group, campaignId: number) => {
    setGroupSelectedCampaignsById((prev) => {
      const selected = new Set(getSelectedCampaignIdsForGroup(group, prev));
      if (selected.has(campaignId)) selected.delete(campaignId);
      else selected.add(campaignId);
      return { ...prev, [group.id]: Array.from(selected) };
    });
  };

  const toggleVisibleCampaignSelection = (group: Group, visibleCampaignIds: number[]) => {
    if (!visibleCampaignIds.length) return;
    setGroupSelectedCampaignsById((prev) => {
      const selected = new Set(getSelectedCampaignIdsForGroup(group, prev));
      const allVisibleSelected = visibleCampaignIds.every((campaignId) => selected.has(campaignId));
      if (allVisibleSelected) visibleCampaignIds.forEach((campaignId) => selected.delete(campaignId));
      else visibleCampaignIds.forEach((campaignId) => selected.add(campaignId));
      return { ...prev, [group.id]: Array.from(selected) };
    });
  };

  const removeSelectedCampaignsFromGroup = (group: Group, campaignIds: number[]) => {
    if (!campaignIds.length) return;
    const ok = confirm(
      `Удалить выбранные РК (${campaignIds.length}) из группы «${group.name}»?\n\nЭто действие можно отменить только повторным добавлением РК.`
    );
    if (!ok) return;

    let updated = groups;
    campaignIds.forEach((campaignId) => {
      updated = removeCampaignFromGroup(group.id, campaignId);
    });
    setGroups(updated);
    setGroupSelectedCampaignsById((prev) => ({ ...prev, [group.id]: [] }));
  };

  const clearSelectedCampaignsForGroup = (groupId: string) => {
    setGroupSelectedCampaignsById((prev) => ({ ...prev, [groupId]: [] }));
  };

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-2xl border bg-white p-8 text-gray-500">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="space-y-3">
        <div className="flex items-center">
          <TabsNav active="groups" />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[color:var(--adr-text-muted)]">Поиск</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Название или ID группы"
              className="w-80 rounded-xl border border-[color:var(--adr-border)] px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

        </div>
      </header>

      <section className="rounded-2xl border border-[color:var(--adr-border)] bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--adr-border)] bg-gradient-to-b from-[color:var(--adr-surface)] to-white/90 text-left">
                <th className="w-[64px] px-2 py-2 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => setOnlyFav((prev) => !prev)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                      onlyFav
                        ? "border-[color:var(--adr-green)] text-[color:var(--adr-green)]"
                        : "border-transparent text-[color:var(--adr-text-muted)] hover:border-[color:var(--adr-border)]"
                    }`}
                    title={onlyFav ? "Показать все группы" : "Показать только избранные группы"}
                    aria-label={onlyFav ? "Показать все группы" : "Показать только избранные группы"}
                  >
                    <Star className={`h-4 w-4 ${onlyFav ? "fill-current" : ""}`} />
                  </button>
                </th>
                <th className="px-3 py-2 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onHeaderSort("name")}
                    className="inline-flex items-center gap-1.5 hover:text-[color:var(--adr-blue)]"
                    title="Сортировать по названию"
                  >
                    <span>Название</span>
                    <SortIcon direction={sortDir("name")} />
                  </button>
                </th>
                <th className="px-3 py-2 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onHeaderSort("size")}
                    className="inline-flex items-center gap-1.5 hover:text-[color:var(--adr-blue)]"
                    title="Сортировать по количеству РК"
                  >
                    <span>РК / Бренды</span>
                    <SortIcon direction={sortDir("size")} />
                  </button>
                </th>
                <th className="px-3 py-2 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onHeaderSort("created")}
                    className="inline-flex items-center gap-1.5 hover:text-[color:var(--adr-blue)]"
                    title="Сортировать по дате создания"
                  >
                    <span>Создана</span>
                    <SortIcon direction={sortDir("created")} />
                  </button>
                </th>
                <th className="px-3 py-2 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onHeaderSort("status")}
                    className="inline-flex items-center gap-1.5 hover:text-[color:var(--adr-blue)]"
                    title="Сортировать по состоянию"
                  >
                    <span>Состояние</span>
                    <SortIcon direction={sortDir("status")} />
                  </button>
                </th>
                <th className="px-3 py-2 text-[13px] font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ group, existingCampaigns, missingIds, brandCount, advertiserCount, inactiveCount, hasInactive }) => {
                const reportIds = existingCampaigns.map((campaign) => campaign.id);
                const isExpanded = expandedGroupId === group.id;
                const isAdding = addingGroupId === group.id;
                const innerQuery = getGroupCampaignQuery(group.id).trim().toLowerCase();
                const visibleCampaignIds = group.campaignIds.filter((campaignId) => {
                  if (!innerQuery) return true;
                  if (String(campaignId).includes(innerQuery)) return true;
                  const campaign = campaignById.get(campaignId);
                  return Boolean(campaign && campaign.name.toLowerCase().includes(innerQuery));
                });
                const selectedIdsForGroup = getSelectedCampaignIdsForGroup(group);
                const selectedInGroup = new Set(selectedIdsForGroup);
                const selectedVisibleCount = visibleCampaignIds.filter((campaignId) =>
                  selectedInGroup.has(campaignId)
                ).length;
                const allVisibleSelected =
                  visibleCampaignIds.length > 0 && selectedVisibleCount === visibleCampaignIds.length;
                return (
                  <React.Fragment key={group.id}>
                    <tr className="odd:bg-white even:bg-[color:var(--adr-surface)] hover:bg-[color:var(--adr-light-blue)]/10">
                      <td className="border-t border-[color:var(--adr-border)] p-2 text-center align-middle">
                        <button
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                            group.favorite
                              ? "border-[color:var(--adr-green)] text-[color:var(--adr-green)]"
                              : "border-[color:var(--adr-border)] text-[color:var(--adr-text-muted)]"
                          }`}
                          onClick={() => setGroups(toggleFavGroup(group.id))}
                          aria-label={group.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                          title={group.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                        >
                          <Star className={`h-4 w-4 ${group.favorite ? "fill-current" : ""}`} />
                        </button>
                      </td>

                      <td className="border-t border-[color:var(--adr-border)] p-2 align-top">
                        <button
                          className="group inline-flex items-center gap-2 text-left"
                          onClick={() => toggleExpand(group.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[color:var(--adr-text-muted)]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[color:var(--adr-text-muted)]" />
                          )}
                          <span className="text-[17px] font-semibold text-[color:var(--adr-blue)] group-hover:underline">
                            {group.name}
                          </span>
                        </button>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--adr-text-muted)]">
                          <span className="rounded-full border border-[color:var(--adr-border)] bg-white px-2 py-0.5">
                            Доступов: {group.sharedWith.length}
                          </span>
                        </div>
                      </td>

                      <td className="border-t border-[color:var(--adr-border)] p-2 align-top">
                        <div className="inline-flex items-center rounded-full border border-[color:var(--adr-light-blue)]/45 bg-[color:var(--adr-light-blue)]/10 px-2.5 py-1 text-xs text-[color:var(--adr-blue)]">
                          {group.campaignIds.length} РК / {brandCount} брендов / {advertiserCount} рекламодателей
                        </div>
                        <div className="mt-2 text-xs text-[color:var(--adr-text-muted)]">
                          Лимит: {group.campaignIds.length}/{MAX_GROUP_CAMPAIGNS}
                        </div>
                      </td>

                      <td className="border-t border-[color:var(--adr-border)] p-2 align-top text-[13px]">
                        <div>{formatDate(group.createdAt)}</div>
                      </td>

                      <td className="border-t border-[color:var(--adr-border)] p-2 align-top">
                        {hasInactive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--adr-orange)]/50 bg-[color:var(--adr-orange)]/10 px-2.5 py-1 text-xs text-[color:var(--adr-orange)]">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            содержит неактивные: {inactiveCount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--adr-green)]/50 bg-[color:var(--adr-green)]/10 px-2.5 py-1 text-xs text-[color:var(--adr-green)]">
                            все кампании активны
                          </span>
                        )}
                        {missingIds.length > 0 ? (
                          <div className="mt-2 text-xs text-[color:var(--adr-text-muted)]">
                            Недоступные РК: {missingIds.length}
                          </div>
                        ) : null}
                      </td>

                      <td className="border-t border-[color:var(--adr-border)] p-2 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <IconBtn
                            icon={<BarChart3 className="h-4 w-4" />}
                            title="Открыть дашборд группы"
                            href={reportIds.length ? `/dashboard?ids=${idsToQuery(reportIds)}` : undefined}
                            disabled={!reportIds.length}
                          />
                          <IconBtn
                            icon={<Puzzle className="h-4 w-4" />}
                            title="Открыть конструктор группы"
                            href={reportIds.length ? `/builder?ids=${idsToQuery(reportIds)}` : undefined}
                            disabled={!reportIds.length}
                          />
                          <IconBtn
                            icon={<Plus className="h-4 w-4" />}
                            title="Добавить РК в группу"
                            onClick={() => startAddCampaigns(group.id)}
                          />
                          <IconBtn
                            icon={<Pencil className="h-4 w-4" />}
                            title="Переименовать группу"
                            onClick={() => handleRenameGroup(group)}
                          />
                          <IconBtn
                            icon={<Copy className="h-4 w-4" />}
                            title="Дублировать группу"
                            onClick={() => handleDuplicateGroup(group)}
                          />
                          <IconBtn
                            icon={<UserRoundPlus className="h-4 w-4" />}
                            title="Делегировать доступ"
                            onClick={() => handleDelegation(group)}
                          />
                          <IconBtn
                            icon={<Trash2 className="h-4 w-4 text-[color:var(--adr-danger)]" />}
                            title="Удалить группу"
                            onClick={() => handleDeleteGroup(group)}
                          />
                        </div>
                      </td>
                    </tr>

                    {isAdding ? (
                      <tr>
                        <td colSpan={6} className="border-t border-[color:var(--adr-border)] bg-white px-3 pb-3">
                          <div className="rounded-xl border border-[color:var(--adr-border)] bg-[color:var(--adr-light-blue)]/5 p-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <input
                                value={addQuery}
                                onChange={(e) => setAddQuery(e.target.value)}
                                placeholder="Поиск РК по ID или названию"
                                className="w-full max-w-[360px] rounded-lg border border-[color:var(--adr-border)] bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                              />
                              <button
                                type="button"
                                onClick={toggleAllAddCandidates}
                                className="rounded-full border border-[color:var(--adr-border)] bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] hover:bg-[color:var(--adr-light-blue)]/10 disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={!addCandidates.length || addCapacityLeft === 0}
                              >
                                {allAddCandidatesSelected ? "Снять выбор" : "Выбрать все"}
                              </button>
                              <button
                                type="button"
                                onClick={submitAddCampaigns}
                                className="rounded-full bg-[color:var(--adr-blue)] px-3 py-1 text-xs text-white hover:bg-[color:var(--adr-dark-blue)] disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={!addSelected.size || addCapacityLeft === 0}
                              >
                                Добавить ({addSelected.size})
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingGroupId(null)}
                                className="rounded-full border border-[color:var(--adr-border)] bg-white px-3 py-1 text-xs text-[color:var(--adr-text-muted)] hover:bg-[color:var(--adr-surface)]"
                              >
                                Закрыть
                              </button>
                              <span className="ml-auto text-xs text-[color:var(--adr-text-muted)]">
                                Свободно мест: {addCapacityLeft}
                              </span>
                            </div>

                            {addCapacityLeft === 0 ? (
                              <div className="rounded-lg border border-[color:var(--adr-orange)]/45 bg-[color:var(--adr-orange)]/10 px-3 py-2 text-sm text-[color:var(--adr-orange)]">
                                В группе достигнут лимит {MAX_GROUP_CAMPAIGNS} РК.
                              </div>
                            ) : (
                              <div className="max-h-52 overflow-auto rounded-lg border border-[color:var(--adr-border)] bg-white">
                                {addCandidates.length === 0 ? (
                                  <div className="px-3 py-4 text-sm text-[color:var(--adr-text-muted)]">Кампании не найдены</div>
                                ) : (
                                  addCandidates.map((campaign) => (
                                    <label
                                      key={campaign.id}
                                      className="flex cursor-pointer items-center gap-2 border-b border-[color:var(--adr-border)] px-3 py-2 text-sm last:border-b-0 hover:bg-[color:var(--adr-light-blue)]/10"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={addSelected.has(campaign.id)}
                                        onChange={() => toggleAddCandidate(campaign.id)}
                                        disabled={
                                          !addSelected.has(campaign.id) && addSelected.size >= addCapacityLeft
                                        }
                                      />
                                      <span className="font-medium text-[color:var(--adr-blue)]">{campaign.id}</span>
                                      <span className="text-[color:var(--adr-text)]">{campaign.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {isExpanded ? (
                      <tr>
                        <td colSpan={6} className="border-t border-[color:var(--adr-border)] bg-white px-3 pb-3">
                          <div className="rounded-xl border border-[color:var(--adr-border)] bg-white p-3">
                            <div className="mb-2 text-xs text-[color:var(--adr-text-muted)]">
                              ID группы: {group.id}
                            </div>
                            <div className="mb-2 text-sm font-semibold text-[color:var(--adr-text)]">
                              Состав группы ({group.campaignIds.length})
                            </div>
                            {!group.campaignIds.length ? (
                              <div className="text-sm text-[color:var(--adr-text-muted)]">В группе пока нет кампаний.</div>
                            ) : !visibleCampaignIds.length ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={getGroupCampaignQuery(group.id)}
                                    onChange={(e) => setGroupCampaignQuery(group.id, e.target.value)}
                                    placeholder="Поиск РК внутри группы (ID или название)"
                                    className="w-full max-w-[360px] rounded-lg border border-[color:var(--adr-border)] bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setGroupCampaignQuery(group.id, "")}
                                    className="rounded-full border border-[color:var(--adr-border)] bg-white px-3 py-1 text-xs text-[color:var(--adr-text-muted)] hover:bg-[color:var(--adr-surface)]"
                                  >
                                    Сбросить
                                  </button>
                                </div>
                                <div className="text-sm text-[color:var(--adr-text-muted)]">По запросу ничего не найдено.</div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={getGroupCampaignQuery(group.id)}
                                    onChange={(e) => setGroupCampaignQuery(group.id, e.target.value)}
                                    placeholder="Поиск РК внутри группы (ID или название)"
                                    className="w-full max-w-[360px] rounded-lg border border-[color:var(--adr-border)] bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleVisibleCampaignSelection(group, visibleCampaignIds)}
                                    className="rounded-full border border-[color:var(--adr-border)] bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] hover:bg-[color:var(--adr-light-blue)]/10 disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!visibleCampaignIds.length}
                                  >
                                    {allVisibleSelected ? "Снять выделение" : "Выбрать найденные"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeSelectedCampaignsFromGroup(group, selectedIdsForGroup)}
                                    className="rounded-full bg-[color:var(--adr-danger)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!selectedIdsForGroup.length}
                                  >
                                    Удалить выбранные ({selectedIdsForGroup.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearSelectedCampaignsForGroup(group.id)}
                                    className="rounded-full border border-[color:var(--adr-border)] bg-white px-3 py-1 text-xs text-[color:var(--adr-text-muted)] hover:bg-[color:var(--adr-surface)] disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!selectedIdsForGroup.length}
                                  >
                                    Сбросить выбор
                                  </button>
                                  <span className="ml-auto text-xs text-[color:var(--adr-text-muted)]">
                                    Найдено: {visibleCampaignIds.length} · Выбрано: {selectedVisibleCount}
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                {visibleCampaignIds.map((campaignId) => {
                                  const campaign = campaignById.get(campaignId);
                                  const checked = selectedInGroup.has(campaignId);
                                  if (!campaign) {
                                    return (
                                      <div
                                        key={campaignId}
                                        className="flex items-center gap-2 rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-3 py-2 text-sm"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleGroupCampaignSelection(group, campaignId)}
                                          aria-label={`Выбрать РК ${campaignId}`}
                                        />
                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                          <div className="text-[color:var(--adr-text-muted)]">
                                            <span className="font-semibold">#{campaignId}</span> РК недоступна или удалена
                                          </div>
                                          <button
                                            onClick={() =>
                                              handleRemoveCampaignFromGroup(group, campaignId, `РК ${campaignId}`)
                                            }
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--adr-border)] text-[color:var(--adr-danger)] hover:bg-[color:var(--adr-danger)]/10"
                                            aria-label="Удалить недоступную РК из группы"
                                            title="Удалить недоступную РК из группы"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  const title = `${campaign.id} · ${campaign.name}`;
                                  return (
                                    <div
                                      key={campaign.id}
                                      className="flex items-center gap-2 rounded-lg border border-[color:var(--adr-border)] px-3 py-2 text-sm"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleGroupCampaignSelection(group, campaignId)}
                                        aria-label={`Выбрать ${title}`}
                                      />
                                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate font-medium text-[color:var(--adr-blue)]">{title}</div>
                                          <div className="text-xs text-[color:var(--adr-text-muted)]">
                                            {campaign.advertiser || "Без рекламодателя"} · {campaign.brand || "Без бренда"}
                                          </div>
                                        </div>
                                        <div className="ml-4 flex items-center gap-3">
                                          <StatusTypeCell type={campaign.type} status={campaign.status} />
                                          <span
                                            className={`text-xs ${
                                              campaign.status === "Активна"
                                                ? "text-[color:var(--adr-green)]"
                                                : "text-[color:var(--adr-text-muted)]"
                                            }`}
                                          >
                                            {campaign.status === "Активна" ? "Активна" : "Не активна"}
                                          </span>
                                          <button
                                            onClick={() =>
                                              handleRemoveCampaignFromGroup(
                                                group,
                                                campaign.id,
                                                `${campaign.id} · ${campaign.name}`
                                              )
                                            }
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--adr-border)] text-[color:var(--adr-danger)] hover:bg-[color:var(--adr-danger)]/10"
                                            aria-label="Удалить РК из группы"
                                            title="Удалить РК из группы"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                </div>
                              </div>
                            )}

                            {group.sharedWith.length > 0 ? (
                              <div className="mt-3 rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-3 py-2 text-xs text-[color:var(--adr-text-muted)]">
                                Делегировано аккаунтам: {group.sharedWith.join(", ")}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}

              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[color:var(--adr-text-muted)]">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
