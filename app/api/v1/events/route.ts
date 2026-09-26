import { broadcaster } from "@/lib/events";
import { ApiError, fail, tenant } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantId =
      url.searchParams.get("tenant") || url.searchParams.get("businessId") || "";
    if (!tenantId) throw new ApiError("İşletme kimliği gerekli.", 400);
    await tenant(tenantId);

    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      unsubscribe?.();
      unsubscribe = null;
    };

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (eventType: string, data: unknown, eventId?: string) => {
          if (closed) return;
          let message = "";
          if (eventId) message += `id: ${eventId}\n`;
          if (eventType) message += `event: ${eventType}\n`;
          message += `data: ${JSON.stringify(data)}\n\n`;
          try {
            controller.enqueue(encoder.encode(message));
          } catch {
            cleanup();
          }
        };

        send("connected", {
          connected: true,
          tenantId,
          timestamp: new Date().toISOString(),
        });

        unsubscribe = broadcaster.subscribe(tenantId, (event) => {
          send(event.type, event, event.id);
        });

        timer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            cleanup();
          }
        }, 15000);

        req.signal.addEventListener(
          "abort",
          () => {
            cleanup();
            try {
              controller.close();
            } catch {}
          },
          { once: true },
        );
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
