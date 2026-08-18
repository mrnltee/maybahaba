import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/admin";
import { reportService } from "@/lib/services/reports";
import { validateActionSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = validateActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const report = await reportService.applyValidation(id, parsed.data.action, "admin");
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Failed to apply validation." }, { status: 500 });
  }
}
