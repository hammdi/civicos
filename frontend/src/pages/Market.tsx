import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  MapPin,
  Map as MapIcon,
  List as ListIcon,
  Plus,
  Eye,
  Tag,
  Sparkles,
  ShoppingBag,
  Apple,
  Shirt,
  Smartphone,
  Sofa,
  Wrench,
  Palette,
  Package,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import type { Category, Listing } from "../api/types";
import { MARKET_CATEGORIES } from "../lib/constants";
import { formatPrice } from "../lib/format";
import { firstPhoto } from "../lib/images";
import { useAuth } from "../context/AuthContext";
import SmartImage from "../components/SmartImage";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import AuthModal from "../components/AuthModal";

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  food: Apple,
  clothing: Shirt,
  electronics: Smartphone,
  furniture: Sofa,
  services: Wrench,
  crafts: Palette,
  other: Package,
};

function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Package;
  return <Icon className={className} />;
}

interface Filters {
  q: string;
  city: string;
  category: Category | "";
  min_price: string;
  max_price: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  city: "",
  category: "",
  min_price: "",
  max_price: "",
};

interface CreateForm {
  title: string;
  description: string;
  category: Category;
  price: string;
  negotiable: boolean;
  photos: string;
  city: string;
  neighborhood: string;
  seller_name: string;
}

const EMPTY_CREATE: CreateForm = {
  title: "",
  description: "",
  category: "other",
  price: "",
  negotiable: false,
  photos: "",
  city: "",
  neighborhood: "",
  seller_name: "",
};

function ListingCard({ listing }: { listing: Listing }) {
  const { t } = useTranslation();
  const location = [listing.neighborhood, listing.city].filter(Boolean).join(", ");
  return (
    <Link
      to={`/market/${listing.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-market focus:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <SmartImage
          src={firstPhoto(listing.photos, listing.title, listing.category)}
          alt={listing.title}
          fallbackKey={listing.category}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />
        <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur">
          <CategoryIcon category={listing.category} className="h-3.5 w-3.5 text-market" />
          {t(`categories.${listing.category}`)}
        </span>
        {listing.negotiable && (
          <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            <Tag className="h-3 w-3" />
            {t("market.negotiable")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-navy">{listing.title}</h3>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}
        <div className="mt-3 flex items-end justify-between gap-2 pt-1">
          <span className="text-lg font-bold text-market">{formatPrice(listing.price)}</span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Eye className="h-3.5 w-3.5" />
            {listing.views} {t("market.views")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Market() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mapView, setMapView] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(
    async (f: Filters) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number | undefined> = {
          q: f.q.trim() || undefined,
          city: f.city.trim() || undefined,
          category: f.category || undefined,
          min_price: f.min_price ? Number(f.min_price) : undefined,
          max_price: f.max_price ? Number(f.max_price) : undefined,
        };
        const data = await api.listings.browse(params);
        setListings(data);
      } catch {
        setError(t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied(filters);
  };

  const setField = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const setFormField = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectCategory = (category: Category | "") => {
    const next = { ...filters, category };
    setFilters(next);
    setApplied(next);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.title.trim() || !form.price || !form.city.trim() || !form.seller_name.trim()) {
      setCreateError(t("common.error"));
      return;
    }
    setCreating(true);
    try {
      const photos = form.photos
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
      await api.listings.create({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        price: Number(form.price),
        negotiable: form.negotiable,
        photos,
        city: form.city.trim(),
        neighborhood: form.neighborhood.trim() || null,
        seller_name: form.seller_name.trim(),
      });
      setForm(EMPTY_CREATE);
      setShowCreate(false);
      setApplied({ ...EMPTY_FILTERS });
      setFilters({ ...EMPTY_FILTERS });
    } catch {
      setCreateError(t("common.error"));
    } finally {
      setCreating(false);
    }
  };

  const mapCity = (applied.city || filters.city).trim();
  const mapSrc = useMemo(() => {
    if (!mapCity) return null;
    const q = encodeURIComponent(mapCity);
    // OpenStreetMap search embed centered on the filtered city (no leaflet).
    return `https://www.openstreetmap.org/export/embed.html?bbox=-20%2C20%2C40%2C55&layer=mapnik&query=${q}`;
  }, [mapCity]);

  const onSell = () => {
    if (!isAuthenticated) {
      setShowAuth(true);
    } else {
      setShowCreate((v) => !v);
    }
  };

  return (
    <div className="container-page">
      {/* Hero header */}
      <header className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-navy-700 to-navy-600 px-6 py-8 text-white shadow-sm sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              <ShoppingBag className="h-3.5 w-3.5" />
              {t("modules.market.title")}
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{t("market.title")}</h1>
            <p className="mt-1 max-w-md text-sm text-white/70">{t("market.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onSell}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-civic-green px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-civic-greenDark focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <Plus className="h-4 w-4" />
            {t("market.sell")}
          </button>
        </div>
      </header>

      {/* Category quick filters */}
      <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:overflow-visible">
        <button
          type="button"
          onClick={() => selectCategory("")}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            applied.category === ""
              ? "border-market bg-market text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-market hover:text-market"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          {t("common.all")}
        </button>
        {MARKET_CATEGORIES.map((c) => {
          const active = applied.category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => selectCategory(c)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-market bg-market text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-market hover:text-market"
              }`}
            >
              <CategoryIcon category={c} className="h-4 w-4" />
              {t(`categories.${c}`)}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <form
        onSubmit={onSearch}
        className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
      >
        <div className="lg:col-span-4">
          <label className="label" htmlFor="q">
            {t("common.search")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              id="q"
              className="input ps-9"
              value={filters.q}
              onChange={(e) => setField("q", e.target.value)}
              placeholder={t("common.search")}
            />
          </div>
        </div>
        <div className="lg:col-span-3">
          <label className="label" htmlFor="city">
            {t("common.city")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
              <MapPin className="h-4 w-4" />
            </span>
            <input
              id="city"
              className="input ps-9"
              value={filters.city}
              onChange={(e) => setField("city", e.target.value)}
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="label" htmlFor="min_price">
            {t("market.minPrice")}
          </label>
          <input
            id="min_price"
            type="number"
            min={0}
            className="input"
            value={filters.min_price}
            onChange={(e) => setField("min_price", e.target.value)}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="label" htmlFor="max_price">
            {t("market.maxPrice")}
          </label>
          <input
            id="max_price"
            type="number"
            min={0}
            className="input"
            value={filters.max_price}
            onChange={(e) => setField("max_price", e.target.value)}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn-green w-full">
            <Search className="me-1 h-4 w-4" />
            {t("common.search")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-12">
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2"
            onClick={() => setMapView((v) => !v)}
            aria-pressed={mapView}
          >
            {mapView ? <ListIcon className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
            {mapView ? t("market.listView") : t("market.mapView")}
          </button>
          <button
            type="button"
            className="btn-primary ms-auto inline-flex items-center gap-2"
            onClick={onSell}
          >
            <Plus className="h-4 w-4" />
            {t("market.sell")}
          </button>
        </div>
      </form>

      {/* Sell / create section */}
      {isAuthenticated && showCreate && (
        <form onSubmit={onCreate} className="card mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-market/10 text-market">
              <Plus className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-navy">{t("market.createListing")}</h2>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-title">
              {t("market.listingTitle")}
            </label>
            <input
              id="c-title"
              className="input"
              value={form.title}
              onChange={(e) => setFormField("title", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-desc">
              {t("market.description")}
            </label>
            <textarea
              id="c-desc"
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => setFormField("description", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="c-category">
              {t("market.category")}
            </label>
            <select
              id="c-category"
              className="input"
              value={form.category}
              onChange={(e) => setFormField("category", e.target.value as Category)}
            >
              {MARKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-price">
              {t("market.price")}
            </label>
            <input
              id="c-price"
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={form.price}
              onChange={(e) => setFormField("price", e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.negotiable}
              onChange={(e) => setFormField("negotiable", e.target.checked)}
            />
            <span className="text-sm text-slate-700">{t("market.negotiable")}</span>
          </label>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-photos">
              {t("market.photos")}
            </label>
            <textarea
              id="c-photos"
              className="input min-h-[70px] font-mono text-xs"
              value={form.photos}
              onChange={(e) => setFormField("photos", e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="label" htmlFor="c-city">
              {t("common.city")}
            </label>
            <input
              id="c-city"
              className="input"
              value={form.city}
              onChange={(e) => setFormField("city", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="c-neighborhood">
              {t("market.neighborhood")}
            </label>
            <input
              id="c-neighborhood"
              className="input"
              value={form.neighborhood}
              onChange={(e) => setFormField("neighborhood", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-seller">
              {t("market.sellerName")}
            </label>
            <input
              id="c-seller"
              className="input"
              value={form.seller_name}
              onChange={(e) => setFormField("seller_name", e.target.value)}
              required
            />
          </div>
          {createError && <p className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-green" disabled={creating}>
              {t("common.submit")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {!isAuthenticated && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-civic-green/20 bg-civic-green/5 px-4 py-3 text-sm text-civic-greenDark">
          <ShoppingBag className="h-5 w-5 shrink-0 text-civic-green" />
          <span>{t("market.loginToSell")}</span>
          <button
            type="button"
            onClick={() => setShowAuth(true)}
            className="ms-auto shrink-0 font-semibold text-civic-green hover:underline"
          >
            {t("market.sell")}
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <EmptyState icon="⚠️" title={t("common.error")}>
          <button className="btn-ghost mt-2" onClick={() => void load(applied)}>
            {t("common.retry")}
          </button>
        </EmptyState>
      ) : mapView ? (
        mapSrc ? (
          <div className="card overflow-hidden">
            <iframe
              title={mapCity}
              className="h-[60vh] w-full border-0"
              src={mapSrc}
              loading="lazy"
            />
          </div>
        ) : (
          <EmptyState icon="🗺️" title={t("market.mapView")}>
            {t("common.city")}
          </EmptyState>
        )
      ) : listings.length === 0 ? (
        <EmptyState icon="🛒" title={t("market.noListings")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
