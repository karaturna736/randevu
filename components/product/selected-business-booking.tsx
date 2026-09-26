"use client";

import { useEffect, useState } from "react";
import BookingTheme from "@/components/themes/booking-theme";
import BookingForm from "./booking-form";
import { Assistant } from "./assistant";
import { api, Blank, Busy } from "./common";
import { PublicShell } from "./public";

export function SelectedBusinessBooking({ slug, branchId }: { slug: string; branchId?: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [assistant, setAssistant] = useState(false);
  const [initial, setInitial] = useState<any>(null);

  useEffect(() => {
    setError("");
    setInitial(null);
    api("public/" + encodeURIComponent(slug))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug, branchId]);

  if (error)
    return (
      <PublicShell>
        <div className="public-message">
          <Blank title="İşletme şu anda randevuya açık değil" description={error} />
          <a className="button primary" href="/kesfet">İşletmeleri keşfet</a>
        </div>
      </PublicShell>
    );

  if (!data)
    return (
      <PublicShell>
        <div className="loading-row"><Busy /> İşletme hazırlanıyor…</div>
      </PublicShell>
    );

  const branches = data.branches || [];
  const requestedBranch = branchId && branches.some((b: any) => b.id === branchId) ? branchId : "";
  const activeBranchId = initial?.branch_id || requestedBranch || branches[0]?.id || "";
  const selectedBranch = branches.find((b: any) => b.id === activeBranchId);

  return (
    <PublicShell business={data.business} presentation={data.presentation}>
      {selectedBranch && (
        <div className="panel" style={{ maxWidth: 1100, margin: "18px auto 0" }}>
          <span className="eyebrow">SEÇİLEN ŞUBE</span>
          <strong>{selectedBranch.name}</strong>
          <span className="muted">{[selectedBranch.city, selectedBranch.address].filter(Boolean).join(" · ")}</span>
          <a className="text-button" href="/kesfet">Şubeyi değiştir</a>
        </div>
      )}
      <BookingTheme data={data} onAssistant={() => setAssistant(true)}>
        <BookingForm key={JSON.stringify(initial)} data={data} initial={initial} />
      </BookingTheme>
      <Assistant
        open={assistant}
        onClose={() => setAssistant(false)}
        w={data}
        publicSlug={slug}
        onBook={(x: any) => {
          setAssistant(false);
          setInitial({ ...x, branch_id: x?.branch_id || activeBranchId || "" });
        }}
      />
    </PublicShell>
  );
}
