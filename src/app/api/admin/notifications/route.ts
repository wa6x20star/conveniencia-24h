import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv, STORE_SLUG } from "@/lib/config";

export const dynamic = "force-dynamic";

type Priority = "critical" | "high" | "medium" | "info";
type Category = "orders" | "deliveries" | "stock" | "finance";

type NotificationItem = {
  id: string;
  category: Category;
  priority: Priority;
  title: string;
  message: string;
  href: string;
  actionLabel: string;
  createdAt: string;
  orderNumber?: number | null;
};

function minutesSince(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
}

function ageLabel(minutes: number) {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `há ${hours}h ${rest}min` : `há ${hours}h`;
}

function orderLabel(value: number | string | null | undefined) {
  return `#${String(value ?? "").padStart(6, "0")}`;
}

function sortNotifications(items: NotificationItem[]) {
  const weight: Record<Priority, number> = { critical: 4, high: 3, medium: 2, info: 1 };
  return items.sort((a, b) => {
    const priority = weight[b.priority] - weight[a.priority];
    if (priority) return priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin", "operation"]);
  if (!staff.user || !staff.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("slug", STORE_SLUG).single();
    if (storeError || !store) throw storeError || new Error("store_not_found");

    const [ordersResult, confirmationsResult, storeProductsResult, driversResult, cancellationsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,order_number,status,payment_method,payment_status,total,customer_name,neighborhood,created_at,updated_at")
        .eq("store_id", store.id)
        .in("status", ["received", "picking", "ready", "out_for_delivery"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("delivery_confirmations")
        .select("id,order_id,delivery_id,status,locked_until,proof_submitted_at,updated_at")
        .eq("store_id", store.id)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("store_products")
        .select("id,product_id,minimum_stock,active")
        .eq("store_id", store.id)
        .eq("active", true)
        .limit(1000),
      supabase.from("drivers").select("id").eq("store_id", store.id),
      supabase.from("orders").select("id,order_number,cancellation_reason,cancelled_at,updated_at,refund_status,refund_amount")
        .eq("store_id", store.id).eq("status", "cancelled")
        .or(`refund_status.eq.pending,cancelled_at.gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`).order("cancelled_at", { ascending: false }),
    ]);

    if (cancellationsResult.error) throw cancellationsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (confirmationsResult.error) throw confirmationsResult.error;
    if (storeProductsResult.error) throw storeProductsResult.error;
    if (driversResult.error) throw driversResult.error;

    const driverIds = (driversResult.data ?? []).map((driver: any) => driver.id);
    let deliveries: any[] = [];
    if (driverIds.length) {
      const deliveriesResult = await supabase
        .from("deliveries")
        .select("id,order_id,driver_id,status,assigned_at,started_at,driver_payout")
        .in("driver_id", driverIds)
        .in("status", ["assigned", "started"])
        .order("assigned_at", { ascending: false })
        .limit(100);
      if (deliveriesResult.error) throw deliveriesResult.error;
      deliveries = deliveriesResult.data ?? [];
    }

    const orders = ordersResult.data ?? [];
    const confirmations = confirmationsResult.data ?? [];
    const storeProducts = storeProductsResult.data ?? [];
    const items: NotificationItem[] = [];
    for (const order of cancellationsResult.data ?? []) {
      const pending = order.refund_status === "pending";
      items.push({ id: `cancelled-${order.id}`, category: pending ? "finance" : "orders", priority: pending ? "critical" : "info",
        title: `${pending ? "Estorno pendente" : "Pedido cancelado"} ${orderLabel(order.order_number)}`,
        message: pending ? `Devolver R$ ${Number(order.refund_amount).toFixed(2).replace(".", ",")}. A devolução ainda não foi registrada.` : (order.cancellation_reason || "Cancelamento registrado."),
        href: "/admin/pedidos#cancelados", actionLabel: pending ? "Conferir estorno" : "Ver cancelamento", createdAt: order.cancelled_at || order.updated_at,
        orderNumber: Number(order.order_number) });
    }
    const orderById = new Map(orders.map((order: any) => [order.id, order]));
    const activeDeliveryOrderIds = new Set(deliveries.map((delivery: any) => delivery.order_id));

    for (const order of orders as any[]) {
      const createdAge = minutesSince(order.created_at);
      const updatedAge = minutesSince(order.updated_at || order.created_at);
      const number = orderLabel(order.order_number);

      if (order.status === "received") {
        items.push({
          id: `order-received-${order.id}`,
          category: "orders",
          priority: createdAge >= 10 ? "high" : "medium",
          title: `${createdAge >= 10 ? "Pedido aguardando" : "Novo pedido"} ${number}`,
          message: `${order.customer_name || "Cliente"} • R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")} • aguardando separação ${ageLabel(createdAge)}.`,
          href: "/admin/pedidos",
          actionLabel: "Abrir pedidos",
          createdAt: order.created_at,
          orderNumber: Number(order.order_number),
        });
      }

      if (order.status === "picking" && updatedAge >= 20) {
        items.push({
          id: `order-picking-stale-${order.id}`,
          category: "orders",
          priority: updatedAge >= 40 ? "critical" : "high",
          title: `Separação demorando ${number}`,
          message: `O pedido está em separação ${ageLabel(updatedAge)} sem nova atualização.`,
          href: "/admin/pedidos",
          actionLabel: "Ver pedido",
          createdAt: order.updated_at || order.created_at,
          orderNumber: Number(order.order_number),
        });
      }

      if (order.status === "ready" && !activeDeliveryOrderIds.has(order.id)) {
        items.push({
          id: `order-ready-no-driver-${order.id}`,
          category: "deliveries",
          priority: updatedAge >= 15 ? "critical" : "high",
          title: `Pedido pronto sem entregador ${number}`,
          message: `${order.neighborhood || "Endereço do cliente"} • aguardando atribuição ${ageLabel(updatedAge)}.`,
          href: "/admin/entregas",
          actionLabel: "Atribuir entregador",
          createdAt: order.updated_at || order.created_at,
          orderNumber: Number(order.order_number),
        });
      }

      if (order.payment_method === "pix" && order.payment_status === "pending" && createdAge >= 10) {
        items.push({
          id: `payment-pix-pending-${order.id}`,
          category: "orders",
          priority: createdAge >= 30 ? "high" : "medium",
          title: `PIX pendente ${number}`,
          message: `Pagamento PIX ainda está pendente ${ageLabel(createdAge)}.`,
          href: "/admin/pedidos",
          actionLabel: "Conferir pagamento",
          createdAt: order.created_at,
          orderNumber: Number(order.order_number),
        });
      }
    }

    for (const delivery of deliveries as any[]) {
      if (delivery.status !== "started") continue;
      const age = minutesSince(delivery.started_at);
      if (age < 60) continue;
      const order = orderById.get(delivery.order_id) as any;
      items.push({
        id: `delivery-long-${delivery.id}`,
        category: "deliveries",
        priority: age >= 120 ? "critical" : "high",
        title: `Entrega em rota há muito tempo ${order ? orderLabel(order.order_number) : ""}`.trim(),
        message: `A entrega foi iniciada ${ageLabel(age)} e ainda não foi concluída.`,
        href: "/admin/entregas",
        actionLabel: "Ver entrega",
        createdAt: delivery.started_at || delivery.assigned_at,
        orderNumber: order?.order_number ?? null,
      });
    }

    for (const confirmation of confirmations as any[]) {
      const order = orderById.get(confirmation.order_id) as any;
      if (confirmation.status === "proof_pending") {
        items.push({
          id: `proof-pending-${confirmation.id}`,
          category: "deliveries",
          priority: "critical",
          title: `Comprovante aguardando análise ${order ? orderLabel(order.order_number) : ""}`.trim(),
          message: "O entregador enviou uma foto de comprovação. A entrega só será concluída após revisão.",
          href: "/admin/entregas#comprovantes-pendentes",
          actionLabel: "Analisar comprovante",
          createdAt: confirmation.proof_submitted_at || confirmation.updated_at,
          orderNumber: order?.order_number ?? null,
        });
      }
      if (confirmation.locked_until && new Date(confirmation.locked_until).getTime() > Date.now()) {
        items.push({
          id: `confirmation-locked-${confirmation.id}`,
          category: "deliveries",
          priority: "high",
          title: `Código de entrega bloqueado ${order ? orderLabel(order.order_number) : ""}`.trim(),
          message: `Muitas tentativas incorretas. Bloqueado até ${new Date(confirmation.locked_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" })}.`,
          href: "/admin/entregas",
          actionLabel: "Ver entrega",
          createdAt: confirmation.updated_at,
          orderNumber: order?.order_number ?? null,
        });
      }
    }

    const storeProductIds = storeProducts.map((row: any) => row.id);
    const productIds = storeProducts.map((row: any) => row.product_id);
    let inventoryRows: any[] = [];
    let productRows: any[] = [];
    if (storeProductIds.length) {
      const result = await supabase.from("inventory").select("store_product_id,on_hand,reserved").in("store_product_id", storeProductIds);
      if (!result.error) inventoryRows = result.data ?? [];
    }
    if (productIds.length) {
      const result = await supabase.from("products").select("id,name").in("id", productIds);
      if (!result.error) productRows = result.data ?? [];
    }
    const inventoryByStoreProduct = new Map(inventoryRows.map((row: any) => [row.store_product_id, row]));
    const productById = new Map(productRows.map((row: any) => [row.id, row]));
    const stockRows = storeProducts.map((row: any) => {
      const inventory = inventoryByStoreProduct.get(row.id) as any;
      const product = productById.get(row.product_id) as any;
      const available = Number(inventory?.on_hand || 0) - Number(inventory?.reserved || 0);
      return { name: product?.name || "Produto", available, minimum: Number(row.minimum_stock || 0) };
    });
    const outOfStock = stockRows.filter((row) => row.available <= 0);
    const lowStock = stockRows.filter((row) => row.available > 0 && row.available <= row.minimum);

    if (outOfStock.length) {
      items.push({
        id: "stock-zero-summary",
        category: "stock",
        priority: "critical",
        title: `${outOfStock.length} ${outOfStock.length === 1 ? "produto zerado" : "produtos zerados"}`,
        message: `${outOfStock.slice(0, 3).map((row) => row.name).join(", ")}${outOfStock.length > 3 ? ` e mais ${outOfStock.length - 3}` : ""}.`,
        href: "/admin/estoque",
        actionLabel: "Abrir estoque",
        createdAt: new Date().toISOString(),
      });
    }
    if (lowStock.length) {
      items.push({
        id: "stock-low-summary",
        category: "stock",
        priority: "medium",
        title: `${lowStock.length} ${lowStock.length === 1 ? "produto com estoque baixo" : "produtos com estoque baixo"}`,
        message: `${lowStock.slice(0, 3).map((row) => `${row.name} (${row.available})`).join(", ")}${lowStock.length > 3 ? ` e mais ${lowStock.length - 3}` : ""}.`,
        href: "/admin/estoque",
        actionLabel: "Planejar reposição",
        createdAt: new Date().toISOString(),
      });
    }

    if (staff.role === "admin") {
      const { data: payoutSettings } = await supabase.from("driver_payout_settings").select("control_started_at").eq("store_id", store.id).maybeSingle();
      if (payoutSettings?.control_started_at) {
        const completedDeliveriesResult = driverIds.length
          ? await supabase
              .from("deliveries")
              .select("id,driver_payout,delivered_at")
              .in("driver_id", driverIds)
              .eq("status", "delivered")
              .gte("delivered_at", payoutSettings.control_started_at)
              .gt("driver_payout", 0)
              .limit(2000)
          : { data: [] as any[] };
        const completedDeliveries = completedDeliveriesResult.data ?? [];
        const deliveryIds = (completedDeliveries ?? []).map((row: any) => row.id);
        let paidIds = new Set<string>();
        if (deliveryIds.length) {
          const { data: paidItems } = await supabase.from("driver_payout_items").select("delivery_id").in("delivery_id", deliveryIds);
          paidIds = new Set((paidItems ?? []).map((row: any) => row.delivery_id));
        }
        const pending = (completedDeliveries ?? []).filter((row: any) => !paidIds.has(row.id));
        const pendingAmount = pending.reduce((sum: number, row: any) => sum + Number(row.driver_payout || 0), 0);
        if (pending.length) {
          items.push({
            id: "finance-payout-pending-summary",
            category: "finance",
            priority: pending.length >= 10 ? "high" : "medium",
            title: `${pending.length} ${pending.length === 1 ? "entrega aguardando repasse" : "entregas aguardando repasse"}`,
            message: `Total pendente de R$ ${pendingAmount.toFixed(2).replace(".", ",")} para os entregadores.`,
            href: "/admin/repasses",
            actionLabel: "Ver repasses",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const notifications = sortNotifications(items);
    const counts = notifications.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.category] += 1;
        acc[item.priority] += 1;
        return acc;
      },
      { total: 0, orders: 0, deliveries: 0, stock: 0, finance: 0, critical: 0, high: 0, medium: 0, info: 0 },
    );

    return NextResponse.json(
      { notifications, counts, role: staff.role, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error) {
    console.error("admin_notifications_get", error);
    return NextResponse.json({ error: "notifications_unavailable" }, { status: 500 });
  }
}
