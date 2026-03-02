import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  return NextResponse.json({
    db_url_length: url.length,
    db_url_prefix: url.slice(0, 20),
    db_url_set: url.length > 0,
  });
}
