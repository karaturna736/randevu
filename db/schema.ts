import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  foreignKey,
  real,
} from "drizzle-orm/sqlite-core";
export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inviteCode: text("invite_code").unique(),
  category: text("category").notNull(),
  city: text("city").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("pending"),
  demo: integer("demo").notNull().default(0),
  hours: text("hours").notNull(),
  cancellationHours: integer("cancellation_hours").notNull().default(2),
  selectedPlan: text("selected_plan").notNull().default("normal"),
  createdAt: text("created_at").notNull(),
});
export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    name: text("name").notNull(),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    active: integer("active").notNull().default(1),
    isPrimary: integer("is_primary").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("branches_tenant_id").on(t.tenantId, t.id),
    index("branches_tenant_active").on(t.tenantId, t.active),
  ],
);
export const members = sqliteTable(
  "members",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("owner"),
    staffId: text("staff_id"),
    disabled: integer("disabled").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId] }),
    index("members_user").on(t.userId),
    foreignKey({
      columns: [t.tenantId, t.staffId],
      foreignColumns: [staff.tenantId, staff.id],
    }),
  ],
);
export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    color: text("color").notNull().default("#789c74"),
    active: integer("active").notNull().default(1),
  },
  (t) => [uniqueIndex("services_tenant_id").on(t.tenantId, t.id)],
);
export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    branchId: text("branch_id"),
    name: text("name").notNull(),
    title: text("title").notNull().default("Uzman"),
    hours: text("hours").notNull(),
    color: text("color").notNull().default("#e1eccd"),
    active: integer("active").notNull().default(1),
  },
  (t) => [
    uniqueIndex("staff_tenant_id").on(t.tenantId, t.id),
    index("staff_branch").on(t.tenantId, t.branchId, t.active),
    foreignKey({
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }),
  ],
);
export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    consent: integer("consent").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("customers_tenant_id").on(t.tenantId, t.id),
    uniqueIndex("customers_phone").on(t.tenantId, t.phone),
  ],
);
export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    branchId: text("branch_id"),
    customerId: text("customer_id").notNull(),
    serviceId: text("service_id").notNull(),
    staffId: text("staff_id").notNull(),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    status: text("status").notNull().default("confirmed"),
    source: text("source").notNull().default("web"),
    serviceNameSnapshot: text("service_name_snapshot").notNull().default(""),
    serviceDescriptionSnapshot: text("service_description_snapshot")
      .notNull()
      .default(""),
    customerNote: text("customer_note").notNull().default(""),
    earlyFrom: integer("early_from"),
    tokenHash: text("token_hash").notNull().unique(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("appointments_tenant_id").on(t.tenantId, t.id),
    index("appointments_date").on(t.tenantId, t.date),
    index("appointments_customer").on(t.tenantId, t.customerId),
    index("appointments_source").on(t.tenantId, t.source, t.createdAt),
    index("appointments_branch_date").on(
      t.tenantId,
      t.branchId,
      t.date,
      t.status,
    ),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.staffId],
      foreignColumns: [staff.tenantId, staff.id],
    }),
  ],
);
export const slots = sqliteTable(
  "slots",
  {
    tenantId: text("tenant_id").notNull(),
    staffId: text("staff_id").notNull(),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
    appointmentId: text("appointment_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.staffId, t.date, t.minute] }),
    index("slots_appointment").on(t.tenantId, t.appointmentId),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.staffId],
      foreignColumns: [staff.tenantId, staff.id],
    }),
  ],
);
export const mutations = sqliteTable(
  "mutations",
  {
    tenantId: text("tenant_id").notNull(),
    appointmentId: text("appointment_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.appointmentId, t.version] }),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const closures = sqliteTable(
  "closures",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    staffId: text("staff_id"),
    date: text("date").notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [
    index("closures_date").on(t.tenantId, t.date),
    foreignKey({
      columns: [t.tenantId, t.staffId],
      foreignColumns: [staff.tenantId, staff.id],
    }),
  ],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    appointmentId: text("appointment_id").notNull().unique(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("reviews_tenant").on(t.tenantId),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const complaints = sqliteTable(
  "complaints",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    appointmentId: text("appointment_id").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("complaints_tenant").on(t.tenantId),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    appointmentId: text("appointment_id").notNull(),
    event: text("event").notNull(),
    state: text("state").notNull().default("not_configured"),
    scheduledAt: text("scheduled_at").notNull(),
  },
  (t) => [
    index("outbox_pending").on(t.state, t.scheduledAt),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => businesses.id),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  providerRef: text("provider_ref"),
  createdAt: text("created_at").notNull(),
});
export const branchExpenses = sqliteTable(
  "branch_expenses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    branchId: text("branch_id").notNull(),
    month: text("month").notNull(),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
    catalogItemId: text("catalog_item_id"),
    quantity: real("quantity").notNull().default(1),
    unit: text("unit").notNull().default("adet"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("branch_expenses_month").on(t.tenantId, t.month, t.branchId),
    foreignKey({
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }),
  ],
);
export const expenseCatalogItems = sqliteTable(
  "expense_catalog_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit").notNull().default("adet"),
    defaultUnitAmount: integer("default_unit_amount").notNull().default(0),
    note: text("note").notNull().default(""),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("expense_catalog_name").on(t.tenantId, t.name),
    index("expense_catalog_tenant").on(t.tenantId, t.active, t.name),
  ],
);
export const branchMonthClosings = sqliteTable(
  "branch_month_closings",
  {
    tenantId: text("tenant_id").notNull(),
    branchId: text("branch_id").notNull(),
    month: text("month").notNull(),
    expensesConfirmed: integer("expenses_confirmed").notNull().default(0),
    confirmedAt: text("confirmed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.branchId, t.month] }),
    foreignKey({
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }),
  ],
);
export const admins = sqliteTable("admins", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

// Authentication is provided by Sites; these rows are application membership.
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default(""),
  accountType: text("account_type").notNull().default("customer"),
  marketingConsent: integer("marketing_consent").notNull().default(0),
  disabled: integer("disabled").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const accountBookings = sqliteTable(
  "account_bookings",
  {
    appointmentId: text("appointment_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("account_bookings_user").on(t.userId),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tenantId] })],
);

export const demandVisits = sqliteTable(
  "demand_visits",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    visitorHash: text("visitor_hash").notNull(),
    day: text("day").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    convertedAt: text("converted_at"),
    appointmentId: text("appointment_id"),
  },
  (t) => [
    uniqueIndex("demand_visits_tenant_id").on(t.tenantId, t.id),
    uniqueIndex("demand_visits_browser_day").on(
      t.tenantId,
      t.visitorHash,
      t.day,
    ),
    index("demand_visits_day").on(t.tenantId, t.day),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const demandSearches = sqliteTable(
  "demand_searches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    visitId: text("visit_id").notNull(),
    serviceId: text("service_id").notNull(),
    staffKey: text("staff_key").notNull(),
    requestedDate: text("requested_date").notNull(),
    minuteFrom: integer("minute_from").notNull(),
    minuteTo: integer("minute_to").notNull(),
    matched: integer("matched").notNull(),
    reason: text("reason").notNull(),
    price: integer("price").notNull(),
    duration: integer("duration").notNull(),
    searchedAt: text("searched_at").notNull(),
  },
  (t) => [
    uniqueIndex("demand_searches_intent").on(
      t.tenantId,
      t.visitId,
      t.serviceId,
      t.staffKey,
      t.requestedDate,
      t.minuteFrom,
      t.minuteTo,
    ),
    index("demand_searches_time").on(t.tenantId, t.searchedAt),
    foreignKey({
      columns: [t.tenantId, t.visitId],
      foreignColumns: [demandVisits.tenantId, demandVisits.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }),
  ],
);
export const earlyOffers = sqliteTable(
  "early_offers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    appointmentId: text("appointment_id").notNull(),
    appointmentVersion: integer("appointment_version").notNull(),
    minute: integer("minute").notNull(),
    status: text("status").notNull().default("offered"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("early_offers_slot").on(
      t.tenantId,
      t.appointmentId,
      t.appointmentVersion,
      t.minute,
    ),
    index("early_offers_appointment").on(t.tenantId, t.appointmentId, t.status),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);

export const authFlows = sqliteTable(
  "auth_flows",
  {
    stateHash: text("state_hash").primaryKey(),
    bindingHash: text("binding_hash").notNull(),
    nonce: text("nonce").notNull(),
    verifier: text("verifier").notNull(),
    returnTo: text("return_to").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("auth_flows_expiry").on(t.expiresAt)],
);
export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    index("auth_sessions_user").on(t.userId),
    index("auth_sessions_expiry").on(t.expiresAt),
  ],
);
export const billingSettings = sqliteTable("billing_settings", {
  id: integer("id").primaryKey(),
  amount: integer("amount").notNull().default(0),
  active: integer("active").notNull().default(0),
  sellerName: text("seller_name").notNull().default(""),
  supportEmail: text("support_email").notNull().default(""),
  sellerAddress: text("seller_address").notNull().default(""),
  termsUrl: text("terms_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
export const billingProfiles = sqliteTable("billing_profiles", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => businesses.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const subscriptionOrders = sqliteTable(
  "subscription_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(),
    originalAmount: integer("original_amount").notNull().default(0),
    campaignId: text("campaign_id"),
    currency: text("currency").notNull().default("TRY"),
    periodDays: integer("period_days").notNull().default(30),
    status: text("status").notNull().default("creating"),
    testMode: integer("test_mode").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerAddress: text("buyer_address").notNull(),
    termsUrl: text("terms_url").notNull(),
    termsAcceptedAt: text("terms_accepted_at").notNull(),
    createdAt: text("created_at").notNull(),
    paidAt: text("paid_at"),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("subscription_orders_idempotency").on(
      t.tenantId,
      t.idempotencyKey,
    ),
    index("subscription_orders_tenant").on(t.tenantId, t.createdAt),
    index("subscription_orders_status").on(t.status, t.createdAt),
  ],
);
export const billingGrants = sqliteTable("billing_grants", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => subscriptionOrders.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => businesses.id),
  periodDays: integer("period_days").notNull(),
  createdAt: text("created_at").notNull(),
});
export const subscriptions = sqliteTable("subscriptions", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => businesses.id),
  paidUntil: text("paid_until").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    discountType: text("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    targetType: text("target_type").notNull(),
    applicablePlans: text("applicable_plans").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    totalUsageLimit: integer("total_usage_limit"),
    perBusinessLimit: integer("per_business_limit"),
    firstPaymentOnly: integer("first_payment_only").notNull().default(0),
    recurringEnabled: integer("recurring_enabled").notNull().default(0),
    active: integer("active").notNull().default(1),
    deletedAt: text("deleted_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("campaigns_code_unique").on(t.code),
    index("campaigns_window").on(t.active, t.startsAt, t.endsAt),
  ],
);
export const campaignBusinesses = sqliteTable(
  "campaign_businesses",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("campaign_businesses_once").on(t.campaignId, t.businessId),
    index("campaign_businesses_business").on(t.businessId, t.campaignId),
  ],
);
export const campaignRedemptions = sqliteTable(
  "campaign_redemptions",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    businessId: text("business_id").references(() => businesses.id),
    userId: text("user_id").notNull(),
    subscriptionId: text("subscription_id"),
    paymentId: text("payment_id").notNull(),
    plan: text("plan").notNull(),
    originalAmount: integer("original_amount").notNull(),
    discountAmount: integer("discount_amount").notNull(),
    finalAmount: integer("final_amount").notNull(),
    status: text("status").notNull().default("reserved"),
    failureReason: text("failure_reason").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    redeemedAt: text("redeemed_at"),
  },
  (t) => [
    uniqueIndex("campaign_redemptions_payment").on(t.paymentId),
    index("campaign_redemptions_campaign").on(
      t.campaignId,
      t.status,
      t.createdAt,
    ),
    index("campaign_redemptions_business").on(
      t.businessId,
      t.campaignId,
      t.status,
    ),
  ],
);
export const campaignAttempts = sqliteTable(
  "campaign_attempts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").references(() => campaigns.id),
    businessId: text("business_id").references(() => businesses.id),
    userId: text("user_id").notNull(),
    code: text("code").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("campaign_attempts_campaign").on(t.campaignId, t.createdAt)],
);

export const receivables = sqliteTable(
  "receivables",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    customerId: text("customer_id").notNull(),
    appointmentId: text("appointment_id"),
    title: text("title").notNull(),
    amount: integer("amount").notNull(),
    remaining: integer("remaining").notNull(),
    dueDate: text("due_date"),
    status: text("status").notNull().default("open"),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (t) => [
    uniqueIndex("receivables_tenant_id").on(t.tenantId, t.id),
    uniqueIndex("receivables_request").on(t.tenantId, t.idempotencyKey),
    index("receivables_customer").on(t.tenantId, t.customerId, t.status),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const receivablePayments = sqliteTable(
  "receivable_payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    receivableId: text("receivable_id").notNull(),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("recorded"),
    reversalReason: text("reversal_reason").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    reversedAt: text("reversed_at"),
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (t) => [
    uniqueIndex("receivable_payments_request").on(t.tenantId, t.idempotencyKey),
    index("receivable_payments_debt").on(t.tenantId, t.receivableId),
    foreignKey({
      columns: [t.tenantId, t.receivableId],
      foreignColumns: [receivables.tenantId, receivables.id],
    }),
  ],
);
export const journeys = sqliteTable(
  "journeys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    customerId: text("customer_id").notNull(),
    title: text("title").notNull(),
    template: text("template").notNull(),
    status: text("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    shareHash: text("share_hash").notNull().unique(),
    shared: integer("shared").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("journeys_tenant_id").on(t.tenantId, t.id),
    index("journeys_customer").on(t.tenantId, t.customerId),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);
export const journeySteps = sqliteTable(
  "journey_steps",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    journeyId: text("journey_id").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    dueDate: text("due_date"),
    completedAt: text("completed_at"),
  },
  (t) => [
    uniqueIndex("journey_steps_order").on(t.tenantId, t.journeyId, t.position),
    foreignKey({
      columns: [t.tenantId, t.journeyId],
      foreignColumns: [journeys.tenantId, journeys.id],
    }),
  ],
);
export const journeyMutations = sqliteTable(
  "journey_mutations",
  {
    tenantId: text("tenant_id").notNull(),
    journeyId: text("journey_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.journeyId, t.version] }),
    foreignKey({
      columns: [t.tenantId, t.journeyId],
      foreignColumns: [journeys.tenantId, journeys.id],
    }),
  ],
);

export const growthSettings = sqliteTable("growth_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => businesses.id),
  theme: text("theme").notNull().default("auto"),
  hideBrand: integer("hide_brand").notNull().default(0),
  autopilot: integer("autopilot").notNull().default(0),
  recallDays: integer("recall_days").notNull().default(30),
  welcome: text("welcome")
    .notNull()
    .default(
      "Merhaba! Randevu almak istediğiniz hizmeti ve günü yazabilirsiniz.",
    ),
  updatedAt: text("updated_at").notNull(),
});
export const referrals = sqliteTable("referrals", {
  referredTenant: text("referred_tenant")
    .primaryKey()
    .references(() => businesses.id),
  referrerTenant: text("referrer_tenant")
    .notNull()
    .references(() => businesses.id),
  ownerId: text("owner_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  reward: integer("reward").notNull().default(50000),
  createdAt: text("created_at").notNull(),
});
export const creditLedger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    amount: integer("amount").notNull(),
    kind: text("kind").notNull(),
    reference: text("reference").notNull().unique(),
    description: text("description").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("credit_ledger_tenant").on(t.tenantId, t.createdAt)],
);
export const waThreads = sqliteTable(
  "wa_threads",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    phone: text("phone").notNull(),
    state: text("state").notNull().default("{}"),
    version: integer("version").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.phone] })],
);
export const waMessages = sqliteTable(
  "wa_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    phone: text("phone").notNull(),
    reply: text("reply").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    appointmentId: text("appointment_id"),
    createdAt: integer("created_at").notNull(),
    sentAt: integer("sent_at"),
  },
  (t) => [
    index("wa_messages_tenant").on(t.tenantId, t.createdAt),
    foreignKey({
      columns: [t.tenantId, t.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
  ],
);
export const waMutations = sqliteTable(
  "wa_mutations",
  {
    tenantId: text("tenant_id").notNull(),
    phone: text("phone").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.phone, t.version] })],
);
export const recallJobs = sqliteTable(
  "recall_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    customerId: text("customer_id").notNull(),
    lastVisit: text("last_visit").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("recall_jobs_visit").on(t.tenantId, t.customerId, t.lastVisit),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);
export const recurringSubscriptions = sqliteTable("recurring_subscriptions", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => businesses.id),
  reference: text("reference").unique(),
  customerReference: text("customer_reference"),
  planReference: text("plan_reference").notNull(),
  plan: text("plan").notNull(),
  amount: integer("amount").notNull(),
  state: text("state").notNull().default("creating"),
  tokenHash: text("token_hash").unique(),
  requestId: text("request_id").notNull().unique(),
  testMode: integer("test_mode").notNull().default(1),
  paidUntil: text("paid_until"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const recurringEvents = sqliteTable("recurring_events", {
  reference: text("reference").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => businesses.id),
  amount: integer("amount").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  testMode: integer("test_mode").notNull(),
  createdAt: text("created_at").notNull(),
});
export const waitlistEntries = sqliteTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    serviceId: text("service_id").notNull(),
    staffId: text("staff_id"),
    requestedDate: text("requested_date").notNull(),
    minuteFrom: integer("minute_from").notNull(),
    minuteTo: integer("minute_to").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    consent: integer("consent").notNull().default(1),
    status: text("status").notNull().default("waiting"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("waitlist_match").on(
      t.tenantId,
      t.serviceId,
      t.requestedDate,
      t.status,
      t.createdAt,
    ),
    index("waitlist_phone").on(t.tenantId, t.phone, t.status),
  ],
);
export const recoverySlots = sqliteTable(
  "recovery_slots",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    sourceAppointmentId: text("source_appointment_id").notNull().unique(),
    serviceId: text("service_id").notNull(),
    staffId: text("staff_id").notNull(),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    status: text("status").notNull().default("queued"),
    recoveredAppointmentId: text("recovered_appointment_id"),
    recoveredCustomerId: text("recovered_customer_id"),
    recoveredAmount: integer("recovered_amount").notNull().default(0),
    createdAt: text("created_at").notNull(),
    filledAt: text("filled_at"),
  },
  (t) => [
    index("recovery_slot_queue").on(t.status, t.date, t.minute, t.createdAt),
    index("recovery_slot_tenant").on(t.tenantId, t.createdAt),
  ],
);
export const recoveryOffers = sqliteTable(
  "recovery_offers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    recoverySlotId: text("recovery_slot_id")
      .notNull()
      .references(() => recoverySlots.id),
    waitlistId: text("waitlist_id")
      .notNull()
      .references(() => waitlistEntries.id),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("offered"),
    providerId: text("provider_id"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    acceptedAt: text("accepted_at"),
  },
  (t) => [
    uniqueIndex("recovery_offer_person").on(t.recoverySlotId, t.waitlistId),
    index("recovery_offer_active").on(t.recoverySlotId, t.status, t.expiresAt),
  ],
);
export const recoveryAttributions = sqliteTable(
  "recovery_attributions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    appointmentId: text("appointment_id").notNull().unique(),
    customerId: text("customer_id").notNull(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("recovery_attribution_tenant").on(t.tenantId, t.createdAt)],
);
export const setupImportBatches = sqliteTable(
  "setup_import_batches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    kind: text("kind").notNull(),
    rowCount: integer("row_count").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("setup_import_tenant").on(t.tenantId, t.createdAt)],
);
export const setupTrainingRequests = sqliteTable(
  "setup_training_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    preferredDate: text("preferred_date"),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("setup_training_tenant").on(t.tenantId, t.createdAt)],
);
