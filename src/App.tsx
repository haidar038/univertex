import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { VoterLayout } from "./components/VoterLayout";

// Landing page
import Index from "./pages/Index";
import PublicResultsPage from "./pages/PublicResultsPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

// Auth pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEvents from "./pages/admin/Events";
import AdminEventDetail from "./pages/admin/EventDetail";
import AdminUsers from "./pages/admin/Users";
import AdminClasses from "./pages/admin/Classes";

// Voter/Candidate pages
import VoterDashboard from "./pages/app/Dashboard";
import VotingPage from "./pages/app/VotingPage";
import ResultsPage from "./pages/app/ResultsPage";
import ProfilePage from "./pages/app/Profile";
import CandidateSettings from "./pages/app/CandidateSettings";
import CandidateDashboard from "./pages/app/CandidateDashboard";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />

                    {/* Public results page */}
                    <Route path="/results/:eventId" element={<PublicResultsPage />} />

                    {/* Admin routes */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requireRole="admin">
                                <AdminLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="events" element={<AdminEvents />} />
                        <Route path="events/:id" element={<AdminEventDetail />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="classes" element={<AdminClasses />} />
                    </Route>

                    {/* Voter/Candidate routes */}
                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute>
                                <VoterLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="dashboard" element={<VoterDashboard />} />
                        <Route path="candidate-dashboard" element={<CandidateDashboard />} />
                        <Route path="vote/:eventId" element={<VotingPage />} />
                        <Route path="results/:eventId" element={<ResultsPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="candidate-settings" element={<CandidateSettings />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </TooltipProvider>
        </QueryClientProvider>
    </ThemeProvider>
);

export default App;
