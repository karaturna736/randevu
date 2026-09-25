import { z } from "zod";
import { body, fail, limit, ok } from "@/lib/server";
import {
  cancelTemporaryPayment,
  prepareTemporaryPayment,
  reviewTemporaryPayment,
  saveTemporaryPaymentSettings,
  submitTemporaryPayment,
  temporaryPaymentAdminSnapshot,
  temporaryPaymentSnapshot,
} from "@/lib/temporary-payments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "admin") {
      await limit(request, "temporary-payment-admin-read", 60);
      return ok(await temporaryPaymentAdminSnapshot());
    }
    await limit(request, "temporary-payment-read", 60);
    return ok(await temporaryPaymentSnapshot());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await body(request),
      action = z.string().parse(input.action);
    if (action === "prepare") {
      await limit(request, "temporary-payment-prepare", 8);
      return ok(await prepareTemporaryPayment(input), 201);
    }
    if (action === "submitted") {
      await limit(request, "temporary-payment-submit", 12);
      return ok(await submitTemporaryPayment(input));
    }
    if (action === "cancel") {
      await limit(request, "temporary-payment-cancel", 12);
      return ok(await cancelTemporaryPayment(input));
    }
    if (action === "save_settings") {
      await limit(request, "temporary-payment-admin-write", 30);
      return ok(await saveTemporaryPaymentSettings(input));
    }
    if (action === "approve" || action === "reject") {
      await limit(request, "temporary-payment-admin-review", 40);
      return ok(await reviewTemporaryPayment(input));
    }
    return ok({ error: "Geçersiz işlem." }, 400);
  } catch (error) {
    return fail(error);
  }
}
