export { predictEstimateInputs } from "./predict";
export type {
  EstimatorDataSource,
  MoveSizeStatRow,
  MaterialPatternRow,
  ValuationPatternRow,
  DrivewayFlags,
} from "./predict";
export { composeLongDistance } from "./long-distance";
export type { LongDistanceInputs, LongDistanceComposition } from "./long-distance";
export { checkMargin } from "./margin";
export type { MarginPolicy } from "./margin";
export { computeInventoryTotals, ITEM_CU_FT_DEFAULTS } from "./inventory";
export { seasonForDate } from "./season";
export { distanceBucket, GoogleDistanceMatrix, haversineMiles } from "./distance";
export type { DistanceProvider, DistanceLookup } from "./distance";
export {
  moveCategorySchema,
  pricingModeSchema,
  seasonSchema,
  distanceBucketSchema,
  hourlyRateForCrew,
} from "./types";
export type {
  MoveCategory,
  PricingMode,
  Season,
  DistanceBucket,
  PredictInputs,
  PredictionResult,
  InventoryItem,
  InventoryTotals,
  LineItem,
  MaterialRecommendation,
  MarginResult,
  BranchConfig,
} from "./types";

export { detectBulkyAdditives, bulkyLineItems, totalWeightAdditive } from "./bulky-additives";
export type { BulkyMatch } from "./bulky-additives";
export { composeAccessFees } from "./access-fees";
export type { AccessInputs } from "./access-fees";
export { extractInventoryFromTranscript } from "./transcript-to-inventory";
export type { TranscriptExtractionResult } from "./transcript-to-inventory";
export { analyzeDrivewayFromStreetView } from "./driveway-vision";
export type { DrivewayVisionResult } from "./driveway-vision";

export * as Tariff15C from "./tariff-15c";
export {
  TARIFF_VERSION,
  TARIFF_EFFECTIVE_DATE,
  LONG_DISTANCE_THRESHOLD_MILES,
  CONSTRUCTIVE_LB_PER_CU_FT,
  VALUATION,
  SUPPLEMENTAL_CLAUSE_TEXT,
  MILEAGE_RATES,
  MATERIAL_PRICES_LOCAL,
  MATERIAL_PRICES_LONG_DISTANCE,
  ACCESS_CHARGES_PER_100LB,
  PIANO_CHARGES,
  ADDITIONAL_STOP_FEE,
  OVERTIME_CHARGES,
  NONBINDING_LIMITS,
  lookupLinehaul,
  weightBracket,
} from "./tariff-15c";
export type {
  LinehaulRateRange,
  WeightBracket,
  MaterialSku,
  MaterialPrice,
} from "./tariff-15c";
