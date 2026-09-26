import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STORAGE_DIR = process.env.IMAGE_STORAGE_DIR || path.join(process.cwd(), "storage", "images");

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

/** Serves generated post images from disk. Filenames only - no paths. */
export async function GET(_request, { params }) {
  const { file } = await params;
  const name = path.basename(String(file || ""));
  if (!name || name !== file || name.includes("..")) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const ext = name.split(".").pop().toLowerCase();
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ STORAGE_DIR, name));
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
