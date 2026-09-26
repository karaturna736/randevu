"use client";

import { useEffect } from "react";

export default function AppointmentsDefaultAll() {
  useEffect(() => {
    const applyDefault = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>("section.panel"));

      for (const panel of panels) {
        if (panel.dataset.netaAppointmentsDefaultAll === "1") continue;

        const dateInput = panel.querySelector<HTMLInputElement>(
          'input[aria-label="Randevu günü"]',
        );
        const showAllButton = Array.from(
          panel.querySelectorAll<HTMLButtonElement>("button"),
        ).find((button) => button.textContent?.trim() === "Tüm tarihler");

        if (!dateInput || !showAllButton) continue;

        panel.dataset.netaAppointmentsDefaultAll = "1";
        showAllButton.click();
      }
    };

    applyDefault();
    const observer = new MutationObserver(applyDefault);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
