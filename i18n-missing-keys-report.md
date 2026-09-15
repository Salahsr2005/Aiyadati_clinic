# i18n Missing Keys & Parity Audit Report

This report documents all extracted missing keys from hardcoded strings in components and routes, with full translation parity across English (`en`), French (`fr`), and Arabic (`ar`), ready for application.

---

## 1. Overview & Dashboard Area (`src/i18n/locales/<lang>/overview.json`)

### src/components/overview/InsightCards.tsx
- key: overview.insights.title
  en: "Operational Insights"
  fr: "Aperçus opérationnels"
  ar: "رؤى تشغيلية"
- key: overview.insights.subtitle
  en: "AI-derived platform recommendation engine"
  fr: "Moteur de recommandations basé sur l'IA"
  ar: "محرك توصيات المنصة المدعوم بالذكاء الاصطناعي"
- key: overview.insights.highDemandSpecialty.title
  en: "High Demand Specialty Area"
  fr: "Spécialité à forte demande"
  ar: "تخصص عالي الطلب"
- key: overview.insights.highDemandSpecialty.desc
  en: "{{specialty}} represents {{pct}}% of all appointments this period, signaling an area for clinic acquisition."
  fr: "{{specialty}} représente {{pct}}% de tous les rendez-vous cette période, indiquant une opportunité d'acquisition."
  ar: "{{specialty}} يمثل {{pct}}% من جميع المواعيد لهذه الفترة، مما يشير إلى فرصة لجلب عيادات جديدة."
- key: overview.insights.cancellationRate.title
  en: "Elevated Cancellation Rate"
  fr: "Taux d'annulation élevé"
  ar: "نسبة إلغاء مرتفعة"
- key: overview.insights.cancellationRate.desc
  en: "Platform cancellations are at {{cancelPct}}%. Consider reviewing slot confirmation timing or enabling SMS reminders."
  fr: "Les annulations sont à {{cancelPct}}%. Envisagez de revoir la confirmation des créneaux ou d'activer les rappels SMS."
  ar: "نسبة الإلغاء بلغت {{cancelPct}}%. يرجى مراجعة توقيت تأكيد المواعيد أو تفعيل التذكير عبر الرسائل القصيرة."
- key: overview.insights.registrationBacklog.title
  en: "Registration Backlog Detected"
  fr: "Retard de vérification détecté"
  ar: "تراكم في طلبات التسجيل"
- key: overview.insights.registrationBacklog.desc
  en: "There are {{doctors}} doctors and {{clinics}} clinics awaiting administrative verification."
  fr: "Il y a {{doctors}} médecins et {{clinics}} cliniques en attente de vérification administrative."
  ar: "هناك {{doctors}} أطباء و {{clinics}} عيادات بانتظار التحقق الإداري."
- key: overview.insights.noShowPatterns.title
  en: "Suspicious No-Show Patterns"
  fr: "Modèles d'absences suspects"
  ar: "أنماط غياب غير معتادة"
- key: overview.insights.noShowPatterns.desc
  en: "{{count}} patients have accumulated 3+ no-shows. Trust tiers should be audited or accounts suspended."
  fr: "{{count}} patients ont accumulé 3 absences ou plus. Les niveaux de confiance doivent être audités."
  ar: "{{count}} مرضى لديهم 3 حالات غياب أو أكثر. يجب مراجعة مستويات الثقة أو تعليق الحسابات."
- key: overview.insights.systemOptimized.title
  en: "System Performance Optimized"
  fr: "Performances système optimales"
  ar: "أداء النظام في المستوى الأمثل"
- key: overview.insights.systemOptimized.desc
  en: "Platform operations running within normal baseline bounds. No anomalies or operational bottlenecks detected."
  fr: "Les opérations de la plateforme fonctionnent normalement. Aucune anomalie détectée."
  ar: "عمليات المنصة تعمل ضمن الحدود الطبيعية. لا توجد أي مشاكل أو اختناقات تشغيلية."
- key: overview.insights.general
  en: "General"
  fr: "Général"
  ar: "عام"

### src/components/overview/ActivityTimeline.tsx
- key: overview.activity.title
  en: "Live Activity Feed"
  fr: "Flux d'activité en direct"
  ar: "سجل النشاط المباشر"
- key: overview.activity.subtitle
  en: "Real-time system events"
  fr: "Événements système en temps réel"
  ar: "أحداث النظام في الوقت الفعلي"
- key: overview.activity.eventsCount
  en: "{{count}} events"
  fr: "{{count}} événements"
  ar: "{{count}} أحداث"
- key: overview.activity.empty
  en: "No recent activity detected."
  fr: "Aucune activité récente détectée."
  ar: "لم يتم رصد أي نشاط مؤخراً."
- key: overview.activity.appointmentCancelled
  en: "Appointment Cancelled"
  fr: "Rendez-vous annulé"
  ar: "تم إلغاء الموعد"
- key: overview.activity.appointmentBooked
  en: "Appointment Booked"
  fr: "Rendez-vous réservé"
  ar: "تم حجز الموعد"
- key: overview.activity.aPatient
  en: "A Patient"
  fr: "Un patient"
  ar: "مريض"
- key: overview.activity.scheduledDescription
  en: "{{patient}} scheduled {{type}} with Dr. {{doctor}}"
  fr: "{{patient}} a programmé {{type}} avec le Dr {{doctor}}"
  ar: "{{patient}} قام بجدولة {{type}} مع د. {{doctor}}"
- key: overview.activity.anAppointment
  en: "an appointment"
  fr: "un rendez-vous"
  ar: "موعد"

### src/components/overview/PlatformStatusPanel.tsx
- key: overview.platformStatus.activeDoctors
  en: "Active Doctors"
  fr: "Médecins actifs"
  ar: "الأطباء النشطون"
- key: overview.platformStatus.inProgress
  en: "In-Progress"
  fr: "En cours"
  ar: "قيد التنفيذ"
- key: overview.platformStatus.drVerifications
  en: "Dr Verifications"
  fr: "Vérifications médecins"
  ar: "توثيق الأطباء"
- key: overview.platformStatus.clinicVerifies
  en: "Clinic Verifies"
  fr: "Vérifications cliniques"
  ar: "توثيق العيادات"
- key: overview.platformStatus.completionRate
  en: "Completion Rate"
  fr: "Taux de complétion"
  ar: "معدل الإتمام"

### src/components/overview/ResponseTimeDistribution.tsx
- key: overview.responseTime.title
  en: "Response Time Distribution"
  fr: "Distribution du temps de réponse"
  ar: "توزيع وقت الاستجابة"
- key: overview.responseTime.empty
  en: "No response metrics available"
  fr: "Aucune métrique de réponse disponible"
  ar: "لا تتوفر مقاييس الاستجابة"

### src/components/overview/SpecialtyActivityMatrix.tsx
- key: overview.specialtyMatrix.title
  en: "Specialty Booking Heatmap"
  fr: "Carte d'activité par spécialité"
  ar: "خريطة الحجوزات حسب التخصص"
- key: overview.specialtyMatrix.empty
  en: "No specialty metrics available"
  fr: "Aucune métrique de spécialité disponible"
  ar: "لا تتوفر مقاييس للتخصصات"
- key: overview.specialtyMatrix.quiet
  en: "Quiet"
  fr: "Calme"
  ar: "هادئ"
- key: overview.specialtyMatrix.busy
  en: "Busy"
  fr: "Chargé"
  ar: "مزدحم"

### src/components/overview/OptimalBookingTime.tsx
- key: overview.optimalBooking.title
  en: "Optimal Booking Time"
  fr: "Périodes optimales de réservation"
  ar: "أفضل أوقات الحجز"
- key: overview.optimalBooking.completion
  en: "Completion"
  fr: "Complétion"
  ar: "الإتمام"
- key: overview.optimalBooking.cancellation
  en: "Cancellation"
  fr: "Annulation"
  ar: "الإلغاء"
- key: overview.optimalBooking.completed
  en: "Completed"
  fr: "Terminés"
  ar: "المكتملة"
- key: overview.optimalBooking.noShows
  en: "No-shows"
  fr: "Absences"
  ar: "حالات الغياب"
- key: overview.optimalBooking.avgResponse
  en: "Avg response"
  fr: "Réponse moy."
  ar: "متوسط الاستجابة"
- key: overview.optimalBooking.quiet
  en: "Quiet"
  fr: "Calme"
  ar: "هادئ"
- key: overview.optimalBooking.busy
  en: "Busy"
  fr: "Chargé"
  ar: "مزدحم"

### src/components/overview/CancellationMatrix.tsx
- key: overview.cancellationMatrix.title
  en: "Cancellation & No-Show Matrix"
  fr: "Matrice d'annulations et absences"
  ar: "مصفوفة الإلغاءات والغياب"
- key: overview.cancellationMatrix.cancelled
  en: "Cancelled"
  fr: "Annulé"
  ar: "ملغى"
- key: overview.cancellationMatrix.noShow
  en: "No-show"
  fr: "Absence"
  ar: "غياب"
- key: overview.cancellationMatrix.rate
  en: "Rate"
  fr: "Taux"
  ar: "النسبة"
- key: overview.cancellationMatrix.none
  en: "None"
  fr: "Aucun"
  ar: "لا يوجد"
- key: overview.cancellationMatrix.critical
  en: "Critical"
  fr: "Critique"
  ar: "حرج"

### src/components/overview/DayHourHeatmap.tsx
- key: overview.dayHourHeatmap.title
  en: "Activity Heatmap"
  fr: "Carte thermique d'activité"
  ar: "الخريطة الحرارية للنشاط"
- key: overview.dayHourHeatmap.total
  en: "Total"
  fr: "Total"
  ar: "الإجمالي"
- key: overview.dayHourHeatmap.active
  en: "Active"
  fr: "Actifs"
  ar: "النشطة"
- key: overview.dayHourHeatmap.completed
  en: "Completed"
  fr: "Terminés"
  ar: "المكتملة"
- key: overview.dayHourHeatmap.cancelled
  en: "Cancelled"
  fr: "Annulés"
  ar: "الملغاة"
- key: overview.dayHourHeatmap.noShows
  en: "No-shows"
  fr: "Absences"
  ar: "حالات الغياب"
- key: overview.dayHourHeatmap.completion
  en: "Completion"
  fr: "Complétion"
  ar: "الإتمام"
- key: overview.dayHourHeatmap.less
  en: "Less"
  fr: "Moins"
  ar: "أقل"
- key: overview.dayHourHeatmap.more
  en: "More"
  fr: "Plus"
  ar: "أكثر"

### src/components/overview/AppointmentAnalytics.tsx
- key: overview.appointmentAnalytics.financialEfficiency
  en: "Financial & Booking Efficiency"
  fr: "Efficacité financière et réservations"
  ar: "الكفاءة المالية والحجوزات"
- key: overview.appointmentAnalytics.split
  en: "Appointments Split"
  fr: "Répartition des rendez-vous"
  ar: "توزيع المواعيد"
- key: overview.appointmentAnalytics.noBookings
  en: "No bookings recorded"
  fr: "Aucune réservation enregistrée"
  ar: "لا توجد حجوزات مسجلة"
- key: overview.appointmentAnalytics.totalBookings
  en: "Total Bookings"
  fr: "Total réservations"
  ar: "إجمالي الحجوزات"

### src/components/overview/DoctorAnalytics.tsx
- key: overview.doctorAnalytics.verificationStatus
  en: "VERIFICATION STATUS"
  fr: "STATUT DE VÉRIFICATION"
  ar: "حالة التوثيق"
- key: overview.doctorAnalytics.leaderboard
  en: "Top Performers Leaderboard"
  fr: "Classement des meilleures performances"
  ar: "لوحة أفضل الأطباء والعيادات أداءً"
- key: overview.doctorAnalytics.rankingsSubtitle
  en: "Rankings of doctors & clinics"
  fr: "Classements des médecins et cliniques"
  ar: "تصنيف الأطباء والعيادات"
- key: overview.doctorAnalytics.topDoctors
  en: "Top Doctors"
  fr: "Meilleurs médecins"
  ar: "أفضل الأطباء"
- key: overview.doctorAnalytics.noDoctorStats
  en: "No doctor statistics"
  fr: "Aucune statistique de médecin"
  ar: "لا توجد إحصائيات للأطباء"
- key: overview.doctorAnalytics.topClinics
  en: "Top Clinics"
  fr: "Meilleures cliniques"
  ar: "أفضل العيادات"
- key: overview.doctorAnalytics.noClinicStats
  en: "No clinic statistics"
  fr: "Aucune statistique de clinique"
  ar: "لا توجد إحصائيات للعيادات"

### src/components/overview/PatientAnalytics.tsx
- key: overview.patientAnalytics.noTrustData
  en: "No trust data"
  fr: "Aucune donnée de confiance"
  ar: "لا توجد بيانات ثقة"

### src/components/overview/RecentAppointmentsTable.tsx
- key: overview.recentAppointments.title
  en: "Recent Appointment Activity"
  fr: "Activité récente des rendez-vous"
  ar: "النشاط الأخير للمواعيد"
- key: overview.recentAppointments.preview
  en: "Appointment Preview"
  fr: "Aperçu du rendez-vous"
  ar: "معاينة الموعد"
- key: overview.recentAppointments.bookingStatus
  en: "Booking Status"
  fr: "Statut de réservation"
  ar: "حالة الحجز"
- key: overview.recentAppointments.fee
  en: "Consultation Fee"
  fr: "Tarif de consultation"
  ar: "رسوم الفحص"
- key: overview.recentAppointments.scheduledDate
  en: "Scheduled Date"
  fr: "Date prévue"
  ar: "التاريخ المحدد"
- key: overview.recentAppointments.startTime
  en: "Start Time"
  fr: "Heure de début"
  ar: "وقت البدء"
- key: overview.recentAppointments.consultationType
  en: "Consultation Type"
  fr: "Type de consultation"
  ar: "نوع الاستشارة"
- key: overview.recentAppointments.paymentMethod
  en: "Payment Method"
  fr: "Mode de paiement"
  ar: "طريقة الدفع"
- key: overview.recentAppointments.notes
  en: "Notes"
  fr: "Remarques"
  ar: "ملاحظات"
- key: overview.recentAppointments.cancellationReason
  en: "Cancellation Reason"
  fr: "Motif d'annulation"
  ar: "سبب الإلغاء"

### src/components/overview/DashboardFilterBar.tsx
- key: overview.filters.selectDatePeriod
  en: "Select date period"
  fr: "Sélectionner la période"
  ar: "اختر الفترة الزمنية"
- key: overview.filters.filterByDoctor
  en: "Filter by Doctor"
  fr: "Filtrer par médecin"
  ar: "تصفية حسب الطبيب"
- key: overview.filters.specialtyArea
  en: "Specialty Area"
  fr: "Spécialité"
  ar: "التخصص الطبي"
- key: overview.filters.locationWilaya
  en: "Location (Wilaya)"
  fr: "Emplacement (Wilaya)"
  ar: "الموقع (الولاية)"

---

## 2. Authentication & Shell Strings (`src/i18n/locales/<lang>/shell.json` / `pages.json`)

### src/routes/login.tsx
- key: auth.clinicPortal
  en: "Clinic Portal"
  fr: "Portail Clinique"
  ar: "بوابة العيادة"
- key: auth.emailAddress
  en: "Email address"
  fr: "Adresse e-mail"
  ar: "البريد الإلكتروني"
- key: auth.password
  en: "Password"
  fr: "Mot de passe"
  ar: "كلمة المرور"

### src/components/patients/MedicalDocsDrawer.tsx
- key: patients.docs.title
  en: "Medical Documents"
  fr: "Documents médicaux"
  ar: "المستندات الطبية"
- key: patients.docs.consentRequired
  en: "Patient Access Consent Required"
  fr: "Consentement d'accès patient requis"
  ar: "موافقة المريض على الوصول مطلوبة"
- key: patients.docs.titlePlaceholder
  en: "Document Title (e.g. Prescription, Consultation Report)"
  fr: "Titre du document (ex. Ordonnance, Rapport de consultation)"
  ar: "عنوان المستند (مثال: وصفة طبية، تقرير فحص)"

---

## 3. Reverse Parity Check

- All existing namespace files (`enums.json`, `map.json`, `pages.json`, `schedule.json`, `shell.json`, `theme.json`) already have exact 1:1 key parity across `en`, `fr`, and `ar`.
- All newly added overview keys have matching translations and identical interpolation variables (such as `{{count}}`, `{{specialty}}`, `{{pct}}`, `{{patient}}`, `{{doctor}}`).
