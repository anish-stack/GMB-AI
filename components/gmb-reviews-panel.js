"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Filter,
  Loader2,
  MessageCircle,
  MessageSquareReply,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  Card,
  CardBody,
  Button,
  Textarea,
  Select,
} from "@/components/ui";

/* =========================================================
   CONSTANTS
========================================================= */

const TONES = [
  "professional",
  "friendly",
  "short",
  "apologetic",
  "grateful",
];

const RATING_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/* =========================================================
   HELPERS
========================================================= */

function ratingToNumber(rating) {
  if (typeof rating === "number") {
    return rating;
  }

  if (!rating) {
    return 0;
  }

  const value = String(rating).toUpperCase();

  if (RATING_MAP[value]) {
    return RATING_MAP[value];
  }

  const numeric = Number(rating);

  return Number.isFinite(numeric) ? numeric : 0;
}

function timeAgo(iso) {
  if (!iso) return "";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toneLabel(tone) {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

/* =========================================================
   STARS
========================================================= */

function Stars({ rating, size = "default" }) {
  const value = ratingToNumber(rating);

  const sizeClass =
    size === "large"
      ? "h-4 w-4"
      : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-zinc-300 dark:text-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

/* =========================================================
   REVIEW STAT
========================================================= */

function ReviewStat({
  icon: Icon,
  label,
  value,
  helper,
  tone = "blue",
}) {
  const tones = {
    amber: {
      box: "bg-amber-50 dark:bg-amber-950/30",
      icon: "text-amber-600 dark:text-amber-400",
    },

    blue: {
      box: "bg-blue-50 dark:bg-blue-950/30",
      icon: "text-blue-600 dark:text-blue-400",
    },

    rose: {
      box: "bg-rose-50 dark:bg-rose-950/30",
      icon: "text-rose-600 dark:text-rose-400",
    },

    emerald: {
      box: "bg-emerald-50 dark:bg-emerald-950/30",
      icon: "text-emerald-600 dark:text-emerald-400",
    },
  };

  const selected =
    tones[tone] || tones.blue;

  return (
    <div className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {value}
          </p>

          {helper ? (
            <p className="mt-1 text-[11px] text-zinc-400">
              {helper}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected.box}`}
        >
          <Icon
            className={`h-4.5 w-4.5 ${selected.icon}`}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REVIEW AVATAR
========================================================= */

function ReviewAvatar({ review }) {
  if (review.profile_photo) {
    return (
      <img
        src={review.profile_photo}
        alt={review.author || "Google reviewer"}
        className="h-11 w-11 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
      <UserRound className="h-5 w-5 text-zinc-500" />
    </div>
  );
}

/* =========================================================
   REVIEW STATUS
========================================================= */

function ReviewStatus({ replied }) {
  if (replied) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Replied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <MessageCircle className="h-3 w-3" />
      Needs reply
    </span>
  );
}

/* =========================================================
   REVIEW ROW
========================================================= */

function ReviewRow({
  clientId,
  review,
  onChanged,
}) {
  const existingReply =
    review.reply?.comment || "";

  const [editing, setEditing] =
    useState(false);

  const [replyText, setReplyText] =
    useState(existingReply);

  const [tone, setTone] =
    useState("professional");

  const [aiBusy, setAiBusy] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState(null);

  const hasReply =
    Boolean(
      review.reply?.comment ||
      review.replied
    );

  async function generateAI() {
    setAiBusy(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/reviews/${review.id}/generate-reply`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            tone,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ||
            "AI reply generation failed."
        );
      }

      setReplyText(
        json.reply || ""
      );

      setEditing(true);
    } catch (e) {
      setError(
        e.message ||
          "AI reply generation failed."
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function publish() {
    const cleanReply =
      replyText.trim();

    if (!cleanReply) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/reviews/${review.id}/reply`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            reply: cleanReply,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ||
            "Publishing reply failed."
        );
      }

      setEditing(false);

      await onChanged?.();
    } catch (e) {
      setError(
        e.message ||
          "Publishing reply failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeReply() {
    const confirmed = window.confirm(
      "Delete this business reply? The customer's review will stay untouched."
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/reviews/${review.id}/reply`,
        {
          method: "DELETE",
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ||
            "Delete failed."
        );
      }

      setReplyText("");
      setEditing(false);

      await onChanged?.();
    } catch (e) {
      setError(
        e.message ||
          "Delete failed."
      );
    } finally {
      setDeleting(false);
    }
  }

  function cancelEdit() {
    setEditing(false);

    setReplyText(
      review.reply?.comment || ""
    );

    setError(null);
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white transition-all duration-200 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      {/* Review Header */}

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ReviewAvatar
            review={review}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {review.author ||
                  "Google user"}
              </h3>

              <span className="hidden h-1 w-1 rounded-full bg-zinc-300 sm:block dark:bg-zinc-700" />

              <span className="text-xs text-zinc-400">
                {timeAgo(
                  review.created_at
                )}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <Stars
                rating={review.rating}
              />

              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {ratingToNumber(
                  review.rating
                )}.0
              </span>
            </div>
          </div>
        </div>

        <ReviewStatus
          replied={hasReply}
        />
      </div>

      {/* Review Body */}

      <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
        {review.comment ? (
          <p className="max-w-4xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {review.comment}
          </p>
        ) : (
          <p className="text-sm italic text-zinc-400">
            This customer left a rating
            without a written review.
          </p>
        )}
      </div>

      {/* Existing Reply */}

      {hasReply &&
      !editing ? (
        <div className="mx-5 mb-5 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between gap-3 border-b border-blue-100 px-4 py-2.5 dark:border-blue-900/30">
            <div className="flex items-center gap-2">
              <MessageSquareReply className="h-4 w-4 text-blue-600 dark:text-blue-400" />

              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Your business reply
              </p>
            </div>

            {review.reply?.updated_at ? (
              <span className="text-[11px] text-blue-600/70 dark:text-blue-400/70">
                {timeAgo(
                  review.reply
                    .updated_at
                )}
              </span>
            ) : null}
          </div>

          <div className="px-4 py-3">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {review.reply?.comment ||
                replyText ||
                "Reply published"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setReplyText(
                    review.reply
                      ?.comment ||
                      replyText ||
                      ""
                  );

                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />

                Edit reply
              </button>

              <button
                type="button"
                onClick={
                  removeReply
                }
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}

                Delete reply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* No Reply Actions */}

      {!hasReply &&
      !editing ? (
        <div className="border-t border-zinc-100 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Respond to this
                customer
              </p>

              <p className="mt-0.5 text-[11px] text-zinc-400">
                Generate a draft with
                AI or write your own
                reply.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={tone}
                onChange={(e) =>
                  setTone(
                    e.target.value
                  )
                }
                className="!w-auto min-w-[145px] text-xs"
              >
                {TONES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {toneLabel(
                        item
                      )}
                    </option>
                  )
                )}
              </Select>

              <Button
                variant="secondary"
                onClick={
                  generateAI
                }
                disabled={aiBusy}
                className="gap-2"
              >
                {aiBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                Generate AI reply
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setReplyText("");
                  setEditing(true);
                }}
              >
                Reply manually
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reply Editor */}

      {editing ? (
        <div className="border-t border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                <Bot className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Business reply
                </p>

                <p className="text-[11px] text-zinc-400">
                  Review the message
                  before publishing it
                  to Google.
                </p>
              </div>
            </div>

            <span className="text-[11px] text-zinc-400">
              {replyText.length} /
              4096
            </span>
          </div>

          <Textarea
            value={replyText}
            onChange={(e) =>
              setReplyText(
                e.target.value
              )
            }
            maxLength={4096}
            rows={5}
            placeholder="Write a thoughtful response to this customer..."
            className="min-h-[130px] resize-y bg-white dark:bg-zinc-950"
          />

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={tone}
                onChange={(e) =>
                  setTone(
                    e.target.value
                  )
                }
                className="!w-auto min-w-[145px] text-xs"
              >
                {TONES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {toneLabel(
                        item
                      )}
                    </option>
                  )
                )}
              </Select>

              <Button
                variant="secondary"
                onClick={
                  generateAI
                }
                disabled={aiBusy}
                className="gap-2"
              >
                {aiBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                {replyText
                  ? "Regenerate"
                  : "Generate with AI"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={
                  cancelEdit
                }
                disabled={
                  saving
                }
              >
                <X className="h-4 w-4" />

                Cancel
              </Button>

              <Button
                variant="primary"
                onClick={publish}
                disabled={
                  saving ||
                  !replyText.trim()
                }
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}

                {hasReply
                  ? "Update reply"
                  : "Publish reply"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Row Error */}

      {error ? (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />

            <p className="text-xs leading-5 text-rose-700 dark:text-rose-300">
              {error}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/* =========================================================
   LOADING STATE
========================================================= */

function ReviewsLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(
        (item) => (
          <div
            key={item}
            className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />

              <div className="flex-1">
                <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />

                <div className="mt-2 h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />

                <div className="mt-5 h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />

                <div className="mt-2 h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  filtered,
  onClear,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <MessageCircle className="h-6 w-6 text-zinc-400" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {filtered
          ? "No reviews match your filters"
          : "No reviews yet"}
      </h3>

      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {filtered
          ? "Try changing the reply status or rating filters to see more reviews."
          : "Reviews received on your Google Business Profile will appear here."}
      </p>

      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-xs font-semibold text-[#F53236] transition hover:text-[#d91e22]"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export function GmbReviewsPanel({
  clientId,
  initialReviews,
}) {
  const [reviews, setReviews] =
    useState(
      initialReviews || null
    );

  const [loading, setLoading] =
    useState(!initialReviews);

  const [error, setError] =
    useState(null);

  const [filter, setFilter] =
    useState("all");

  const [
    starFilter,
    setStarFilter,
  ] = useState("all");

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/reviews`,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ||
            "Failed to load reviews."
        );
      }

      setReviews(json);
    } catch (e) {
      setError(
        e.message ||
          "Failed to load reviews."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialReviews) {
      load();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const items =
    reviews?.items || [];

  const stats =
    useMemo(() => {
      const returnedTotal =
        items.length;

      const replied =
        items.filter(
          (review) =>
            Boolean(
              review.replied ||
                review.reply
                  ?.comment
            )
        ).length;

      return {
        averageRating:
          Number(
            reviews?.average_rating ||
              0
          ),

        total:
          Number(
            reviews?.total ??
              returnedTotal
          ),

        replied,

        unreplied:
          Math.max(
            returnedTotal -
              replied,
            0
          ),
      };
    }, [items, reviews]);

  const filtered =
    useMemo(() => {
      return items.filter(
        (review) => {
          const hasReply =
            Boolean(
              review.replied ||
                review.reply
                  ?.comment
            );

          if (
            filter ===
              "unreplied" &&
            hasReply
          ) {
            return false;
          }

          if (
            filter ===
              "replied" &&
            !hasReply
          ) {
            return false;
          }

          if (
            starFilter !==
              "all" &&
            ratingToNumber(
              review.rating
            ) !==
              Number(
                starFilter
              )
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      items,
      filter,
      starFilter,
    ]);

  const hasFilters =
    filter !== "all" ||
    starFilter !== "all";

  function clearFilters() {
    setFilter("all");
    setStarFilter("all");
  }

  return (
    <Card className="overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="border-b border-zinc-200 bg-gradient-to-r from-white via-white to-zinc-50/80 px-5 py-5 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/60 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900/40">
              <Star className="h-5 w-5 fill-current" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Google Reviews
                </h2>

                {stats.total > 0 ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {stats.total}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Monitor customer
                feedback, generate AI
                responses and publish
                replies directly to your
                Google Business Profile.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={load}
            disabled={loading}
            className="gap-2 self-start sm:self-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            Refresh reviews
          </Button>
        </div>
      </div>

      <CardBody className="p-5 sm:p-6">
        {/* =================================================
            GLOBAL ERROR
        ================================================= */}

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />

            <div>
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                Unable to load
                reviews
              </p>

              <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ReviewStat
            icon={Star}
            label="Average rating"
            value={
              stats.averageRating.toFixed(
                1
              )
            }
            helper="Out of 5 stars"
            tone="amber"
          />

          <ReviewStat
            icon={
              MessageCircle
            }
            label="Total reviews"
            value={stats.total}
            helper="Google reviews"
            tone="blue"
          />

          <ReviewStat
            icon={
              MessageSquareReply
            }
            label="Needs reply"
            value={
              stats.unreplied
            }
            helper="Awaiting response"
            tone="rose"
          />

          <ReviewStat
            icon={
              CheckCircle2
            }
            label="Replied"
            value={stats.replied}
            helper="Responses published"
            tone="emerald"
          />
        </div>

        {/* =================================================
            FILTER TOOLBAR
        ================================================= */}

        <div className="my-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <Filter className="h-3.5 w-3.5" />

                Filters
              </div>

              <div className="relative">
                <Select
                  value={filter}
                  onChange={(e) =>
                    setFilter(
                      e.target
                        .value
                    )
                  }
                  className="!w-auto min-w-[150px]"
                >
                  <option value="all">
                    All reviews
                  </option>

                  <option value="unreplied">
                    Needs reply
                  </option>

                  <option value="replied">
                    Replied
                  </option>
                </Select>
              </div>

              <Select
                value={
                  starFilter
                }
                onChange={(e) =>
                  setStarFilter(
                    e.target
                      .value
                  )
                }
                className="!w-auto min-w-[140px]"
              >
                <option value="all">
                  All ratings
                </option>

                <option value="5">
                  5 stars
                </option>

                <option value="4">
                  4 stars
                </option>

                <option value="3">
                  3 stars
                </option>

                <option value="2">
                  2 stars
                </option>

                <option value="1">
                  1 star
                </option>
              </Select>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#F53236] transition hover:bg-red-50 hover:text-[#d91d22] dark:hover:bg-red-950/20"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {!loading &&
            items.length ? (
              <p className="text-xs text-zinc-400">
                Showing{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {
                    filtered.length
                  }
                </span>{" "}
                of{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {items.length}
                </span>{" "}
                loaded reviews
              </p>
            ) : null}
          </div>
        </div>

        {/* =================================================
            REVIEW LIST
        ================================================= */}

        {loading ? (
          <ReviewsLoading />
        ) : filtered.length ? (
          <div className="space-y-3">
            {filtered.map(
              (review) => (
                <ReviewRow
                  key={
                    review.id
                  }
                  clientId={
                    clientId
                  }
                  review={
                    review
                  }
                  onChanged={
                    load
                  }
                />
              )
            )}
          </div>
        ) : (
          <EmptyState
            filtered={
              hasFilters
            }
            onClear={
              clearFilters
            }
          />
        )}

        {/* =================================================
            GOOGLE NOTE
        ================================================= */}

        {reviews?.note ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

            <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
              {reviews.note}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}