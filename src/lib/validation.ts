import { z } from "zod";

const floodDepthEnum = z.enum([
  "WALANG_BAHA",
  "GUTTER_DEEP",
  "BUKONG_BUKONG",
  "BINTI",
  "TUHOD",
  "HITA",
  "BAYWANG",
  "HINDI_MADAANAN",
]);

const roadConditionEnum = z.enum([
  "PASSABLE",
  "PASSABLE_WITH_CAUTION",
  "DIFFICULT",
  "NOT_PASSABLE",
]);

const vehicleTypeEnum = z.enum(["MOTORCYCLE", "SEDAN", "SUV", "TRUCK", "JEEPNEY", "OTHER"]);

/**
 * Server-side validation for report submission. The client also
 * validates for UX, but per spec section 46 ("never trust client-side
 * validation alone") this is the source of truth.
 */
export const createReportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().trim().min(1).max(200),
  street: z.string().trim().max(120).nullable().optional(),
  barangay: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(120).nullable().optional(),
  floodDepth: floodDepthEnum,
  roadCondition: roadConditionEnum.nullable().optional(),
  // Multi-select; capped so a request cannot carry an unbounded array.
  vehicleTypes: z.array(vehicleTypeEnum).max(6).optional(),
  reportedAt: z.string().datetime({ offset: true }),
  reporterName: z.string().trim().max(60).nullable().optional(),
  anonymous: z.boolean(),
  // Client can acknowledge an existing duplicate-warning and submit anyway.
  acknowledgedDuplicateId: z.string().nullable().optional(),
});

export type CreateReportBody = z.infer<typeof createReportSchema>;

export const validateActionSchema = z.object({
  action: z.enum(["VALIDATE", "DENY", "FLAG"]),
});

/** Public community confirmation — see CommunityAction in lib/types.ts. */
export const communityActionSchema = z.object({
  action: z.enum(["STILL_FLOODED", "NO_LONGER_FLOODED", "ACCURATE", "INACCURATE"]),
  /**
   * Opaque per-browser identifier generated client-side. Combined with a
   * server-side hash so a user can't vote twice from one browser, while
   * still requiring no account. Not a tracking identifier — it is only
   * ever stored hashed, alongside a report id.
   */
  deviceId: z.string().trim().min(8).max(64),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(5000).optional(),
});
