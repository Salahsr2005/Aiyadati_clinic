# Aiyadati Clinic Portal — API Contract & State Sync Audit Report

## 1. Executive Summary

This audit systematically examined all frontend API client bindings in `src/api/` against the backend NestJS/Express v1 route handlers, controllers, validation schemas, and DTOs located in `backend/src/modules/`.

Key results:
- **Envelope Unwrapping & Normalization**: The global Axios response interceptor in `src/lib/api.ts` correctly unwraps the standard Iyadati envelope (`{ success, message, data, meta }`), providing `r.data = env.data` and saving metadata to `r.meta`. Verified that zero occurrences of `.data.data` leaks exist in the codebase.
- **Error Normalization**: `normalizeError()` in `src/lib/api.ts` maps backend validation errors (`{ errors: [{ field, message }] }`), status codes, and HTTP exceptions to standard Error objects with `.fields` and `.status` properties.
- **Query Cache Hardening**: Hand-rolled query client (`src/lib/queryClient.tsx`) was hardened to actively trigger re-fetches for mounted queries on `invalidateQueries()`, support `staleTime`, support `refetchInterval`, add exponential backoff retry for 5xx/network errors without retrying 4xx client errors, and preserve strict request deduplication.

---

## 2. API Domain Contract Audit Matrix

| Domain | Frontend API Module | Backend Routes / Controller | Key DTOs / Schemas | Audit Status & Fixes |
|---|---|---|---|---|
| **Clinic Self Profile** | `src/api/clinicSelfApi.ts` | `backend/src/modules/clinic/v1/clinic.routes.ts` | `CompleteClinicDto`, `WorkingHoursDto`, `CreateRoomDto`, `InviteDoctorDto` | **Verified & Compliant**. Handled multipart FormData for `updateProfile`, working hours format converter to standard DayOfWeek enum. |
| **Clinic Appointments & Slots** | `src/api/clinicAppointmentsApi.ts` | `backend/src/modules/appointment/v1/appointment.routes.ts` | `BookAppointmentDto`, `GenerateSlotsDto`, `UpdateStatusDto` | **Verified & Compliant**. Slot generation, status transitions, walk-in fallback to public book endpoint, guest patient cache resolution. |
| **Clinic Services** | `src/api/clinicServicesApi.ts` | `backend/src/modules/clinic-service/v1/clinic-service.routes.ts` | `CreateClinicServiceDto`, `UpdateClinicServiceDto`, `AssignDoctorDto` | **Hardened**. `getDetail` updated to use `/clinic-services/v1/public/:id` with fallback. |
| **Doctor Self-Service** | `src/api/doctorSelfApi.ts` | `backend/src/modules/doctor/v1/doctor.routes.ts` | `CompleteDoctorDto`, `SetAvailabilityDto`, `CreateBreakDto` | **Verified & Compliant**. Self-service routes correctly isolate authenticated doctor context from admin routes. |
| **Doctors Directory** | `src/api/doctorsApi.ts` | `backend/src/modules/doctor/v1/` & `/public/v1/doctors` | `DoctorResponse`, `FindAllDoctorsQuery` | **Verified & Compliant**. |
| **Reviews & Ratings** | `src/api/reviewsApi.ts` | `backend/src/modules/review/v1/` | `ReviewDto`, `ReviewStatsDto`, `ClinicReviewResponse` | **Verified & Compliant**. Safe parsing of rating distributions and clinic review visibility. |
| **Specialties** | `src/api/specialtyApi.ts` | `backend/src/modules/specialty/v1/` | `CreateSpecialtyDto`, `UpdateSpecialtyDto` | **Verified & Compliant**. Multi-language support (`nameFr`, `nameAr`, `descriptionFr`, `descriptionAr`). |
| **Users & Patients** | `src/api/usersApi.ts` | `backend/src/modules/user/v1/` | `UserDto`, `SuspendUserDto` | **Verified & Compliant**. Proper phone and email search fallback. |
| **Wallet & Transactions** | `src/api/walletApi.ts` | `backend/src/modules/wallet/v1/` | `AdminTransactionResponse`, `GrantCreditsDto` | **Verified & Compliant**. Canonical transaction kind mapping handles backend types (`purchase`, `use`, `refund`, `admin_grant`). |
| **Consent & Medical Docs** | `src/api/consentApi.ts` | `backend/src/modules/consent/v1/` | `DoctorPatientConsentDto`, `PatientDocumentDto` | **Verified & Compliant**. 403/404 handled gracefully with `noConsent: true`. |
| **Content & Advertisements** | `src/api/contentApi.ts` | `backend/src/modules/advertisement/v1/` & `news/v1/` | `AdvertisementDto`, `NewsDto` | **Verified & Compliant**. Localization fallback chain and public view/click tracking. |
| **Notifications** | `src/api/notificationsApi.ts` | `backend/src/modules/notification/v1/` | `NotificationDto`, `RegisterDeviceDto` | **Verified & Compliant**. Device registration and batch read operations. |
| **Credits & Pricing** | `src/api/creditApi.ts` | `backend/src/modules/credit/v1/` | `CreditPriceDto` | **Verified & Compliant**. |
| **Analytics Engine** | `src/api/analyticsV2Api.ts` | `backend/src/modules/appointment/v1/` & `analytics/v1/` | `DoctorDetailedStats`, `DoctorRevenueStats` | **Verified & Compliant**. Derives real analytics from appointment datasets. |

---

## 3. Query Client & State Sync Hardening (Task 3a)

### 3.1 Invalidation Refetch for Mounted Queries
- Previously: `invalidateQueries({ queryKey })` marked `updatedAt = 0` and called `notify()`, which did not fetch new data until an explicit remount.
- Fix: `QueryCacheEntry` now tracks the latest active `queryFn`. When `invalidateQueries` is called, all matching cache entries with active listeners (`listeners.size > 0`) immediately dispatch `entry.fetch(entry.queryFn)`.

### 3.2 `staleTime` and `refetchInterval`
- `staleTime`: Avoids redundant network requests on remount if `Date.now() - entry.updatedAt < staleTime`.
- `refetchInterval`: Automates periodic background polling for real-time widgets when mounted and enabled.

### 3.3 Transient Error Retry & Exponential Backoff
- `isRetryableError()` detects HTTP status codes:
  - 4xx errors (e.g. 400, 401, 403, 404, 422) are never retried.
  - Network disconnection or 5xx server errors trigger an automatic retry after backoff (`1000 * attempt` ms).

### 3.4 Request Deduplication
- Multiple concurrent calls with the same query key share the single active promise `entry.promise`.

---

## 4. Verification & Validation

- `npx tsc --noEmit` on `Aiyadati-clinic`: **0 errors**.
- Image CORS audit: **0 `crossOrigin` attributes remain**, safe fallback handling with `RemoteImage` and `ASSET_FALLBACKS`.
- i18n audit: Complete French, Arabic, and English parity across dashboard overview, auth, and widgets.
