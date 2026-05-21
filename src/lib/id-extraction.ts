export type FaceBox = [number, number, number, number];

export type ExtractedIdData = {
  fullNameEn?: string;
  fullNameTh?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  faceBox?: FaceBox;
  croppedFace?: string | null;
  applicantFaceBox?: FaceBox;
  applicantCroppedFace?: string | null;
};

type FaceBoxRecord = Record<string, unknown>;

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readFaceBoxCoordinates(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length === 4) {
    const parsed = value.map(parseNumericValue);
    return parsed.every((coord): coord is number => coord !== null) ? parsed : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as FaceBoxRecord;
  const yMin = record.ymin ?? record.yMin ?? record.top;
  const xMin = record.xmin ?? record.xMin ?? record.left;
  const yMax = record.ymax ?? record.yMax ?? record.bottom;
  const xMax = record.xmax ?? record.xMax ?? record.right;

  const parsed = [yMin, xMin, yMax, xMax].map(parseNumericValue);
  return parsed.every((coord): coord is number => coord !== null) ? parsed : null;
}

export function normalizeFaceBox(value: unknown): FaceBox | undefined {
  const coordinates = readFaceBoxCoordinates(value);
  if (!coordinates) return undefined;

  const maxCoordinate = Math.max(...coordinates.map((coord) => Math.abs(coord)));
  const normalizedCoordinates =
    maxCoordinate <= 1
      ? coordinates.map((coord) => coord * 100)
      : maxCoordinate <= 100
        ? coordinates
        : maxCoordinate <= 1000
          ? coordinates.map((coord) => coord / 10)
          : null;

  if (!normalizedCoordinates) return undefined;

  const [rawTop, rawLeft, rawBottom, rawRight] = normalizedCoordinates.map((coord) =>
    Number(clampPercentage(coord).toFixed(2))
  );

  const [top, bottom] = rawTop <= rawBottom ? [rawTop, rawBottom] : [rawBottom, rawTop];
  const [left, right] = rawLeft <= rawRight ? [rawLeft, rawRight] : [rawRight, rawLeft];

  if (bottom - top < 1 || right - left < 1) {
    return undefined;
  }

  return [top, left, bottom, right];
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function readFaceBoxCandidate(record: FaceBoxRecord) {
  return (
    record.faceBox ??
    record.face_box ??
    record.faceBounds ??
    record.faceBoundingBox ??
    record.boundingBox ??
    ((record.ymin ?? record.yMin ?? record.top) !== undefined ? record : undefined)
  );
}

export function normalizeExtractedIdData(value: unknown): ExtractedIdData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as FaceBoxRecord;
  const normalized: ExtractedIdData = {};

  const fullNameEn = readOptionalString(record.fullNameEn);
  if (fullNameEn) normalized.fullNameEn = fullNameEn;

  const fullNameTh = readOptionalString(record.fullNameTh);
  if (fullNameTh) normalized.fullNameTh = fullNameTh;

  const dateOfBirth = readOptionalString(record.dateOfBirth);
  if (dateOfBirth) normalized.dateOfBirth = dateOfBirth;

  const gender = readOptionalString(record.gender);
  if (gender) normalized.gender = gender;

  const nationality = readOptionalString(record.nationality);
  if (nationality) normalized.nationality = nationality;

  const address = readOptionalString(record.address);
  if (address) normalized.address = address;

  const faceBox = normalizeFaceBox(readFaceBoxCandidate(record));
  if (faceBox) normalized.faceBox = faceBox;

  const croppedFace = readOptionalString(record.croppedFace);
  if (croppedFace) normalized.croppedFace = croppedFace;

  const applicantFaceBox = normalizeFaceBox(
    record.applicantFaceBox ??
      record.applicant_face_box ??
      record.applicantFaceBounds ??
      record.applicantBoundingBox
  );
  if (applicantFaceBox) normalized.applicantFaceBox = applicantFaceBox;

  const applicantCroppedFace = readOptionalString(
    record.applicantCroppedFace ?? record.croppedApplicantFace
  );
  if (applicantCroppedFace) normalized.applicantCroppedFace = applicantCroppedFace;

  return normalized;
}

export function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return normalized.slice(firstBrace, lastBrace + 1);
  }

  return normalized;
}
