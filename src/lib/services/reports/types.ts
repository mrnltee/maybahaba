import type {
  AreaBounds,
  CommunityAction,
  FloodReport,
  ReportStatus,
  ValidationAction,
} from "@/lib/types";

export interface CreateReportInput {
  latitude: number;
  longitude: number;
  locationName: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  floodDepth: FloodReport["floodDepth"];
  roadCondition: FloodReport["roadCondition"];
  vehicleTypes: FloodReport["vehicleTypes"];
  /** UTC ISO string. */
  reportedAt: string;
  reporterName: string | null;
  anonymous: boolean;
  /**
   * Set when this report answers an earlier one via "Tulungan ang
   * susunod". A follow-up is always a new row — the original reporter's
   * observation was true when they made it, so it is preserved rather
   * than edited.
   */
  followUpTo?: string | null;
}

export interface PendingReportsFilter {
  sort: "newest" | "nearest" | "flagged" | "high_priority";
  status?: ReportStatus;
  near?: { latitude: number; longitude: number };
  limit?: number;
}

/**
 * Abstraction boundary for report storage/retrieval (spec section 31).
 * `MockReportProvider` and `SupabaseReportProvider` both implement this
 * so the rest of the app never touches a database client directly.
 */
export interface ReportService {
  /** Reports within `radiusMeters` of a point, most recent first, excludes DENIED. */
  getNearby(latitude: number, longitude: number, radiusMeters: number): Promise<FloodReport[]>;
  /**
   * Every report inside a geographic envelope — used for city/barangay/
   * province searches. Geographic rather than name-matched so a geocoder
   * name variant can never silently hide reports.
   */
  getInArea(bounds: AreaBounds, limit?: number): Promise<FloodReport[]>;
  getById(id: string): Promise<FloodReport | null>;
  create(input: CreateReportInput): Promise<FloodReport>;
  applyValidation(
    reportId: string,
    action: ValidationAction,
    validatorRef: string
  ): Promise<FloodReport>;
  /**
   * Records a public, account-free community confirmation.
   * Returns the updated report, or null if `validatorRef` has already
   * acted on this report (one vote per person per report).
   */
  applyCommunityValidation(
    reportId: string,
    action: CommunityAction,
    validatorRef: string
  ): Promise<FloodReport | null>;
  getPending(filter: PendingReportsFilter): Promise<FloodReport[]>;
  /**
   * Every report regardless of status — moderator view only.
   * Unlike the public queries this deliberately includes DENIED and
   * EXPIRED rows, since the whole point of the admin table is to see
   * what was filed and what happened to it.
   */
  getAllForAdmin(limit?: number): Promise<FloodReport[]>;
  /** Marks reports older than the expiry window as EXPIRED. Safe to call often; idempotent. */
  sweepExpired(): Promise<number>;
}

export class ReportServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ReportServiceError";
  }
}
