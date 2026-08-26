import { REPORT_EXPIRY_MINUTES } from "@/lib/config/freshness";
import { supabaseAdmin, supabasePublic } from "@/lib/supabaseClient";
import type { AreaBounds, CommunityAction, FloodReport, ValidationAction, VehicleTypeCode } from "@/lib/types";
import type { CreateReportInput, PendingReportsFilter, ReportService } from "./types";
import { ReportServiceError } from "./types";

/**
 * PostgreSQL + PostGIS via Supabase (spec section 21/22).
 *
 * Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * (and `SUPABASE_SERVICE_ROLE_KEY` for moderation actions) to be set —
 * see .env.example and supabase/migrations/. Free tier is sufficient for
 * MVP traffic levels.
 */

interface ReportRow {
  id: string;
  latitude: number;
  longitude: number;
  location_name: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  flood_depth: FloodReport["floodDepth"];
  road_condition: FloodReport["roadCondition"];
  vehicle_type: VehicleTypeCode | null;
  vehicle_types: VehicleTypeCode[] | null;
  follow_up_to: string | null;
  reported_at: string;
  reporter_name: string | null;
  anonymous: boolean;
  status: FloodReport["status"];
  confidence_score: number;
  validation_count: number;
  deny_count: number;
  still_flooded_count: number;
  no_longer_flooded_count: number;
  accurate_count: number;
  inaccurate_count: number;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReport(row: ReportRow): FloodReport {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name,
    street: row.street,
    barangay: row.barangay,
    city: row.city,
    province: row.province,
    floodDepth: row.flood_depth,
    roadCondition: row.road_condition,
    // Prefer the array column; fall back to the legacy single value so
    // pre-migration rows still render (see migration 0005).
    vehicleTypes: row.vehicle_types ?? (row.vehicle_type ? [row.vehicle_type] : []),
    followUpTo: row.follow_up_to ?? null,
    reportedAt: row.reported_at,
    reporterName: row.reporter_name,
    anonymous: row.anonymous,
    status: row.status,
    confidenceScore: row.confidence_score,
    validationCount: row.validation_count,
    denyCount: row.deny_count,
    stillFloodedCount: row.still_flooded_count ?? 0,
    noLongerFloodedCount: row.no_longer_flooded_count ?? 0,
    accurateCount: row.accurate_count ?? 0,
    inaccurateCount: row.inaccurate_count ?? 0,
    lastConfirmedAt: row.last_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDemoData: false,
  };
}

export class SupabaseReportProvider implements ReportService {
  async getNearby(latitude: number, longitude: number, radiusMeters: number): Promise<FloodReport[]> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");
    const { data, error } = await supabasePublic.rpc("nearby_reports", {
      center_lat: latitude,
      center_lng: longitude,
      radius_m: radiusMeters,
    });
    if (error) throw new ReportServiceError("Failed to fetch nearby reports", error);
    return (data as ReportRow[]).map(rowToReport);
  }

  async getInArea(bounds: AreaBounds, limit = 200): Promise<FloodReport[]> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");
    const { data, error } = await supabasePublic.rpc("reports_in_area", {
      min_lat: bounds.minLat,
      min_lon: bounds.minLon,
      max_lat: bounds.maxLat,
      max_lon: bounds.maxLon,
      max_rows: limit,
    });
    if (error) throw new ReportServiceError("Failed to fetch reports in area", error);
    return (data as ReportRow[]).map(rowToReport);
  }

  async getById(id: string): Promise<FloodReport | null> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");
    const { data, error } = await supabasePublic.from("reports").select("*").eq("id", id).maybeSingle();
    if (error) throw new ReportServiceError("Failed to fetch report", error);
    return data ? rowToReport(data as ReportRow) : null;
  }

  async create(input: CreateReportInput): Promise<FloodReport> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");
    const { data, error } = await supabasePublic
      .from("reports")
      .insert({
        latitude: input.latitude,
        longitude: input.longitude,
        location_name: input.locationName,
        street: input.street,
        barangay: input.barangay,
        city: input.city,
        province: input.province,
        flood_depth: input.floodDepth,
        road_condition: input.roadCondition,
        vehicle_types: input.vehicleTypes,
        follow_up_to: input.followUpTo ?? null,
        reported_at: input.reportedAt,
        reporter_name: input.reporterName,
        anonymous: input.anonymous,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error) throw new ReportServiceError("Failed to create report", error);
    return rowToReport(data as ReportRow);
  }

  async applyValidation(
    reportId: string,
    action: ValidationAction,
    validatorRef: string
  ): Promise<FloodReport> {
    const client = supabaseAdmin ?? supabasePublic;
    if (!client) throw new ReportServiceError("Supabase is not configured");

    const { error: insertError } = await client.from("report_validations").insert({
      report_id: reportId,
      validator_ref: validatorRef,
      action,
    });
    if (insertError) throw new ReportServiceError("Failed to record validation", insertError);

    const { data, error } = await client.rpc("apply_report_validation", {
      p_report_id: reportId,
      p_action: action,
    });
    if (error) throw new ReportServiceError("Failed to apply validation", error);
    return rowToReport(data as ReportRow);
  }

  async applyCommunityValidation(
    reportId: string,
    action: CommunityAction,
    validatorRef: string
  ): Promise<FloodReport | null> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");

    // The RPC records the vote and updates the counters in one atomic,
    // SECURITY DEFINER call (see migration 0003). Doing the dedupe insert
    // here instead would be bypassable: the anon key is public, so anyone
    // could call the counter-bump RPC directly in a loop. It returns null
    // when this validator_ref has already voted on this report.
    const { data, error } = await supabasePublic.rpc("apply_community_validation", {
      p_report_id: reportId,
      p_action: action,
      p_validator_ref: validatorRef,
    });
    if (error) throw new ReportServiceError("Failed to apply confirmation", error);
    if (!data) return null;
    return rowToReport(data as ReportRow);
  }

  async getPending(filter: PendingReportsFilter): Promise<FloodReport[]> {
    if (!supabasePublic) throw new ReportServiceError("Supabase is not configured");
    let query = supabasePublic
      .from("reports")
      .select("*")
      .in("status", filter.status ? [filter.status] : ["PENDING", "FLAGGED"])
      .limit(filter.limit ?? 50);

    if (filter.sort === "newest") {
      query = query.order("reported_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw new ReportServiceError("Failed to fetch pending reports", error);
    return (data as ReportRow[]).map(rowToReport);
  }

  async getAllForAdmin(limit = 1000): Promise<FloodReport[]> {
    // Uses the service-role client so RLS doesn't hide DENIED rows —
    // this path is already gated behind a moderator session upstream.
    const client = supabaseAdmin ?? supabasePublic;
    if (!client) throw new ReportServiceError("Supabase is not configured");
    const { data, error } = await client
      .from("reports")
      .select("*")
      .order("reported_at", { ascending: false })
      .limit(limit);
    if (error) throw new ReportServiceError("Failed to fetch reports", error);
    return (data as ReportRow[]).map(rowToReport);
  }

  async sweepExpired(): Promise<number> {
    const client = supabaseAdmin ?? supabasePublic;
    if (!client) throw new ReportServiceError("Supabase is not configured");
    // Done in SQL rather than here because expiry must compare against
    // COALESCE(last_confirmed_at, reported_at) — a report the community
    // keeps confirming should not age out. See migration 0003.
    const { data, error } = await client.rpc("sweep_expired_reports", {
      expiry_minutes: REPORT_EXPIRY_MINUTES,
    });
    if (error) throw new ReportServiceError("Failed to sweep expired reports", error);
    return (data as number) ?? 0;
  }
}
