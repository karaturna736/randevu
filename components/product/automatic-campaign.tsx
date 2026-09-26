"use client";

import { useEffect } from "react";

function currentPlan() {
  const active = document.querySelector(
    '[role="radio"][aria-checked="true"]',
  ) as HTMLElement | null;
  const text = active?.textContent?.toLocaleLowerCase("tr-TR") || "";
  if (text.includes("plus")) return "plus";
  if (text.includes("pro")) return "pro";
  return "normal";
}

function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function campaignInput() {
  return document.querySelector(
    'input[aria-label="İndirim kodu"], input[placeholder="Kampanya kodunuz"]',
  ) as HTMLInputElement | null;
}

function applyButton(input: HTMLInputElement) {
  const container = input.parentElement;
  return Array.from(container?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Uygula",
  ) as HTMLButtonElement | undefined;
}

function tl(value: unknown) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value || 0) / 100);
}

function showAutomaticNotice(
  input: HTMLInputElement,
  campaign: any,
  realCheckoutDiscount: boolean,
) {
  const card = input.closest(".panel") || input.parentElement?.parentElement;
  if (!card) return;
  let notice = card.querySelector(
    "[data-automatic-campaign-notice]",
  ) as HTMLElement | null;
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "notice success";
    notice.dataset.automaticCampaignNotice = "true";
    const wrapper = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    wrapper.appendChild(title);
    wrapper.appendChild(detail);
    notice.appendChild(wrapper);
    const row = input.parentElement;
    row?.insertAdjacentElement("beforebegin", notice);
  }
  const title = notice.querySelector("strong");
  const detail = notice.querySelector("small");
  if (title)
    title.textContent = String(
      campaign.description || campaign.campaign_name || "Size özel kampanya",
    ).trim();
  if (detail)
    detail.textContent = realCheckoutDiscount
      ? `${tl(campaign.discount_amount)} avantaj hesabınıza otomatik uygulandı. Ödenecek tutar ${tl(campaign.final_amount)}.`
      : `${tl(campaign.discount_amount)} kampanya avantajı hesabınıza tanımlı. İlk abonelik tahsilatı mevcut iyzico planında sabit fiyatlı olduğu için bu ekranda tutar otomatik düşürülmez.`;
}

export function AutomaticCampaign() {
  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: number | undefined;

    const sync = async () => {
      if (stopped || running) return;
      const path = location.pathname;
      if (path !== "/odeme" && path !== "/abonelik") return;
      const input = campaignInput();
      if (!input) return;

      const params = new URLSearchParams();
      params.set("plan", currentPlan());
      const tenantId = new URLSearchParams(location.search).get("tenant");
      if (tenantId) params.set("tenant", tenantId);

      running = true;
      try {
        const response = await fetch("/api/campaign-auto?" + params.toString(), {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { campaign?: any };
        const campaign = payload.campaign;
        if (!campaign?.code) return;

        const key = `${campaign.code}:${params.get("plan")}:${tenantId || "new"}`;
        if (input.dataset.automaticCampaign === key) return;
        input.dataset.automaticCampaign = key;

        const canApplyToCheckout = path === "/abonelik" && campaign.checkout_supported === true;
        showAutomaticNotice(input, campaign, canApplyToCheckout);
        if (!canApplyToCheckout) return;

        setReactInput(input, campaign.code);
        window.setTimeout(() => applyButton(input)?.click(), 40);
      } finally {
        running = false;
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, 80);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    document.addEventListener("click", schedule, true);
    window.addEventListener("popstate", schedule);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("popstate", schedule);
    };
  }, []);

  return null;
}
