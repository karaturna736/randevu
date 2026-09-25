"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/product/dashboard"), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      Demo yükleniyor…
    </main>
  ),
});

export default function DemoPage() {
  return <Dashboard />;
}
