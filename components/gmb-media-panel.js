"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Images,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  Card,
  CardBody,
  Button,
  Field,
  Input,
  Select,
} from "@/components/ui";

const CATEGORIES = [
  {
    value: "COVER",
    label: "Cover",
    size: "1200 × 900",
    hint: "Main business image",
  },
  {
    value: "PROFILE",
    label: "Profile / Logo",
    size: "720 × 720",
    hint: "Square logo or profile image",
  },
  {
    value: "EXTERIOR",
    label: "Exterior",
    size: "1200 × 900",
    hint: "Outside view of the business",
  },
  {
    value: "INTERIOR",
    label: "Interior",
    size: "1200 × 900",
    hint: "Inside view and ambience",
  },
  {
    value: "PRODUCT",
    label: "Product",
    size: "1080 × 1080",
    hint: "Products and merchandise",
  },
  {
    value: "AT_WORK",
    label: "At Work",
    size: "1200 × 900",
    hint: "Team providing services",
  },
  {
    value: "FOOD_AND_DRINK",
    label: "Food & Drink",
    size: "1080 × 1080",
    hint: "Food or beverage photos",
  },
  {
    value: "MENU",
    label: "Menu",
    size: "1080 × 1350",
    hint: "Menu or pricing information",
  },
  {
    value: "COMMON_AREA",
    label: "Common Area",
    size: "1200 × 900",
    hint: "Shared spaces",
  },
  {
    value: "ROOMS",
    label: "Rooms",
    size: "1200 × 900",
    hint: "Guest rooms",
  },
  {
    value: "TEAMS",
    label: "Team",
    size: "1200 × 900",
    hint: "Staff and management",
  },
  {
    value: "ADDITIONAL",
    label: "Additional",
    size: "1080 × 1080",
    hint: "Other business images",
  },
];

function getCategoryMeta(category) {
  return (
    CATEGORIES.find(
      (item) =>
        item.value === category
    ) ||
    CATEGORIES[
      CATEGORIES.length - 1
    ]
  );
}

export function GmbMediaPanel({
  clientId,
}) {
  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [showModal, setShowModal] =
    useState(false);

  const [sourceUrl, setSourceUrl] =
    useState("");
const [file, setFile] = useState(null);
const [uploadMode, setUploadMode] = useState("file"); // file | url
  const [category, setCategory] =
    useState("ADDITIONAL");

  const [
    description,
    setDescription,
  ] = useState("");

  const [busy, setBusy] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/media`,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ||
            "Failed to load media."
        );
      }

      setItems(
        json.items || []
      );
    } catch (e) {
      setError(
        e.message ||
          "Failed to load media."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

function resetForm() {
  setUploadMode("file");
  setFile(null);
  setSourceUrl("");
  setDescription("");
  setCategory("ADDITIONAL");
}

  function closeModal() {
    if (busy) return;

    setShowModal(false);
    resetForm();
  }

async function upload() {
  if (uploadMode === "file" && !file) {
    setError("Please select a file.");
    return;
  }

  if (uploadMode === "url" && !sourceUrl.trim()) {
    setError("Please enter a media URL.");
    return;
  }

  setBusy(true);
  setError(null);

  try {
    let res;

    if (uploadMode === "file") {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("category", category);

      if (description.trim()) {
        formData.append(
          "description",
          description.trim()
        );
      }

      res = await fetch(
        `/api/gmb/${clientId}/media`,
        {
          method: "POST",
          body: formData,
        }
      );
    } else {
      res = await fetch(
        `/api/gmb/${clientId}/media`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            sourceUrl: sourceUrl.trim(),
            category,
            description:
              description.trim() || null,
            mediaFormat: "PHOTO",
          }),
        }
      );
    }

    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(
        json.error || "Upload failed."
      );
    }

    setShowModal(false);
    resetForm();

    await load();
  } catch (e) {
    setError(
      e.message || "Upload failed."
    );
  } finally {
    setBusy(false);
  }
}

  async function remove(item) {
    const confirmed =
      window.confirm(
        "Delete this photo from the Google Business Profile?"
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError(null);

    try {
      const res = await fetch(
        `/api/gmb/${clientId}/media/${encodeURIComponent(
          item.name || item.id
        )}`,
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

      setItems((prev) =>
        prev.filter(
          (media) =>
            media.id !== item.id
        )
      );
    } catch (e) {
      setError(
        e.message ||
          "Delete failed."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const groupedCount =
    useMemo(() => {
      return items.reduce(
        (acc, item) => {
          const key =
            item.category ||
            "ADDITIONAL";

          acc[key] =
            (acc[key] || 0) + 1;

          return acc;
        },
        {}
      );
    }, [items]);

  return (
    <>
      <Card className="overflow-hidden">
        {/* Header */}

        <div className="border-b border-zinc-200 bg-gradient-to-r from-white to-zinc-50 px-5 py-5 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/50 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                <Images className="h-5 w-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    Business Media
                  </h2>

                  {items.length ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {
                        items.length
                      }
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Manage photos and media
                  shown on your Google
                  Business Profile.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={load}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                Refresh
              </Button>

              <Button
                variant="primary"
                onClick={() =>
                  setShowModal(true)
                }
              >
                <Plus className="h-4 w-4" />

                Add Media
              </Button>
            </div>
          </div>
        </div>

        <CardBody className="p-5 sm:p-6">
          {/* Error */}

          {error ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />

              <p className="text-xs text-rose-700 dark:text-rose-300">
                {error}
              </p>
            </div>
          ) : null}

          {/* Category summary */}

          {!!items.length ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {Object.entries(
                groupedCount
              ).map(
                ([
                  key,
                  count,
                ]) => {
                  const meta =
                    getCategoryMeta(
                      key
                    );

                  return (
                    <span
                      key={key}
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      {
                        meta.label
                      }{" "}
                      · {count}
                    </span>
                  );
                }
              )}
            </div>
          ) : null}

          {/* Grid */}

          {loading ? (
            <MediaLoading />
          ) : items.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map(
                (item) => (
                  <MediaCard
                    key={
                      item.id
                    }
                    item={
                      item
                    }
                    deleting={
                      deletingId ===
                      item.id
                    }
                    onDelete={() =>
                      remove(item)
                    }
                  />
                )
              )}
            </div>
          ) : (
            <MediaEmptyState
              onAdd={() =>
                setShowModal(true)
              }
            />
          )}
        </CardBody>
      </Card>

{showModal ? (
  <AddMediaModal
    uploadMode={uploadMode}
    setUploadMode={setUploadMode}

    file={file}
    setFile={setFile}

    sourceUrl={sourceUrl}
    setSourceUrl={setSourceUrl}

    category={category}
    setCategory={setCategory}

    description={description}
    setDescription={setDescription}

    busy={busy}
    onClose={closeModal}
    onUpload={upload}
  />
) : null}
    </>
  );
}

/* =========================================================
   MEDIA CARD
========================================================= */

function MediaCard({
  item,
  deleting,
  onDelete,
}) {
  const meta =
    getCategoryMeta(
      item.category
    );

  const imageUrl =
    item.thumbnailUrl ||
    item.googleUrl;

  return (
    <div className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={
              item.description ||
              meta.label
            }
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-zinc-400" />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {meta.label}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {
              meta.label
            }
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            Recommended:{" "}
            {meta.size}
          </p>
        </div>

        {item.description ? (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            {
              item.description
            }
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {item.googleUrl ? (
            <a
              href={
                item.googleUrl
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />

              View
            </a>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={
              onDelete
            }
            disabled={
              deleting
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}

            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADD MEDIA MODAL
========================================================= */

function AddMediaModal({
  uploadMode,
  setUploadMode,

  file,
  setFile,

  sourceUrl,
  setSourceUrl,

  category,
  setCategory,

  description,
  setDescription,

  busy,
  onClose,
  onUpload,
}) {
  const meta =
    getCategoryMeta(
      category
    );
const previewUrl =
  uploadMode === "file" && file
    ? URL.createObjectURL(file)
    : sourceUrl;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Modal header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              Add Business Media
            </h3>

            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Add a photo or
              video to this Google
              Business Profile.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={busy}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal body */}

        <div className="space-y-5 p-5">
<div className="space-y-3">
  <div className="flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
    <button
      type="button"
      onClick={() => setUploadMode("file")}
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
        uploadMode === "file"
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      }`}
    >
      Upload File
    </button>

    <button
      type="button"
      onClick={() => setUploadMode("url")}
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
        uploadMode === "url"
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      }`}
    >
      Use URL
    </button>
  </div>

  {uploadMode === "file" ? (
    <Field label="Choose media file">
      <Input
        type="file"
        accept="image/jpeg,image/png,video/mp4,video/quicktime"
        onChange={(e) =>
          setFile(
            e.target.files?.[0] || null
          )
        }
      />

      {file ? (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {file.name}
          </p>

          <p className="mt-0.5 text-[11px] text-zinc-400">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      ) : null}
    </Field>
  ) : (
    <Field label="Public media URL">
      <Input
        value={sourceUrl}
        onChange={(e) =>
          setSourceUrl(e.target.value)
        }
        placeholder="https://example.com/photo.jpg"
      />
    </Field>
  )}
</div>

{previewUrl ? (
  <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
    <div className="aspect-video bg-zinc-100 dark:bg-zinc-900">
      <img
        src={previewUrl}
        alt="Preview"
        className="h-full w-full object-cover"
      />
    </div>
  </div>
) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Media category">
              <Select
                value={
                  category
                }
                onChange={(e) =>
                  setCategory(
                    e.target
                      .value
                  )
                }
              >
                {CATEGORIES.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  )
                )}
              </Select>
            </Field>

            <Field label="Recommended size">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {
                    meta.size
                  }
                </p>

                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {
                    meta.hint
                  }
                </p>
              </div>
            </Field>
          </div>

          <Field label="Description">
            <Input
              value={
                description
              }
              onChange={(e) =>
                setDescription(
                  e.target
                    .value
                )
              }
              maxLength={300}
              placeholder="Optional description"
            />

            <p className="mt-1 text-right text-[11px] text-zinc-400">
              {
                description.length
              }{" "}
              / 300
            </p>
          </Field>

          {/* Preview */}

          {sourceUrl ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Preview
                </span>

                <span className="text-[11px] text-zinc-400">
                  {
                    meta.label
                  }
                </span>
              </div>

              <div className="aspect-video bg-zinc-100 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    sourceUrl
                  }
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display =
                      "none";
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Guidelines */}

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              Google media guidelines
            </p>

            <div className="mt-2 space-y-1 text-[11px] leading-5 text-blue-700/80 dark:text-blue-300/80">
              <p>
                JPG or PNG
                recommended
              </p>

              <p>
                General recommended
                resolution: 720 ×
                720 or higher
              </p>

              <p>
                Photo file size:
                10 KB – 5 MB
              </p>

              <p>
                Minimum resolution:
                250 × 250
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <Button
            variant="ghost"
            onClick={
              onClose
            }
            disabled={busy}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={
              onUpload
            }
          disabled={
  busy ||
  (uploadMode === "file"
    ? !file
    : !sourceUrl.trim())
}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}

            Upload Media
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function MediaLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {[1, 2, 3, 4].map(
        (item) => (
          <div
            key={item}
            className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="aspect-[4/3] bg-zinc-200 dark:bg-zinc-800" />

            <div className="space-y-3 p-4">
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />

              <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function MediaEmptyState({
  onAdd,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <ImageIcon className="h-6 w-6 text-zinc-400" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        No business media yet
      </h3>

      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Add photos of your
        storefront, products,
        services, team or
        interior to improve the
        Google Business Profile.
      </p>

      <Button
        variant="primary"
        onClick={onAdd}
        className="mt-4"
      >
        <Plus className="h-4 w-4" />

        Add first media
      </Button>
    </div>
  );
}