"use client";

import { useEffect } from "react";
import { money } from "@/lib/types";
import { api } from "./common";

const plans = ["normal", "pro", "plus"] as const;
type Mode = "onboarding" | "billing";

type Offer = {
  code: string;
  campaign_name: string;
  description: string;
  discount_amount: number;
  final_amount: number;
};

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectedOnboardingPlan() {
  const radios = Array.from(
    document.querySelectorAll<HTMLElement>(".onboarding-plans [role='radio']"),
  );
  const index = radios.findIndex(
    (radio) => radio.getAttribute("aria-checked") === "true",
  );
  return index >= 0 ? plans[index] : null;
}

function tenantFromPage() {
  const fromUrl = new URLSearchParams(location.search).get("tenant");
  if (fromUrl) return fromUrl;
  const link = document.querySelector<HTMLAnchorElement>(
    'a[href*="/panel/pazarlama?tenant="]',
  );
  if (!link) return null;
  try {
    return new URL(link.href, location.origin).searchParams.get("tenant");
  } catch {
    return null;
  }
}

function fillNotice(notice: HTMLElement, offer: Offer, detailText: string) {
  notice.replaceChildren();
  const text = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  title.textContent = offer.description.trim() || offer.campaign_name;
  detail.textContent = detailText;
  text.appendChild(title);
  text.appendChild(detail);
  notice.appendChild(text);
}

function showAutomaticNotice(card: HTMLElement, offer: Offer) {
  let notice = card.querySelector<HTMLElement>("[data-auto-campaign-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.dataset.autoCampaignNotice = "true";
    notice.className = "notice success";
    const row = card.querySelector(".campaign-code-row");
    row?.insertAdjacentElement("beforebegin", notice);
  }
  fillNotice(
    notice,
    offer,
    "Bu kampanya hesabınıza otomatik tanımlandı; kod girmenize gerek yok.",
  );
}

function showPlanPreview(picker: HTMLElement, offer: Offer | null) {
  const parent = picker.parentElement;
  if (!parent) return;
  let notice = parent.querySelector<HTMLElement>("[data-auto-campaign-preview]");
  if (!offer) {
    notice?.remove();
    return;
  }
  if (!notice) {
    notice = document.createElement("div");
    notice.dataset.autoCampaignPreview = "true";
    notice.className = "notice success";
    picker.insertAdjacentElement("afterend", notice);
  }
  fillNotice(
    notice,
    offer,
    `${money(offer.discount_amount)} kampanya avantajı · ${money(offer.final_amount)} ile satın alıyorsunuz.`,
  );
}

export default function CampaignAutoApply({ mode }: { mode: Mode }) {
  useEffect(() => {
    let disposed = false;
    let sequence = 0;
    const cache = new Map<string, Promise<Offer | null>>();

    const rememberPlan = () => {
      const plan = selectedOnboardingPlan();
      if (plan) sessionStorage.setItem("neta-campaign-plan", plan);
    };

    const loadOffer = (key: string, query: string) => {
      let pending = cache.get(key);
      if (!pending) {
        pending = api(`campaign-offer?${query}`)
          .then((result: { offer: Offer | null }) => result.offer)
          .catch(() => null);
        cache.set(key, pending);
      }
      return pending;
    };

    const previewOnboarding = async () => {
      const picker = document.querySelector<HTMLElement>(".onboarding-plans");
      if (!picker) return;
      const plan = selectedOnboardingPlan() || "normal";
      if (picker.dataset.autoCampaignPreviewKey === plan) return;
      picker.dataset.autoCampaignPreviewKey = plan;
      const offer = await loadOffer(
        `onboarding:${plan}`,
        `plan=${encodeURIComponent(plan)}`,
      );
      if (disposed || picker.dataset.autoCampaignPreviewKey !== plan) return;
      showPlanPreview(picker, offer);
    };

    const applyToCampaignCard = async () => {
      const card = document.querySelector<HTMLElement>(".campaign-payment-card");
      const input = card?.querySelector<HTMLInputElement>(".campaign-code-row input");
      const applyButton = card?.querySelector<HTMLButtonElement>(
        ".campaign-code-row button",
      );
      if (!card || !input || !applyButton) return;

      let query = "";
      let contextKey = "";
      if (mode === "onboarding") {
        const plan =
          selectedOnboardingPlan() ||
          (sessionStorage.getItem("neta-campaign-plan") as
            | (typeof plans)[number]
            | null) ||
          "normal";
        if (!plans.includes(plan)) return;
        query = `plan=${encodeURIComponent(plan)}`;
        contextKey = `onboarding:${plan}`;
      } else {
        const tenant = tenantFromPage();
        if (!tenant) return;
        query = `tenant=${encodeURIComponent(tenant)}`;
        contextKey = `billing:${tenant}`;
      }

      if (card.dataset.autoCampaignKey === contextKey) return;
      if (input.value.trim() && input.dataset.netaAutoCampaign !== "1") return;

      if (input.dataset.netaAutoCampaign === "1") {
        setInputValue(input, "");
        delete input.dataset.netaAutoCampaign;
      }
      card.querySelector("[data-auto-campaign-notice]")?.remove();
      card.dataset.autoCampaignKey = contextKey;

      const current = ++sequence;
      const offer = await loadOffer(contextKey, query);
      if (disposed || current !== sequence) return;
      if (card.dataset.autoCampaignKey !== contextKey || !offer) return;

      input.dataset.netaAutoCampaign = "1";
      setInputValue(input, offer.code);
      showAutomaticNotice(card, offer);
      window.setTimeout(() => {
        if (!disposed && input.value === offer.code) applyButton.click();
      }, 0);
    };

    const scan = () => {
      if (disposed) return;
      if (mode === "onboarding") {
        rememberPlan();
        void previewOnboarding();
      }
      void applyToCampaignCard();
    };

    const click = (event: Event) => {
      if (mode !== "onboarding") return;
      const target = event.target as HTMLElement | null;
      const radio = target?.closest<HTMLElement>(".onboarding-plans [role='radio']");
      if (!radio) return;
      const radios = Array.from(
        document.querySelectorAll<HTMLElement>(".onboarding-plans [role='radio']"),
      );
      const index = radios.indexOf(radio);
      if (index >= 0) sessionStorage.setItem("neta-campaign-plan", plans[index]);
      window.setTimeout(scan, 0);
    };

    document.addEventListener("click", click, true);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      disposed = true;
      sequence++;
      observer.disconnect();
      document.removeEventListener("click", click, true);
    };
  }, [mode]);

  return null;
}
