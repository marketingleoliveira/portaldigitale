import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import Downloads from "./pages/Downloads";
import FileManagement from "./pages/FileManagement";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import Tickets from "./pages/Tickets";
import NewTicket from "./pages/NewTicket";
import TicketDetails from "./pages/TicketDetails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/produtos/:id" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
              <Route path="/categorias" element={<ProtectedRoute allowedRoles={['admin']}><Categories /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
              <Route path="/arquivos" element={<ProtectedRoute allowedRoles={['admin']}><FileManagement /></ProtectedRoute>} />
              <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
              <Route path="/notificacoes" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin', 'gerente']}><Reports /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/ajuda" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
              <Route path="/tickets/novo" element={<ProtectedRoute><NewTicket /></ProtectedRoute>} />
              <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
