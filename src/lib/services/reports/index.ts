import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { getMockReportProvider } from "./mockProvider";
import { SupabaseReportProvider } from "./supabaseProvider";
import type { ReportService } from "./types";

export type {
  CreateReportInput,
  PendingReportsFilter,
  ReportService,
} from "./types";
export { ReportServiceError } from "./types";

/**
 * Provider selection point (spec section 31). Real Supabase/PostGIS is
 * used automatically once `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; otherwise the app runs on the
 * in-memory mock provider seeded with clearly-labeled DEMO DATA so the
 * whole product can be evaluated with zero setup.
 */
function createReportService(): ReportService {
  if (isSupabaseConfigured) return new SupabaseReportProvider();
  return getMockReportProvider();
}

export const reportService = createReportService();

/** Whether the active provider is the local mock (used to show "DEMO DATA" banners). */
export const isUsingMockData = !isSupabaseConfigured;
