import { createHash, timingSafeEqual } from "crypto";
import { existsSync, readFileSync } from "fs";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const META_PATH = "/tmp/cnooc-src-export/meta.json";
const FILENAME = "cnooc-eng-supervision-demo-v1.6.1-src.zip";

type Meta = {
  token: string;
  expiresAtMs: number;
  filePath: string;
};

function noStore(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    ...extra,
  };
}

function tokenMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  // 正式部署默认关闭。该接口仅供 Agent 导出源码包，访客页面不使用。
  if (process.env.ENABLE_SOURCE_PACKAGE !== "1") {
    return new NextResponse("Not found", { status: 404, headers: noStore() });
  }

  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!existsSync(META_PATH)) {
    return new NextResponse("Not found", { status: 404, headers: noStore() });
  }

  let meta: Meta;
  try {
    meta = JSON.parse(readFileSync(META_PATH, "utf8")) as Meta;
  } catch {
    return new NextResponse("Not found", { status: 404, headers: noStore() });
  }

  if (!tokenMatches(token, meta.token)) {
    return new NextResponse("Forbidden", { status: 403, headers: noStore() });
  }
  if (Date.now() > meta.expiresAtMs) {
    return new NextResponse("Gone", { status: 410, headers: noStore() });
  }
  if (!meta.filePath || !existsSync(meta.filePath)) {
    return new NextResponse("Not found", { status: 404, headers: noStore() });
  }

  const body = readFileSync(meta.filePath);
  return new NextResponse(body, {
    status: 200,
    headers: noStore({
      "Content-Type": "application/zip",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${FILENAME}"`,
    }),
  });
}
