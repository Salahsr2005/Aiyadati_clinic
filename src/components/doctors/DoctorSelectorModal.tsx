import { useState, useMemo } from "react";
import { Search, Filter, Stethoscope, Award, Check, X, User } from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { RemoteImage } from "@/components/common/RemoteImage";
import { ensureArray } from "@/lib/utils";
import type { ClinicDoctor } from "@/api/clinicSelfApi";
import findDoctorImg from "@/assets/home-quick-actions/find-doctor.png";

export interface DoctorCardItem {
  id: string;
  doctorId: string;
  name: string;
  specialty: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  yearsOfExp?: number;
  status?: string;
  raw?: ClinicDoctor | DoctorRow;
}

interface DoctorSelectorModalProps {
  open: boolean;
  onClose: () => void;
  doctors: DoctorCardItem[];
  selectedDoctorId?: string;
  onSelectDoctor: (doctor: DoctorCardItem) => void;
  title?: string;
  subtitle?: string;
}

export function DoctorSelectorModal({
  open,
  onClose,
  doctors,
  selectedDoctorId,
  onSelectDoctor,
  title = "Select Doctor Provider",
  subtitle = "Choose an affiliated specialist doctor for consultation",
}: DoctorSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const fallbackPhoto = findDoctorImg;

  // Extract unique specialties for dropdown
  const uniqueSpecialties = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => {
      if (d.specialty) set.add(d.specialty);
    });
    return Array.from(set).sort();
  }, [doctors]);

  // Filtered doctors list
  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      const matchesSearch =
        !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.email && d.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSpecialty = !specialtyFilter || d.specialty === specialtyFilter;

      return matchesSearch && matchesSpecialty;
    });
  }, [doctors, searchQuery, specialtyFilter]);

  return (
    <FormModal
      id="doctor-selector-modal"
      open={open}
      onClose={onClose}
      title={title}
      description={subtitle}
    >
      <div className="space-y-4">
        {/* Search & Specialty Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctor by name or specialty..."
              className="glass w-full rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {uniqueSpecialties.length > 0 && (
            <div className="relative w-full sm:w-48">
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
              >
                <option value="">All Specialties ({uniqueSpecialties.length})</option>
                {uniqueSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Doctor Cards Grid */}
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar space-y-3 pe-1">
          {filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Stethoscope className="h-9 w-9 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-bold text-foreground">No matching doctors found</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Try clearing your search query or specialty filter</p>
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const isSelected = selectedDoctorId === doc.doctorId || selectedDoctorId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDoctor(doc);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary-500/10 border-primary-500 ring-2 ring-primary-500/30"
                      : "bg-accent/30 border-border/40 hover:bg-accent/60 hover:border-primary-500/40"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative h-12 w-12 shrink-0 rounded-2xl overflow-hidden border border-border/40 bg-accent">
                      <img
                        src={doc.photoUrl || fallbackPhoto}
                        alt={doc.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = fallbackPhoto;
                        }}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-foreground truncate group-hover:text-primary-500 transition">
                          {doc.name}
                        </h4>
                        {doc.status && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success uppercase">
                            {doc.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-primary-500 mt-0.5 truncate">
                        {doc.specialty}
                      </p>
                      {doc.yearsOfExp !== undefined && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Award className="h-3 w-3 text-amber-500" />
                          <span>{doc.yearsOfExp} Years Experience</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ms-3">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        isSelected
                          ? "bg-primary-500 text-primary-foreground shadow-xs"
                          : "bg-primary-500/10 text-primary-500 group-hover:bg-primary-500 group-hover:text-primary-foreground"
                      }`}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </FormModal>
  );
}
