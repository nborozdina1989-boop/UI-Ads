import { Suspense } from "react";
import CampaignsPage from "../_pages/CampaignsPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Загрузка…</div>}>
      <CampaignsPage />
    </Suspense>
  );
}
