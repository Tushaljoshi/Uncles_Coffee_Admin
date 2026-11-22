import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Coffee,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiRoot, configuredApiBase, requestApi } from "../utils/api";

const menuApiUrl = `${apiRoot}/menu`;

const createEmptyForm = () => ({
  menuCode: "",
  name: "",
  category: "coffee",
  description: "",
  CutoffPrice: "",
  SellingPrice: "",
  badges: "",
  available: true,
  milk: "Regular, Almond, Oat, Soy",
  temperature: "Hot, Cold",
  extras: [
    { name: "Extra Espresso Shot", price: "40" },
    { name: "Whipped Cream", price: "30" },
    { name: "Chocolate Syrup", price: "20" },
  ],
  image: null,
});

const splitOptions = (value) =>
  value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function getImageUrl(item) {
  if (item.imageFileId) {
    return `${menuApiUrl}/file/${encodeURIComponent(item.imageFileId)}`;
  }
  if (!item.imageUrl && !item.image) return "";
  const path = item.imageUrl || item.image;
  if (/^https?:\/\//i.test(path)) return path;
  if (configuredApiBase) {
    const origin = configuredApiBase.replace(/\/api$/, "");
    return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return path;
}

function formFromItem(item) {
  const options = item.options || {};
  return {
    menuCode: item.menuCode || "",
    name: item.name || "",
    category: item.category || "coffee",
    description: item.description || "",
    CutoffPrice: item.CutoffPrice ?? "",
    SellingPrice: item.SellingPrice ?? "",
    badges: Array.isArray(item.badges) ? item.badges.join(", ") : "",
    available: item.available !== false,
    milk: Array.isArray(options.milk) ? options.milk.join(", ") : "",
    temperature: Array.isArray(options.temperature)
      ? options.temperature.join(", ")
      : "",
    extras: Array.isArray(options.extras)
      ? options.extras.map(({ name, price }) => ({
          name: name || "",
          price: price ?? "",
        }))
      : [],
    image: null,
  };
}

function toMultipartForm(form) {
  const body = new FormData();
  body.append("menuCode", form.menuCode.trim());
  body.append("name", form.name.trim());
  body.append("category", form.category);
  body.append("description", form.description.trim());
  body.append("CutoffPrice", String(form.CutoffPrice));
  body.append("SellingPrice", String(form.SellingPrice));
  body.append("badges", form.badges);
  body.append("available", String(form.available));
  body.append(
    "options",
    JSON.stringify({
      milk: splitOptions(form.milk),
      temperature: splitOptions(form.temperature),
      extras: form.extras
        .filter((extra) => extra.name.trim())
        .map((extra) => ({
          name: extra.name.trim(),
          price: Number(extra.price) || 0,
        })),
    })
  );
  if (form.image) body.append("image", form.image);
  return body;
}

function MenuPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const loadMenu = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestApi(menuApiUrl);
      if (!Array.isArray(result.items)) {
        throw new Error("The menu service returned an unexpected response.");
      }
      setItems(result.items);
    } catch (requestError) {
      setError(requestError.message || "Unable to load menu items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const categories = useMemo(
    () => ["all", ...new Set(items.map((item) => item.category).filter(Boolean))],
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const searchable = [
        item.name,
        item.menuCode,
        item.category,
        item.description,
        ...(Array.isArray(item.badges) ? item.badges : []),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [items, search, categoryFilter]);

  const availableCount = items.filter((item) => item.available).length;
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!form.image) {
      setImagePreview(editingItem ? getImageUrl(editingItem) : "");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(form.image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.image, editingItem]);

  const openCreateEditor = () => {
    setEditingItem(null);
    setForm(createEmptyForm());
    setError("");
    setEditorOpen(true);
  };

  const openEditEditor = (item) => {
    setEditingItem(item);
    setForm(formFromItem(item));
    setError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingItem(null);
    setForm(createEmptyForm());
  };

  const updateForm = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!editingItem && !form.image) {
      setError("Choose an image for this menu item.");
      return;
    }

    setSaving(true);
    const itemId = editingItem?._id || editingItem?.id;
    const url = editingItem
      ? `${menuApiUrl}/${encodeURIComponent(itemId)}`
      : menuApiUrl;
    try {
      await requestApi(url, {
        method: editingItem ? "PUT" : "POST",
        body: toMultipartForm(form),
      });
      setNotice(editingItem ? "Menu item updated." : "Menu item created.");
      setEditorOpen(false);
      setEditingItem(null);
      setForm(createEmptyForm());
      await loadMenu();
    } catch (requestError) {
      setError(requestError.message || "Unable to save this menu item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const itemId = item._id || item.id;
    if (
      !itemId ||
      !window.confirm(`Delete "${item.name}" from the menu? This cannot be undone.`)
    ) {
      return;
    }

    setDeletingId(itemId);
    setError("");
    setNotice("");
    try {
      await requestApi(`${menuApiUrl}/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      setItems((current) =>
        current.filter((entry) => (entry._id || entry.id) !== itemId)
      );
      setNotice("Menu item deleted.");
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this menu item.");
    } finally {
      setDeletingId("");
    }
  };

  const updateExtra = (index, field, value) => {
    setForm((current) => ({
      ...current,
      extras: current.extras.map((extra, extraIndex) =>
        extraIndex === index ? { ...extra, [field]: value } : extra
      ),
    }));
  };

  const addExtra = () =>
    setForm((current) => ({
      ...current,
      extras: [...current.extras, { name: "", price: "" }],
    }));

  const removeExtra = (index) =>
    setForm((current) => ({
      ...current,
      extras: current.extras.filter((_, extraIndex) => extraIndex !== index),
    }));

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
              Catalog
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Menu items
            </h1>
            <p className="mt-2 text-sm text-espresso/65">
              Create and manage the items guests can order.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-caramelHover focus:outline-none focus:ring-2 focus:ring-caramel focus:ring-offset-2"
          >
            <Plus size={19} />
            Add menu item
          </button>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total items" value={items.length} />
          <StatCard label="Available now" value={availableCount} />
          <StatCard label="Categories" value={Math.max(categories.length - 1, 0)} />
        </section>

        {notice && (
          <div
            role="status"
            className="mb-5 flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm font-medium text-success"
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="ml-auto rounded p-1 hover:bg-success/10"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && !editorOpen && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="ml-auto rounded p-1 hover:bg-error/10"
            >
              <X size={16} />
            </button>
          </div>
        )}

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
                placeholder="Search menu items..."
                className="w-full rounded-xl border border-latte bg-cream py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-espresso/45 focus:border-caramel focus:ring-2 focus:ring-caramel/20"
              />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Filter by category">
              {categories.map((category) => {
                const active = categoryFilter === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                      active
                        ? "bg-espresso text-white"
                        : "bg-cream text-espresso/70 hover:bg-latte"
                    }`}
                  >
                    {category === "all" ? "All items" : category.replace("-", " ")}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-caramel">
            <Loader2 className="animate-spin" size={30} />
            <p className="text-sm font-medium">Loading menu...</p>
          </div>
        ) : error && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-error/20 bg-white px-6 py-12 text-center">
            <AlertCircle className="mx-auto mb-3 text-error" size={30} />
            <h2 className="font-semibold">Could not load the menu</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-espresso/65">
              {error}
            </p>
            <button
              type="button"
              onClick={loadMenu}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-caramel px-4 py-2.5 text-sm font-semibold text-white hover:bg-caramelHover"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-latte bg-white px-6 py-14 text-center">
            <Coffee className="mx-auto mb-3 text-caramel/60" size={34} />
            <h2 className="font-semibold">
              {items.length ? "No matching menu items" : "Your menu is empty"}
            </h2>
            <p className="mt-2 text-sm text-espresso/60">
              {items.length
                ? "Try another search or category."
                : "Add your first item to start building the cafe menu."}
            </p>
            {!items.length && (
              <button
                type="button"
                onClick={openCreateEditor}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-caramel px-4 py-2.5 text-sm font-semibold text-white hover:bg-caramelHover"
              >
                <Plus size={16} />
                Add first item
              </button>
            )}
          </div>
        ) : (
          <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item._id || item.id || item.menuCode}
                item={item}
                imageUrl={getImageUrl(item)}
                deleting={deletingId === (item._id || item.id)}
                onEdit={() => openEditEditor(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
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
            aria-labelledby="menu-editor-title"
            className="my-auto w-full max-w-3xl rounded-2xl bg-cream shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-latte px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-caramel">
                  Menu editor
                </p>
                <h2 id="menu-editor-title" className="mt-1 text-xl font-bold">
                  {editingItem ? "Edit menu item" : "Add menu item"}
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

            <form onSubmit={handleSave} className="space-y-6 p-5 sm:p-7">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
                >
                  {error}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Menu code" htmlFor="menu-code">
                  <input
                    id="menu-code"
                    required
                    value={form.menuCode}
                    onChange={(event) => updateForm("menuCode", event.target.value)}
                    placeholder="MENU-LATTE-01"
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Item name" htmlFor="menu-name">
                  <input
                    id="menu-name"
                    required
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Chocolate Icecream"
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Category" htmlFor="menu-category">
                  <select
                    id="menu-category"
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                    className={inputClassName}
                  >
                    {["coffee", "cold-brew", "tea", "dessert", "bakery", "other"].map(
                      (category) => (
                        <option key={category} value={category}>
                          {category.replace("-", " ")}
                        </option>
                      )
                    )}
                    {form.category &&
                      ![
                        "coffee",
                        "cold-brew",
                        "tea",
                        "dessert",
                        "bakery",
                        "other",
                      ].includes(form.category) && (
                        <option value={form.category}>{form.category}</option>
                      )}
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Cutoff price (₹)" htmlFor="cutoff-price">
                    <input
                      id="cutoff-price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.CutoffPrice}
                      onChange={(event) =>
                        updateForm("CutoffPrice", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>
                  <FormField label="Selling price (₹)" htmlFor="selling-price">
                    <input
                      id="selling-price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.SellingPrice}
                      onChange={(event) =>
                        updateForm("SellingPrice", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>
                </div>
              </div>

              <FormField label="Description" htmlFor="menu-description">
                <textarea
                  id="menu-description"
                  rows="3"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Describe the menu item..."
                  className={`${inputClassName} resize-y`}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Badges"
                  htmlFor="menu-badges"
                  hint="Separate badges with commas."
                >
                  <input
                    id="menu-badges"
                    value={form.badges}
                    onChange={(event) => updateForm("badges", event.target.value)}
                    placeholder="Trending, Cold"
                    className={inputClassName}
                  />
                </FormField>
                <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-latte bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={(event) =>
                      updateForm("available", event.target.checked)
                    }
                    className="h-4 w-4 accent-caramel"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Available</span>
                    <span className="block text-xs text-espresso/60">
                      Show this item as orderable
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Milk options"
                  htmlFor="milk-options"
                  hint="Comma-separated, e.g. Regular, Oat."
                >
                  <input
                    id="milk-options"
                    value={form.milk}
                    onChange={(event) => updateForm("milk", event.target.value)}
                    className={inputClassName}
                  />
                </FormField>
                <FormField
                  label="Temperature options"
                  htmlFor="temperature-options"
                  hint="Comma-separated, e.g. Hot, Cold."
                >
                  <input
                    id="temperature-options"
                    value={form.temperature}
                    onChange={(event) =>
                      updateForm("temperature", event.target.value)
                    }
                    className={inputClassName}
                  />
                </FormField>
              </div>

              <fieldset className="rounded-xl border border-latte bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <legend className="text-sm font-semibold">Extras</legend>
                    <p className="text-xs text-espresso/55">
                      Optional add-ons and their prices.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addExtra}
                    className="inline-flex items-center gap-1 rounded-lg bg-latte px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-latte/70"
                  >
                    <Plus size={14} />
                    Add extra
                  </button>
                </div>
                <div className="space-y-2">
                  {form.extras.map((extra, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        aria-label={`Extra ${index + 1} name`}
                        value={extra.name}
                        onChange={(event) =>
                          updateExtra(index, "name", event.target.value)
                        }
                        placeholder="Extra Espresso Shot"
                        className={`${inputClassName} min-w-0 flex-1`}
                      />
                      <input
                        aria-label={`Extra ${index + 1} price`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={extra.price}
                        onChange={(event) =>
                          updateExtra(index, "price", event.target.value)
                        }
                        placeholder="₹"
                        className={`${inputClassName} w-24`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove extra ${index + 1}`}
                        onClick={() => removeExtra(index)}
                        className="rounded-lg px-2 text-error transition hover:bg-error/10"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <FormField
                  label="Item image"
                  htmlFor="menu-image"
                  hint={editingItem ? "Choose a new image to replace the current one." : "Image is required."}
                >
                  <label
                    htmlFor="menu-image"
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-caramel/50 bg-white px-4 py-3 text-sm text-caramel transition hover:bg-latte/40"
                  >
                    <ImagePlus size={19} />
                    <span className="truncate">
                      {form.image ? form.image.name : "Choose an image"}
                    </span>
                  </label>
                  <input
                    id="menu-image"
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
                      alt="Menu item preview"
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
                    : editingItem
                      ? "Save changes"
                      : "Create menu item"}
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

function MenuItemCard({ item, imageUrl, deleting, onEdit, onDelete }) {
  const badges = Array.isArray(item.badges) ? item.badges : [];
  const cutoffPrice = Number(item.CutoffPrice) || 0;
  const sellingPrice = Number(item.SellingPrice) || 0;
  const discount =
    item.PercentageOff ??
    (cutoffPrice > 0
      ? Math.round(((cutoffPrice - sellingPrice) / cutoffPrice) * 100)
      : 0);

  return (
    <article className="group overflow-hidden rounded-2xl border border-latte bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-48 bg-latte">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-caramel/60">
            <Coffee size={42} />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${
            item.available
              ? "bg-success text-white"
              : "bg-espresso/75 text-white"
          }`}
        >
          {item.available ? "Available" : "Unavailable"}
        </span>
        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-terracotta px-3 py-1 text-xs font-bold text-white">
            {discount}% off
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-caramel">
              {(item.category || "uncategorized").replace("-", " ")}
            </p>
            <h2 className="mt-1 truncate text-lg font-bold" title={item.name}>
              {item.name}
            </h2>
          </div>
          <span className="max-w-28 truncate rounded-md bg-cream px-2 py-1 text-[10px] font-medium text-espresso/60">
            {item.menuCode}
          </span>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-espresso/65">
          {item.description || "No description provided."}
        </p>

        <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-latte/70 px-2.5 py-1 text-xs font-medium text-espresso"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-baseline gap-2 border-t border-latte pt-4">
          <span className="text-xl font-bold text-espresso">
            {formatPrice(item.SellingPrice)}
          </span>
          {cutoffPrice > sellingPrice && (
            <span className="text-sm text-espresso/45 line-through">
              {formatPrice(cutoffPrice)}
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-2">
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
            aria-label={`Delete ${item.name}`}
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

export default MenuPage;
