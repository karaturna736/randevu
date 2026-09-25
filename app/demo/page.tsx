"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { demoWorkspace } from "@/lib/demo";

const Dashboard = dynamic(() => import("@/components/product/dashboard"), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      Demo yükleniyor…
    </main>
  ),
});

export default function DemoPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/v1/demo-workspace")) {
        return new Response(JSON.stringify(demoWorkspace()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return originalFetch(input, init);
    }) as typeof window.fetch;

    setReady(true);
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        Demo yükleniyor…
      </main>
    );
  }

  return <Dashboard />;
}
