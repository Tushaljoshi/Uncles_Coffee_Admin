import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiRoot, configuredApiBase, requestApi } from "../utils/api";

const reservationsApiUrl = `${apiRoot}/reservations`;
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
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatBookingDate = (date) => {
  if (!date) return "Date not set";
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
};

const formatTimestamp = (value) => {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};

const capitalizeStatus = (status) =>
  (status || "requested")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const bookingStatusClass = (status) => {
  switch (status) {
    case "confirmed":
    case "checked_in":
      return "bg-success/15 text-success";
    case "preparing":
      return "bg-warning/15 text-warning";
    case "ready":
      return "bg-caramel/15 text-caramel";
    case "completed":
      return "bg-espresso/10 text-espresso";
    case "cancelled":
      return "bg-error/10 text-error";
    default:
      return "bg-terracotta/15 text-terracotta";
  }
};

const isPaymentPaid = (booking) =>
  ["paid", "success", "succeeded", "completed"].includes(
    (booking.paymentStatus || "").toLowerCase()
  );

const canConfirmCounterPayment = (booking) =>
  (booking.paymentMethod || "").toLowerCase() === "counter" &&
  !isPaymentPaid(booking) &&
  !["cancelled", "completed"].includes((booking.status || "").toLowerCase());

const getBookingKey = (booking) =>
  booking._id || booking.id || booking.bookingId;

function getBookingImageUrl(booking) {
  if (booking.imageFileId) {
    return `${reservationsApiUrl}/file/${encodeURIComponent(
      booking.imageFileId
    )}`;
  }

  const table = booking.reservation?.tableId;
  if (table?.imageFileId) {
    return `${apiRoot}/tables/file/${encodeURIComponent(table.imageFileId)}`;
  }

  const path = booking.imageUrl || booking.image || table?.imageUrl || table?.image;
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (configuredApiBase) {
    const origin = configuredApiBase.replace(/\/api$/, "");
    return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return path;
}

function BookingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [updatingBookingId, setUpdatingBookingId] = useState("");
  const [confirmingPaymentId, setConfirmingPaymentId] = useState("");

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestApi(reservationsApiUrl);
      if (!Array.isArray(result.reservations)) {
        throw new Error(
          "The reservations service returned an unexpected response."
        );
      }
      setBookings(result.reservations);
      setSelectedBooking((current) => {
        if (!current) return current;
        const key = getBookingKey(current);
        return (
          result.reservations.find(
            (booking) => getBookingKey(booking) === key
          ) || null
        );
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to load table bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const status = (booking.status || "requested").toLowerCase();
      const paymentStatus = isPaymentPaid(booking) ? "paid" : "unpaid";
      const table = booking.reservation?.tableId;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" || paymentStatus === paymentFilter;
      const searchText = [
        booking.bookingId,
        booking.customer?.name,
        booking.customer?.mobile,
        booking.customer?.email,
        table?.tableCode,
        table?.name,
        table?.area,
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesStatus &&
        matchesPayment &&
        (!query || searchText.includes(query))
      );
    });
  }, [bookings, search, statusFilter, paymentFilter]);

  const metrics = useMemo(
    () => ({
      total: bookings.length,
      requested: bookings.filter((booking) => booking.status === "requested")
        .length,
      upcoming: bookings.filter(
        (booking) =>
          !["completed", "cancelled"].includes(
            (booking.status || "").toLowerCase()
          )
      ).length,
      unpaid: bookings.filter((booking) => !isPaymentPaid(booking)).length,
    }),
    [bookings]
  );

  const openDetails = (booking) => {
    setSelectedBooking(booking);
    setStatusDraft(booking.status || "requested");
    setStatusMessage("");
    setCollectedBy("");
    setPaymentNotes("");
    setError("");
  };

  const updateBookingStatus = async (event) => {
    event.preventDefault();
    if (!selectedBooking || !statusDraft) return;
    const bookingId =
      selectedBooking.bookingId ||
      selectedBooking._id ||
      selectedBooking.id;
    if (!bookingId) {
      setError("This booking is missing an ID and cannot be updated.");
      return;
    }

    setUpdatingBookingId(getBookingKey(selectedBooking));
    setError("");
    setNotice("");
    try {
      await requestApi(
        `${reservationsApiUrl}/${encodeURIComponent(bookingId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: statusDraft,
            message:
              statusMessage.trim() ||
              `Booking status changed to ${capitalizeStatus(statusDraft)}.`,
          }),
        }
      );
      setNotice(`Booking ${bookingId} updated to ${capitalizeStatus(statusDraft)}.`);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message || "Unable to update booking status.");
    } finally {
      setUpdatingBookingId("");
    }
  };

  const confirmCounterPayment = async (event) => {
    event.preventDefault();
    if (!selectedBooking || !canConfirmCounterPayment(selectedBooking)) return;
    const bookingId =
      selectedBooking.bookingId ||
      selectedBooking._id ||
      selectedBooking.id;
    if (!bookingId) {
      setError("This booking is missing its booking ID.");
      return;
    }
    if (!collectedBy.trim()) {
      setError("Enter the hostess or staff member who collected the cash.");
      return;
    }
    if (
      !window.confirm(
        `Confirm ${formatCurrency(
          selectedBooking.bookingFee
        )} cash received by ${collectedBy.trim()} for ${bookingId}?`
      )
    ) {
      return;
    }

    setConfirmingPaymentId(getBookingKey(selectedBooking));
    setError("");
    setNotice("");
    try {
      await requestApi(
        `${reservationsApiUrl}/${encodeURIComponent(
          bookingId
        )}/confirm-counter`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectedBy: collectedBy.trim(),
            notes:
              paymentNotes.trim() ||
              `Cash ${formatCurrency(selectedBooking.bookingFee)} received`,
          }),
        }
      );
      setNotice(`Counter payment confirmed for booking ${bookingId}.`);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message || "Unable to confirm counter payment.");
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
                Table bookings
              </h1>
              <p className="mt-2 text-sm text-espresso/65">
                Track guest reservations, prepare tables, and confirm counter payments.
              </p>
            </div>
            <button
              type="button"
              onClick={loadBookings}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-latte bg-white px-4 py-3 text-sm font-semibold text-espresso transition hover:bg-latte disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh bookings
            </button>
          </div>

          {notice && (
            <MessageBanner
              type="success"
              message={notice}
              onDismiss={() => setNotice("")}
            />
          )}
          {error && !selectedBooking && (
            <MessageBanner
              type="error"
              message={error}
              onDismiss={() => setError("")}
            />
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total bookings" value={metrics.total} icon={CalendarDays} />
            <MetricCard label="New requests" value={metrics.requested} icon={Clock3} />
            <MetricCard label="Active bookings" value={metrics.upcoming} icon={Users} />
            <MetricCard label="Payments pending" value={metrics.unpaid} icon={Banknote} />
          </section>

          <section className="mb-6 rounded-2xl border border-latte bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <label className="relative block w-full lg:max-w-md">
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Search bookings
                </span>
                <Search
                  size={17}
                  className="absolute bottom-3 left-3 text-espresso/40"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Booking ID, guest, phone, table..."
                  className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-espresso/45 focus:border-caramel focus:ring-2 focus:ring-caramel/20"
                />
              </label>
              <div className="flex flex-wrap gap-2" aria-label="Filter by status">
                {["all", ...bookingStatuses].map((status) => {
                  const active = statusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      aria-pressed={active}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                        active
                          ? "bg-espresso text-white"
                          : "bg-cream text-espresso/70 hover:bg-latte"
                      }`}
                    >
                      {status === "all" ? "All" : capitalizeStatus(status)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-latte pt-4">
              <span className="mr-1 text-xs font-semibold text-espresso/55">
                Payment:
              </span>
              {[
                ["all", "All"],
                ["unpaid", "Unpaid"],
                ["paid", "Paid"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentFilter(value)}
                  aria-pressed={paymentFilter === value}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    paymentFilter === value
                      ? "bg-latte text-espresso"
                      : "text-espresso/60 hover:bg-cream"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              {loading
                ? "Loading bookings..."
                : `${filteredBookings.length} booking${
                    filteredBookings.length === 1 ? "" : "s"
                  }`}
            </h2>
            <p className="text-xs text-espresso/55">
              Select a booking to view guest details, payment, and status history.
            </p>
          </div>

          {loading && bookings.length === 0 ? (
            <LoadingState />
          ) : error && bookings.length === 0 ? (
            <EmptyState
              title="Could not load bookings"
              description={error}
              onRetry={loadBookings}
            />
          ) : filteredBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-latte bg-white px-6 py-14 text-center">
              <CalendarDays className="mx-auto mb-3 text-caramel/60" size={36} />
              <h3 className="font-semibold">No bookings found</h3>
              <p className="mt-2 text-sm text-espresso/60">
                Try another status, payment filter, or search term.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPaymentFilter("all");
                }}
                className="mt-4 rounded-lg bg-latte px-4 py-2 text-sm font-semibold text-espresso hover:bg-latte/70"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={getBookingKey(booking)}
                  booking={booking}
                  imageUrl={getBookingImageUrl(booking)}
                  onOpen={() => openDetails(booking)}
                />
              ))}
            </section>
          )}
        </main>

        {selectedBooking && (
          <BookingDetails
            booking={selectedBooking}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            statusMessage={statusMessage}
            setStatusMessage={setStatusMessage}
            collectedBy={collectedBy}
            setCollectedBy={setCollectedBy}
            paymentNotes={paymentNotes}
            setPaymentNotes={setPaymentNotes}
            updating={updatingBookingId === getBookingKey(selectedBooking)}
            confirmingPayment={
              confirmingPaymentId === getBookingKey(selectedBooking)
            }
            error={error}
            onDismissError={() => setError("")}
            onClose={() => {
              setSelectedBooking(null);
              setError("");
            }}
            onUpdateStatus={updateBookingStatus}
            onConfirmPayment={confirmCounterPayment}
          />
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, imageUrl, onOpen }) {
  const reservation = booking.reservation || {};
  const table = reservation.tableId || {};
  const status = booking.status || "requested";
  const paid = isPaymentPaid(booking);
  const canCollect = canConfirmCounterPayment(booking);

  return (
    <article className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm transition hover:shadow-md">
      <div className="flex min-h-36">
        <div className="relative w-28 shrink-0 bg-latte sm:w-40">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={table.name || "Reserved table"}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-caramel/60">
              <MapPin size={34} />
            </div>
          )}
          <span
            className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold sm:left-3 sm:top-3 sm:text-xs ${bookingStatusClass(
              status
            )}`}
          >
            {capitalizeStatus(status)}
          </span>
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-caramel">
                {booking.bookingId || "Booking"}
              </p>
              <h3 className="mt-1 truncate text-lg font-bold">
                {booking.customer?.name || "Guest"}
              </h3>
            </div>
            <PaymentBadge booking={booking} />
          </div>
          <div className="mt-3 grid gap-2 text-sm text-espresso/70 sm:grid-cols-2">
            <p className="flex items-center gap-1.5">
              <CalendarDays size={15} className="shrink-0 text-caramel" />
              {formatBookingDate(reservation.date)}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock3 size={15} className="shrink-0 text-caramel" />
              {reservation.time || "Time not set"}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin size={15} className="shrink-0 text-caramel" />
              {table.tableCode || table.name || "Table not assigned"}
            </p>
            <p className="flex items-center gap-1.5">
              <Users size={15} className="shrink-0 text-caramel" />
              {reservation.guests ?? "—"} guests
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-latte pt-3">
            <div>
              <p className="text-xs text-espresso/55">Booking fee</p>
              <p className="font-bold">{formatCurrency(booking.bookingFee)}</p>
            </div>
            <div className="flex gap-2">
              {canCollect && (
                <span className="hidden items-center gap-1 text-xs font-semibold text-warning sm:inline-flex">
                  <Banknote size={14} />
                  Cash to collect
                </span>
              )}
              <button
                type="button"
                onClick={onOpen}
                className="rounded-lg bg-caramel px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-caramelHover"
              >
                Manage booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function BookingDetails({
  booking,
  statusDraft,
  setStatusDraft,
  statusMessage,
  setStatusMessage,
  collectedBy,
  setCollectedBy,
  paymentNotes,
  setPaymentNotes,
  updating,
  confirmingPayment,
  error,
  onDismissError,
  onClose,
  onUpdateStatus,
  onConfirmPayment,
}) {
  const reservation = booking.reservation || {};
  const table = reservation.tableId || {};
  const canCollect = canConfirmCounterPayment(booking);

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
        aria-labelledby="booking-details-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-cream shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-latte bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-caramel">
              Reservation details
            </p>
            <h2 id="booking-details-title" className="mt-1 text-xl font-bold">
              {booking.bookingId || "Booking"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking details"
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
              <h3 className="mb-3 text-sm font-bold">Guest & reservation</h3>
              <p className="font-semibold">{booking.customer?.name || "Guest"}</p>
              {booking.customer?.mobile && (
                <a
                  href={`tel:${booking.customer.mobile}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-caramel hover:underline"
                >
                  <Phone size={14} />
                  {booking.customer.mobile}
                </a>
              )}
              {booking.customer?.email && (
                <p className="mt-1 break-all text-sm text-espresso/60">
                  {booking.customer.email}
                </p>
              )}
              <div className="mt-3 space-y-2 text-sm text-espresso/70">
                <p className="flex items-center gap-2">
                  <CalendarDays size={15} className="text-caramel" />
                  {formatBookingDate(reservation.date)} · {reservation.time}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={15} className="text-caramel" />
                  {table.tableCode || table.name || "Table not assigned"}
                  {table.location ? ` · ${table.location}` : ""}
                </p>
                <p className="flex items-center gap-2">
                  <Users size={15} className="text-caramel" />
                  {reservation.guests ?? "—"} guests
                </p>
              </div>
              {booking.customer?.notes && (
                <p className="mt-3 rounded-lg bg-latte/50 px-3 py-2 text-sm text-espresso/75">
                  <span className="font-semibold">Guest notes:</span>{" "}
                  {booking.customer.notes}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-latte bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Booking payment</h3>
                  <p className="mt-1 text-2xl font-bold">
                    {formatCurrency(booking.bookingFee)}
                  </p>
                </div>
                <PaymentBadge booking={booking} />
              </div>
              <p className="mt-3 text-sm text-espresso/65">
                Method:{" "}
                <span className="font-medium capitalize">
                  {booking.paymentMethod || "Unknown"}
                </span>
              </p>
              {booking.paymentId && (
                <p className="mt-1 break-all text-xs text-espresso/50">
                  Payment reference: {booking.paymentId}
                </p>
              )}
              {booking.paidAt && (
                <p className="mt-1 text-xs text-success">
                  Paid {formatTimestamp(booking.paidAt)}
                </p>
              )}
              {canCollect && (
                <form onSubmit={onConfirmPayment} className="mt-4 space-y-3 border-t border-latte pt-4">
                  <p className="text-xs font-medium text-warning">
                    Confirm only after the hostess has physically collected the cash.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-espresso/65">
                      Collected by
                    </span>
                    <input
                      required
                      value={collectedBy}
                      onChange={(event) => setCollectedBy(event.target.value)}
                      placeholder="Hostess name"
                      className={inputClassName}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-espresso/65">
                      Payment note
                    </span>
                    <input
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      placeholder={`Cash ${formatCurrency(booking.bookingFee)} received`}
                      className={inputClassName}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={confirmingPayment}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-success/90 disabled:cursor-wait disabled:opacity-60"
                  >
                    {confirmingPayment ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    {confirmingPayment
                      ? "Confirming payment..."
                      : "Confirm cash received"}
                  </button>
                </form>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-latte bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-caramel">
                  Table {table.tableNumber ?? "—"}
                </p>
                <h3 className="mt-1 font-bold">
                  {table.name || "Reserved table"}
                </h3>
              </div>
              <span className="text-sm text-espresso/60">
                Capacity: {table.capacity ?? "—"}
              </span>
            </div>
            {getBookingImageUrl(booking) && (
              <img
                src={getBookingImageUrl(booking)}
                alt={table.name || "Reserved table"}
                className="max-h-56 w-full rounded-lg object-cover"
              />
            )}
            {table.area && (
              <p className="mt-3 flex items-center gap-2 text-sm text-espresso/65">
                <MapPin size={15} className="text-caramel" />
                {table.area}
                {table.location ? ` · ${table.location}` : ""}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-latte bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Booking status</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusClass(
                  booking.status
                )}`}
              >
                {capitalizeStatus(booking.status)}
              </span>
            </div>
            <form onSubmit={onUpdateStatus} className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Change status
                </span>
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  className={inputClassName}
                >
                  {bookingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {capitalizeStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Update note
                </span>
                <input
                  value={statusMessage}
                  onChange={(event) => setStatusMessage(event.target.value)}
                  placeholder={`${capitalizeStatus(statusDraft)} update`}
                  className={inputClassName}
                />
              </label>
              <button
                type="submit"
                disabled={
                  updating ||
                  statusDraft === booking.status ||
                  !bookingStatuses.includes(statusDraft)
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-caramelHover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
              >
                {updating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {updating ? "Updating..." : "Save booking status"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-latte bg-white p-4">
            <h3 className="mb-4 text-sm font-bold">Booking timeline</h3>
            {booking.statusHistory?.length ? (
              <ol className="space-y-4">
                {[...booking.statusHistory]
                  .sort((a, b) => new Date(a.at) - new Date(b.at))
                  .map((entry, index) => (
                    <li
                      key={entry._id || entry.id || `${entry.status}-${index}`}
                      className="flex gap-3"
                    >
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-latte text-caramel">
                        <Clock3 size={14} />
                      </span>
                      <div className="min-w-0 flex-1 border-b border-latte pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bookingStatusClass(
                              entry.status
                            )}`}
                          >
                            {capitalizeStatus(entry.status)}
                          </span>
                          <time className="text-xs text-espresso/50">
                            {formatTimestamp(entry.at)}
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
                No status history is available for this booking.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function PaymentBadge({ booking }) {
  const paid = isPaymentPaid(booking);
  const failed = ["failed", "rejected"].includes(
    (booking.paymentStatus || "").toLowerCase()
  );
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        paid
          ? "bg-success/15 text-success"
          : failed
            ? "bg-error/10 text-error"
            : "bg-warning/15 text-warning"
      }`}
    >
      {paid ? (
        <Check size={13} />
      ) : failed ? (
        <AlertCircle size={13} />
      ) : (
        <Banknote size={13} />
      )}
      {paid
        ? "Paid"
        : failed
          ? booking.paymentStatus
          : (booking.paymentStatus || "unpaid").toLowerCase() === "pending"
            ? "Unpaid"
            : booking.paymentStatus || "Unpaid"}
    </span>
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
      <p className="text-sm font-medium">Loading bookings...</p>
    </div>
  );
}

function EmptyState({ title, description, onRetry }) {
  return (
    <div className="rounded-2xl border border-error/20 bg-white px-6 py-12 text-center">
      <AlertCircle className="mx-auto mb-3 text-error" size={30} />
      <h2 className="font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-espresso/65">
        {description}
      </p>
      <button
        type="button"
        onClick={onRetry}
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

export default BookingsPage;
