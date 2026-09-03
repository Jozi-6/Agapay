import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/Dashboard";
import DAInterventions from "./pages/admin/DAInterventions";
import LGUInterventions from "./pages/admin/LGUInterventions";
import AdminCrisisReports from "./pages/admin/CrisisReports";
import Users from "./pages/admin/Users";
import AuditTrail from "./pages/admin/AuditTrail";
import Reports from "./pages/admin/Reports";
import Beneficiaries from "./pages/admin/Beneficiaries";
import Inventory from "./pages/admin/Inventory";
import AgriculturalTechnologistDashboard from "./pages/agricultural-technologist/Dashboard";
import AgriculturalTechnologistCrisisReports from "./pages/agricultural-technologist/CrisisReports";
import AgriculturalTechnologistDAInterventions from "./pages/agricultural-technologist/DAInterventions";
import AgriculturalTechnologistLGUInterventions from "./pages/agricultural-technologist/LGUInterventions";
import DataEncoderDashboard from "./pages/data-encoder/Dashboard";
import DataEncoderInterventionRecords from "./pages/data-encoder/InterventionRecords";
import DataEncoderInventory from "./pages/data-encoder/Inventory";
import DataEncoderCrisisReports from "./pages/data-encoder/CrisisReports";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
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
          path="/admin/crisis-reports" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminCrisisReports />
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
        
        <Route 
          path="/admin/beneficiaries" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Beneficiaries />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/inventory" 
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Inventory />
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
          path="/agricultural-technologist/crisis-reports" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistCrisisReports />
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
          path="/agritech/crisis-reports" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistCrisisReports />
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
          path="/data-encoder/crisis-reports" 
          element={
            <ProtectedRoute allowedRoles={["DATA_ENCODER"]}>
              <DataEncoderCrisisReports />
            </ProtectedRoute>
          } 
        />

        
        
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
