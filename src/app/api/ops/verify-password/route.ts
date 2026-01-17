import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ops/verify-password
 * Verifies the ops password against the OPS_PWD environment variable
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { valid: false, error: "Password is required" },
        { status: 400 }
      );
    }

    const opsPassword = process.env.OPS_PWD;

    if (!opsPassword) {
      console.error("OPS_PWD environment variable is not set");
      return NextResponse.json(
        { valid: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const isValid = password === opsPassword;

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error("Error verifying ops password:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
