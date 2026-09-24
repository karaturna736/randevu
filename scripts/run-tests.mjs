import { spawnSync } from "node:child_process";

const suites = [
  "tests/campaigns.mjs",
  "tests/customer-operations.mjs",
  "tests/identity-billing.mjs",
  "tests/onboarding-payment.mjs",
  "tests/opportunities.mjs",
  "tests/scheduling.mjs",
];

for (const suite of suites) {
  console.log(`\n▶ ${suite}`);
  const result = spawnSync(process.execPath, [suite], { stdio: "inherit" });

  if (result.error) {
    console.error(`Test çalıştırılamadı: ${suite}`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n✓ ${suites.length} test paketi başarıyla tamamlandı.`);
