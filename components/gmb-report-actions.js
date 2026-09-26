"use client";

import { useState } from "react";
import {
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";

import {
  Button,
  Modal,
  Field,
  Input,
  Select,
  Alert,
} from "@/components/ui";

import { apiFetch } from "@/lib/hooks/use-api";

const RANGES = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["180", "Last 6 months"],
];

const SHARE_METHODS = [
  {
    value: "EMAIL",
    label: "Email",
    icon: Mail,
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
    icon: MessageCircle,
  },
  {
    value: "LINK",
    label: "Link",
    icon: Link2,
  },
];

export function GmbReportActions({
  clientId,
  ownerEmail,
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [method, setMethod] = useState("EMAIL");

  const [form, setForm] = useState({
    to: ownerEmail || "",
    name: "",
    phone: "",
  });

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const resetState = () => {
    setResult(null);
    setError("");
    setCopied(false);
  };

  const handleOpen = () => {
    resetState();

    setForm((prev) => ({
      ...prev,
      to: prev.to || ownerEmail || "",
    }));

    setOpen(true);
  };

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
  };

  const handleMethodChange = (value) => {
    setMethod(value);
    resetState();
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validate = () => {
    if (method === "EMAIL" && !form.to.trim()) {
      return "Business owner email is required.";
    }

    if (method === "WHATSAPP" && !form.phone.trim()) {
      return "WhatsApp number is required.";
    }

    return "";
  };

  async function share() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        days,
        method,
        name: form.name.trim(),
      };

      if (method === "EMAIL") {
        payload.to = form.to.trim();
      }

      if (method === "WHATSAPP") {
        payload.phone = form.phone.trim();
      }

      const res = await apiFetch(
        `/api/gmb/${clientId}/report`,
        {
          body: payload,
        }
      );

      setResult(res);

      if (method === "WHATSAPP" && res?.whatsapp) {
        window.open(
          res.whatsapp,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (e) {
      setError(
        e?.message ||
          "Unable to generate the report. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result?.link) return;

    try {
      await navigator.clipboard.writeText(result.link);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setError("Unable to copy the report link.");
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleOpen}
      >
        <FileText className="h-3.5 w-3.5" />
        Report
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Performance report"
        size="lg"
      >
        <div className="space-y-5">
          {/* Report options */}
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Export report
              </h4>

              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Select the reporting period and download the
                performance report.
              </p>
            </div>

            <Field label="Report period">
              <Select
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  resetState();
                }}
              >
                {RANGES.map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <a
                href={`/api/gmb/${clientId}/report?days=${days}`}
                className="w-full"
              >
                <Button className="w-full justify-center">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </a>

              <a
                href={`/api/gmb/${clientId}/report?days=${days}&format=csv`}
              >
                <Button
                  variant="secondary"
                  className="w-full justify-center sm:w-auto"
                >
                  CSV
                </Button>
              </a>
            </div>
          </section>

          {/* Share section */}
          <section>
            <div className="mb-3 flex items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950/40">
                <Share2 className="h-4 w-4" />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Share with business owner
                </h4>

                <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Generate a private report and send it using
                  your preferred method.
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70">
              {SHARE_METHODS.map(
                ({ value, label, icon: Icon }) => {
                  const active = method === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        handleMethodChange(value)
                      }
                      className={[
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium transition",
                        active
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                      ].join(" ")}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />

                      <span className="truncate">
                        {label}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            {/* Fields */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Owner name">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    handleFormChange(
                      "name",
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </Field>

              {method === "EMAIL" ? (
                <Field label="Email address">
                  <Input
                    type="email"
                    value={form.to}
                    onChange={(e) =>
                      handleFormChange(
                        "to",
                        e.target.value
                      )
                    }
                    placeholder="owner@business.com"
                  />
                </Field>
              ) : null}

              {method === "WHATSAPP" ? (
                <Field label="WhatsApp number">
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      handleFormChange(
                        "phone",
                        e.target.value
                      )
                    }
                    placeholder="+91 98xxxxxxxx"
                  />
                </Field>
              ) : null}
            </div>

            {method === "LINK" ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                <div className="flex items-start gap-2">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />

                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                      Private share link
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700/80 dark:text-blue-400/80">
                      A secure report link will be created and
                      will expire automatically after 30 days.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Error */}
            {error ? (
              <Alert className="mt-4">
                {error}
              </Alert>
            ) : null}

            {/* Success */}
            {result ? (
              <Alert
                tone="green"
                className="mt-4"
              >
                <div className="space-y-2">
                  <p>
                    {method === "EMAIL"
                      ? result.sent_to
                        ? `Report queued for ${result.sent_to}.`
                        : "Report queued successfully."
                      : method === "WHATSAPP"
                        ? "WhatsApp opened with the report link."
                        : "Private report link created successfully."}
                  </p>

                  {result.link ? (
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
                    >
                      <Copy className="h-3.5 w-3.5" />

                      {copied
                        ? "Copied"
                        : "Copy report link"}
                    </button>
                  ) : null}
                </div>
              </Alert>
            ) : null}

            {/* Action */}
            <Button
              className="mt-4 w-full justify-center"
              onClick={share}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}

              {busy
                ? "Generating report..."
                : method === "EMAIL"
                  ? "Generate & email"
                  : method === "WHATSAPP"
                    ? "Generate & open WhatsApp"
                    : "Generate private link"}
            </Button>

            <p className="mt-3 text-center text-[11px] leading-4 text-zinc-400">
              Every shared report is saved in Shared reports
              with delivery and view status.
            </p>
          </section>
        </div>
      </Modal>
    </>
  );
}