import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  MapPin,
  Eye,
  Star,
  Tag,
  CheckCircle2,
  MessageCircle,
  Send,
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
import type { Category, ListingDetail } from "../api/types";
import { formatPrice, formatDate, isValidPhone } from "../lib/format";
import { firstPhoto } from "../lib/images";
import SmartImage from "../components/SmartImage";
import Avatar from "../components/Avatar";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  food: Apple,
  clothing: Shirt,
  electronics: Smartphone,
  furniture: Sofa,
  services: Wrench,
  crafts: Palette,
  other: Package,
};

function Stars({
  value,
  onChange,
  readOnly = false,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5" role={readOnly ? undefined : "radiogroup"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const cls = filled ? "fill-amber-400 text-amber-400" : "fill-none text-slate-300";
        if (readOnly) {
          return <Star key={n} style={{ width: size, height: size }} className={cls} />;
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n}`}
            className="transition hover:scale-110"
            onClick={() => onChange?.(n)}
          >
            <Star
              style={{ width: size + 6, height: size + 6 }}
              className={filled ? "fill-amber-400 text-amber-400" : "fill-none text-slate-300 hover:text-amber-300"}
            />
          </button>
        );
      })}
    </div>
  );
}

interface ContactForm {
  buyer_phone: string;
  buyer_name: string;
  message: string;
}

interface ReviewForm {
  reviewer_phone: string;
  rating: number;
  comment: string;
}

export default function MarketDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  const [contact, setContact] = useState<ContactForm>({
    buyer_phone: "",
    buyer_name: "",
    message: "",
  });
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactDone, setContactDone] = useState(false);

  const [review, setReview] = useState<ReviewForm>({
    reviewer_phone: "",
    rating: 5,
    comment: "",
  });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDone, setReviewDone] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(listingId)) {
      setError(t("common.notFound"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.listings.detail(listingId);
      setListing(data);
      setActivePhoto(0);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [listingId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    if (!isValidPhone(contact.buyer_phone) || !contact.message.trim()) {
      setContactError(t("common.error"));
      return;
    }
    setContactBusy(true);
    try {
      await api.listings.contact(listingId, {
        buyer_phone: contact.buyer_phone.trim(),
        buyer_name: contact.buyer_name.trim() || undefined,
        message: contact.message.trim(),
      });
      setContactDone(true);
      setContact({ buyer_phone: "", buyer_name: "", message: "" });
    } catch {
      setContactError(t("common.error"));
    } finally {
      setContactBusy(false);
    }
  };

  const onReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    if (!isValidPhone(review.reviewer_phone) || review.rating < 1 || review.rating > 5) {
      setReviewError(t("common.error"));
      return;
    }
    setReviewBusy(true);
    try {
      await api.listings.review(listingId, {
        reviewer_phone: review.reviewer_phone.trim(),
        rating: review.rating,
        comment: review.comment.trim() || undefined,
      });
      setReviewDone(true);
      setReview({ reviewer_phone: "", rating: 5, comment: "" });
      void load();
    } catch {
      setReviewError(t("common.error"));
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container-page">
        <EmptyState icon="⚠️" title={error ?? t("common.notFound")}>
          <Link to="/market" className="btn-ghost mt-2 inline-block">
            {t("common.back")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const photos = listing.photos ?? [];
  const mainSrc = photos[activePhoto] ?? firstPhoto(photos, listing.title, listing.category);
  const seller = listing.seller;
  const CategoryIcon = CATEGORY_ICONS[listing.category] ?? Package;
  const location = [listing.neighborhood, listing.city].filter(Boolean).join(", ");

  return (
    <div className="container-page">
      <Link
        to="/market"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-market hover:underline"
      >
        <ArrowLeft className="h-4 w-4 rtl-flip" />
        {t("market.browse")}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="card aspect-[4/3] w-full overflow-hidden bg-slate-100">
            <SmartImage
              key={activePhoto}
              src={mainSrc}
              alt={listing.title}
              fallbackKey={listing.category}
              className="h-full w-full object-cover"
            />
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                    i === activePhoto ? "border-market" : "border-transparent hover:border-slate-200"
                  }`}
                  aria-label={`${i + 1}`}
                >
                  <SmartImage
                    src={p}
                    alt=""
                    fallbackKey={listing.category}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-market/10 px-3 py-1 text-xs font-semibold text-market">
              <CategoryIcon className="h-3.5 w-3.5" />
              {t(`categories.${listing.category}`)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                listing.negotiable ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              {listing.negotiable ? t("market.negotiable") : t("market.fixedPrice")}
            </span>
            <span className="ms-auto inline-flex items-center gap-1 text-xs text-slate-400">
              <Eye className="h-3.5 w-3.5" />
              {listing.views} {t("market.views")}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-bold text-navy md:text-3xl">{listing.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Stars value={listing.avg_rating} readOnly size={14} />
              <span className="text-slate-600">
                {listing.avg_rating.toFixed(1)} · {listing.review_count} {t("market.reviews")}
              </span>
            </span>
          </div>

          <div className="mt-4 text-3xl font-bold text-market">{formatPrice(listing.price)}</div>

          {listing.description && (
            <p className="mt-4 whitespace-pre-line text-slate-700">{listing.description}</p>
          )}

          {/* Seller block */}
          {seller && (
            <div className="card mt-5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("market.soldBy")}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={seller.name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/market?city=${encodeURIComponent(seller.city)}`}
                      className="truncate font-semibold text-navy hover:underline"
                    >
                      {seller.name}
                    </Link>
                    {seller.verified && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-market"
                        title={t("market.verified")}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("market.verified")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Stars value={seller.rating} readOnly size={14} />
                    <span>{seller.rating.toFixed(1)}</span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {seller.city}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">{formatDate(listing.created_at)}</p>
        </div>
      </div>

      {/* Contact + Review */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact seller */}
        <form onSubmit={onContact} className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-market/10 text-market">
              <MessageCircle className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-navy">{t("market.contactSeller")}</h2>
          </div>
          {contactDone ? (
            <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {t("market.messageSent")}
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="buyer_phone">
                  {t("common.phone")}
                </label>
                <input
                  id="buyer_phone"
                  className="input"
                  value={contact.buyer_phone}
                  onChange={(e) => setContact((p) => ({ ...p, buyer_phone: e.target.value }))}
                  placeholder="+216 55 123 456"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="buyer_name">
                  {t("common.name")} ({t("common.optional")})
                </label>
                <input
                  id="buyer_name"
                  className="input"
                  value={contact.buyer_name}
                  onChange={(e) => setContact((p) => ({ ...p, buyer_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="contact_message">
                  {t("market.yourMessage")}
                </label>
                <textarea
                  id="contact_message"
                  className="input min-h-[90px]"
                  value={contact.message}
                  onChange={(e) => setContact((p) => ({ ...p, message: e.target.value }))}
                  required
                />
              </div>
              {contactError && <p className="text-sm text-red-600">{contactError}</p>}
              <button
                type="submit"
                className="btn-green inline-flex w-full items-center justify-center gap-2"
                disabled={contactBusy}
              >
                <Send className="h-4 w-4 rtl-flip" />
                {t("common.send")}
              </button>
            </div>
          )}
        </form>

        {/* Leave a review */}
        <form onSubmit={onReview} className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-500">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </span>
            <h2 className="text-lg font-semibold text-navy">{t("market.leaveReview")}</h2>
          </div>
          {reviewDone ? (
            <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {t("market.reviewLeft")}
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="reviewer_phone">
                  {t("common.phone")}
                </label>
                <input
                  id="reviewer_phone"
                  className="input"
                  value={review.reviewer_phone}
                  onChange={(e) => setReview((p) => ({ ...p, reviewer_phone: e.target.value }))}
                  placeholder="+216 55 123 456"
                  required
                />
              </div>
              <div>
                <span className="label">{t("market.rating")}</span>
                <Stars
                  value={review.rating}
                  onChange={(v) => setReview((p) => ({ ...p, rating: v }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="review_comment">
                  {t("market.description")} ({t("common.optional")})
                </label>
                <textarea
                  id="review_comment"
                  className="input min-h-[90px]"
                  value={review.comment}
                  onChange={(e) => setReview((p) => ({ ...p, comment: e.target.value }))}
                />
              </div>
              {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
              <button
                type="submit"
                className="btn-primary inline-flex w-full items-center justify-center gap-2"
                disabled={reviewBusy}
              >
                <ShoppingBag className="h-4 w-4" />
                {t("common.submit")}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
