import { z } from "zod";
import { all, one, q, user, date, ApiError, db, now } from "./server";
import { SELECT_APPOINTMENTS, change } from "./booking";
import { today, addDays } from "./types";
import { businessAccess, normalizeBusinessRole } from "./business-access";
import { hashPanelPassword, panelLoginSchema, panelPasswordSchema } from "./password-auth";

const memberSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: panelLoginSchema,
  password: panelPasswordSchema,
  role: z.enum(["manager", "employee"]),
  branch_id: z.string().min(1).max(200),
  staff_id: z.string().max(200).optional().nullable(),
});

async function manageableMember(tenantId: string, actorRole: string, actorBranch: string | null, userId: string) {
  const target = await one(
    `SELECT m.*,COALESCE(m.branch_id,s.branch_id) effective_branch_id
     FROM members m LEFT JOIN staff s ON s.tenant_id=m.tenant_id AND s.id=m.staff_id
     WHERE m.tenant_id=? AND m.user_id=?`,
    tenantId,
    userId,
  );
  if (!target) throw new ApiError("Panel hesabı bulunamadı.", 404);
  const role = normalizeBusinessRole(target.role);
  if (role === "owner") throw new ApiError("Yönetici hesabı buradan değiştirilemez.", 403);
  if (actorRole === "manager" && (role !== "employee" || target.effective_branch_id !== actorBranch))
    throw new ApiError("Bu hesap üzerinde yetkiniz yok.", 403);
  return target;
}

export async function teamAccess(id: string) {
  const access = await businessAccess(id, ["owner", "manager"]);
  const branchFilter = access.role === "manager" ? " AND COALESCE(m.branch_id,s.branch_id)=?" : "";
  const args = access.role === "manager" ? [id, access.branchId] : [id];
  const members = await all(
    `SELECT m.user_id,m.email,m.name,m.role,m.staff_id,m.branch_id,m.disabled,
            COALESCE(m.branch_id,s.branch_id) effective_branch_id,
            s.name staff_name,br.name branch_name
     FROM members m
     LEFT JOIN staff s ON s.tenant_id=m.tenant_id AND s.id=m.staff_id
     LEFT JOIN branches br ON br.tenant_id=m.tenant_id AND br.id=COALESCE(m.branch_id,s.branch_id)
     WHERE m.tenant_id=? AND m.role<>'owner'${branchFilter}
     ORDER BY m.disabled,m.role,m.name`,
    ...args,
  );
  const branches = access.role === "owner"
    ? await all("SELECT id,name,city,address FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name", id)
    : await all("SELECT id,name,city,address FROM branches WHERE tenant_id=? AND id=? AND active=1", id, access.branchId);
  return {
    members: members.map((row: any) => ({ ...row, role: normalizeBusinessRole(row.role), branch_id: row.effective_branch_id })),
    branches,
    access: { role: access.role, branch_id: access.branchId, can_create_manager: access.role === "owner" },
  };
}

export async function setTeamAccess(id: string, input: any) {
  const access = await businessAccess(id, ["owner", "manager"]);
  if (input.action === "remove") {
    const targetId = z.string().min(1).parse(input.user_id);
    await manageableMember(id, access.role, access.branchId, targetId);
    await q("UPDATE members SET disabled=1 WHERE tenant_id=? AND user_id=?", id, targetId).run();
    return { ok: true };
  }
  if (input.action === "reset_password") {
    const targetId = z.string().min(1).parse(input.user_id);
    const target = await manageableMember(id, access.role, access.branchId, targetId);
    const passwordHash = await hashPanelPassword(input.password);
    const stamp = now();
    await q(
      `INSERT INTO password_credentials(user_id,login,password_hash,must_change_password,created_at,updated_at)
       VALUES(?,?,?,0,?,?)
       ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at,must_change_password=0`,
      target.user_id,
      String(target.email).toLowerCase(),
      passwordHash,
      stamp,
      stamp,
    ).run();
    return { ok: true };
  }

  const x = memberSchema.parse(input);
  if (access.role === "manager" && x.role !== "employee")
    throw new ApiError("Müdür yalnızca çalışan hesabı oluşturabilir.", 403);
  if (access.role === "manager" && x.branch_id !== access.branchId)
    throw new ApiError("Yalnızca kendi şubenize çalışan ekleyebilirsiniz.", 403);
  const branch = await one("SELECT id FROM branches WHERE tenant_id=? AND id=? AND active=1", id, x.branch_id);
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  if (x.staff_id) {
    const person = await one("SELECT id,branch_id FROM staff WHERE tenant_id=? AND id=? AND active=1", id, x.staff_id);
    if (!person) throw new ApiError("Personel bulunamadı.", 404);
    if (person.branch_id && person.branch_id !== x.branch_id)
      throw new ApiError("Personel seçilen şubeye bağlı değil.", 409);
  }

  const profileMatches = await all("SELECT user_id,name,email,disabled FROM profiles WHERE lower(email)=? LIMIT 2", x.email);
  if (profileMatches.length > 1) throw new ApiError("Bu e-posta birden fazla hesapla eşleşiyor.", 409);
  let profile = profileMatches[0] || null;
  let userId = profile?.user_id || `local:${crypto.randomUUID()}`;
  if (profile?.disabled) throw new ApiError("Bu hesap kapalı.", 403);

  const existingMembership = await one("SELECT role FROM members WHERE tenant_id=? AND user_id=?", id, userId);
  if (existingMembership?.role === "owner") throw new ApiError("Yönetici hesabının rolü değiştirilemez.", 403);

  const credential = await one("SELECT user_id FROM password_credentials WHERE login=?", x.email);
  if (credential && credential.user_id !== userId)
    throw new ApiError("Bu e-posta başka bir panel hesabında kullanılıyor.", 409);
  if (credential && !existingMembership)
    throw new ApiError("Bu e-posta zaten bir Neta hesabına ait. Mevcut kullanıcıyı doğrudan bağlamak için destek akışı kullanılmalı.", 409);

  const passwordHash = await hashPanelPassword(x.password);
  const stamp = now();
  const operations: any[] = [];
  if (!profile) {
    operations.push(
      q(
        `INSERT INTO profiles(user_id,name,email,phone,city,account_type,marketing_consent,disabled,created_at,updated_at)
         VALUES(?,?,?,'','','business',0,0,?,?)`,
        userId,
        x.name,
        x.email,
        stamp,
        stamp,
      ),
    );
  } else {
    operations.push(q("UPDATE profiles SET name=?,updated_at=? WHERE user_id=?", x.name, stamp, userId));
  }
  operations.push(
    q(
      `INSERT INTO password_credentials(user_id,login,password_hash,must_change_password,created_at,updated_at)
       VALUES(?,?,?,0,?,?)
       ON CONFLICT(user_id) DO UPDATE SET login=excluded.login,password_hash=excluded.password_hash,updated_at=excluded.updated_at,must_change_password=0`,
      userId,
      x.email,
      passwordHash,
      stamp,
      stamp,
    ),
    q(
      `INSERT INTO members(tenant_id,user_id,email,name,role,staff_id,branch_id,disabled)
       VALUES(?,?,?,?,?,?,?,0)
       ON CONFLICT(tenant_id,user_id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role,staff_id=excluded.staff_id,branch_id=excluded.branch_id,disabled=0`,
      id,
      userId,
      x.email,
      x.name,
      x.role,
      x.staff_id || null,
      x.branch_id,
    ),
  );
  await db().batch(operations);
  return { ok: true, user_id: userId, role: x.role, branch_id: x.branch_id };
}

async function assignments() {
  const u = await user();
  return {
    u,
    rows: await all(
      `SELECT b.id,b.name,b.slug,m.staff_id,p.name staff_name
       FROM members m JOIN businesses b ON b.id=m.tenant_id
       JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id
       WHERE m.user_id=? AND m.role IN ('staff','employee') AND m.disabled=0 AND p.active=1
         AND b.status NOT IN ('deleted','suspended')`,
      u.userId,
    ),
  };
}
export async function teamJobs(id: string, d: string) {
  const { u, rows } = await assignments();
  if (!rows.length) return { businesses: [], appointments: [], user: u };
  const b = id ? rows.find((row: any) => row.id === id) : rows[0];
  if (!b) throw new ApiError("Ekip erişimi reddedildi.", 403);
  const day = date.parse(d || today());
  if (day < addDays(today(), -90) || day > addDays(today(), 90))
    throw new ApiError("90 günlük aralıkta bir tarih seçin.");
  return {
    businesses: rows,
    business: b,
    user: u,
    appointments: await all(
      SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.staff_id=? AND a.date=? ORDER BY a.minute LIMIT 100",
      b.id,
      b.staff_id,
      day,
    ),
  };
}
export async function finishTeamJob(id: string, x: any) {
  const { rows } = await assignments(),
    assignment = rows.find((row: any) => row.id === id);
  if (!assignment) throw new ApiError("Ekip erişimi reddedildi.", 403);
  const a = await one(
    SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.staff_id=? AND a.id=?",
    id,
    assignment.staff_id,
    z.string().parse(x.id),
  );
  if (!a) throw new ApiError("İşlem bulunamadı.", 404);
  const status = z.enum(["completed", "no_show"]).parse(x.status),
    b = await one("SELECT * FROM businesses WHERE id=?", id);
  return change(b, a, { status });
}
