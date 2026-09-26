"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const FIELD_TEXT = {
  target: "Hedef türü",
  plans: "Geçerli paketler",
  code: "Benzersiz kod",
};

function directFieldLabel(field: Element) {
  return Array.from(field.children).find((child) => child.tagName === "SPAN")?.textContent?.trim() || "";
}

function findField(form: HTMLFormElement, label: string) {
  return Array.from(form.querySelectorAll(".field") as NodeListOf<HTMLElement>).find(
    (field) => directFieldLabel(field) === label,
  );
}

function checkboxChecked(row: HTMLElement) {
  const control = row.querySelector("[role='checkbox'], button") as HTMLElement | null;
  return (
    control?.getAttribute("aria-checked") === "true" ||
    control?.getAttribute("data-state") === "checked"
  );
}

export default function CampaignTargetEnhancer() {
  useEffect(() => {
    const enhance = () => {
      const form = document.querySelector(".campaign-form") as HTMLFormElement | null;
      if (!form || form.dataset.targetEnhancer === "ready") return;
      form.dataset.targetEnhancer = "ready";

      const targetField = findField(form, FIELD_TEXT.target);
      const targetSelect = targetField?.querySelector("select") as HTMLSelectElement | null;
      const plansField = findField(form, FIELD_TEXT.plans);
      if (!targetField || !targetSelect || !plansField) return;

      const helper = document.createElement("div");
      helper.className = "business-picker campaign-target-helper";
      helper.setAttribute("aria-live", "polite");
      targetField.insertAdjacentElement("afterend", helper);

      const planRows = () =>
        Array.from(plansField.querySelectorAll("label.check-row") as NodeListOf<HTMLElement>);

      const render = () => {
        helper.replaceChildren();
        const target = targetSelect.value;

        if (target === "new") {
          const notice = document.createElement("div");
          notice.className = "notice success";
          notice.innerHTML =
            "<span><strong>Yeni işletmelere özel</strong><small>Bu hedef, daha önce gerçek Neta aboneliği başlatmamış işletmelerde ilk satın alma sırasında otomatik doğrulanır. Tek tek işletme seçmeniz gerekmez.</small></span>";
          helper.appendChild(notice);

          const packages = document.createElement("div");
          packages.className = "notice";
          const selected = planRows()
            .filter(checkboxChecked)
            .map((row) => row.textContent?.trim())
            .filter(Boolean)
            .join(" · ");
          packages.innerHTML = `<span><strong>Geçerli paketler</strong><small>${selected || "Henüz paket seçilmedi"}</small></span>`;
          helper.appendChild(packages);
          return;
        }

        if (target === "plan") {
          const heading = document.createElement("div");
          heading.className = "notice success";
          heading.innerHTML =
            "<span><strong>Hangi paketlerde geçerli?</strong><small>Aşağıdan bir veya daha fazla paket seçin. Seçiminiz üstteki paket alanıyla aynı ayarı değiştirir.</small></span>";
          helper.appendChild(heading);

          const picker = document.createElement("div");
          picker.className = "campaign-checks";
          for (const row of planRows()) {
            const original = row.querySelector("[role='checkbox'], button") as HTMLElement | null;
            const label = row.textContent?.trim() || "Paket";
            const button = document.createElement("button");
            button.type = "button";
            button.className = checkboxChecked(row) ? "button primary" : "button";
            button.setAttribute("aria-pressed", checkboxChecked(row) ? "true" : "false");
            button.textContent = `${checkboxChecked(row) ? "✓ " : ""}${label}`;
            button.addEventListener("click", () => {
              original?.click();
              window.setTimeout(render, 0);
            });
            picker.appendChild(button);
          }
          helper.appendChild(picker);
          return;
        }

        helper.style.display = "none";
      };

      const renderVisible = () => {
        helper.style.display = "";
        render();
      };
      targetSelect.addEventListener("change", renderVisible);

      const submitGuard = (event: Event) => {
        const codeField = findField(form, FIELD_TEXT.code);
        const codeInput = codeField?.querySelector("input") as HTMLInputElement | null;
        const code = codeInput?.value.trim() || "";
        if (code.length < 3) {
          event.preventDefault();
          event.stopPropagation();
          toast.error("Kampanya kodu en az 3 karakter olmalı. Örn. YAZ20");
          codeInput?.focus();
          return;
        }

        if (targetSelect.value === "plan" && !planRows().some(checkboxChecked)) {
          event.preventDefault();
          event.stopPropagation();
          toast.error("Belirli paketler hedefi için en az bir paket seçin.");
        }
      };
      form.addEventListener("submit", submitGuard, true);
      renderVisible();
    };

    enhance();
    const observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
