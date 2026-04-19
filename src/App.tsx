import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ActiveLabs from "./pages/ActiveLabs.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProPlan from "./pages/ProPlan.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import LabLoading from "./pages/LabLoading.tsx";
import Courses from "./pages/Courses.tsx";
import CourseDetail from "./pages/CourseDetail.tsx";
import Pricing from "./pages/Pricing.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/active-labs" element={<ActiveLabs />} />
            <Route path="/pro-plan" element={<ProPlan />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/lab-loading" element={<LabLoading />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseDetail />} />
            <Route path="/pricing" element={<Pricing />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
