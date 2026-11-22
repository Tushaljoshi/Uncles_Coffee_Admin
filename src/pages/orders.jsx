import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  CreditCard,
  Filter,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiRoot, requestApi } from "../utils/api";

const ordersApiUrl = `${apiRoot}/orders`;
const statuses = [
  "cart",
  "placed",
  "accepted",
  "preparing",
  "ready",
  "served",
  "cancelled",
];
const initialFilters = {
  status: "",
  mobile: "",
  tableId: "",
  search: "",
  includeCart: false,
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "Date unavailable";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};

const getOrderKey = (order) => order._id || order.id || order.orderId;

const getOrderStatus = (order) => (order.status || "placed").toLowerCase();

const isPaid = (order) =>
  ["paid", "success", "succeeded", "completed"].includes(
    (order.paymentStatus || "").toLowerCase()
  );

const canConfirmCounterPayment = (order) =>
  ["counter", "cash"].includes((order.paymentMethod || "").toLowerCase()) &&
  !isPaid(order) &&
  !["cart", "cancelled"].includes(getOrderStatus(order));

const statusClassNames = (status) => {
  switch (status) {
    case "accepted":
      return "bg-caramel/15 text-caramel";
    case "preparing":
      return "bg-warning/15 text-warning";
    case "ready":
      return "bg-success/15 text-success";
    case "served":
      return "bg-espresso/10 text-espresso";
    case "cancelled":
      return "bg-error/10 text-error";
    case "cart":
      return "bg-latte text-espresso/70";
    default:
      return "bg-terracotta/15 text-terracotta";
  }
};

function OrdersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tablesError, setTablesError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [confirmingPaymentId, setConfirmingPaymentId] = useState("");

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const loadOrders = async (activeFilters) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    ["status", "mobile", "tableId", "search"].forEach((key) => {
      const value = activeFilters[key]?.trim();
      if (value) query.set(key, value);
    });
    if (activeFilters.includeCart || activeFilters.status === "cart") {
      query.set("includeCart", "true");
    }

    try {
      const result = await requestApi(
        `${ordersApiUrl}${query.toString() ? `?${query.toString()}` : ""}`
      );
      if (!Array.isArray(result.orders)) {
        throw new Error("The orders service returned an unexpected response.");
      }
      setOrders(result.orders);
      setSelectedOrder((current) => {
        if (!current) return current;
        const key = getOrderKey(current);
        return result.orders.find((order) => getOrderKey(order) === key) || null;
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    setTablesError("");
    try {
      const result = await requestApi(`${apiRoot}/tables/all`);
      if (!Array.isArray(result.tables)) {
        throw new Error("The tables service returned an unexpected response.");
      }
      setTables(result.tables);
    } catch (requestError) {
      setTablesError(requestError.message || "Unable to load tables.");
    }
  };

  useEffect(() => {
    loadOrders(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    loadTables();
  }, []);

  const metrics = useMemo(
    () => ({
      total: orders.length,
      active: orders.filter((order) =>
        ["placed", "accepted", "preparing", "ready"].includes(
          getOrderStatus(order)
        )
      ).length,
      unpaid: orders.filter((order) => !isPaid(order)).length,
      revenue: orders.reduce(
        (sum, order) => sum + (isPaid(order) ? Number(order.total) || 0 : 0),
        0
      ),
    }),
    [orders]
  );

  const applyFilters = (event) => {
    event.preventDefault();
    setNotice("");
    setError("");
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setNotice("");
    setError("");
  };

  const openDetails = (order) => {
    setSelectedOrder(order);
    setStatusDraft(getOrderStatus(order));
    setStatusMessage("");
    setError("");
  };

  const updateOrderStatus = async (event) => {
    event.preventDefault();
    if (!selectedOrder || !statusDraft) return;
    const orderId = selectedOrder.orderId || selectedOrder._id || selectedOrder.id;
    if (!orderId) {
      setError("This order is missing an ID and cannot be updated.");
      return;
    }

    setUpdatingOrderId(getOrderKey(selectedOrder));
    setError("");
    setNotice("");
    try {
      await requestApi(
        `${ordersApiUrl}/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: statusDraft,
            message:
              statusMessage.trim() ||
              `Order status changed to ${statusDraft}.`,
          }),
        }
      );
      setNotice(`Order ${orderId} updated to ${statusDraft}.`);
      await loadOrders(appliedFilters);
    } catch (requestError) {
      setError(requestError.message || "Unable to update order status.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  const confirmCounterPayment = async (order) => {
    const orderId = order.orderId;
    if (!orderId) {
      setError("This order is missing its order number.");
      return;
    }
    if (!canConfirmCounterPayment(order)) return;
    if (!window.confirm(`Confirm that cash payment for ${orderId} was collected?`)) {
      return;
    }

    setConfirmingPaymentId(getOrderKey(order));
    setError("");
    setNotice("");
    try {
      await requestApi(
        `${apiRoot}/payments/order/${encodeURIComponent(orderId)}/confirm-counter`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Cash collected by cashier" }),
        }
      );
      setNotice(`Cash payment confirmed for ${orderId}.`);
      await loadOrders(appliedFilters);
    } catch (requestError) {
      setError(requestError.message || "Unable to confirm cash payment.");
    } finally {
      setConfirmingPaymentId("");
    }
  };

  return (
    <div className="min-h-screen bg-cream text-espresso">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={toggleSidebar}
          className="fixed inset-0 z-40 bg-espresso/30 lg:hidden"
        />
      )}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="min-h-screen lg:pl-60">
        <TopBar toggleSidebar={toggleSidebar} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-caramel">
                Cafe operations
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Orders
              </h1>
              <p className="mt-2 text-sm text-espresso/65">
                Track kitchen progress, order details, and payment collection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadOrders(appliedFilters)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-latte bg-white px-4 py-3 text-sm font-semibold text-espresso transition hover:bg-latte disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh orders
            </button>
          </div>

          {notice && (
            <MessageBanner
              type="success"
              message={notice}
              onDismiss={() => setNotice("")}
            />
          )}
          {error && !selectedOrder && (
            <MessageBanner
              type="error"
              message={error}
              onDismiss={() => setError("")}
            />
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Orders in view" value={metrics.total} icon={ClipboardList} />
            <MetricCard label="In progress" value={metrics.active} icon={Clock3} />
            <MetricCard label="Awaiting payment" value={metrics.unpaid} icon={Banknote} />
            <MetricCard
              label="Paid revenue in view"
              value={formatCurrency(metrics.revenue)}
              icon={CreditCard}
            />
          </section>

          <section className="mb-6 rounded-2xl border border-latte bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={18} className="text-caramel" />
              <div>
                <h2 className="font-semibold">Find orders</h2>
                <p className="text-xs text-espresso/55">
                  Filter orders by status, customer, table, or mobile number.
                </p>
              </div>
            </div>
            <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Order status
                </span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {capitalize(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Customer mobile
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={filters.mobile}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      mobile: event.target.value,
                    }))
                  }
                  placeholder="9876543210"
                  className={inputClassName}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Table
                </span>
                <select
                  value={filters.tableId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      tableId: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">All tables</option>
                  {tables.map((table) => (
                    <option
                      key={table._id || table.id || table.tableCode}
                      value={table.tableCode}
                    >
                      {table.tableCode} · {table.name}
                    </option>
                  ))}
                </select>
                {tablesError && (
                  <span className="mt-1 block text-xs text-error">
                    Table filter unavailable
                  </span>
                )}
              </label>
              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Search
                </span>
                <span className="relative block">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40"
                  />
                  <input
                    type="search"
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    placeholder="Order ID or customer name"
                    className={`${inputClassName} pl-10`}
                  />
                </span>
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-caramel px-4 py-3 text-sm font-semibold text-white transition hover:bg-caramelHover"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-latte px-3 py-3 text-sm font-semibold text-espresso transition hover:bg-latte"
                >
                  Clear
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-espresso/75 sm:col-span-2 xl:col-span-6">
                <input
                  type="checkbox"
                  checked={filters.includeCart}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      includeCart: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-caramel"
                />
                Include carts that have not been submitted
              </label>
            </form>
          </section>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              {loading ? "Loading orders..." : `${orders.length} orders`}
            </h2>
            <p className="text-xs text-espresso/55">
              Choose an order to view its timeline and update its status.
            </p>
          </div>

          {loading && orders.length === 0 ? (
            <LoadingState />
          ) : error && orders.length === 0 ? (
            <EmptyState
              title="Could not load orders"
              description={error}
              action={() => loadOrders(appliedFilters)}
            />
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-latte bg-white px-6 py-14 text-center">
              <ClipboardList className="mx-auto mb-3 text-caramel/60" size={36} />
              <h3 className="font-semibold">No orders found</h3>
              <p className="mt-2 text-sm text-espresso/60">
                Change or clear your filters to see more orders.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-latte px-4 py-2 text-sm font-semibold text-espresso hover:bg-latte/70"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {orders.map((order) => (
                <OrderCard
                  key={getOrderKey(order)}
                  order={order}
                  onOpen={() => openDetails(order)}
                  onConfirmPayment={() => confirmCounterPayment(order)}
                  confirmingPayment={confirmingPaymentId === getOrderKey(order)}
                />
              ))}
            </section>
          )}
        </main>

        {selectedOrder && (
          <OrderDetails
            order={selectedOrder}
            statuses={statuses}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            statusMessage={statusMessage}
            setStatusMessage={setStatusMessage}
            updating={updatingOrderId === getOrderKey(selectedOrder)}
            confirmingPayment={
              confirmingPaymentId === getOrderKey(selectedOrder)
            }
            error={error}
            onDismissError={() => setError("")}
            onClose={() => {
              setSelectedOrder(null);
              setError("");
            }}
            onUpdateStatus={updateOrderStatus}
            onConfirmPayment={() => confirmCounterPayment(selectedOrder)}
          />
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onOpen, onConfirmPayment, confirmingPayment }) {
  const status = getOrderStatus(order);
  const table = order.tableId;
  const itemCount = (order.items || []).reduce(
    (count, item) => count + (Number(item.quantity) || 0),
    0
  );
  const counterPayment = canConfirmCounterPayment(order);

  return (
    <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-caramel">
            {order.orderId || "Order"}
          </p>
          <h3 className="mt-1 text-lg font-bold text-espresso">
            {order.customer?.name || "Guest"}
          </h3>
          <p className="mt-0.5 text-sm text-espresso/60">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusClassNames(status)}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl bg-cream p-3 sm:grid-cols-3">
        <InfoBlock
          icon={MapPin}
          label="Table"
          value={table?.tableCode || table?.name || "—"}
        />
        <InfoBlock
          icon={Users}
          label="Guests"
          value={order.guestCount ?? "—"}
        />
        <InfoBlock
          icon={ClipboardList}
          label="Items"
          value={itemCount}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-espresso/55">Order total</p>
          <p className="text-xl font-bold">{formatCurrency(order.total)}</p>
        </div>
        <PaymentBadge order={order} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-latte pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-latte px-4 py-2.5 text-sm font-semibold text-espresso transition hover:bg-latte"
        >
          <ClipboardList size={16} />
          View & update
        </button>
        {counterPayment && (
          <button
            type="button"
            onClick={onConfirmPayment}
            disabled={confirmingPayment}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-success/90 disabled:cursor-wait disabled:opacity-60"
          >
            {confirmingPayment ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Banknote size={16} />
            )}
            Mark cash paid
          </button>
        )}
      </div>
    </article>
  );
}

function OrderDetails({
  order,
  statuses,
  statusDraft,
  setStatusDraft,
  statusMessage,
  setStatusMessage,
  updating,
  confirmingPayment,
  error,
  onDismissError,
  onClose,
  onUpdateStatus,
  onConfirmPayment,
}) {
  const status = getOrderStatus(order);
  const counterPayment = canConfirmCounterPayment(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-espresso/55 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-cream shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-latte bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-caramel">
              Order details
            </p>
            <h2 id="order-details-title" className="mt-1 text-xl font-bold">
              {order.orderId || "Order"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="rounded-lg p-2 text-espresso/60 transition hover:bg-latte hover:text-espresso"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto p-5 sm:p-7">
          {error && (
            <MessageBanner type="error" message={error} onDismiss={onDismissError} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-latte bg-white p-4">
              <h3 className="mb-3 text-sm font-bold">Customer & seating</h3>
              <p className="font-semibold">{order.customer?.name || "Guest"}</p>
              <p className="mt-1 text-sm text-espresso/65">
                {order.customer?.mobile || "No phone number"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-espresso/70">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-caramel" />
                  {order.tableId?.tableCode || order.tableId?.name || "No table"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={15} className="text-caramel" />
                  {order.guestCount ?? "—"} guests
                </span>
              </div>
            </section>
            <section className="rounded-xl border border-latte bg-white p-4">
              <h3 className="mb-3 text-sm font-bold">Payment</h3>
              <PaymentBadge order={order} />
              <p className="mt-3 text-sm text-espresso/65">
                Method: <span className="font-medium capitalize">{order.paymentMethod || "Unknown"}</span>
              </p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(order.total)}</p>
              {counterPayment && (
                <button
                  type="button"
                  onClick={onConfirmPayment}
                  disabled={confirmingPayment}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white transition hover:bg-success/90 disabled:opacity-60"
                >
                  {confirmingPayment ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Banknote size={15} />
                  )}
                  Confirm cash collected
                </button>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-latte bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Items ordered</h3>
              <span className="text-xs text-espresso/55">
                {formatDate(order.createdAt)}
              </span>
            </div>
            <div className="divide-y divide-latte">
              {(order.items || []).map((item, index) => {
                const menuItem = item.menuItemId;
                return (
                  <div
                    key={`${menuItem?._id || item.name}-${index}`}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {item.name || menuItem?.name || "Menu item"}
                        <span className="ml-2 text-sm font-normal text-espresso/60">
                          × {item.quantity}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-espresso/60">
                        {[item.options?.milk, item.options?.temperature]
                          .filter(Boolean)
                          .join(" · ")}
                        {item.options?.extras?.length
                          ? ` · ${item.options.extras
                              .map((extra) => extra.name)
                              .join(", ")}`
                          : ""}
                      </p>
                      {item.note && (
                        <p className="mt-1 text-xs italic text-espresso/55">
                          Note: {item.note}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold">
                      {formatCurrency(item.lineTotal ?? item.unitPrice * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
            {order.kitchenNote && (
              <p className="mt-4 rounded-lg bg-latte/50 px-3 py-2 text-sm text-espresso/75">
                <span className="font-semibold">Kitchen note:</span>{" "}
                {order.kitchenNote}
              </p>
            )}
            <div className="mt-4 space-y-1.5 border-t border-latte pt-3 text-sm">
              <AmountRow label="Subtotal" amount={order.subtotal} />
              <AmountRow label="Tax" amount={order.tax} />
              {Number(order.serviceCharge) > 0 && (
                <AmountRow label="Service charge" amount={order.serviceCharge} />
              )}
              <div className="flex justify-between border-t border-latte pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-latte bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <PackageCheck size={18} className="text-caramel" />
              <h3 className="text-sm font-bold">Kitchen status</h3>
              <span
                className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClassNames(status)}`}
              >
                {status}
              </span>
            </div>
            <form onSubmit={onUpdateStatus} className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Change status
                </span>
                <span className="relative block">
                  <select
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                    className={`${inputClassName} appearance-none pr-10`}
                  >
                    {statuses.map((option) => (
                      <option key={option} value={option}>
                        {capitalize(option)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-espresso/50"
                  />
                </span>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Update note
                </span>
                <input
                  value={statusMessage}
                  onChange={(event) => setStatusMessage(event.target.value)}
                  placeholder={`Order ${statusDraft || status}`}
                  className={inputClassName}
                />
              </label>
              <button
                type="submit"
                disabled={updating || statusDraft === status}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-caramelHover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
              >
                {updating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {updating ? "Updating..." : "Save status"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-latte bg-white p-4">
            <h3 className="mb-4 text-sm font-bold">Order timeline</h3>
            {order.statusHistory?.length ? (
              <ol className="space-y-4">
                {[...order.statusHistory]
                  .sort((a, b) => new Date(a.at) - new Date(b.at))
                  .map((entry, index) => (
                    <li key={entry._id || entry.id || `${entry.status}-${index}`} className="flex gap-3">
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-latte text-caramel">
                        <Clock3 size={14} />
                      </span>
                      <div className="min-w-0 flex-1 border-b border-latte pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClassNames(entry.status)}`}
                          >
                            {entry.status}
                          </span>
                          <time className="text-xs text-espresso/50">
                            {formatDate(entry.at)}
                          </time>
                        </div>
                        {entry.message && (
                          <p className="mt-1.5 text-sm text-espresso/70">
                            {entry.message}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="text-sm text-espresso/55">
                No status history is available for this order.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function PaymentBadge({ order }) {
  const paid = isPaid(order);
  const paymentStatus = (order.paymentStatus || "unpaid").toLowerCase();
  const failed = ["failed", "rejected"].includes(paymentStatus);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        paid
          ? "bg-success/15 text-success"
          : failed
            ? "bg-error/10 text-error"
            : "bg-warning/15 text-warning"
      }`}
    >
      {paid ? (
        <Check size={14} />
      ) : failed ? (
        <AlertCircle size={14} />
      ) : (
        <Banknote size={14} />
      )}
      {paid
        ? "Paid"
        : failed
          ? capitalize(paymentStatus)
          : paymentStatus === "pending"
            ? "Unpaid"
            : capitalize(paymentStatus)}
    </span>
  );
}

function InfoBlock({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-espresso/50">
        <Icon size={14} className="text-caramel" />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-espresso">{value}</p>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-espresso/60">{label}</p>
          <p className="mt-2 text-2xl font-bold text-espresso">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-latte text-caramel">
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

function AmountRow({ label, amount }) {
  return (
    <div className="flex justify-between text-espresso/65">
      <span>{label}</span>
      <span>{formatCurrency(amount)}</span>
    </div>
  );
}

function MessageBanner({ type, message, onDismiss }) {
  const success = type === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        success
          ? "border-success/20 bg-success/10 font-medium text-success"
          : "border-error/20 bg-error/10 text-error"
      }`}
    >
      {!success && <AlertCircle size={18} />}
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="ml-auto rounded p-1 hover:bg-current/10"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-caramel">
      <Loader2 className="animate-spin" size={30} />
      <p className="text-sm font-medium">Loading orders...</p>
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-error/20 bg-white px-6 py-12 text-center">
      <AlertCircle className="mx-auto mb-3 text-error" size={30} />
      <h2 className="font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-espresso/65">
        {description}
      </p>
      <button
        type="button"
        onClick={action}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-caramel px-4 py-2.5 text-sm font-semibold text-white hover:bg-caramelHover"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-latte bg-cream px-3.5 py-3 text-sm text-espresso outline-none transition placeholder:text-espresso/40 focus:border-caramel focus:ring-2 focus:ring-caramel/20";

const capitalize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

export default OrdersPage;
