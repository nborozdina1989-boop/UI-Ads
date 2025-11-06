import React from "react";
import TabNav from "./TabNav";

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <TabNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
