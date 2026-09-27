"use client";

import { useEffect } from "react";

type Role = "owner" | "manager" | "employee";

const MANAGER = new Set([
  "Genel bakış",
  "Randevular",
  "Takvim",
  "Müşteriler",
  "Hizmetler",
  "Ekip",
  "Şube kârlılığı",
  "Yardım merkezi",
]);
const EMPLOYEE = new Set(["Randevular", "Takvim", "Müşteriler", "Yardım merkezi"]);
const ALL_NAV = new Set([
  "Genel bakış",
  "Randevular",
  "Takvim",
  "Müşteriler",
  "Hizmetler",
  "Ekip",
  "Borç / Veresiye",
  "Hizmet yolculuğu",
  "Randevu linkim",
  "Pazarlama ve büyüme",
  "Gelir kurtarma",
  "Talep fırsatları",
  "İşlem analizi",
  "Gelir raporu",
  "Şube kârlılığı",
  "Plus araçları",
  "WhatsApp",
  "Kurulum Merkezi",
  "Yardım merkezi",
  "Ayarlar",
]);

function textOf(element: Element) {
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

export default function RolePanelGuard({
  role,
  branchName,
}: {
  role: Role;
  branchName?: string | null;
}) {
  useEffect(() => {
    if (role === "owner") return;
    const allowed = role === "manager" ? MANAGER : EMPLOYEE;
    const scan = () => {
      const controls = Array.from(document.querySelectorAll("button,a"));
      for (const control of controls) {
        const text = textOf(control);
        if (ALL_NAV.has(text)) {
          const visible = allowed.has(text);
          const target = control.closest("li") || control;
          (target as HTMLElement).style.display = visible ? "" : "none";
        }
        if (
          text.includes("Yeni işletme ekle") ||
          text.includes("Abonelik ve ödemeler") ||
          text === "Ayarlar"
        ) {
          (control as HTMLElement).style.display = "none";
        }
      }
      const ownerLabels = Array.from(document.querySelectorAll("small,span,p"));
      for (const node of ownerLabels) {
        if (textOf(node) === "İşletme sahibi") {
          node.textContent = role === "manager"
            ? `Müdür / Sorumlu${branchName ? ` · ${branchName}` : ""}`
            : `Çalışan${branchName ? ` · ${branchName}` : ""}`;
        }
      }
    };
    const forceSafeView = () => {
      const desired = role === "manager" ? "Genel bakış" : "Randevular";
      const controls = Array.from(document.querySelectorAll("button,a"));
      const desiredControl = controls.find((control) => textOf(control) === desired) as HTMLElement | undefined;
      const activeControl = controls.find((control) => {
        const text = textOf(control);
        return ALL_NAV.has(text) && (control.getAttribute("data-active") === "true" || control.getAttribute("aria-current") === "page");
      });
      if (activeControl && !allowed.has(textOf(activeControl)) && desiredControl) desiredControl.click();
    };
    scan();
    const observer = new MutationObserver(() => {
      scan();
      forceSafeView();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(forceSafeView, 250);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [role, branchName]);

  return null;
}
