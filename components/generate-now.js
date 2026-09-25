"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { POST_TYPES } from "@/lib/constants";

/**
 * Creates a task for one client
 * and runs the full AI pipeline immediately.
 */
export function GenerateNow({ clientId }) {
  const router = useRouter();

  const [postType, setPostType] = useState("Service");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          postType,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(
          data.error || "Generation failed"
        );
      }

      router.push(
        `/gmb/tasks/${data.taskId}`
      );
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">

        {/* POST TYPE SELECT */}
        <div className="relative">
          <select
            value={postType}
            onChange={(e) =>
              setPostType(e.target.value)
            }
            disabled={busy}
            aria-label="Post type"
            className="
              h-8
              min-w-[118px]
              appearance-none
              rounded-lg
              border
              border-zinc-200
              bg-white
              pl-3
              pr-8
              text-xs
              font-medium
              text-zinc-700
              outline-none
              transition
              hover:border-zinc-300
              focus:border-violet-400
              focus:ring-4
              focus:ring-violet-500/10
              disabled:cursor-not-allowed
              disabled:opacity-60

              dark:border-zinc-700
              dark:bg-zinc-900
              dark:text-zinc-200
              dark:hover:border-zinc-600
            "
          >
            {POST_TYPES.map((type) => (
              <option key={type}>
                {type}
              </option>
            ))}
          </select>

          <ChevronDown
            className="
              pointer-events-none
              absolute
              right-2.5
              top-1/2
              h-3.5
              w-3.5
              -translate-y-1/2
              text-zinc-400
            "
          />
        </div>

        {/* AI GENERATE BUTTON */}
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="
            group
            relative
            inline-flex
            h-8
            items-center
            justify-center
            gap-1.5
            overflow-hidden
            rounded-lg
            bg-gradient-to-r
            from-violet-600
            via-fuchsia-600
            to-[#F53236]
            px-3
            text-xs
            font-semibold
            text-white
            shadow-[0_5px_16px_rgba(124,58,237,0.20)]
            transition-all
            duration-200

            hover:-translate-y-[1px]
            hover:shadow-[0_7px_20px_rgba(124,58,237,0.28)]

            active:translate-y-0

            disabled:pointer-events-none
            disabled:opacity-60
          "
        >
          {/* subtle AI shine */}
          <span
            className="
              absolute
              inset-0
              -translate-x-full
              bg-gradient-to-r
              from-transparent
              via-white/20
              to-transparent
              transition-transform
              duration-700
              group-hover:translate-x-full
            "
          />

          {busy ? (
            <Loader2 className="relative h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="relative h-3.5 w-3.5" />
          )}

          <span className="relative whitespace-nowrap">
            {busy
              ? "Generating..."
              : "Generate AI"}
          </span>

          {!busy ? (
            <span
              className="
                relative
                rounded
                bg-white/15
                px-1
                py-0.5
                text-[8px]
                font-bold
                tracking-wide
                text-white/90
              "
            >
              AI
            </span>
          ) : null}
        </button>
      </div>

      {/* ERROR MESSAGE */}
      {msg ? (
        <p className="max-w-[260px] text-[11px] font-medium text-red-500">
          {msg}
        </p>
      ) : null}
    </div>
  );
}