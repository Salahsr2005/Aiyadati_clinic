# Clinic Management API — Full Endpoint Reference

Source: `iyadati-main/backend/src/modules/clinic/**` and
`iyadati-main/backend/src/modules/clinic-service/**` (verified against
`.routes.ts`, `.controller.ts`, `.service.ts`, `.types.ts`, `.validation.ts`, and
`prisma/schema.prisma` — not just the Swagger comments).

Base URL prefixes (from `app.ts` + each module's inner router):
- **Clinic module:** `/api/v1/clinic/v1`
- **Clinic-Service module:** `/api/v1/clinic-services/v1`

All examples below use these full prefixes.

---

## 0. Conventions used by every endpoint

### 0.1 Auth
- `authenticate` → requires `Authorization: Bearer <JWT>`.
- `authorize('ROLE', ...)` → the JWT's role must be one of the listed roles.
- Roles seen in this API: `CLINIC` (the clinic's own account, "self-service"), `SUPER_ADMIN`,
  `ADMIN` (platform staff, "staff routes"). A few routes are public (no auth).

### 0.2 Response envelope
Every response goes through `ResponseUtil` (`core/utils/response.ts`), so the JSON body is
always shaped one of these three ways:

**Single resource / action (`ResponseUtil.success` / `.created`):**
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { /* resource or null */ },
  "meta": { "timestamp": "2026-08-19T10:00:00.000Z", "requestId": "..." }
}
```
`created` is identical but with HTTP status `201`.

**Paginated list (`ResponseUtil.paginated`) — only `GET /` (findAll clinics) and public
service search use this:**
```json
{
  "success": true,
  "message": "Clinics retrieved successfully",
  "data": [ /* array of resources */ ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "timestamp": "2026-08-19T10:00:00.000Z",
    "requestId": "..."
  }
}
```

**Error (`ResponseUtil.error` and its shortcuts):**
```json
{
  "success": false,
  "message": "Description of the error",
  "error": "Description of the error",
  "errors": [ { "field": "email", "message": "Valid email is required" } ],
  "meta": { "timestamp": "..." }
}
```

| Error helper | HTTP status | Used for |
|---|---|---|
| `badRequest` | 400 | Generic bad input (e.g. missing file) |
| `unauthorized` | 401 | Missing/invalid JWT |
| `forbidden` | 403 | Wrong ownership (e.g. deleting another clinic's image) |
| `notFound` | 404 | Resource doesn't exist |
| `conflict` | 409 | Duplicate email/phone, duplicate invite, etc. |
| `validationError` | 422 | Joi schema failure — `errors[]` has one entry per invalid field |

### 0.3 File uploads
Three upload middlewares are used across these modules — all multipart/form-data, single file,
field name as shown:

| Middleware | Form field name | Max size | Allowed MIME types |
|---|---|---|---|
| `uploadLogo` | `logo` | 2 MB | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` |
| `uploadGalleryImage` / `uploadServiceImage` | `image` | 5 MB | same as above |
| `uploadClinicDocument` | `document` | 20 MB | `application/pdf`, `image/jpeg`, `image/png` |

---

# PART A — Clinic Module (`/api/v1/clinic/v1`)

## A.1 Clinic Self-Service Routes (JWT role: `CLINIC`)

> These act on the clinic identified by the JWT itself (`req.user!.id`) — no `:id` param.

### `GET /me/profile`
Returns the authenticated clinic's own profile.
**Response `data`:** `ClinicResponse` (see §A.4.1).

### `PATCH /me/complete`
Completes the clinic's profile after verification. `multipart/form-data`, optional `logo` file field.

**Request body fields (all optional — `completeClinicSchema`):**
| Field | Type | Rule |
|---|---|---|
| `descriptionAr` | string | max 1000, nullable/empty allowed |
| `descriptionFr` | string | max 1000, nullable/empty allowed |
| `baladyaId` | string (UUID) | nullable/empty allowed |
| `latitude` | number | -90..90, nullable |
| `longitude` | number | -180..180, nullable |

**Business rules:** 400 if clinic not yet verified (`isVerified === false`); 400 if already
completed (`isCompleted === true`).
**Response `data`:** `ClinicResponse`.

### `GET /me/documents`
List the clinic's own documents. **Response `data`:** `ClinicDocumentResponse[]` (§A.4.2).

### `POST /me/documents`
Upload a document. `multipart/form-data`, field `document` (required, else `400 Bad request`).
**Response `data`:** `ClinicDocumentResponse` (HTTP 201).

### `DELETE /me/documents/:id`
Deletes one of the clinic's own documents (`:id` = document id). Removes the underlying file too.
**Response `data`:** `null`.

### `GET /me/working-hours`
**Response `data`:** `WorkingHoursResponse[]` (§A.4.3), one entry per day that has been set.

### `POST /me/working-hours`
**Request body:**
```json
{ "hours": [ { "dayOfWeek": "MONDAY", "openTime": "08:00", "closeTime": "17:00", "isOpen": true } ] }
```
`hours` is a required array (min 1 item, `workingHoursSchema`). Per item:
| Field | Type | Rule |
|---|---|---|
| `dayOfWeek` | enum | `SUNDAY`\|`MONDAY`\|`TUESDAY`\|`WEDNESDAY`\|`THURSDAY`\|`FRIDAY`\|`SATURDAY`, required |
| `openTime` | string | `HH:mm` 24h, required |
| `closeTime` | string | `HH:mm` 24h, required |
| `isOpen` | boolean | required |

Upserted per `(clinicId, dayOfWeek)` — posting again for the same day overwrites it.
**Response `data`:** `WorkingHoursResponse[]` (only the days just submitted).

### `GET /me/rooms`
**Response `data`:** `RoomResponse[]` (§A.4.4).

### `POST /me/rooms`
**Request body (`createRoomSchema`):**
| Field | Type | Rule |
|---|---|---|
| `name` | string | required, 2–100 chars |
| `specialtyId` | string (UUID) | optional, nullable |

**Response `data`:** `RoomResponse` (HTTP 201).

### `POST /me/doctors/invite`
Clinic invites a doctor to join. **Request body (`inviteDoctorSchema`):**
| Field | Type | Rule |
|---|---|---|
| `doctorId` | string (UUID) | required |

**Business rules:** `404` if doctor doesn't exist; `400` if an invite is already `PENDING`;
`400` if doctor already `ACCEPTED` and active in this clinic.
**Response `data`:** `ClinicDoctorResponse` without the nested `doctor`/`clinic` objects (HTTP 201).

### `GET /me/doctors`
**Response `data`:** `ClinicDoctorResponse[]` (§A.4.5), each including the nested `doctor` object.

### `POST /me/doctors/:id/accept` and `POST /me/doctors/:id/reject`
`:id` = the `ClinicDoctor` link id (not the doctor's own id). Only valid when the link was
`invitedBy: 'doctor'` and still `PENDING`; otherwise `400`.
**Response `data`:** `ClinicDoctorResponse` (no nested objects).

### `DELETE /me/doctors/:id`
Removes a doctor from the clinic (`:id` = link id). **Response `data`:** `null`.

### `GET /me/gallery`
**Response `data`:** `GalleryImageResponse[]` (§A.4.6).

### `POST /me/gallery`
`multipart/form-data`, field `image` (required). Optional text fields alongside it:
| Field | Type | Notes |
|---|---|---|
| `captionFr` | string | optional |
| `captionAr` | string | optional |

**Response `data`:** `GalleryImageResponse` (HTTP 201). `sortOrder` is auto-assigned
(`max existing + 1`).

---

## A.2 Clinic Staff Routes (JWT role: `SUPER_ADMIN` or `ADMIN`)

> These act on any clinic via `:id` in the path.

### `GET /`
List/search all clinics. **Query params (all optional):**
| Param | Type | Effect |
|---|---|---|
| `page` | number | default 1 |
| `limit` | number | default 10 |
| `wilayaId` | string (UUID) | filter |
| `baladyaId` | string (UUID) | filter |
| `facilityType` | `CLINIC`\|`HOSPITAL` | filter |
| `isVerified` | `"true"`\|`"false"` | filter |
| `isSuspended` | `"true"`\|`"false"` | filter |
| `isCompleted` | `"true"`\|`"false"` | filter |
| `search` | string | free-text search (name/email/phone, per repository) |
| `sortBy` | string | default `createdAt` |
| `sortOrder` | `asc`\|`desc` | default `desc` |

**Response:** paginated envelope, `data`: `ClinicResponse[]`.

### `GET /:id`
**Response `data`:** `ClinicResponse`. `404` if not found.

### `POST /`
Staff creates a clinic account directly (this is the only place a `password` is ever set for a
clinic in this module — it becomes the clinic's login credential, hashed with bcrypt cost 12
before storage). **Request body (`createClinicSchema`):**

| Field | Type | Rule |
|---|---|---|
| `nameFr` | string | required, 2–100 |
| `nameAr` | string | required, 2–100 |
| `email` | string | required, valid email, must be unique (`409` if taken) |
| `phone` | string | required, exactly 10 digits, must be unique (`409` if taken) |
| `password` | string | required, min 8 chars — plaintext in the request, bcrypt-hashed server-side |
| `wilayaId` | string (UUID) | required |
| `baladyaId` | string (UUID) | optional, nullable |
| `facilityType` | `CLINIC`\|`HOSPITAL` | optional; Joi defaults to `CLINIC`, **but note:** the service layer applies its own fallback of `'HOSPITAL'` if the field is falsy after validation — confirm which one you want before relying on the default |
| `descriptionAr` | string | optional, max 1000 |
| `descriptionFr` | string | optional, max 1000 |
| `latitude` | number | optional, -90..90 |
| `longitude` | number | optional, -180..180 |

**Side effects:** clinic is created with `isVerified: true` immediately (staff-created clinics
skip the verification step); a `welcome` notification is emitted; an audit log entry
(`clinic.created`) is recorded.
**Response `data`:** `ClinicResponse` (HTTP 201). Password is never echoed back.

### `PATCH /:id`
**Request body (`updateClinicSchema`, all optional, at least one field required):**
`nameFr, nameAr, descriptionAr, descriptionFr, phone (10 digits), email, wilayaId, baladyaId, latitude, longitude, facilityType`.
Same uniqueness checks as create for `email`/`phone` if changed (`409` on conflict).
**Response `data`:** `ClinicResponse`.

### `POST /:id/verify`
No request body. `400` if already verified. Emits `account_verified` notification.
**Response `data`:** `ClinicResponse`.

### `POST /:id/suspend`
**Request body (`suspendClinicSchema`):**
| Field | Type | Rule |
|---|---|---|
| `reason` | string | required, 3–500 chars |

`400` if already suspended. Emits `account_suspended` notification containing the reason.
**Response `data`:** `ClinicResponse`.

### `POST /:id/unsuspend`
No body. `400` if not currently suspended. Emits `account_unsuspended` notification.
**Response `data`:** `ClinicResponse`.

### `POST /:id/logo`
`multipart/form-data`, field `logo` (required, else `400`).
**Response `data`:** `ClinicResponse` (with `logoUrl` now populated).

### `GET /:id/documents`
**Response `data`:** `ClinicDocumentResponse[]`.

### `POST /:id/documents`
Same as `POST /me/documents` but for an arbitrary clinic id (staff-side).
**Response `data`:** `ClinicDocumentResponse` (HTTP 201).

### `DELETE /:id/documents/:documentId`
`400` if the document doesn't belong to `:id`. **Response `data`:** `null`.

### `GET /:id/working-hours` / `POST /:id/working-hours`
Identical contract to the `/me/...` variants, targeting `:id` instead of the JWT clinic.

### `GET /:id/rooms` / `POST /:id/rooms` / `PATCH /:id/rooms/:roomId` / `DELETE /:id/rooms/:roomId`
Same `RoomResponse` contract as the self-service rooms endpoints.
**`PATCH` body (`updateRoomSchema`, at least one field required):**
| Field | Type | Rule |
|---|---|---|
| `name` | string | optional, 2–100 |
| `specialtyId` | string (UUID) or `null` | optional |

### `GET /:id/doctors`
**Response `data`:** `ClinicDoctorResponse[]`, same shape as `GET /me/doctors`.

### `GET /:id/gallery` / `POST /:id/gallery` / `PATCH /:id/gallery/:imageId` / `DELETE /:id/gallery/:imageId`
Same contract as self-service gallery, plus:

**`PATCH` body (`updateGalleryImageSchema`, at least one field required):**
| Field | Type | Rule |
|---|---|---|
| `captionFr` | string | optional, max 200, nullable |
| `captionAr` | string | optional, max 200, nullable |
| `sortOrder` | integer | optional, ≥ 0 |

---

## A.3 Full endpoint index (Clinic module)

| Method | Path | Auth | Body | 201? |
|---|---|---|---|---|
| GET | `/me/profile` | CLINIC | — | |
| PATCH | `/me/complete` | CLINIC | multipart + JSON fields | |
| GET | `/me/documents` | CLINIC | — | |
| POST | `/me/documents` | CLINIC | multipart `document` | ✅ |
| GET | `/me/working-hours` | CLINIC | — | |
| POST | `/me/working-hours` | CLINIC | `{ hours: [...] }` | |
| GET | `/me/rooms` | CLINIC | — | |
| POST | `/me/rooms` | CLINIC | `CreateRoomDTO` | ✅ |
| POST | `/me/doctors/invite` | CLINIC | `{ doctorId }` | |
| GET | `/me/doctors` | CLINIC | — | |
| POST | `/me/doctors/:id/accept` | CLINIC | — | |
| POST | `/me/doctors/:id/reject` | CLINIC | — | |
| DELETE | `/me/doctors/:id` | CLINIC | — | |
| GET | `/me/gallery` | CLINIC | — | |
| POST | `/me/gallery` | CLINIC | multipart `image` + captions | ✅ |
| DELETE | `/me/documents/:id` | CLINIC | — | |
| GET | `/` | SUPER_ADMIN, ADMIN | — (query filters) | |
| GET | `/:id` | SUPER_ADMIN, ADMIN | — | |
| POST | `/` | SUPER_ADMIN, ADMIN | `CreateClinicDTO` | ✅ |
| PATCH | `/:id` | SUPER_ADMIN, ADMIN | `UpdateClinicDTO` | |
| POST | `/:id/verify` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/suspend` | SUPER_ADMIN, ADMIN | `{ reason }` | |
| POST | `/:id/unsuspend` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/logo` | SUPER_ADMIN, ADMIN | multipart `logo` | |
| GET | `/:id/documents` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/documents` | SUPER_ADMIN, ADMIN | multipart `document` | ✅ |
| DELETE | `/:id/documents/:documentId` | SUPER_ADMIN, ADMIN | — | |
| GET | `/:id/working-hours` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/working-hours` | SUPER_ADMIN, ADMIN | `{ hours: [...] }` | |
| GET | `/:id/rooms` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/rooms` | SUPER_ADMIN, ADMIN | `CreateRoomDTO` | ✅ |
| PATCH | `/:id/rooms/:roomId` | SUPER_ADMIN, ADMIN | `UpdateRoomDTO` | |
| DELETE | `/:id/rooms/:roomId` | SUPER_ADMIN, ADMIN | — | |
| GET | `/:id/doctors` | SUPER_ADMIN, ADMIN | — | |
| GET | `/:id/gallery` | SUPER_ADMIN, ADMIN | — | |
| POST | `/:id/gallery` | SUPER_ADMIN, ADMIN | multipart `image` + captions | ✅ |
| PATCH | `/:id/gallery/:imageId` | SUPER_ADMIN, ADMIN | `UpdateGalleryImageDTO` | |
| DELETE | `/:id/gallery/:imageId` | SUPER_ADMIN, ADMIN | — | |

(37 routes total — routes are declared with the `/me/...` block **before** `/:id` in
`clinic.routes.ts` specifically so `/me` isn't swallowed by the `:id` param.)

---

## A.4 Data shapes (Clinic module)

### A.4.1 `ClinicResponse`
```ts
{
  id: string;
  nameFr: string;
  nameAr: string;
  descriptionAr: string | null;
  descriptionFr: string | null;
  wilayaId: string;
  wilaya?: { id: string; code: number; name: string };
  baladyaId: string | null;
  baladya?: { id: string; name: string } | null;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  logoPath: string | null;
  logoUrl: string | null;        // signed/public URL derived from logoFileId, or legacy /uploads path
  facilityType: string;          // 'CLINIC' | 'HOSPITAL'
  isVerified: boolean;
  isSuspended: boolean;
  isCompleted: boolean;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```
`password` is **never** included in any response — it exists only in `CreateClinicDTO` (input).

### A.4.2 `ClinicDocumentResponse`
```ts
{
  id: string;
  clinicId: string;
  fileName: string;
  fileType: string;   // MIME type
  fileSize: number;    // bytes
  accessUrl: string;   // time-limited signed URL (generateSignedUrl(fileId))
  createdAt: string;
}
```

### A.4.3 `WorkingHoursResponse`
```ts
{ id: string; clinicId: string; dayOfWeek: string; openTime: string; closeTime: string; isOpen: boolean; }
```
`openTime`/`closeTime` are returned as `HH:mm` (sliced from a stored `DateTime`).

### A.4.4 `RoomResponse`
```ts
{ id: string; clinicId: string; name: string; specialtyId: string | null; isActive: boolean; createdAt: string; updatedAt: string; }
```

### A.4.5 `ClinicDoctorResponse`
```ts
{
  id: string;
  clinicId: string;
  doctorId: string;
  status: string;      // e.g. 'PENDING' | 'ACCEPTED' | 'REJECTED'
  invitedBy: string;    // 'clinic' | 'doctor'
  isActive: boolean;
  joinedAt: string;
  doctor?: {
    id: string; email: string;
    firstNameFr: string; firstNameAr: string;
    lastNameFr: string; lastNameAr: string;
    phone: string; photoUrl: string | null;
    specialties: { id: string; nameFr: string; nameAr: string }[];
    yearsOfExp: number | null;
  };
  clinic?: { id: string; nameFr: string; nameAr: string; email: string; phone: string; logoUrl: string | null; };
}
```
`doctor` is populated on list/invite responses that fetch it; `clinic` is declared in the type
but not populated by any current service method (always `undefined` in practice).

### A.4.6 `GalleryImageResponse`
```ts
{
  id: string; clinicId: string;
  imagePath: string; imageUrl: string;
  captionFr: string | null; captionAr: string | null;
  sortOrder: number; isActive: boolean; createdAt: string;
}
```

---

# PART B — Clinic-Service Module (`/api/v1/clinic-services/v1`)

This module manages the **services a clinic offers** (e.g. "Dental Cleaning", "General
Consultation") — separate from the `clinic` module above.

## B.1 Public Routes (no auth)

### `GET /public/search`
**Query params (all optional):**
| Param | Type | Effect |
|---|---|---|
| `query` | string | free-text search on service name/description |
| `wilayaId` | string (UUID) | filter by clinic's wilaya |
| `clinicId` | string (UUID) | filter to one clinic |
| `page` | number | default 1 |
| `limit` | number | default 10 |

**Response:** paginated envelope, `data`: `ClinicServiceResponse[]`.

### `GET /public/:id`
**Response `data`:** `ClinicServiceResponse`.

## B.2 Clinic Self-Service Routes (JWT role: `CLINIC`)

### `GET /me`
**Response `data`:** `ClinicServiceResponse[]` — all services for the authenticated clinic.

### `POST /me`
**Request body (`createServiceSchema`):**
| Field | Type | Rule |
|---|---|---|
| `nameFr` | string | required, 2–200 |
| `nameAr` | string | required, 2–200 |
| `descriptionFr` | string | optional, max 2000, nullable |
| `descriptionAr` | string | optional, max 2000, nullable |
| `sortOrder` | integer | optional, ≥ 0, default 0 |

**Response `data`:** `ClinicServiceResponse` (HTTP 201), with `gallery: []` and `doctors: []`.

### `PATCH /me/:id`
**Request body (`updateServiceSchema`, all optional, at least one required):**
`nameFr, nameAr, descriptionFr, descriptionAr, sortOrder, isActive`.
**Response `data`:** `ClinicServiceResponse`.

### `DELETE /me/:id`
**Response `data`:** `null`.

### `POST /me/:id/images`
`multipart/form-data`, field `image` (required). Optional `captionFr`, `captionAr` text fields.
**Response `data`:** `ServiceImageResponse` (HTTP 201).

### `DELETE /me/:id/images/:imageId`
`403 Forbidden` if the image's service doesn't belong to the authenticated clinic.
**Response `data`:** `null`.

### `GET /me/:id/doctors`
**Response `data`:** `ServiceDoctorResponse[]`.

### `POST /me/:id/doctors`
**Request body (`assignDoctorSchema`):**
| Field | Type | Rule |
|---|---|---|
| `doctorId` | string (UUID) | required |
| `isPrimary` | boolean | optional, default `false` |

`409` if the doctor is already assigned to this service.
**Response `data`:** `ServiceDoctorResponse` (HTTP 201).

### `DELETE /me/:id/doctors/:doctorId`
**Response `data`:** `null`.

## B.3 Staff Routes (JWT role: `SUPER_ADMIN` or `ADMIN`)

Identical contracts to the self-service block above, but every path is prefixed with
`/clinic/:clinicId` instead of `/me`, and `:clinicId` (not the JWT) determines the target clinic:

`GET|POST /clinic/:clinicId`, `PATCH|DELETE /clinic/:clinicId/:id`,
`POST /clinic/:clinicId/:id/images`, `DELETE /clinic/:clinicId/:id/images/:imageId`,
`GET|POST /clinic/:clinicId/:id/doctors`, `DELETE /clinic/:clinicId/:id/doctors/:doctorId`.

## B.4 Full endpoint index (Clinic-Service module)

| Method | Path | Auth | Body | 201? |
|---|---|---|---|---|
| GET | `/public/search` | none | — (query filters) | |
| GET | `/public/:id` | none | — | |
| GET | `/me` | CLINIC | — | |
| POST | `/me` | CLINIC | `CreateServiceDTO` | ✅ |
| PATCH | `/me/:id` | CLINIC | `UpdateServiceDTO` | |
| DELETE | `/me/:id` | CLINIC | — | |
| POST | `/me/:id/images` | CLINIC | multipart `image` + captions | ✅ |
| DELETE | `/me/:id/images/:imageId` | CLINIC | — | |
| GET | `/me/:id/doctors` | CLINIC | — | |
| POST | `/me/:id/doctors` | CLINIC | `AssignDoctorDTO` | ✅ |
| DELETE | `/me/:id/doctors/:doctorId` | CLINIC | — | |
| GET | `/clinic/:clinicId` | SUPER_ADMIN, ADMIN | — | |
| POST | `/clinic/:clinicId` | SUPER_ADMIN, ADMIN | `CreateServiceDTO` | ✅ |
| PATCH | `/clinic/:clinicId/:id` | SUPER_ADMIN, ADMIN | `UpdateServiceDTO` | |
| DELETE | `/clinic/:clinicId/:id` | SUPER_ADMIN, ADMIN | — | |
| POST | `/clinic/:clinicId/:id/images` | SUPER_ADMIN, ADMIN | multipart `image` + captions | ✅ |
| DELETE | `/clinic/:clinicId/:id/images/:imageId` | SUPER_ADMIN, ADMIN | — | |
| GET | `/clinic/:clinicId/:id/doctors` | SUPER_ADMIN, ADMIN | — | |
| POST | `/clinic/:clinicId/:id/doctors` | SUPER_ADMIN, ADMIN | `AssignDoctorDTO` | ✅ |
| DELETE | `/clinic/:clinicId/:id/doctors/:doctorId` | SUPER_ADMIN, ADMIN | — | |

## B.5 Data shapes (Clinic-Service module)

### B.5.1 `ClinicServiceResponse`
```ts
{
  id: string;
  clinicId: string;
  clinic?: {
    id: string; nameFr: string; nameAr: string; logoUrl: string | null;
    wilaya?: { id: string; nameFr: string; nameAr: string };
    baladya?: { id: string; nameFr: string; nameAr: string } | null;
  };
  nameFr: string;
  nameAr: string;
  descriptionFr: string | null;
  descriptionAr: string | null;
  isActive: boolean;
  sortOrder: number;
  gallery: ServiceImageResponse[];
  doctors: ServiceDoctorResponse[];
  createdAt: string;
  updatedAt: string;
}
```
`clinic` is only populated when the underlying query fetched the `clinic` relation (e.g. public
search); on plain `getById`/`getByClinicId` it depends on the repository's own `include` —
check `repositories/clinic-service.repository.ts` if you need to confirm for a specific call.

### B.5.2 `ServiceImageResponse`
```ts
{ id: string; serviceId: string; imagePath: string; imageUrl: string; captionFr: string | null; captionAr: string | null; sortOrder: number; isActive: boolean; createdAt: string; }
```

### B.5.3 `ServiceDoctorResponse`
```ts
{
  id: string; serviceId: string; doctorId: string; isPrimary: boolean;
  doctor: {
    id: string; firstNameFr: string; firstNameAr: string; lastNameFr: string; lastNameAr: string;
    photoUrl: string | null;
    specialties?: { id: string; nameFr: string; nameAr: string }[];
  };
  createdAt: string;
}
```

---

# PART C — Cross-cutting notes worth knowing before building against this API

1. **`facilityType` default mismatch:** the Joi schema for `POST /clinic/v1` defaults
   `facilityType` to `'CLINIC'` if omitted, but `ClinicService.create()` independently falls back
   to `'HOSPITAL'` (`data.facilityType || 'HOSPITAL'`). In practice Joi's default means
   `data.facilityType` is never falsy by the time it reaches the service, so `'CLINIC'` wins —
   but the dead `'HOSPITAL'` fallback is a code smell worth flagging if you're cleaning this up.
2. **Route ordering matters:** in `clinic.routes.ts`, all `/me/...` routes are declared before
   `/:id` routes specifically so Express doesn't match `/me` as `:id=me`. If you add new
   clinic-scoped staff routes, add them after the `/me` block or they'll shadow it.
3. **Soft deletes:** rooms, gallery images, and services use `softDelete`/`isActive: false`
   rather than hard deletes in most repositories — `DELETE` endpoints generally flip a flag
   rather than removing the row (confirm per-repository if this matters for your use case).
4. **Ownership checks are inconsistent in strictness:** clinic-service image deletion checks
   `service.clinicId !== clinicId` and throws `403`; clinic document deletion checks
   `doc.clinicId !== clinicId` and throws `400` (`BadRequestError`, not `403`) for the same kind
   of mismatch. Don't assume a single status code for "wrong owner" across endpoints — check the
   specific controller/service method.