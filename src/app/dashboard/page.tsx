"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Тип для строки данных
interface PlacementData {
  placement: string;
  impressions: number;
  reach: number;
  uniqueAudience: number;
  clicks: number;
  uniqueClicks: number;
  frequency: number;
  budget: number;
  ivt: number;
}

// Тестовые данные
const data: PlacementData[] = [
  {
    placement: "Yandex / Banner 300x250",
    impressions: 240000,
    reach: 160000,
    uniqueAudience: 90000,
    clicks: 3800,
    uniqueClicks: 2900,
    frequency: 1.5,
    budget: 210000,
    ivt: 2.1,
  },
  {
    placement: "VK / Video preroll",
    impressions: 180000,
    reach: 120000,
    uniqueAudience: 70000,
    clicks: 2600,
    uniqueClicks: 2100,
    frequency: 1.6,
    budget: 240000,
    ivt: 2.8,
  },
  {
    placement: "RBC / Banner 728x90",
    impressions: 120000,
    reach: 85000,
    uniqueAudience: 52000,
    clicks: 1600,
    uniqueClicks: 1300,
    frequency: 1.4,
    budget: 110000,
    ivt: 3.2,
  },
  {
    placement: "IVI",
    impressions: 80000,
    reach: 57000,
    uniqueAudience: 35000,
    clicks: 900,
    uniqueClicks: 700,
    frequency: 1.4,
    budget: 130000,
    ivt: 1.8,
  },
  {
    placement: "Hyper",
    impressions: 100000,
    reach: 72000,
    uniqueAudience: 42000,
    clicks: 1400,
    uniqueClicks: 1100,
    frequency: 1.4,
    budget: 90000,
    ivt: 2.4,
  },
];

// Дашборд
export default function DashboardPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("Все кампании");

  return (
    <div className="p-6 space-y-6">
      {/* Фильтры */}
      <div className="grid grid-cols-4 gap-4">
        <input
          type="date"
          className="border p-2 rounded"
          placeholder="Период"
        />
        <select
          className="border p-2 rounded"
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
        >
          <option>Все кампании</option>
          <option>Кампания 1</option>
          <option>Кампания 2</option>
        </select>
        <select className="border p-2 rounded">
          <option>Страна</option>
          <option>Россия</option>
          <option>Казахстан</option>
        </select>
        <select className="border p-2 rounded">
          <option>Город</option>
          <option>Москва</option>
          <option>Санкт-Петербург</option>
        </select>
      </div>

      {/* График */}
      <div className="w-full h-96 bg-white shadow rounded p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="placement" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="impressions" fill="#0078D7" name="Показы" />
            <Bar dataKey="clicks" fill="#95D600" name="Клики" />
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#002E6D"
              strokeWidth={2}
              name="Бюджет ₽"
              yAxisId={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-full table-auto border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2">Размещение</th>
              <th className="border px-4 py-2">Показы</th>
              <th className="border px-4 py-2">Охват</th>
              <th className="border px-4 py-2">Экскл. аудитория</th>
              <th className="border px-4 py-2">Клики</th>
              <th className="border px-4 py-2">Уник. клики</th>
              <th className="border px-4 py-2">Частота</th>
              <th className="border px-4 py-2">Бюджет ₽</th>
              <th className="border px-4 py-2">Доля IVT %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="text-center">
                <td className="border px-4 py-2">{row.placement}</td>
                <td className="border px-4 py-2">{row.impressions.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.reach.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.uniqueAudience.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.clicks.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.uniqueClicks.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.frequency.toFixed(2)}</td>
                <td className="border px-4 py-2">{row.budget.toLocaleString()}</td>
                <td className="border px-4 py-2">{row.ivt.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}