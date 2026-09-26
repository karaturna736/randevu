export type SSEEvent = {
  id: string;
  type:
    | "appointment.created"
    | "appointment.updated"
    | "appointment.cancelled"
    | "appointment.payment_updated";
  appointmentId: string;
  tenantId: string;
  branchId?: string | null;
  timestamp: string;
  data: {
    customer_name?: string;
    customer_phone?: string;
    service_name?: string;
    staff_name?: string;
    branch_name?: string;
    date?: string;
    minute?: number;
    time?: string;
    status?: string;
    price?: number;
    payment_status?: string;
  };
};

type ClientCallback = (event: SSEEvent) => void;

class EventBroadcaster {
  private clients: Map<string, Set<ClientCallback>> = new Map();

  subscribe(tenantId: string, callback: ClientCallback): () => void {
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Set());
    }
    const tenantClients = this.clients.get(tenantId)!;
    tenantClients.add(callback);

    return () => {
      const current = this.clients.get(tenantId);
      if (current) {
        current.delete(callback);
        if (current.size === 0) {
          this.clients.delete(tenantId);
        }
      }
    };
  }

  emit(event: SSEEvent) {
    const tenantClients = this.clients.get(event.tenantId);
    if (tenantClients) {
      for (const cb of tenantClients) {
        try {
          cb(event);
        } catch (err) {
          console.error("Error broadcasting SSE event:", err);
        }
      }
    }
  }
}

export const broadcaster = new EventBroadcaster();
