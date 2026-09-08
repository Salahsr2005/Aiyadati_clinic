import { useTranslation } from "react-i18next";
import { Radio, ShieldAlert, Zap, Calendar, HeartPulse, Activity } from "lucide-react";

interface NewsTickerProps {
  pendingCount?: number;
  todayCount?: number;
  completedCount?: number;
}

export function NewsTicker({
  pendingCount = 0,
  todayCount = 0,
  completedCount = 0,
}: NewsTickerProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language || "fr";
  const isRtl = locale.startsWith("ar");

  const tickerItems = [
    {
      id: "stat-today",
      category: isRtl ? "مباشر" : "LIVE METRICS",
      text: isRtl
        ? `Appointments اليوم: ${todayCount} (مكتملة: ${completedCount})`
        : `Today's Appointments: ${todayCount} (${completedCount} completed)`,
      icon: Calendar,
    },
    ...(pendingCount > 0
      ? [
          {
            id: "stat-pending",
            category: isRtl ? "تنبيه هام" : "ACTION REQ",
            text: isRtl
              ? `لديك ${pendingCount} Appointments جديدة بانتظار الConfirm السريع!`
              : `You have ${pendingCount} pending appointments awaiting confirmation!`,
            icon: ShieldAlert,
          },
        ]
      : []),
    {
      id: "tip-quick",
      category: isRtl ? "تلميح العيادة" : "CLINIC TIP",
      text: isRtl
        ? "يمكنك حجز المرضى الفوريين وإنشاء Créneaux سريعة بنقرة واحدة من لوحة التحكم."
        : "Book walk-in patients and batch-generate slots directly from your cockpit.",
      icon: Zap,
    },
    {
      id: "news-health",
      category: isRtl ? "تحديث طبي" : "HEALTH MATRIX",
      text: isRtl
        ? "تحديث بروتوكولات الوصفات الطبية الإلكترونية وConfirm الهوية الوطنية للمريض متوفر الآن."
        : "Digital prescription verification & electronic health record sync is now active.",
      icon: HeartPulse,
    },
  ];

  const quadrupledItems = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary-500/30 bg-gradient-to-r from-slate-950 via-primary-950 to-slate-900 text-white shadow-lg">
      <div className="flex items-center">
        {/* TV Badge */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-primary-600 px-3.5 py-2.5 shadow-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <Radio className="h-3.5 w-3.5 animate-pulse text-white" />
          <span className="text-[11px] font-black uppercase tracking-wider text-white">
            {isRtl ? "الأخبار المباشرة" : "LIVE TICKER"}
          </span>
        </div>

        {/* Marquee Ticker */}
        <div className="relative min-w-0 flex-1 overflow-hidden py-2.5">
          <div className="pointer-events-none absolute start-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r rtl:bg-gradient-to-l from-slate-950 to-transparent" />
          <div className="pointer-events-none absolute end-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l rtl:bg-gradient-to-r from-slate-900 to-transparent" />

          <div
            className={`pause-on-hover flex w-max items-center gap-8 ${
              isRtl ? "animate-ticker-rtl" : "animate-ticker-ltr"
            }`}
          >
            {quadrupledItems.map((item, idx) => {
              const Icon = item.icon || Activity;
              return (
                <div key={`${item.id}-${idx}`} className="flex shrink-0 items-center gap-2.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-200 border border-white/10">
                    <Icon className="h-3 w-3 text-primary-300" />
                    {item.category}
                  </span>
                  <span className="font-semibold text-slate-100">{item.text}</span>
                  <span className="ms-4 text-white/25 font-bold">•</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
