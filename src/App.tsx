import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClinicPortalLayout from "@/routes/_clinicPortal";
import DashboardPage from "@/routes/_clinicPortal/dashboard";
import AppointmentsPage from "@/routes/_clinicPortal/appointments";
import DoctorsPage from "@/routes/_clinicPortal/doctors";
import PatientsPage from "@/routes/_clinicPortal/patients";
import RoomsPage from "@/routes/_clinicPortal/rooms";
import SchedulePage from "@/routes/_clinicPortal/schedule";
import ServicesPage from "@/routes/_clinicPortal/services";
import ReviewsPage from "@/routes/_clinicPortal/reviews";
import ProfilePage from "@/routes/_clinicPortal/profile";
import GalleryPage from "@/routes/_clinicPortal/gallery";
import LoginPage from "@/routes/login";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ClinicPortalLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
