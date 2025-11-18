import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (token === process.env.ADMIN_SECRET_TOKEN) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

