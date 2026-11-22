import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Banknote,
  CalendarDays,
  ClipboardList,
  Coffee,
  CreditCard,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiRoot, requestApi } from "../utils/api";

const palette = {
  caramel: "#A35D38",
  terracotta: "#C86D46",
  espresso: "#3D2314",
  latte: "#EAD8C0",
  success: "#5F7654",
  warning: "#B7793E",
  error: "#A64B3C",
  cream: "#FAF6EE",
};

const orderStatuses = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "served",
  "cancelled",
];
const bookingStatuses = [
  "requested",
  "confirmed",
  "preparing",
  "ready",
  "checked_in",
  "completed",
  "cancelled",
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatCompactCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(amount) || 0);

const isPaid = (record) =>
  ["paid", "success", "succeeded", "completed"].includes(
    (record.paymentStatus || "").toLowerCase()
  );

const getOrderDate = (order) => order.createdAt || order.updatedAt;
const getBookingDate = (booking) => booking.createdAt || booking.updatedAt;
const getOrderKey = (order) => order._id || order.id || order.orderId;

const getRangeStart = (range) => {
  if (range === "all") return null;
  const days = Number(range);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return start;
};

const isWithinRange = (value, range) => {
  if (range === "all") return true;
  const date = value ? new Date(value) : null;
  const start = getRangeStart(range);
  return date && !Number.isNaN(date.getTime()) && date >= start;
};

const formatDay = (date) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    date
  );

const formatMonth = (date) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(
    date
  );

function buildTrend(orders, range) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const useMonths = range === "all";
  const count = useMonths ? 12 : Number(range);
  const points = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    if (useMonths) {
      date.setDate(1);
      date.setMonth(date.getMonth() - offset);
    } else {
      date.setDate(date.getDate() - offset);
    }
    const key = useMonths
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    points.push({
      key,
      label: useMonths ? formatMonth(date) : formatDay(date),
      orders: 0,
      collected: 0,
      pending: 0,
    });
  }

  const pointByKey = new Map(points.map((point) => [point.key, point]));
  orders.forEach((order) => {
    if (order.status === "cart" || order.status === "cancelled") return;
    const createdAt = getOrderDate(order);
    const date = createdAt ? new Date(createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const key = useMonths
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const point = pointByKey.get(key);
    if (!point) return;
    point.orders += 1;
    if (isPaid(order)) {
      point.collected += Number(order.total) || 0;
    } else {
      point.pending += Number(order.total) || 0;
    }
  });

  return points;
}

function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30");
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [orderResult, menuResult, bookingResult] = await Promise.all([
        requestApi(`${apiRoot}/orders`),
        requestApi(`${apiRoot}/menu`),
        requestApi(`${apiRoot}/reservations`),
      ]);

      if (
        !Array.isArray(orderResult.orders) ||
        !Array.isArray(menuResult.items) ||
        !Array.isArray(bookingResult.reservations)
      ) {
        throw new Error("One or more dashboard APIs returned unexpected data.");
      }

      setOrders(orderResult.orders);
      setMenuItems(menuResult.items);
      setBookings(bookingResult.reservations);
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const analytics = useMemo(() => {
    const rangeOrders = orders.filter((order) =>
      isWithinRange(getOrderDate(order), range)
    );
    const rangeBookings = bookings.filter((booking) =>
      isWithinRange(getBookingDate(booking), range)
    );

    const paidOrders = rangeOrders.filter(isPaid);
    const pendingOrders = rangeOrders.filter(
      (order) => !isPaid(order) && order.status !== "cancelled"
    );
    const paidBookings = rangeBookings.filter(isPaid);
    const pendingBookings = rangeBookings.filter(
      (booking) =>
        !isPaid(booking) &&
        !["cancelled", "completed"].includes(
          (booking.status || "").toLowerCase()
        )
    );

    const allPayments = [
      ...[...paidOrders, ...pendingOrders].map((order) => ({
        method: order.paymentMethod || "unknown",
        paid: isPaid(order),
        amount: Number(order.total) || 0,
      })),
      ...[...paidBookings, ...pendingBookings].map((booking) => ({
        method: booking.paymentMethod || "unknown",
        paid: isPaid(booking),
        amount: Number(booking.bookingFee) || 0,
      })),
    ];

    const methodTotals = new Map();
    allPayments.forEach((payment) => {
      const method = payment.method.toLowerCase();
      const current = methodTotals.get(method) || {
        method: capitalize(method),
        paid: 0,
        pending: 0,
      };
      if (payment.paid) current.paid += payment.amount;
      else current.pending += payment.amount;
      methodTotals.set(method, current);
    });

    const soldItems = new Map();
    rangeOrders.forEach((order) => {
      if (order.status === "cart" || order.status === "cancelled") return;
      (order.items || []).forEach((item) => {
        const name = item.name || item.menuItemId?.name || "Menu item";
        const current = soldItems.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += Number(item.quantity) || 0;
        current.revenue += Number(item.lineTotal) || 0;
        soldItems.set(name, current);
      });
    });

    const categoryTotals = new Map();
    menuItems.forEach((item) => {
      const category = item.category || "Other";
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + 1);
    });

    const orderStatusData = orderStatuses
      .map((status) => ({
        name: capitalize(status),
        value: rangeOrders.filter((order) => order.status === status).length,
      }))
      .filter((entry) => entry.value > 0);
    const bookingStatusData = bookingStatuses
      .map((status) => ({
        name: capitalize(status),
        status,
        value: rangeBookings.filter((booking) => booking.status === status)
          .length,
      }))
      .filter((entry) => entry.value > 0);

    const collectedRevenue =
      paidOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0) +
      paidBookings.reduce(
        (sum, booking) => sum + (Number(booking.bookingFee) || 0),
        0
      );
    const pendingAmount =
      pendingOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0) +
      pendingBookings.reduce(
        (sum, booking) => sum + (Number(booking.bookingFee) || 0),
        0
      );

    return {
      orders: rangeOrders.filter((order) => order.status !== "cart"),
      bookings: rangeBookings,
      paidOrders,
      paidBookings,
      pendingOrders,
      pendingBookings,
      collectedRevenue,
      pendingAmount,
      paidCount: paidOrders.length + paidBookings.length,
      unpaidCount:
        pendingOrders.length +
        pendingBookings.length,
      orderStatusData,
      bookingStatusData,
      paymentMethodData: [...methodTotals.values()],
      paymentStatusData: [
        { name: "Paid", value: paidOrders.length + paidBookings.length },
        {
          name: "Pending",
          value: pendingOrders.length + pendingBookings.length,
        },
      ].filter((entry) => entry.value > 0),
      topItems: [...soldItems.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      categoryData: [...categoryTotals.entries()]
        .map(([name, value]) => ({ name: capitalize(name), value }))
        .sort((a, b) => b.value - a.value),
      trend: buildTrend(rangeOrders, range),
      bookingFeeCollected: paidBookings.reduce(
        (sum, booking) => sum + (Number(booking.bookingFee) || 0),
        0
      ),
      paidOrderRevenue: paidOrders.reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0
      ),
    };
  }, [orders, bookings, menuItems, range]);

  const availableMenuCount = menuItems.filter((item) => item.available).length;
  const cancelledCount = analytics.bookings.filter(
    (booking) => booking.status === "cancelled"
  ).length;

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
                Cafe overview
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Analytics dashboard
              </h1>
              <p className="mt-2 text-sm text-espresso/65">
                A live view of sales, payments, reservations, and your menu.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="analytics-range">
                Activity date range
              </label>
              <select
                id="analytics-range"
                value={range}
                onChange={(event) => setRange(event.target.value)}
                className="rounded-xl border border-latte bg-white px-4 py-3 text-sm font-medium text-espresso outline-none focus:border-caramel focus:ring-2 focus:ring-caramel/20"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-latte bg-white px-4 py-3 text-sm font-semibold text-espresso transition hover:bg-latte disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-center gap-3 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadDashboardData()}
                className="ml-auto font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Orders"
              value={analytics.orders.length}
              detail={`${analytics.pendingOrders.length} awaiting payment`}
              icon={ClipboardList}
              accent="caramel"
            />
            <MetricCard
              label="Collected revenue"
              value={formatCurrency(analytics.collectedRevenue)}
              detail={`${formatCurrency(analytics.paidOrderRevenue)} orders · ${formatCurrency(analytics.bookingFeeCollected)} bookings`}
              icon={Wallet}
              accent="success"
            />
            <MetricCard
              label="Table bookings"
              value={analytics.bookings.length}
              detail={`${analytics.bookings.filter((booking) => booking.status === "requested").length} new requests`}
              icon={CalendarDays}
              accent="terracotta"
            />
            <MetricCard
              label="Menu items"
              value={menuItems.length}
              detail={`${availableMenuCount} currently available`}
              icon={Coffee}
              accent="warning"
            />
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">Revenue & order activity</h2>
                  <p className="mt-1 text-xs text-espresso/55">
                    Paid order revenue, pending order value, and orders placed
                  </p>
                </div>
                <span className="rounded-full bg-latte/60 px-3 py-1 text-xs font-semibold text-espresso/70">
                  {range === "all" ? "Past 12 months" : `Last ${range} days`}
                </span>
              </div>
              <div className="h-72">
                {loading ? (
                  <ChartLoading />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={palette.caramel} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={palette.caramel} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pendingFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={palette.warning} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={palette.warning} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={palette.latte} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
                      <YAxis yAxisId="money" tickFormatter={formatCompactCurrency} tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} width={66} />
                      <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "Orders"
                            ? [value, name]
                            : [formatCurrency(value), name]
                        }
                        contentStyle={{
                          borderRadius: 12,
                          borderColor: palette.latte,
                          color: palette.espresso,
                        }}
                      />
                      <Legend />
                      <Area yAxisId="money" type="monotone" dataKey="collected" name="Collected" stroke={palette.caramel} fill="url(#collectedFill)" strokeWidth={2.5} />
                      <Area yAxisId="money" type="monotone" dataKey="pending" name="Pending" stroke={palette.warning} fill="url(#pendingFill)" strokeWidth={2} />
                      <Area yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke={palette.success} fill="none" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-2">
                <h2 className="font-bold">Payment overview</h2>
                <p className="mt-1 text-xs text-espresso/55">
                  Paid and outstanding orders plus booking fees
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-success/10 p-4">
                  <p className="text-xs font-medium text-success">Collected</p>
                  <p className="mt-1 text-xl font-bold text-success">
                    {formatCurrency(analytics.collectedRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-success/80">
                    {analytics.paidCount} payments
                  </p>
                </div>
                <div className="rounded-xl bg-warning/10 p-4">
                  <p className="text-xs font-medium text-warning">Pending</p>
                  <p className="mt-1 text-xl font-bold text-warning">
                    {formatCurrency(analytics.pendingAmount)}
                  </p>
                  <p className="mt-1 text-xs text-warning/80">
                    {analytics.unpaidCount} unpaid
                  </p>
                </div>
              </div>
              <div className="mt-2 h-52">
                {loading ? (
                  <ChartLoading />
                ) : analytics.paymentStatusData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.paymentStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {analytics.paymentStatusData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Paid"
                                ? palette.success
                                : palette.warning
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={28} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty text="No payments in this period yet." />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-latte pt-3 text-xs text-espresso/60">
                <CreditCard size={14} className="text-caramel" />
                Payment insights combine order totals and reservation fees.
              </div>
            </article>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="font-bold">Top-selling menu items</h2>
                <p className="mt-1 text-xs text-espresso/55">
                  Based on quantities in non-cancelled orders
                </p>
              </div>
              <div className="h-72">
                {loading ? (
                  <ChartLoading />
                ) : analytics.topItems.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topItems} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke={palette.latte} strokeDasharray="4 4" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={112} tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "Revenue"
                            ? formatCurrency(value)
                            : [`${value} items`, "Sold"]
                        }
                        contentStyle={{ borderRadius: 12, borderColor: palette.latte }}
                      />
                      <Bar dataKey="quantity" name="Sold" fill={palette.caramel} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty text="Sales data will appear when orders are placed." />
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="font-bold">Menu category mix</h2>
                <p className="mt-1 text-xs text-espresso/55">
                  Current catalog inventory by category
                </p>
              </div>
              <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
                <div className="h-64">
                  {loading ? (
                    <ChartLoading />
                  ) : analytics.categoryData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categoryData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={82}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {analytics.categoryData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                [
                                  palette.caramel,
                                  palette.success,
                                  palette.terracotta,
                                  palette.warning,
                                  palette.espresso,
                                  "#C4A484",
                                ][index % 6]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty text="No menu categories available." />
                  )}
                </div>
                <div className="space-y-3">
                  {analytics.categoryData.map((category, index) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: [
                              palette.caramel,
                              palette.success,
                              palette.terracotta,
                              palette.warning,
                              palette.espresso,
                              "#C4A484",
                            ][index % 6],
                          }}
                        />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="font-semibold">{category.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 border-t border-latte pt-3 text-xs text-espresso/55">
                Availability: {availableMenuCount} of {menuItems.length} items
                are orderable.
              </p>
            </article>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <StatusPanel
              title="Order pipeline"
              subtitle={`${analytics.orders.length} orders in selected period`}
              data={analytics.orderStatusData}
              statuses={orderStatuses}
              countLabel="orders"
            />
            <StatusPanel
              title="Booking pipeline"
              subtitle={`${analytics.bookings.length} bookings in selected period`}
              data={analytics.bookingStatusData}
              statuses={bookingStatuses}
              countLabel="bookings"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity size={18} className="text-caramel" />
                <div>
                  <h2 className="font-bold">Payment methods</h2>
                  <p className="mt-1 text-xs text-espresso/55">
                    Collected and pending amounts by payment method
                  </p>
                </div>
              </div>
              <div className="h-64">
                {loading ? (
                  <ChartLoading />
                ) : analytics.paymentMethodData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.paymentMethodData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                      <CartesianGrid stroke={palette.latte} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="method" tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatCompactCurrency} tick={{ fill: palette.espresso, fontSize: 11 }} axisLine={false} tickLine={false} width={68} />
                      <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: 12, borderColor: palette.latte }} />
                      <Legend />
                      <Bar dataKey="paid" name="Collected" fill={palette.success} radius={[5, 5, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill={palette.warning} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty text="No payment activity in this period." />
                )}
              </div>
            </article>

            <div className="flex flex-col gap-4 lg:w-64">
              <QuickLink
                to="/orders"
                icon={ClipboardList}
                title="Manage orders"
                detail="Review orders and kitchen status"
              />
              <QuickLink
                to="/bookings"
                icon={CalendarDays}
                title="Manage bookings"
                detail="Confirm reservations and payments"
              />
              <QuickLink
                to="/menu"
                icon={Coffee}
                title="Manage menu"
                detail={`${menuItems.length} catalog items`}
              />
              <div className="rounded-2xl border border-latte bg-white p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <TrendingUp size={17} className="text-caramel" />
                  Booking health
                </div>
                <p className="mt-2 text-xs leading-5 text-espresso/60">
                  {analytics.bookings.length
                    ? `${analytics.bookings.length - cancelledCount} active and ${cancelledCount} cancelled in the selected period.`
                    : "Reservation insights will appear when bookings are created."}
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent }) {
  const accentClasses = {
    caramel: "bg-caramel/10 text-caramel",
    success: "bg-success/10 text-success",
    terracotta: "bg-terracotta/10 text-terracotta",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-espresso/60">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-espresso">{value}</p>
          <p className="mt-1 truncate text-xs text-espresso/55">{detail}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function StatusPanel({ title, subtitle, data, statuses, countLabel }) {
  const values = new Map(data.map((entry) => [entry.status, entry.value]));
  const maxValue = Math.max(1, ...data.map((entry) => entry.value));
  const statusColor = {
    requested: palette.terracotta,
    placed: palette.terracotta,
    accepted: palette.caramel,
    confirmed: palette.success,
    preparing: palette.warning,
    ready: palette.success,
    checked_in: palette.caramel,
    served: palette.espresso,
    completed: palette.espresso,
    cancelled: palette.error,
  };

  return (
    <article className="rounded-2xl border border-latte bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-xs text-espresso/55">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {statuses.map((status) => {
          const value = values.get(status) || 0;
          return (
            <div key={status}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="capitalize text-espresso/70">
                  {capitalize(status)}
                </span>
                <span className="font-semibold">
                  {value}{" "}
                  <span className="text-xs font-normal text-espresso/45">
                    {countLabel}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${value ? Math.max(5, (value / maxValue) * 100) : 0}%`,
                    backgroundColor: statusColor[status] || palette.caramel,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function QuickLink({ to, icon: Icon, title, detail }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-latte bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-caramel/40 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-latte text-caramel transition group-hover:bg-caramel group-hover:text-white">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-espresso/55">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-full items-center justify-center text-caramel">
      <Loader2 size={26} className="animate-spin" />
    </div>
  );
}

function ChartEmpty({ text }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-cream/60 px-5 text-center text-sm text-espresso/50">
      {text}
    </div>
  );
}

const capitalize = (value) =>
  value
    ? value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

export default DashboardPage;
