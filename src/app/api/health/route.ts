import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
