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
import DataEncoderDashboard from "./pages/data-encoder/Dashboard";

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
        
        <Route 
          path="/agricultural-technologist/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["AGRICULTURAL_TECHNOLOGIST"]}>
              <AgriculturalTechnologistDashboard />
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
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;