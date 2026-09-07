import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import {
  Star,
  Eye,
  EyeOff,
  MessageSquare,
  Filter,
  RotateCcw,
  Search,
  X,
  MessageCircle,
  CornerDownRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Award,
} from "lucide-react";
import { reviewsApi, type ReviewRow } from "@/api/reviewsApi";
import { useClinicProfile } from "@/hooks/useClinicProfile";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import { KPICard } from "@/components/overview/KPICard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { FormModal } from "@/components/data/FormModal";
import { RemoteImage } from "@/components/common/RemoteImage";
import { EmptyState } from "@/components/data/EmptyState";

type RatingFilter = "ALL" | "5" | "4" | "3" | "2" | "1" | "RESPONDED" | "UNRESPONDED";

export default function ReviewsPage() {
  const { t } = useTranslation();
  const { data: profile } = useClinicProfile();
  const clinicId = profile?.id;

  const [isVisible, setIsVisible] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("ALL");
  const [replyModalReview, setReplyModalReview] = useState<ReviewRow | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (profile?.reviewsVisible !== undefined) {
      setIsVisible(!!profile.reviewsVisible);
    }
  }, [profile?.reviewsVisible]);

  const { data: reviews = [], isLoading } = useQuery<ReviewRow[]>({
    queryKey: qk.clinics.reviews(clinicId || ""),
    queryFn: () => (clinicId ? reviewsApi.clinic(clinicId) : Promise.resolve([])),
    enabled: !!clinicId,
  });

  const { data: statsData } = useQuery({
    queryKey: qk.clinics.reviewStats(clinicId || ""),
    queryFn: () => (clinicId ? reviewsApi.clinicStats(clinicId) : Promise.resolve({})),
    enabled: !!clinicId,
  });

  const toggleVisibilityMutation = useEntityMutation({
    mutationFn: (visible: boolean) => reviewsApi.setClinicVisibility({ isVisible: visible }),
    invalidate: [qk.clinicSelf.profile()],
    successMessage: t("reviews.visibilitySuccess", { defaultValue: "تم تحديث حالة إظهار التقييمات للعامة" }),
    onSuccess: (_, variables) => setIsVisible(variables),
  });

  const replyMutation = useEntityMutation({
    mutationFn: ({ reviewId, response }: { reviewId: string; response: string }) =>
      reviewsApi.respondToReview(reviewId, { response }),
    invalidate: [qk.clinics.reviews(clinicId || "")],
    successMessage: t("reviews.replySuccess", { defaultValue: "تم إرسال رد العيادة بنجاح" }),
    onSuccess: () => {
      setReplyModalReview(null);
      setReplyText("");
    },
  });

  const stats = statsData as any;
  const averageRating = stats?.average ?? stats?.avgRating ?? (reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 5.0);
  const totalReviews = reviews.length;
  const respondedCount = reviews.filter((r) => r.response && r.response.trim().length > 0).length;
  const responseRate = totalReviews > 0 ? Math.round((respondedCount / totalReviews) * 100) : 100;

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (ratingFilter === "ALL") return true;
      if (ratingFilter === "RESPONDED") return !!r.response;
      if (ratingFilter === "UNRESPONDED") return !r.response;
      return String(Math.floor(r.rating)) === ratingFilter;
    });
  }, [reviews, ratingFilter]);

  const openReplyModal = (rev: ReviewRow) => {
    setReplyModalReview(rev);
    setReplyText(rev.response || "");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Public Visibility Switch */}
      <GlassCard className="p-6 md:p-8 border border-border/40 relative overflow-hidden">
        <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("reviews.title", { defaultValue: "التقييمات وآراء المرضى" })}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("reviews.subtitle", { defaultValue: "متابعة انطباعات المرضى والاستجابة لملاحظاتهم الطبيّة" })}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-accent/40 p-3 border border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              {isVisible ? (
                <Eye className="h-4 w-4 text-success" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold">
                {t("reviews.toggleVisibility", { defaultValue: "إظهار التقييمات للعامة" })}: {isVisible ? t("common.active", { defaultValue: "نشط" }) : t("common.inactive", { defaultValue: "مخفي" })}
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => toggleVisibilityMutation.mutate(e.target.checked)}
                disabled={toggleVisibilityMutation.isPending}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </GlassCard>

      {/* 2. Main KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label={t("reviews.avgRating", { defaultValue: "معدل التقييم العام" })}
          value={averageRating}
          format={(n) => n.toFixed(1)}
          subLabel="من 5.0 نجوم"
          delta={averageRating}
          tone="warning"
        />
        <KPICard
          label={t("reviews.totalReviews", { defaultValue: "إجمالي التقييمات" })}
          value={totalReviews}
          subLabel="تقييمات مراجعة المرضى"
          delta={totalReviews}
          tone="primary"
        />
        <KPICard
          label={t("reviews.responseRate", { defaultValue: "نسبة الرد على التقييمات" })}
          value={responseRate}
          format={(n) => `${n}%`}
          subLabel={`${respondedCount} من ${totalReviews} تم الرد عليها`}
          delta={responseRate}
          tone="success"
        />
        <KPICard
          label={t("reviews.toggleVisibility", { defaultValue: "إظهار التقييمات للعامة" })}
          value={isVisible ? 100 : 0}
          format={() => isVisible ? t("common.active", { defaultValue: "ظاهر" }) : t("common.inactive", { defaultValue: "مخفي" })}
          subLabel="تظهر بملف العيادة العام"
          tone="info"
        />
      </div>

      {/* 3. Filter Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "تصفية وتنقيب" })}</span>
          </div>

          {ratingFilter !== "ALL" && (
            <button
              onClick={() => setRatingFilter("ALL")}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer ms-auto"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "إعادة تعيين" })}
            </button>
          )}
        </div>

        {/* Status & Star Rating Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
          {(
            [
              { id: "ALL" as RatingFilter, label: t("reviews.filterAll", { defaultValue: "جميع التقييمات" }) },
              { id: "5" as RatingFilter, label: "5 ★" },
              { id: "4" as RatingFilter, label: "4 ★" },
              { id: "3" as RatingFilter, label: "3 ★" },
              { id: "2" as RatingFilter, label: "2 ★" },
              { id: "1" as RatingFilter, label: "1 ★" },
              { id: "UNRESPONDED" as RatingFilter, label: t("reviews.filterPending", { defaultValue: "بانتظار الرد" }) },
              { id: "RESPONDED" as RatingFilter, label: t("reviews.filterResponded", { defaultValue: "تم الرد عليها" }) },
            ] as const
          ).map((pill) => {
            const isActive = ratingFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setRatingFilter(pill.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-primary-500 text-primary-foreground shadow-xs"
                    : "bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* 4. Reviews List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          title={ratingFilter !== "ALL" ? t("common.empty", { defaultValue: "لا توجد سجّلات متاحة حاليًا" }) : t("reviews.emptyTitle", { defaultValue: "لا توجد تقييمات مسجلة للعيادة حتى الآن" })}
          description={
            ratingFilter !== "ALL"
              ? t("filters.clear", { defaultValue: "جرب تعديل فلاتر التقييم." })
              : t("reviews.emptySub", { defaultValue: "ستظهر تقييمات المرضى هنا فور إجرائهم الفحوصات الطبية." })
          }
          action={
            ratingFilter !== "ALL" ? (
              <button
                onClick={() => setRatingFilter("ALL")}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> {t("filters.reset", { defaultValue: "إعادة تعيين" })}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => {
            const reviewerName =
              rev.user
                ? `${rev.user.firstName || ""} ${rev.user.lastName || ""}`.trim()
                : rev.patient
                  ? `${rev.patient.firstName || ""} ${rev.patient.lastName || ""}`.trim()
                  : t("reviews.patientLabel", { defaultValue: "مريض موثق" });

            const avatarUrl = rev.user?.avatarUrl || rev.patient?.avatarUrl;

            return (
              <GlassCard key={rev.id} className="p-6 space-y-4 border border-border/40 hover:bg-accent/30 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <RemoteImage
                      src={avatarUrl}
                      alt={reviewerName}
                      className="h-10 w-10 rounded-full object-cover border border-border/40 font-bold grid place-items-center text-xs"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{reviewerName}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{rev.createdAt?.slice(0, 10)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-warning/15 px-2.5 py-1 rounded-xl border border-warning/20">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span className="text-xs font-extrabold text-warning">{rev.rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* Review Text */}
                {(rev.comment || rev.review) && (
                  <p className="text-xs text-foreground/90 leading-relaxed bg-accent/20 p-3.5 rounded-2xl border border-border/30">
                    &quot;{rev.comment || rev.review}&quot;
                  </p>
                )}

                {/* Clinic Official Response Block */}
                {rev.response ? (
                  <div className="ms-4 p-3.5 rounded-2xl bg-primary-500/10 border border-primary-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-primary-500">
                      <span className="flex items-center gap-1.5">
                        <CornerDownRight className="h-3.5 w-3.5 rtl:rotate-180" /> {t("reviews.clinicReplyTitle", { defaultValue: "رد العيادة الرسمي" })}
                      </span>
                      <button
                        onClick={() => openReplyModal(rev)}
                        className="text-[11px] underline hover:opacity-80 cursor-pointer"
                      >
                        {t("common.edit", { defaultValue: "تعديل" })}
                      </button>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed ps-5">{rev.response}</p>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => openReplyModal(rev)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500/15 px-3.5 py-1.5 text-xs font-bold text-primary-500 hover:bg-primary-500/25 transition cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {t("reviews.respondButton", { defaultValue: "الرد على المريض" })}
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* 5. Reply Modal */}
      <FormModal
        id="reply-review-modal"
        open={!!replyModalReview}
        onClose={() => setReplyModalReview(null)}
        title={t("reviews.replyModalTitle", { defaultValue: "الرد الرسمي على تقييم المريض" })}
        description={t("reviews.replyModalSub", { defaultValue: "اكتب رد العيادة الرسمي على المريض بأسلوب مهني..." })}
      >
        <div className="space-y-4">
          {replyModalReview && (
            <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/40 text-xs space-y-1">
              <div className="font-bold text-foreground">
                {t("reviews.patientReviewLabel", { defaultValue: "تقييم المريض" })} ({replyModalReview.rating} ★):
              </div>
              <p className="text-muted-foreground italic">
                &quot;{replyModalReview.comment || replyModalReview.review || "—"}&quot;
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("reviews.replyPlaceholder", { defaultValue: "اكتب رد العيادة الرسمي..." })}*</label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder={t("reviews.replyPlaceholder", { defaultValue: "اكتب رد العيادة الرسمي على المريض بأسلوب مهني..." })}
              className="glass w-full rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReplyModalReview(null)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="button"
              disabled={!replyText.trim() || replyMutation.isPending}
              onClick={() => {
                if (replyModalReview && replyText.trim()) {
                  replyMutation.mutate({ reviewId: replyModalReview.id, response: replyText.trim() });
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {replyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Send className="h-3.5 w-3.5" /> {t("reviews.respondButton", { defaultValue: "الرد على المريض" })}
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

