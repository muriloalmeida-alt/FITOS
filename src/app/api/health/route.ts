import { NextResponse } from "next/server";
import { appEnv, appName } from "@/shared/config/env";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: appName,
    env: appEnv,
    timestamp: new Date().toISOString(),
  });
}
