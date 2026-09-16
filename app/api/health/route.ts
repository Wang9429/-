import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      name: "cnooc-eng-penetrating-supervision-demo",
      version: "1.6.1",
      runtime: "standalone",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
