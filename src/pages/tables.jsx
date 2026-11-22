import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiRoot, configuredApiBase, requestApi } from "../utils/api";

const tablesApiUrl = `${apiRoot}/tables`;

const getToday = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const createEmptyForm = () => ({
  tableNumber: "",
  name: "",
  area: "Main Roastery Floor",
  location: "",
  capacity: "2",
  features: "",
  amenities: "",
  isActive: true,
  image: null,
});

const splitList = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function getTableImageUrl(table) {
  if (table.imageFileId) {
    return `${tablesApiUrl}/file/${encodeURIComponent(table.imageFileId)}`;
  }
  const path = table.imageUrl || table.image;
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (configuredApiBase) {
    const origin = configuredApiBase.replace(/\/api$/, "");
    return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return path;
}

function formFromTable(table) {
  return {
    tableNumber: table.tableNumber ?? "",
    name: table.name || "",
    area: table.area || "",
    location: table.location || "",
    capacity: table.capacity ?? "",
    features: Array.isArray(table.features) ? table.features.join(", ") : "",
    amenities: Array.isArray(table.amenities) ? table.amenities.join(", ") : "",
    isActive: table.isActive !== false,
    image: null,
  };
}

function toMultipartForm(form) {
  const body = new FormData();
  body.append("tableNumber", String(form.tableNumber));
  body.append("name", form.name.trim());
  body.append("area", form.area.trim());
  body.append("location", form.location.trim());
  body.append("capacity", String(form.capacity));
  body.append("features", splitList(form.features).join(", "));
  body.append("amenities", splitList(form.amenities).join(", "));
  body.append("isActive", String(form.isActive));
  if (form.image) body.append("image", form.image);
  return body;
}

function TablesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [imagePreview, setImagePreview] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState({
    date: getToday(),
    time: "19:00",
    guests: "2",
  });
  const [availabilityResult, setAvailabilityResult] = useState(null);

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const loadTables = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestApi(`${tablesApiUrl}/all`);
      if (!Array.isArray(result.tables)) {
        throw new Error("The table service returned an unexpected response.");
      }
      setTables(result.tables);
    } catch (requestError) {
      setError(requestError.message || "Unable to load tables.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (!form.image) {
      setImagePreview(editingTable ? getTableImageUrl(editingTable) : "");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(form.image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.image, editingTable]);

  const activeCount = tables.filter((table) => table.isActive).length;

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tables.filter((table) => {
      const id = table._id || table.id || table.tableCode;
      const availableAtTime = availabilityResult?.availableIds.has(id);
      const status = availabilityResult
        ? availableAtTime
          ? "available"
          : "unavailable"
        : table.isActive
          ? "active"
          : "inactive";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const searchable = [
        table.name,
        table.tableCode,
        table.tableNumber,
        table.area,
        table.location,
        ...(Array.isArray(table.features) ? table.features : []),
        ...(Array.isArray(table.amenities) ? table.amenities : []),
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [tables, search, statusFilter, availabilityResult]);

  const openCreateEditor = () => {
    setEditingTable(null);
    setForm(createEmptyForm());
    setError("");
    setEditorOpen(true);
  };

  const openEditEditor = (table) => {
    setEditingTable(table);
    setForm(formFromTable(table));
    setError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingTable(null);
    setForm(createEmptyForm());
  };

  const updateForm = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!editingTable && !form.image) {
      setError("Choose an image for this table.");
      return;
    }

    setSaving(true);
    const tableId = editingTable?._id || editingTable?.id;
    const url = editingTable
      ? `${tablesApiUrl}/${encodeURIComponent(tableId)}`
      : tablesApiUrl;
    try {
      await requestApi(url, {
        method: editingTable ? "PUT" : "POST",
        body: toMultipartForm(form),
      });
      setNotice(editingTable ? "Table updated." : "Table created.");
      setEditorOpen(false);
      setEditingTable(null);
      setForm(createEmptyForm());
      setAvailabilityResult(null);
      await loadTables();
    } catch (requestError) {
      setError(requestError.message || "Unable to save this table.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table) => {
    const tableId = table._id || table.id;
    if (
      !tableId ||
      !window.confirm(
        `Delete "${table.name}" (Table ${table.tableNumber})? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(tableId);
    setError("");
    setNotice("");
    try {
      await requestApi(`${tablesApiUrl}/${encodeURIComponent(tableId)}`, {
        method: "DELETE",
      });
      setTables((current) =>
        current.filter((entry) => (entry._id || entry.id) !== tableId)
      );
      setAvailabilityResult(null);
      setNotice("Table deleted.");
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this table.");
    } finally {
      setDeletingId("");
    }
  };

  const checkAvailability = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setStatusFilter("all");
    setCheckingAvailability(true);
    const query = new URLSearchParams({
      date: availabilityForm.date,
      time: availabilityForm.time,
      guests: String(availabilityForm.guests),
    });
    try {
      const result = await requestApi(
        `${tablesApiUrl}/availability?${query.toString()}`
      );
      if (!Array.isArray(result.tables)) {
        throw new Error("The availability service returned an unexpected response.");
      }
      setAvailabilityResult({
        availableIds: new Set(
          result.tables.map((table) => table._id || table.id || table.tableCode)
        ),
        availableCount: result.availableCount ?? result.tables.length,
        date: result.date || availabilityForm.date,
        time: result.time || availabilityForm.time,
        guests: result.guests ?? Number(availabilityForm.guests),
      });
    } catch (requestError) {
      setAvailabilityResult(null);
      setError(requestError.message || "Unable to check table availability.");
    } finally {
      setCheckingAvailability(false);
    }
  };

  const clearAvailability = () => {
    setAvailabilityResult(null);
    setStatusFilter("all");
  };

  const filters = availabilityResult
    ? [
        ["all", "All tables"],
        ["available", "Available"],
        ["unavailable", "Unavailable"],
      ]
    : [
        ["all", "All tables"],
        ["active", "Active"],
        ["inactive", "Inactive"],
      ];

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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-caramel">
                Cafe seating
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tables
              </h1>
              <p className="mt-2 text-sm text-espresso/65">
                Manage seating areas and check availability for guests.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-caramelHover focus:outline-none focus:ring-2 focus:ring-caramel focus:ring-offset-2"
            >
              <Plus size={19} />
              Add table
            </button>
          </div>

          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total tables" value={tables.length} />
            <StatCard label="Active tables" value={activeCount} />
            <StatCard
              label={
                availabilityResult
                  ? `Available for ${availabilityResult.guests} guests`
                  : "Active for booking"
              }
              value={
                availabilityResult
                  ? availabilityResult.availableCount
                  : activeCount
              }
            />
          </section>

          {notice && (
            <Notice type="success" message={notice} onDismiss={() => setNotice("")} />
          )}
          {error && !editorOpen && (
            <Notice type="error" message={error} onDismiss={() => setError("")} />
          )}

          <section className="mb-6 rounded-2xl border border-latte bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h2 className="font-semibold">Check table availability</h2>
              <p className="mt-1 text-sm text-espresso/60">
                Find seating for a specific date, time, and party size.
              </p>
            </div>
            <form
              onSubmit={checkAvailability}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
            >
              <label className="relative">
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Date
                </span>
                <CalendarDays
                  size={17}
                  className="pointer-events-none absolute bottom-3 left-3 text-caramel"
                />
                <input
                  type="date"
                  required
                  min={getToday()}
                  value={availabilityForm.date}
                  onChange={(event) => {
                    setAvailabilityForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }));
                    clearAvailability();
                  }}
                  className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-3 text-sm text-espresso outline-none focus:border-caramel focus:ring-2 focus:ring-caramel/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Time
                </span>
                <span className="relative block">
                  <Clock3
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caramel"
                  />
                  <input
                    type="time"
                    required
                    value={availabilityForm.time}
                    onChange={(event) => {
                      setAvailabilityForm((current) => ({
                        ...current,
                        time: event.target.value,
                      }));
                      clearAvailability();
                    }}
                    className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-3 text-sm text-espresso outline-none focus:border-caramel focus:ring-2 focus:ring-caramel/20"
                  />
                </span>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-espresso/65">
                  Guests
                </span>
                <span className="relative block">
                  <Users
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caramel"
                  />
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={availabilityForm.guests}
                    onChange={(event) => {
                      setAvailabilityForm((current) => ({
                        ...current,
                        guests: event.target.value,
                      }));
                      clearAvailability();
                    }}
                    className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-3 text-sm text-espresso outline-none focus:border-caramel focus:ring-2 focus:ring-caramel/20"
                  />
                </span>
              </label>
              <button
                type="submit"
                disabled={checkingAvailability}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-espresso px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-caramel disabled:cursor-wait disabled:opacity-60"
              >
                {checkingAvailability ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Check availability
              </button>
              {availabilityResult && (
                <button
                  type="button"
                  onClick={clearAvailability}
                  className="mt-auto rounded-xl border border-latte px-4 py-2.5 text-sm font-semibold text-espresso transition hover:bg-latte"
                >
                  Clear
                </button>
              )}
            </form>
            {availabilityResult && (
              <p role="status" className="mt-4 text-sm text-success">
                {availabilityResult.availableCount} table
                {availabilityResult.availableCount === 1 ? "" : "s"} available
                for {availabilityResult.guests} guests on{" "}
                {availabilityResult.date} at {availabilityResult.time}.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-latte bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-sm">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/45"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by table, area, or feature..."
                  className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-espresso/45 focus:border-caramel focus:ring-2 focus:ring-caramel/20"
                />
              </label>
              <div className="flex flex-wrap gap-2" aria-label="Filter tables">
                {filters.map(([value, label]) => {
                  const active = statusFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      aria-pressed={active}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-espresso text-white"
                          : "bg-cream text-espresso/70 hover:bg-latte"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-caramel">
              <Loader2 className="animate-spin" size={30} />
              <p className="text-sm font-medium">Loading tables...</p>
            </div>
          ) : error && tables.length === 0 ? (
            <EmptyState
              title="Could not load tables"
              description={error}
              action={
                <button
                  type="button"
                  onClick={loadTables}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-caramel px-4 py-2.5 text-sm font-semibold text-white hover:bg-caramelHover"
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
              }
            />
          ) : filteredTables.length === 0 ? (
            <EmptyState
              title={tables.length ? "No matching tables" : "No tables yet"}
              description={
                tables.length
                  ? "Try a different search or filter."
                  : "Add a table to start managing cafe seating."
              }
              action={
                !tables.length && (
                  <button
                    type="button"
                    onClick={openCreateEditor}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-caramel px-4 py-2.5 text-sm font-semibold text-white hover:bg-caramelHover"
                  >
                    <Plus size={16} />
                    Add first table
                  </button>
                )
              }
            />
          ) : (
            <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {filteredTables.map((table) => {
                const tableId = table._id || table.id || table.tableCode;
                return (
                  <TableCard
                    key={tableId}
                    table={table}
                    imageUrl={getTableImageUrl(table)}
                    availabilityChecked={Boolean(availabilityResult)}
                    available={availabilityResult?.availableIds.has(tableId)}
                    deleting={deletingId === tableId}
                    onEdit={() => openEditEditor(table)}
                    onDelete={() => handleDelete(table)}
                  />
                );
              })}
            </section>
          )}
        </div>

        {editorOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-espresso/55 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEditor();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="table-editor-title"
              className="my-auto w-full max-w-2xl rounded-2xl bg-cream shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-latte px-5 py-4 sm:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-caramel">
                    Seating editor
                  </p>
                  <h2 id="table-editor-title" className="mt-1 text-xl font-bold">
                    {editingTable ? "Edit table" : "Add table"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  aria-label="Close editor"
                  className="rounded-lg p-2 text-espresso/60 transition hover:bg-latte hover:text-espresso disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-7">
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
                  >
                    {error}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Table number" htmlFor="table-number">
                    <input
                      id="table-number"
                      type="number"
                      min="1"
                      required
                      value={form.tableNumber}
                      onChange={(event) =>
                        updateForm("tableNumber", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>
                  <FormField label="Table name" htmlFor="table-name">
                    <input
                      id="table-name"
                      required
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Family Table"
                      className={inputClassName}
                    />
                  </FormField>
                  <FormField label="Area" htmlFor="table-area">
                    <input
                      id="table-area"
                      required
                      value={form.area}
                      onChange={(event) => updateForm("area", event.target.value)}
                      placeholder="Main Roastery Floor"
                      className={inputClassName}
                    />
                  </FormField>
                  <FormField label="Location" htmlFor="table-location">
                    <input
                      id="table-location"
                      required
                      value={form.location}
                      onChange={(event) =>
                        updateForm("location", event.target.value)
                      }
                      placeholder="Window Side"
                      className={inputClassName}
                    />
                  </FormField>
                  <FormField label="Capacity (guests)" htmlFor="table-capacity">
                    <input
                      id="table-capacity"
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={form.capacity}
                      onChange={(event) =>
                        updateForm("capacity", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>
                  <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-latte bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        updateForm("isActive", event.target.checked)
                      }
                      className="h-4 w-4 accent-caramel"
                    />
                    <span>
                      <span className="block text-sm font-semibold">Active</span>
                      <span className="block text-xs text-espresso/60">
                        Available for booking
                      </span>
                    </span>
                  </label>
                </div>

                <FormField
                  label="Features"
                  htmlFor="table-features"
                  hint="Separate features with commas."
                >
                  <input
                    id="table-features"
                    value={form.features}
                    onChange={(event) =>
                      updateForm("features", event.target.value)
                    }
                    placeholder="Window View, Quiet Area"
                    className={inputClassName}
                  />
                </FormField>
                <FormField
                  label="Amenities"
                  htmlFor="table-amenities"
                  hint="Separate amenities with commas."
                >
                  <input
                    id="table-amenities"
                    value={form.amenities}
                    onChange={(event) =>
                      updateForm("amenities", event.target.value)
                    }
                    placeholder="AC, Charging Point"
                    className={inputClassName}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <FormField
                    label="Table image"
                    htmlFor="table-image"
                    hint={
                      editingTable
                        ? "Choose a new image to replace the current one."
                        : "Image is required."
                    }
                  >
                    <label
                      htmlFor="table-image"
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-caramel/50 bg-white px-4 py-3 text-sm text-caramel transition hover:bg-latte/40"
                    >
                      <ImagePlus size={19} />
                      <span className="truncate">
                        {form.image ? form.image.name : "Choose an image"}
                      </span>
                    </label>
                    <input
                      id="table-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        updateForm("image", event.target.files?.[0] || null)
                      }
                      className="sr-only"
                    />
                  </FormField>
                  {imagePreview && (
                    <div className="h-28 overflow-hidden rounded-xl border border-latte bg-white">
                      <img
                        src={imagePreview}
                        alt="Table preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-latte pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={saving}
                    className="rounded-xl border border-latte bg-white px-5 py-3 text-sm font-semibold text-espresso transition hover:bg-latte disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-5 py-3 text-sm font-semibold text-white transition hover:bg-caramelHover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 size={17} className="animate-spin" />}
                    {saving
                      ? "Saving..."
                      : editingTable
                        ? "Save changes"
                        : "Create table"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-latte bg-white px-3.5 py-3 text-sm text-espresso outline-none transition placeholder:text-espresso/40 focus:border-caramel focus:ring-2 focus:ring-caramel/20";

function FormField({ label, htmlFor, hint, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-espresso/55">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <p className="text-sm text-espresso/60">{label}</p>
      <p className="mt-2 text-3xl font-bold text-espresso">{value}</p>
    </div>
  );
}

function Notice({ type, message, onDismiss }) {
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

function EmptyState({ title, description, action }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-latte bg-white px-6 py-14 text-center">
      <MapPin className="mx-auto mb-3 text-caramel/60" size={34} />
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-espresso/60">{description}</p>
      {action}
    </div>
  );
}

function TableCard({
  table,
  imageUrl,
  availabilityChecked,
  available,
  deleting,
  onEdit,
  onDelete,
}) {
  const features = Array.isArray(table.features) ? table.features : [];
  const amenities = Array.isArray(table.amenities) ? table.amenities : [];
  const statusLabel = availabilityChecked
    ? available
      ? "Available"
      : "Unavailable"
    : table.isActive
      ? "Active"
      : "Inactive";

  return (
    <article className="group overflow-hidden rounded-2xl border border-latte bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-48 bg-latte">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={table.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-caramel/60">
            <MapPin size={42} />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${
            statusLabel === "Available" || statusLabel === "Active"
              ? "bg-success text-white"
              : statusLabel === "Unavailable"
                ? "bg-warning text-white"
                : "bg-espresso/75 text-white"
          }`}
        >
          {statusLabel}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-espresso">
          Table {table.tableNumber}
        </span>
      </div>

      <div className="p-5">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-caramel">
            {table.tableCode || `Table ${table.tableNumber}`}
          </p>
          <h2 className="mt-1 truncate text-lg font-bold" title={table.name}>
            {table.name}
          </h2>
        </div>

        <div className="space-y-2 text-sm text-espresso/70">
          <p className="flex items-center gap-2">
            <MapPin size={15} className="shrink-0 text-caramel" />
            <span className="truncate">
              {table.area}
              {table.location ? ` · ${table.location}` : ""}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Users size={15} className="shrink-0 text-caramel" />
            Capacity: {table.capacity} guests
          </p>
        </div>

        {features.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-espresso/50">
              Features
            </p>
            <div className="flex flex-wrap gap-1.5">
              {features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-latte/70 px-2.5 py-1 text-xs font-medium text-espresso"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-espresso/50">
              Amenities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-espresso/75"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-latte pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-latte px-3 py-2.5 text-sm font-semibold text-espresso transition hover:bg-latte"
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete table ${table.tableNumber}`}
            className="inline-flex items-center justify-center rounded-lg border border-error/20 px-3 py-2.5 text-error transition hover:bg-error/10 disabled:cursor-wait disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default TablesPage;
