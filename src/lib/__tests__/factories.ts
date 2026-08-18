import type { FloodReport } from "../types";

interface Overrides extends Partial<FloodReport> {
  /** Convenience: sets reportedAt this many minutes in the past. */
  minutesAgo?: number;
  /** Convenience: sets lastConfirmedAt this many minutes in the past. */
  confirmedMinutesAgo?: number;
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Builds a FloodReport with sane defaults so tests state only what they care about. */
export function makeReport(overrides: Overrides = {}): FloodReport {
  const { minutesAgo = 5, confirmedMinutesAgo, ...rest } = overrides;

  return {
    id: "test-report",
    latitude: 14.6349,
    longitude: 121.0645,
    locationName: "Katipunan Avenue, Quezon City",
    street: "Katipunan Avenue",
    barangay: "Loyola Heights",
    city: "Quezon City",
    province: "Metro Manila",
    floodDepth: "GUTTER_DEEP",
    roadCondition: null,
    vehicleType: null,
    reportedAt: minutesAgoIso(minutesAgo),
    reporterName: null,
    anonymous: true,
    status: "PENDING",
    confidenceScore: 0,
    validationCount: 0,
    denyCount: 0,
    stillFloodedCount: 0,
    noLongerFloodedCount: 0,
    accurateCount: 0,
    inaccurateCount: 0,
    lastConfirmedAt: confirmedMinutesAgo === undefined ? null : minutesAgoIso(confirmedMinutesAgo),
    createdAt: minutesAgoIso(minutesAgo),
    updatedAt: minutesAgoIso(minutesAgo),
    isDemoData: false,
    ...rest,
  };
}
