import { AUTO_FLAG_INACCURATE_THRESHOLD } from "@/lib/config/confidence";
import { REPORT_EXPIRY_MINUTES } from "@/lib/config/freshness";
import { getEffectiveTimestamp } from "@/lib/freshness";
import { distanceMeters } from "@/lib/geo";
import type { CommunityAction, FloodReport, ValidationAction } from "@/lib/types";
import { randomUUID } from "crypto";
import type {
  CreateReportInput,
  PendingReportsFilter,
  ReportService,
} from "./types";

/**
 * In-memory dev/mock data provider.
 *
 * Used automatically when no Supabase credentials are configured (see
 * `services/reports/index.ts`). Every seeded record is explicitly marked
 * `isDemoData: true` and the UI must label it "DEMO DATA" — it is never
 * presented as a live community report (spec section 50).
 *
 * State resets whenever the server process restarts; this is intentional
 * for local development and is not a substitute for a real database.
 */
function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function seedReports(): FloodReport[] {
  const now = () => new Date().toISOString();
  const seed: Omit<FloodReport, "createdAt" | "updatedAt">[] = [
    {
      id: "demo-1",
      latitude: 14.6349,
      longitude: 121.0645,
      locationName: "Katipunan Avenue, Quezon City",
      street: "Katipunan Avenue",
      barangay: "Loyola Heights",
      city: "Quezon City",
      province: "Metro Manila",
      floodDepth: "GUTTER_DEEP",
      roadCondition: "PASSABLE_WITH_CAUTION",
      vehicleTypes: ["SEDAN"],
      reportedAt: minutesAgoIso(12),
      reporterName: "Juan",
      anonymous: false,
      status: "VALIDATED",
      confidenceScore: 0.8,
      validationCount: 4,
      denyCount: 0,
      stillFloodedCount: 2,
      noLongerFloodedCount: 0,
      accurateCount: 3,
      inaccurateCount: 0,
      lastConfirmedAt: minutesAgoIso(5),
      isDemoData: true,
    },
    {
      id: "demo-2",
      latitude: 14.6355,
      longitude: 121.0651,
      locationName: "Katipunan Avenue cor. Aurora Blvd, Quezon City",
      street: "Katipunan Avenue",
      barangay: "Loyola Heights",
      city: "Quezon City",
      province: "Metro Manila",
      floodDepth: "BUKONG_BUKONG",
      roadCondition: "DIFFICULT",
      vehicleTypes: ["MOTORCYCLE"],
      reportedAt: minutesAgoIso(25),
      reporterName: null,
      anonymous: true,
      status: "PENDING",
      confidenceScore: 0.5,
      validationCount: 1,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      isDemoData: true,
    },
    {
      id: "demo-3",
      latitude: 14.5764,
      longitude: 121.0851,
      locationName: "EDSA cor. Ortigas Ave, Mandaluyong",
      street: "EDSA",
      barangay: "Wack-Wack",
      city: "Mandaluyong",
      province: "Metro Manila",
      floodDepth: "TUHOD",
      roadCondition: "DIFFICULT",
      vehicleTypes: ["SUV"],
      reportedAt: minutesAgoIso(48),
      reporterName: "Marikit",
      anonymous: false,
      status: "VALIDATED",
      confidenceScore: 0.7,
      validationCount: 3,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      isDemoData: true,
    },
    {
      id: "demo-4",
      latitude: 14.6091,
      longitude: 121.0223,
      locationName: "Commonwealth Avenue, Quezon City",
      street: "Commonwealth Avenue",
      barangay: "Holy Spirit",
      city: "Quezon City",
      province: "Metro Manila",
      floodDepth: "HINDI_MADAANAN",
      roadCondition: "NOT_PASSABLE",
      vehicleTypes: ["MOTORCYCLE"],
      reportedAt: minutesAgoIso(8),
      reporterName: null,
      anonymous: true,
      status: "PENDING",
      confidenceScore: 0.4,
      validationCount: 0,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      isDemoData: true,
    },
    {
      id: "demo-5",
      latitude: 14.5547,
      longitude: 121.0244,
      locationName: "Makati Avenue, Makati",
      street: "Makati Avenue",
      barangay: "Bel-Air",
      city: "Makati",
      province: "Metro Manila",
      floodDepth: "WALANG_BAHA",
      roadCondition: "PASSABLE",
      vehicleTypes: [],
      reportedAt: minutesAgoIso(15),
      reporterName: "Mel",
      anonymous: false,
      status: "VALIDATED",
      confidenceScore: 0.6,
      validationCount: 2,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      isDemoData: true,
    },
    {
      id: "demo-6",
      latitude: 14.6488,
      longitude: 121.0509,
      locationName: "Marikina City Hall, Marikina",
      street: null,
      barangay: "Santo Niño",
      city: "Marikina",
      province: "Metro Manila",
      floodDepth: "BAYWANG",
      roadCondition: "NOT_PASSABLE",
      vehicleTypes: ["TRUCK"],
      reportedAt: minutesAgoIso(300), // stale, should not read as current
      reporterName: null,
      anonymous: true,
      status: "VALIDATED",
      confidenceScore: 0.5,
      validationCount: 2,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      isDemoData: true,
    },
  ];

  return seed.map((r) => ({ ...r, createdAt: now(), updatedAt: now() }));
}

class MockReportProvider implements ReportService {
  private reports: FloodReport[] = seedReports();
  /** `${reportId}:${validatorRef}` pairs that have already voted. */
  private communityVotes = new Set<string>();

  async getNearby(latitude: number, longitude: number, radiusMeters: number): Promise<FloodReport[]> {
    await this.sweepExpired();
    return this.reports
      .filter((r) => r.status !== "DENIED")
      .filter((r) => distanceMeters(latitude, longitude, r.latitude, r.longitude) <= radiusMeters)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  async getById(id: string): Promise<FloodReport | null> {
    return this.reports.find((r) => r.id === id) ?? null;
  }

  async create(input: CreateReportInput): Promise<FloodReport> {
    const now = new Date().toISOString();
    const report: FloodReport = {
      id: randomUUID(),
      ...input,
      status: "PENDING",
      confidenceScore: 0,
      validationCount: 0,
      denyCount: 0,
      stillFloodedCount: 0,
      noLongerFloodedCount: 0,
      accurateCount: 0,
      inaccurateCount: 0,
      lastConfirmedAt: null,
      createdAt: now,
      updatedAt: now,
      isDemoData: false,
    };
    this.reports.unshift(report);
    return report;
  }

  async applyValidation(
    reportId: string,
    action: ValidationAction,
    validatorRef: string
  ): Promise<FloodReport> {
    // Mock provider doesn't persist a validations table; validatorRef is
    // accepted only to satisfy the ReportService interface (the Supabase
    // provider records it in `report_validations`).
    void validatorRef;
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    if (action === "VALIDATE") {
      report.validationCount += 1;
      if (report.validationCount >= 1) report.status = "VALIDATED";
    } else if (action === "DENY") {
      report.denyCount += 1;
      if (report.denyCount >= 1) report.status = "DENIED";
    } else if (action === "FLAG") {
      report.status = "FLAGGED";
    }
    report.updatedAt = new Date().toISOString();
    return report;
  }

  async applyCommunityValidation(
    reportId: string,
    action: CommunityAction,
    validatorRef: string
  ): Promise<FloodReport | null> {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    // One vote per person per report. The Supabase provider enforces this
    // with a unique index; here we keep an in-memory set.
    const key = `${reportId}:${validatorRef}`;
    if (this.communityVotes.has(key)) return null;
    this.communityVotes.add(key);

    const now = new Date().toISOString();
    if (action === "STILL_FLOODED") {
      report.stillFloodedCount += 1;
      // A confirmation is fresh evidence the condition holds — reset the
      // currency clock so the report stops aging out while people keep
      // confirming it.
      report.lastConfirmedAt = now;
    } else if (action === "NO_LONGER_FLOODED") {
      report.noLongerFloodedCount += 1;
    } else if (action === "ACCURATE") {
      report.accurateCount += 1;
    } else if (action === "INACCURATE") {
      report.inaccurateCount += 1;
    }

    // Enough people calling it inaccurate sends it to the moderation
    // queue — it never hides the report outright (see config comment).
    if (
      report.inaccurateCount >= AUTO_FLAG_INACCURATE_THRESHOLD &&
      report.inaccurateCount > report.accurateCount &&
      report.status !== "DENIED"
    ) {
      report.status = "FLAGGED";
    }

    report.updatedAt = now;
    return report;
  }

  async getPending(filter: PendingReportsFilter): Promise<FloodReport[]> {
    await this.sweepExpired();
    let list = this.reports.filter((r) =>
      filter.status ? r.status === filter.status : r.status === "PENDING" || r.status === "FLAGGED"
    );

    if (filter.sort === "newest") {
      list = list.slice().sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
    } else if (filter.sort === "nearest" && filter.near) {
      const { latitude, longitude } = filter.near;
      list = list
        .slice()
        .sort(
          (a, b) =>
            distanceMeters(latitude, longitude, a.latitude, a.longitude) -
            distanceMeters(latitude, longitude, b.latitude, b.longitude)
        );
    } else if (filter.sort === "flagged") {
      list = list.filter((r) => r.status === "FLAGGED");
    } else if (filter.sort === "high_priority") {
      list = list
        .slice()
        .sort((a, b) => {
          const sevA = a.floodDepth === "HINDI_MADAANAN" ? 1 : 0;
          const sevB = b.floodDepth === "HINDI_MADAANAN" ? 1 : 0;
          return sevB - sevA;
        });
    }

    return list.slice(0, filter.limit ?? 50);
  }

  async sweepExpired(): Promise<number> {
    const cutoff = Date.now() - REPORT_EXPIRY_MINUTES * 60_000;
    let count = 0;
    for (const r of this.reports) {
      // Expire against the effective timestamp so a report people keep
      // confirming stays current instead of ageing out underneath them.
      if (r.status !== "EXPIRED" && new Date(getEffectiveTimestamp(r)).getTime() < cutoff) {
        r.status = "EXPIRED";
        count += 1;
      }
    }
    return count;
  }
}

// Singleton so the mock "database" survives across requests within one
// server process (Next.js dev server / a single serverless instance).
declare global {
  var __maybahabaMockProvider: MockReportProvider | undefined;
}

export function getMockReportProvider(): ReportService {
  if (!global.__maybahabaMockProvider) {
    global.__maybahabaMockProvider = new MockReportProvider();
  }
  return global.__maybahabaMockProvider;
}
