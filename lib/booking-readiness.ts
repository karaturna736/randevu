type Hours = Record<string, [number, number]>;

type Workspace = {
  business: { address?: string; city?: string; phone?: string; hours?: string | Hours; status?: string; demo?: number };
  services: Array<{ active?: number; duration?: number }>;
  staff: Array<{ active?: number; hours?: string | Hours }>;
  public_site_ready?: boolean;
};

function schedule(value: string | Hours | undefined): Hours {
  try {
    const hours = typeof value === "string" ? JSON.parse(value) : value;
    return hours && typeof hours === "object" ? hours : {};
  } catch {
    return {};
  }
}

export function bookingReadiness(w: Workspace) {
  const services = w.services.filter((service) => service.active !== 0);
  const shortestService = services.length
    ? Math.min(...services.map((service) => Number(service.duration) || 15))
    : 15;
  const businessHours = schedule(w.business.hours);
  const steps = [
    {
      label: "İşletme bilgileri",
      done: !!(w.business.city?.trim() && w.business.address?.trim() && w.business.phone?.trim()),
      view: "settings",
    },
    { label: "İlk hizmet", done: services.length > 0, view: "services" },
    {
      label: "Ekip ve saatler",
      done: w.staff.some((person) => {
        if (person.active === 0) return false;
        const staffHours = schedule(person.hours);
        return Object.keys(staffHours).some((day) => {
          const businessDay = businessHours[day];
          const staffDay = staffHours[day];
          return Array.isArray(businessDay) && Array.isArray(staffDay) &&
            Math.min(businessDay[1], staffDay[1]) - Math.max(businessDay[0], staffDay[0]) >= shortestService;
        });
      }),
      view: "staff",
    },
  ];
  return {
    steps,
    ready: w.public_site_ready === true && w.business.status === "approved" &&
      w.business.demo !== 1 && steps.every((step) => step.done),
  };
}
