/**
 * Core domain types for MayBahaBa.
 *
 * These types are shared by every layer of the app (services, API routes,
 * UI). Keeping them in one place means the mock provider and the Supabase
 * provider are guaranteed to speak the same shape.
 */

/** Filipino-friendly flood depth classification (spec section 8). */
export type FloodDepthCode =
  | "WALANG_BAHA"
  | "GUTTER_DEEP"
  | "BUKONG_BUKONG"
  | "BINTI"
  | "TUHOD"
  | "HITA"
  | "BAYWANG"
  | "HINDI_MADAANAN";

export interface FloodDepthOption {
  code: FloodDepthCode;
  /** Short label shown as the primary answer, e.g. "Gutter Deep". */
  label: string;
  /** Plain-language Filipino/Taglish explanation shown under the label. */
  description: string;
  /** Ordinal severity used for sorting/comparison. Higher = worse. */
  severity: number;
  /** Approximate centimeter range for future precise measurement support. Not shown to users by default. */
  approxCm: [number, number] | null;
}

/** Ordered worst-to-least is NOT assumed; use `severity` for ordering. */
export const FLOOD_DEPTH_OPTIONS: FloodDepthOption[] = [
  {
    code: "WALANG_BAHA",
    label: "Walang Baha",
    description: "Walang nakikitang baha sa lugar na ito.",
    severity: 0,
    approxCm: [0, 0],
  },
  {
    code: "GUTTER_DEEP",
    label: "Gutter Deep",
    description: "Tubig hanggang gutter o ilalim ng gulong.",
    severity: 1,
    approxCm: [1, 10],
  },
  {
    code: "BUKONG_BUKONG",
    label: "Bukong-bukong",
    description: "Tubig hanggang bukong-bukong (ankle level).",
    severity: 2,
    approxCm: [10, 15],
  },
  {
    code: "BINTI",
    label: "Binti",
    description: "Tubig hanggang lower leg/shin.",
    severity: 3,
    approxCm: [15, 30],
  },
  {
    code: "TUHOD",
    label: "Tuhod",
    description: "Tubig hanggang tuhod (knee level).",
    severity: 4,
    approxCm: [30, 50],
  },
  {
    code: "HITA",
    label: "Hita",
    description: "Tubig hanggang hita (thigh level).",
    severity: 5,
    approxCm: [50, 70],
  },
  {
    code: "BAYWANG",
    label: "Baywang",
    description: "Tubig hanggang baywang (waist level).",
    severity: 6,
    approxCm: [70, 100],
  },
  {
    code: "HINDI_MADAANAN",
    label: "Hindi Madaanan",
    description: "Hindi na madaanan ang kalsada. Iwasan ang rutang ito.",
    severity: 7,
    approxCm: [100, null as unknown as number],
  },
];

export function getFloodDepthOption(code: FloodDepthCode): FloodDepthOption {
  const found = FLOOD_DEPTH_OPTIONS.find((o) => o.code === code);
  if (!found) throw new Error(`Unknown flood depth code: ${code}`);
  return found;
}

export type RoadConditionCode =
  | "PASSABLE"
  | "PASSABLE_WITH_CAUTION"
  | "DIFFICULT"
  | "NOT_PASSABLE";

/**
 * All four values remain valid so reports already in the database keep
 * rendering. The form, however, now offers a single yes/no tick — in
 * practice reporters could not reliably tell "with caution" from
 * "difficult", and a binary they answer honestly beats a scale they
 * guess at. `ROAD_CONDITION_LABELS` covers display of legacy values.
 */
export const ROAD_CONDITION_LABELS: Record<RoadConditionCode, string> = {
  PASSABLE: "Madaanan",
  PASSABLE_WITH_CAUTION: "Madaanan nang may ingat",
  DIFFICULT: "Mahirap daanan",
  NOT_PASSABLE: "Hindi madaanan",
};

export const ROAD_CONDITION_OPTIONS: { code: RoadConditionCode; label: string }[] = (
  ["PASSABLE", "PASSABLE_WITH_CAUTION", "DIFFICULT", "NOT_PASSABLE"] as RoadConditionCode[]
).map((code) => ({ code, label: ROAD_CONDITION_LABELS[code] }));

export type VehicleTypeCode =
  | "MOTORCYCLE"
  | "SEDAN"
  | "SUV"
  | "TRUCK"
  | "JEEPNEY"
  | "OTHER";

export const VEHICLE_TYPE_OPTIONS: { code: VehicleTypeCode; label: string }[] = [
  { code: "MOTORCYCLE", label: "Motorcycle" },
  { code: "SEDAN", label: "Sedan" },
  { code: "SUV", label: "SUV" },
  { code: "TRUCK", label: "Truck" },
  { code: "JEEPNEY", label: "Jeepney" },
  { code: "OTHER", label: "Other" },
];

/** Lifecycle status of a report (spec section 15 / 22). */
export type ReportStatus =
  | "PENDING"
  | "VALIDATED"
  | "DENIED"
  | "EXPIRED"
  | "FLAGGED";

/** A single crowdsourced flood report. */
export interface FloodReport {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  floodDepth: FloodDepthCode;
  roadCondition: RoadConditionCode | null;
  /**
   * Vehicle types the reporter saw affected. Multi-select: a flooded
   * street rarely affects exactly one class of vehicle, and "passable for
   * an SUV, not for a sedan" is the distinction motorists actually need.
   */
  vehicleTypes: VehicleTypeCode[];
  /** When the flooding was actually observed (UTC ISO string). */
  reportedAt: string;
  reporterName: string | null;
  anonymous: boolean;
  status: ReportStatus;
  /** 0-1 internal confidence score. Never shown raw to end users. */
  confidenceScore: number;
  /** Moderator validate/deny tallies. */
  validationCount: number;
  denyCount: number;
  /** Community currency confirmations — "is it still flooded?" */
  stillFloodedCount: number;
  noLongerFloodedCount: number;
  /** Community accuracy confirmations — "was this report right?" */
  accurateCount: number;
  inaccurateCount: number;
  /**
   * When the community last confirmed this report is STILL happening.
   * Used to compute effective freshness — a confirmed report stays
   * "current" without anyone having to file a duplicate. Null if never
   * confirmed.
   */
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * True only for seed/demo records used in local development.
   * Must always be surfaced in the UI as "DEMO DATA" — never presented
   * as a live community report (spec section 50).
   */
  isDemoData: boolean;
}

/** Moderator-only actions, taken from /admin/validate. */
export type ValidationAction = "VALIDATE" | "DENY" | "FLAG";

/**
 * Public, account-free community validation actions (spec section 16).
 *
 * Two independent questions, deliberately kept separate because they
 * mean different things:
 *  - currency  — STILL_FLOODED / NO_LONGER_FLOODED: is this happening NOW?
 *  - accuracy  — ACCURATE / INACCURATE: was this report truthful at all?
 *
 * A report can be accurate but stale ("it was knee-deep an hour ago, it
 * has since drained"), so collapsing these into one control would lose
 * information a motorist needs.
 */
export type CommunityAction =
  | "STILL_FLOODED"
  | "NO_LONGER_FLOODED"
  | "ACCURATE"
  | "INACCURATE";

export const CURRENCY_ACTIONS: CommunityAction[] = ["STILL_FLOODED", "NO_LONGER_FLOODED"];
export const ACCURACY_ACTIONS: CommunityAction[] = ["ACCURATE", "INACCURATE"];

export interface ReportValidationEntry {
  id: string;
  reportId: string;
  /** Hashed/anonymous identifier — never a raw IP or account id. */
  validatorRef: string;
  action: ValidationAction | CommunityAction;
  createdAt: string;
}

/** Human-facing confidence tier (spec section 16 / 34). Raw formula is never exposed. */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  agreeingReportCount: number;
}

/** Freshness tier of a report relative to now (spec section 17). */
export type FreshnessLevel =
  | "VERY_RECENT"
  | "RECENT"
  | "AGING"
  | "STALE"
  | "EXPIRED";

export interface FreshnessResult {
  level: FreshnessLevel;
  minutesAgo: number;
  label: string;
}

/**
 * Overall status the UI answers "May baha ba?" with. Deliberately richer
 * than a flooded/not-flooded boolean (spec section 7) so the UI can be
 * conservative about absence of data.
 */
export type MayBahaStatus =
  | "NO_RECENT_REPORT"
  | "NO_FLOOD_REPORTED"
  | "FLOODED"
  | "SEVERE_FLOODING"
  | "ROAD_IMPASSABLE"
  | "UNKNOWN_STALE";

export interface LocationResult {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  /** Rough relevance category used for client-side ranking bias. */
  kind: "street" | "address" | "barangay" | "city" | "province" | "landmark" | "other";
  /**
   * Geographic extent, present for administrative places (barangay, city,
   * province). Its presence is what makes an "area search" possible.
   *
   * Deliberately geographic rather than matching reports on a `city` text
   * field: geocoders return name variants ("Quezon City" / "Lungsod
   * Quezon"), and a name mismatch would silently drop flood reports —
   * the most dangerous way this app could fail.
   */
  boundingBox?: AreaBounds | null;
}

/** South-west / north-east corners, as returned by the geocoder. */
export interface AreaBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** Administrative kinds worth answering with an area summary rather than one card. */
export const AREA_KINDS = ["barangay", "city", "province"] as const;

export function isAreaSearch(location: {
  kind: LocationResult["kind"];
  boundingBox?: AreaBounds | null;
}): boolean {
  return Boolean(
    location.boundingBox && (AREA_KINDS as readonly string[]).includes(location.kind)
  );
}

/** Aggregate answer for a whole area — never a single condition claim. */
export interface AreaSearchResult {
  bounds: AreaBounds;
  label: string;
  totalReports: number;
  impassableCount: number;
  severeCount: number;
  reports: FloodReport[];
}

export interface NearbySearchResult {
  center: { latitude: number; longitude: number; label: string };
  status: MayBahaStatus;
  topReport: FloodReport | null;
  confidence: ConfidenceResult;
  freshness: FreshnessResult | null;
  nearbyReports: FloodReport[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  /** 0-1 likelihood this new report duplicates an existing one. */
  duplicateConfidence: number;
  existingReport: FloodReport | null;
  reason: string;
}
