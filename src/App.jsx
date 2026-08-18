import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/Dashboard";
import DAInterventions from "./pages/admin/DAInterventions";
import LGUInterventions from "./pages/admin/LGUInterventions";
import NewlyRegistered from "./pages/admin/NewlyRegistered";
import DisasterReports from "./pages/admin/DisasterReports";
import Users from "./pages/admin/Users";
import AuditTrail from "./pages/admin/AuditTrail";
import Reports from "./pages/admin/Reports";
import AgriculturalTechnologistDashboard from "./pages/agricultural-technologist/Dashboard";
import AgriculturalTechnologistBeneficiaryValidation from "./pages/agricultural-technologist/BeneficiaryValidation";
import AgriculturalTechnologistDisasterReports from "./pages/agricultural-technologist/DisasterReports";
import AgriculturalTechnologistDAInterventions from "./pages/agricultural-technologist/DAInterventions";
import AgriculturalTechnologistLGUInterventions from "./pages/agricultural-technologist/LGUInterventions";
import DataEncoderDashboard from "./pages/data-encoder/Dashboard";
import DataEncoderBeneficiaryProfiles from "./pages/data-encoder/BeneficiaryProfiles";
import DataEncoderInterventionRecords from "./pages/data-encoder/InterventionRecords";
import DataEncoderInventory from "./pages/data-encoder/Inventory";
import DataEncoderDisasterReports from "./pages/data-encoder/DisasterReports";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/da-interventions" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DAInterventions />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/lgu-interventions" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LGUInterventions />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/newly-registered" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <NewlyRegistered />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/disaster-reports" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DisasterReports />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Users />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/audit-trail" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AuditTrail />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/reports" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Reports />
            </ProtectedRoute>
          } 
        />

        {/* Agricultural Technologist routes - canonical path */}
        <Route 
          path="/agricultural-technologist/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agricultural-technologist/beneficiary-validation" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistBeneficiaryValidation />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agricultural-technologist/da-intervention" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDAInterventions />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agricultural-technologist/lgu-intervention" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistLGUInterventions />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agricultural-technologist/disaster-reports" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDisasterReports />
            </ProtectedRoute>
          } 
        />

        {/* Agricultural Technologist routes - /agritech alias */}
        <Route 
          path="/agritech/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agritech/beneficiary-validation" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistBeneficiaryValidation />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agritech/da-intervention" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDAInterventions />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agritech/lgu-intervention" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistLGUInterventions />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agritech/disaster-reports" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDisasterReports />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/data-encoder/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/data-encoder/beneficiary-profiles" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderBeneficiaryProfiles />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/data-encoder/intervention-records" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderInterventionRecords />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/data-encoder/inventory" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderInventory />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/data-encoder/disaster-reports" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderDisasterReports />
            </ProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
