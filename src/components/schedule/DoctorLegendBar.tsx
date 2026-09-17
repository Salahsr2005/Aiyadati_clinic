import { RemoteImage } from "@/components/common/RemoteImage";
import { getDoctorColor } from "@/lib/doctorColor";
import { cn } from "@/lib/utils";
import type { DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";

export function DoctorLegendBar({
  doctors,
  activeDoctorId,
  onSelect,
}: {
  doctors: DoctorCardItem[];
  activeDoctorId: string;
  onSelect: (doctorId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
      {doctors.map((doc) => {
        const color = getDoctorColor(doc.doctorId);
        const active = doc.doctorId === activeDoctorId;
        return (
          <button
            key={doc.doctorId}
            type="button"
            onClick={() => onSelect(doc.doctorId)}
            title={doc.name}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-full border px-2 py-1 transition cursor-pointer",
              active ? "shadow-sm" : "opacity-70 hover:opacity-100",
            )}
            style={{
              borderColor: active ? color.hex : "transparent",
              backgroundColor: active ? `${color.hex}1a` : "transparent",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
            <div className="h-5 w-5 rounded-full overflow-hidden border border-border/40">
              <RemoteImage src={doc.photoUrl} alt={doc.name} className="h-full w-full object-cover" />
            </div>
            <span className="text-[10px] font-bold text-foreground max-w-[80px] truncate">{doc.name}</span>
          </button>
        );
      })}
    </div>
  );
}
