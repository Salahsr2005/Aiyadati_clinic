export type UploadType = "IMAGE" | "DOCUMENT" | "LOGO";

export const UPLOAD_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  LOGO: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 20 * 1024 * 1024, // 20MB
};

export const ALLOWED_MIME_TYPES: Record<UploadType, string[]> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  LOGO: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  DOCUMENT: ["application/pdf", "image/jpeg", "image/png"],
};

export function validateUploadFile(file: File, type: UploadType): { valid: boolean; error?: string } {
  const allowedTypes = ALLOWED_MIME_TYPES[type];
  const maxSize = UPLOAD_LIMITS[type];

  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format (${file.type || "unknown"}). Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB.`,
    };
  }

  return { valid: true };
}

export function buildUploadFormData(
  fieldName: "image" | "document" | "logo" | string,
  file: File,
  extraFields?: Record<string, string>
): FormData {
  const formData = new FormData();
  formData.append(fieldName, file);
  if (fieldName !== "file") {
    formData.append("file", file);
  }
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        formData.append(key, val);
      }
    });
  }
  return formData;
}
