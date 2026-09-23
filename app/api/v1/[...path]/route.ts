import { waSnapshot } from "@/lib/whatsapp";
import {
  joinWaitlist,
  recoverySnapshot,
  recoveryOffer,
  acceptRecovery,
} from "@/lib/recovery";
import { setupSnapshot, importSetup, requestTraining } from "@/lib/setup";
import {
  branchSnapshot,
  saveBranch,
  saveBranchExpense,
  branchAction,
} from "@/lib/branches";
import {
  getBusinessConfig,
  getBusinessConfigCatalog,
} from "@/lib/business-config";
import { helpAnswer, helpStatus } from "@/lib/help";
import {
  recurringSnapshot,
  beginRecurring,
  recurringAction,
  platformRecurring,
} from "@/lib/recurring";
import {
  growthSnapshot,
  saveGrowth,
  publicStyle,
  approveReferral,
  platformGrowth,
  referralReview,
} from "@/lib/growth";
import {
  contact,
  receivableSnapshot,
  createReceivable,
  recordCollection,
  reviseReceivable,
} from "@/lib/receivables";
import {
  journeySnapshot,
  createJourney,
  changeJourney,
  sharedJourney,
} from "@/lib/journeys";
import { authStatus } from "@/lib/identity";
import {
  publicPlan,
  billingSnapshot,
  saveBillingProfile,
  beginCheckout,
  platformBilling,
  savePlatformBilling,
} from "@/lib/billing";
import {
  startVisit,
  visitIdentity,
  searchDemand,
  demandAnalytics,
  serviceAnalytics,
} from "@/lib/demand";
import { earlyInbox } from "@/lib/early";
import { teamAccess, setTeamAccess, teamJobs, finishTeamJob } from "@/lib/team";
import {
  accountSnapshot,
  saveProfile,
  accountBookings,
  ownAppointment,
  appointmentDetails,
  claimAppointment,
  getFavorites,
  setFavorite,
  bookingAccount,
  customerAction,
} from "@/lib/accounts";
import { z } from "zod";
import {
  db,
  q,
  all,
  one,
  ok,
  fail,
  body,
  tenant,
  admin,
  uid,
  now,
  limit,
  date,
  ApiError,
} from "@/lib/server";
import {
  workspace,
  createBusiness,
  saveService,
  saveStaff,
  settings,
} from "@/lib/workspace";
import {
  available,
  publicBusiness,
  book,
  change,
  byToken,
  assistant,
  SELECT_APPOINTMENTS,
} from "@/lib/booking";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url),
      p = u.pathname.split("/").filter(Boolean).slice(2),
      id = u.searchParams.get("tenant") || "";
    if (p[0] === "whatsapp") return ok(await waSnapshot(id));
    if (p[0] === "recovery") return ok(await recoverySnapshot(id));
    if (p[0] === "recovery-offer") {
      await limit(req, "recovery-offer", 120);
      return ok(
        await recoveryOffer(
          req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
        ),
      );
    }
    if (p[0] === "setup-center") return ok(await setupSnapshot(id));
    if (p[0] === "branches")
      return ok(
        await branchSnapshot(id, u.searchParams.get("month") || undefined),
      );
    if (p[0] === "help-status") return ok(helpStatus());
    if (p[0] === "recurring") return ok(await recurringSnapshot(id));
    if (p[0] === "platform-recurring") return ok(await platformRecurring());
    if (p[0] === "growth") return ok(await growthSnapshot(id));
    if (p[0] === "platform-growth") return ok(await platformGrowth());
    if (p[0] === "receivables") return ok(await receivableSnapshot(id));
    if (p[0] === "journeys") return ok(await journeySnapshot(id));
    if (p[0] === "shared-journey") {
      await limit(req, "journey-read", 100);
      return ok(
        await sharedJourney(
          req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
        ),
      );
    }
    if (p[0] === "auth-status") return ok(authStatus());
    if (p[0] === "plans") return ok(await publicPlan());
    if (p[0] === "billing") return ok(await billingSnapshot(id || undefined));
    if (p[0] === "platform-billing") return ok(await platformBilling());
    if (p[0] === "demand-insights")
      return ok(await demandAnalytics(id, u.searchParams.get("days")));
    if (p[0] === "service-insights")
      return ok(await serviceAnalytics(id, u.searchParams.get("days") || 30));
    if (p[0] === "early-offers") return ok(await earlyInbox());
    if (p[0] === "team-access") return ok(await teamAccess(id));
    if (p[0] === "team-jobs")
      return ok(await teamJobs(id, u.searchParams.get("date") || ""));
    if (p[0] === "account") return ok(await accountSnapshot());
    if (p[0] === "my-bookings") return ok(await accountBookings());
    if (p[0] === "my-appointment")
      return ok(
        await appointmentDetails(
          await ownAppointment(u.searchParams.get("id") || ""),
        ),
      );
    if (p[0] === "favorites") return ok(await getFavorites());
    if (p[0] === "workspace") {
      const data = await workspace(id || undefined);
      return ok(
        data.business
          ? {
              ...data,
              configuration: getBusinessConfig(data.business.category),
            }
          : data,
      );
    }
    if (p[0] === "business-types")
      return ok({ businessTypes: getBusinessConfigCatalog() });
    if (p[0] === "availability") {
      const b = id
        ? await tenant(id)
        : await publicBusiness(u.searchParams.get("slug") || "");
      return ok({
        slots: await available(
          b,
          u.searchParams.get("service") || "",
          date.parse(u.searchParams.get("date")),
          u.searchParams.get("staff") || "any",
          "",
          undefined,
          u.searchParams.get("branch") || undefined,
        ),
      });
    }
    if (p[0] === "businesses")
      return ok({
        businesses: await all(
          "SELECT b.id,b.name,b.slug,b.category,b.city,b.address,b.description,(SELECT MIN(price) FROM services WHERE tenant_id=b.id AND active=1) min_price FROM businesses b WHERE status='approved' AND demo=0 ORDER BY name LIMIT 100",
        ),
      });
    if (p[0] === "public") {
      const b = await publicBusiness(p[1]);
      return ok({
        business: b,
        configuration: getBusinessConfig(b.category),
        presentation: await publicStyle(b.id),
        services: await all(
          "SELECT id,name,description,duration,price,color,active FROM services WHERE tenant_id=? AND active=1",
          b.id,
        ),
        staff: await all(
          "SELECT id,branch_id,name,title,color,active FROM staff WHERE tenant_id=? AND active=1",
          b.id,
        ),
        branches: await all(
          "SELECT id,name,city,address FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name",
          b.id,
        ),
        reviews: await all(
          "SELECT rating,comment,created_at FROM reviews WHERE tenant_id=? AND status='published' ORDER BY created_at DESC LIMIT 30",
          b.id,
        ),
      });
    }
    if (p[0] === "manage") {
      await limit(req, "manage", 150);
      return ok(
        await appointmentDetails(
          await byToken(
            req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
          ),
        ),
      );
    }
    if (p[0] === "admin") {
      await admin();
      return ok({
        businesses: await all(
          "SELECT * FROM businesses ORDER BY created_at DESC LIMIT 500",
        ),
        users: await all(
          "SELECT p.user_id,p.email,p.name,(SELECT COUNT(*) FROM members m WHERE m.user_id=p.user_id) businesses,p.disabled,p.account_type FROM profiles p UNION ALL SELECT m.user_id,m.email,m.name,COUNT(*) businesses,MAX(m.disabled) disabled,'business' account_type FROM members m WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id=m.user_id) GROUP BY m.user_id LIMIT 500",
        ),
        appointments: await all(
          SELECT_APPOINTMENTS + " ORDER BY a.date DESC LIMIT 200",
        ),
        reviews: await all(
          "SELECT r.*,b.name business_name FROM reviews r JOIN businesses b ON b.id=r.tenant_id ORDER BY r.created_at DESC LIMIT 100",
        ),
        complaints: await all(
          "SELECT c.*,b.name business_name FROM complaints c JOIN businesses b ON b.id=c.tenant_id ORDER BY c.created_at DESC LIMIT 100",
        ),
        payments: await all(
          "SELECT * FROM payments ORDER BY created_at DESC LIMIT 100",
        ),
      });
    }
    throw new ApiError("Sayfa bulunamadı.", 404);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const p = new URL(req.url).pathname.split("/").filter(Boolean).slice(2),
      x = await body(req),
      id = String(x.tenant_id || "");
    if (p[0] === "help") {
      await limit(req, "help", 40);
      return ok(await helpAnswer(id, x));
    }
    if (p[0] === "waitlist") {
      await limit(req, "waitlist", 20);
      return ok(await joinWaitlist(x), 201);
    }
    if (p[0] === "recovery-offer") {
      await limit(req, "recovery-accept", 20);
      return ok(
        await acceptRecovery(
          req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
        ),
        201,
      );
    }
    if (p[0] === "setup-import") {
      await limit(req, "setup-import", 60);
      return ok(await importSetup(id, x));
    }
    if (p[0] === "setup-training") {
      await limit(req, "setup-training", 10);
      return ok(await requestTraining(id, x), 201);
    }
    if (p[0] === "branches")
      return ok(x.action ? await branchAction(id, x) : await saveBranch(id, x));
    if (p[0] === "branch-expenses") return ok(await saveBranchExpense(id, x));
    if (p[0] === "recurring") {
      await limit(req, "recurring", 10);
      return ok(
        x.action ? await recurringAction(id, x) : await beginRecurring(id, x),
      );
    }
    if (p[0] === "growth") return ok(await saveGrowth(id, x));
    if (p[0] === "platform-growth") return ok(await referralReview(x));
    if (p[0] === "contacts") return ok(await contact(id, x));
    if (p[0] === "receivables") return ok(await createReceivable(id, x));
    if (p[0] === "collections") return ok(await recordCollection(id, x));
    if (p[0] === "receivable-action") return ok(await reviseReceivable(id, x));
    if (p[0] === "journeys")
      return ok(
        x.action ? await changeJourney(id, x) : await createJourney(id, x),
      );
    if (p[0] === "billing-profile") {
      await limit(req, "billing-profile", 20);
      return ok(await saveBillingProfile(id, x));
    }
    if (p[0] === "checkout") {
      await limit(req, "checkout", 10);
      return ok(await beginCheckout(req, x));
    }
    if (p[0] === "platform-billing") {
      await limit(req, "platform-billing", 20);
      return ok(await savePlatformBilling(x));
    }
    if (p[0] === "visit") {
      await limit(req, "visit", 90);
      return ok(await startVisit(await publicBusiness(String(x.slug)), x));
    }
    if (p[0] === "demand-search") {
      await limit(req, "demand-search", 90);
      return ok(await searchDemand(await publicBusiness(String(x.slug)), x));
    }
    if (p[0] === "team-access") {
      await limit(req, "team-access", 30);
      return ok(await setTeamAccess(id, x));
    }
    if (p[0] === "team-jobs") return ok(await finishTeamJob(id, x));
    if (p[0] === "account") {
      await limit(req, "profile", 40);
      return ok(await saveProfile(x));
    }
    if (p[0] === "claim-booking") {
      await limit(req, "claim-booking", 15);
      return ok(await claimAppointment(x));
    }
    if (p[0] === "favorites") return ok(await setFavorite(x));
    if (p[0] === "my-appointment") {
      await limit(req, "my-appointment", 50);
      return ok(
        await customerAction(await ownAppointment(String(x.id || "")), x),
      );
    }
    if (p[0] === "businesses") {
      await limit(req, "business-create", 15);
      return ok(await createBusiness(x), 201);
    }
    if (p[0] === "services") return ok(await saveService(id, x));
    if (p[0] === "staff") return ok(await saveStaff(id, x));
    if (p[0] === "settings") return ok(await settings(id, x));
    if (p[0] === "closures") {
      await tenant(id);
      if (x.action === "delete") {
        await q(
          "DELETE FROM closures WHERE tenant_id=? AND id=?",
          id,
          String(x.id),
        ).run();
        return ok({ ok: true });
      }
      const d = date.parse(x.date),
        person = x.staff_id && x.staff_id !== "all" ? String(x.staff_id) : null;
      if (
        person &&
        !(await one(
          "SELECT id FROM staff WHERE tenant_id=? AND id=?",
          id,
          person,
        ))
      )
        throw new ApiError("Personel bulunamadı.", 404);
      if (
        (
          await one(
            "SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND date=? AND status='confirmed' AND (? IS NULL OR staff_id=?)",
            id,
            d,
            person,
            person,
          )
        ).n
      )
        throw new ApiError(
          "O gün aktif randevu var. Önce taşıyın veya iptal edin.",
          409,
        );
      await q(
        "INSERT INTO closures (id,tenant_id,staff_id,date,reason) VALUES (?,?,?,?,?)",
        uid(),
        id,
        person,
        d,
        z
          .string()
          .max(200)
          .parse(x.reason || "İzin"),
      ).run();
      return ok({ ok: true });
    }
    if (p[0] === "bookings") {
      await limit(req, "booking", 30);
      const b = id
        ? await tenant(id)
        : await publicBusiness(z.string().parse(x.slug));
      return ok(
        await book(
          b,
          x,
          id ? undefined : await bookingAccount(),
          id ? undefined : await visitIdentity(b.id, x),
          undefined,
          id ? "panel" : "web",
        ),
        201,
      );
    }
    if (p[0] === "appointment") {
      const b = await tenant(id),
        a = await one(
          SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.id=?",
          id,
          String(x.id),
        );
      if (!a) throw new ApiError("Randevu bulunamadı.", 404);
      return ok(await change(b, a, x));
    }
    if (p[0] === "assistant") {
      await limit(req, "assistant", 50);
      return ok(
        await assistant(
          id
            ? await tenant(id)
            : await publicBusiness(z.string().parse(x.slug)),
          z.string().min(3).max(500).parse(x.message),
        ),
      );
    }
    if (p[0] === "manage") {
      await limit(req, "manage-write", 40);
      return ok(
        await customerAction(
          await byToken(
            req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
          ),
          x,
        ),
      );
    }
    if (p[0] === "admin") {
      const u = await admin(),
        target = z.string().min(1).parse(x.id),
        ops = [];
      if (x.action === "business-status")
        ops.push(
          q(
            "UPDATE businesses SET status=? WHERE id=?",
            z.enum(["approved", "suspended", "deleted"]).parse(x.status),
            target,
          ),
        );
      else if (x.action === "user-status") {
        if (target === u.userId)
          throw new ApiError("Kendi hesabınızı kapatamazsınız.");
        ops.push(
          q(
            "INSERT INTO profiles (user_id,name,email,account_type,disabled,created_at,updated_at) SELECT user_id,name,email,'business',?,?,? FROM members WHERE user_id=? LIMIT 1 ON CONFLICT(user_id) DO NOTHING",
            x.disabled === true ? 1 : 0,
            now(),
            now(),
            target,
          ),
          q(
            "UPDATE profiles SET disabled=?,updated_at=? WHERE user_id=?",
            x.disabled === true ? 1 : 0,
            now(),
            target,
          ),
          q(
            "UPDATE members SET disabled=? WHERE user_id=?",
            x.disabled === true ? 1 : 0,
            target,
          ),
        );
      } else if (x.action === "review-status")
        ops.push(
          q(
            "UPDATE reviews SET status=? WHERE id=?",
            z.enum(["published", "hidden"]).parse(x.status),
            target,
          ),
        );
      else if (x.action === "complaint-resolve")
        ops.push(
          q("UPDATE complaints SET status='resolved' WHERE id=?", target),
        );
      else throw new ApiError("Geçersiz işlem.");
      ops.push(
        q(
          "INSERT INTO audit (id,user_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
          uid(),
          u.userId,
          x.action,
          target,
          now(),
        ),
      );
      await db().batch(ops);
      if (x.action === "business-status" && x.status === "approved")
        await approveReferral(target);
      return ok({ ok: true });
    }
    throw new ApiError("İşlem bulunamadı.", 404);
  } catch (e) {
    return fail(e);
  }
}
