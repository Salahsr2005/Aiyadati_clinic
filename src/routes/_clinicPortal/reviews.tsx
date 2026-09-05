import { useState, useEffect } from "react";
import { useQuery } from "@/lib/queryClient";
import { Star, Eye, EyeOff, MessageSquare } from "lucide-react";
import { reviewsApi, type ReviewRow } from "@/api/reviewsApi";
import { useClinicProfile } from "@/hooks/useClinicProfile";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";

export default function ReviewsPage() {
  const { data: profile } = useClinicProfile();
  const clinicId = profile?.id;

  const [isVisible, setIsVisible] = useState(true);

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

  const { data: stats } = useQuery({
    queryKey: qk.clinics.reviewStats(clinicId || ""),
    queryFn: () => (clinicId ? reviewsApi.clinicStats(clinicId) : Promise.resolve({})),
    enabled: !!clinicId,
  });

  const toggleVisibilityMutation = useEntityMutation({
    mutationFn: (visible: boolean) => reviewsApi.setClinicVisibility({ isVisible: visible }),
    invalidate: [qk.clinicSelf.profile()],
    successMessage: "Public review visibility updated",
    onSuccess: (_, variables) => setIsVisible(variables),
  });

  const averageRating = (stats as any)?.average || (stats as any)?.avgRating || 5.0;
  const totalReviews = reviews.length;

  return (
    <div className="space-y-6">
      {/* Header & Visibility Switch */}
      <GlassCard className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Reviews</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor feedback from patients and control public review visibility
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-accent/40 p-3 border border-border/40">
          <div className="flex items-center gap-2">
            {isVisible ? (
              <Eye className="h-4 w-4 text-success" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs font-semibold">
              Public Reviews: {isVisible ? "Visible" : "Hidden"}
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
      </GlassCard>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-warning/15 text-warning flex items-center justify-center font-bold text-lg">
            <Star className="h-6 w-6 fill-warning text-warning" />
          </div>
          <div>
            <div className="text-2xl font-extrabold">{averageRating.toFixed(1)} / 5.0</div>
            <div className="text-xs text-muted-foreground">Average Patient Score</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary-500/15 text-primary-500 flex items-center justify-center font-bold text-lg">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold">{totalReviews}</div>
            <div className="text-xs text-muted-foreground">Total Published Reviews</div>
          </div>
        </GlassCard>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Star className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <h3 className="text-base font-semibold">No reviews received yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Reviews left by patients after completed clinic appointments will appear here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <GlassCard key={rev.id} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-accent/60 grid place-items-center font-bold text-xs">
                    {rev.user?.firstName?.[0] || rev.patient?.firstName?.[0] || "P"}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">
                      {rev.user
                        ? `${rev.user.firstName || ""} ${rev.user.lastName || ""}`
                        : rev.patient
                          ? `${rev.patient.firstName || ""} ${rev.patient.lastName || ""}`
                          : "Anonymous Patient"}
                    </h4>
                    <p className="text-[10px] text-muted-foreground">{rev.createdAt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= rev.rating
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {(rev.comment || rev.review) && (
                <p className="text-xs text-muted-foreground/90 pt-1">
                  "{rev.comment || rev.review}"
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
