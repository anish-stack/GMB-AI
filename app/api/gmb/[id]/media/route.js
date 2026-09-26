import { NextResponse } from "next/server";

import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { providerFor } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================================================
   GET MEDIA
========================================================= */

export async function GET(request, { params }) {
  const g = await guard(request, {
    permission: "gmb.view",
  });

  if (g.error) {
    return g.error;
  }

  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(
      clientId,
      g.ctx.tenantId,
    );

    const provider = await providerFor(clientId);

    const items =
      await provider.getMedia(clientId);

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return apiError(err);
  }
}

/* =========================================================
   CREATE MEDIA
   Supports:
   1. multipart/form-data -> local file upload
   2. application/json    -> public URL upload
========================================================= */

export async function POST(request, { params }) {
  const g = await guard(request, {
    permission: "gmb.edit",
  });

  if (g.error) {
    return g.error;
  }

  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(
      clientId,
      g.ctx.tenantId,
    );

    const provider = await providerFor(clientId);

    const contentType =
      request.headers.get("content-type") || "";

    /* =====================================================
       FILE UPLOAD
    ===================================================== */

    if (
      contentType.includes(
        "multipart/form-data",
      )
    ) {
      const formData =
        await request.formData();

      const file =
        formData.get("file");

      const category =
        String(
          formData.get("category") ||
            "ADDITIONAL",
        );

      const descriptionRaw =
        formData.get("description");

      const description =
        descriptionRaw
          ? String(descriptionRaw).trim()
          : null;

      if (
        !file ||
        typeof file.arrayBuffer !== "function"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Media file is required.",
          },
          {
            status: 400,
          },
        );
      }

      /* -------------------------------
         Validate file type
      -------------------------------- */

      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
      ];

      const allowedVideoTypes = [
        "video/mp4",
        "video/quicktime",
      ];

      const isImage =
        allowedImageTypes.includes(
          file.type,
        );

      const isVideo =
        allowedVideoTypes.includes(
          file.type,
        );

      if (!isImage && !isVideo) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Only JPG, PNG, MP4 or MOV files are allowed.",
          },
          {
            status: 400,
          },
        );
      }

      /* -------------------------------
         Size validation
      -------------------------------- */

      const PHOTO_MAX =
        5 * 1024 * 1024;

      const VIDEO_MAX =
        75 * 1024 * 1024;

      if (
        isImage &&
        file.size > PHOTO_MAX
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Photo must be 5 MB or smaller.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        isVideo &&
        file.size > VIDEO_MAX
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Video must be 75 MB or smaller.",
          },
          {
            status: 400,
          },
        );
      }

      /* -------------------------------
         Convert File -> Buffer
      -------------------------------- */

      const arrayBuffer =
        await file.arrayBuffer();

      const buffer =
        Buffer.from(arrayBuffer);

      /* -------------------------------
         Upload directly to Google
      -------------------------------- */

      const item =
        await provider.uploadMediaFile(
          clientId,
          {
            buffer,
            mimeType: file.type,
            category,
            description,
          },
        );

      return NextResponse.json({
        ok: true,
        item,
        uploadMode: "file",
      });
    }

    /* =====================================================
       URL UPLOAD
    ===================================================== */

    if (
      contentType.includes(
        "application/json",
      )
    ) {
      const body =
        await request.json();

      if (!body.sourceUrl) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "sourceUrl is required.",
          },
          {
            status: 400,
          },
        );
      }

      const item =
        await provider.uploadMedia(
          clientId,
          {
            sourceUrl:
              body.sourceUrl,

            category:
              body.category ||
              "ADDITIONAL",

            description:
              body.description ||
              null,

            mediaFormat:
              body.mediaFormat ||
              "PHOTO",
          },
        );

      return NextResponse.json({
        ok: true,
        item,
        uploadMode: "url",
      });
    }

    /* =====================================================
       UNSUPPORTED CONTENT TYPE
    ===================================================== */

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported upload type. Send multipart/form-data for files or application/json for URL uploads.",
      },
      {
        status: 415,
      },
    );
  } catch (err) {
    console.error("[gmb media]", err?.message || err)
    return apiError(err);
  }
}