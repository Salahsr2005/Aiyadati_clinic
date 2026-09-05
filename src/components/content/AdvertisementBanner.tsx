import { useEffect } from "react";
import { useQuery } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ExternalLink, Sparkles } from "lucide-react";
import { advertisementsApi, pickContent, type AdvertisementRow } from "@/api/contentApi";
import { qk } from "@/lib/queryKeys";

interface AdvertisementBannerProps {
  position?: "HOME_TOP" | "HOME_MIDDLE" | "HOME_BOTTOM" | "CUSTOM";
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  className?: string;
}

export function AdvertisementBanner({
  position = "HOME_TOP",
  title: defaultTitle = "Aiyadati Enterprise Healthcare Portal",
  description: defaultDesc = "Empowering clinics and healthcare facilities across Algeria with integrated appointment management and doctor networks.",
  imageUrl: fallbackImage,
  link: fallbackLink = "https://iyadati.com",
  className,
}: AdvertisementBannerProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language || "fr";

  // Fetch real active ads from API
  const { data: ads } = useQuery({
    queryKey: qk.content.ads(position),
    queryFn: () => advertisementsApi.active({ position }),
    staleTime: 5 * 60 * 1000,
  });

  const activeAds = ads || [];
  const currentAd: AdvertisementRow | undefined = activeAds[0];

  // Track impressions
  useEffect(() => {
    if (currentAd?.id) {
      void advertisementsApi.trackView(currentAd.id);
    }
  }, [currentAd?.id]);

  const adTitle = currentAd
    ? pickContent(locale, {
        ar: currentAd.titleAr,
        fr: currentAd.titleFr,
        en: currentAd.titleEn,
        fallback: currentAd.title,
      })
    : defaultTitle;

  const adDescription = currentAd
    ? pickContent(locale, {
        ar: currentAd.descriptionAr,
        fr: currentAd.descriptionFr,
        en: currentAd.descriptionEn,
        fallback: currentAd.description || "",
      })
    : defaultDesc;

  const adImageUrl = currentAd?.imageUrl || fallbackImage;
  const adLink = currentAd?.link || fallbackLink;

  const handleClick = () => {
    if (currentAd?.id) {
      void advertisementsApi.trackClick(currentAd.id);
    }
    if (adLink) {
      window.open(adLink, "_blank", "noopener,noreferrer");
    }
  };

  if (!adImageUrl) {
    return (
      <div
        onClick={handleClick}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm transition hover:shadow-md ${className || ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black text-amber-500 uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Sponsored Announcement
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary-500 transition">
              {adTitle}
            </h4>
            {adDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 font-medium">
                {adDescription}
              </p>
            )}
          </div>
          {adLink && (
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-xs group-hover:bg-primary-600 transition">
                Explore <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative cursor-pointer overflow-hidden rounded-3xl border border-border/40 shadow-md transition-all duration-300 hover:shadow-xl aspect-[21/9] min-h-[190px] ${className || ""}`}
    >
      <img
        src={adImageUrl}
        crossOrigin="anonymous"
        alt={adTitle}
        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black text-black uppercase tracking-wider shadow-xs">
            <Sparkles className="h-3 w-3" /> Sponsored
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <h4 className="text-base font-extrabold tracking-tight text-white drop-shadow-xs line-clamp-1 group-hover:text-amber-300 transition">
              {adTitle}
            </h4>
            {adDescription && (
              <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed opacity-90 font-medium">
                {adDescription}
              </p>
            )}
          </div>
          {adLink && (
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md group-hover:bg-primary-400 transition hover:scale-105">
                Explore <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
