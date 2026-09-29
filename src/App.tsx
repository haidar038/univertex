import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { VoterLayout } from "./components/VoterLayout";
import { CommitteeLayout } from "./components/CommitteeLayout";
import { ObserverLayout } from "./components/ObserverLayout";
import { AppBootstrap } from "./components/AppBootstrap";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./lib/logger";

// Landing page
import Index from "./pages/Index";
import PublicResultsPage from "./pages/PublicResultsPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

// Auth pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEvents from "./pages/admin/Events";
import AdminEventDetail from "./pages/admin/EventDetail";
import AdminUsers from "./pages/admin/Users";
import AdminClasses from "./pages/admin/Classes";
import AdminInvitations from "./pages/admin/Invitations";
import AdminAuditLog from "./pages/admin/AuditLog";
import AdminSessions from "./pages/admin/Sessions";
import AdminElectionStaff from "./pages/admin/ElectionStaff";
import AdminAuditExport from "./pages/admin/AuditExport";

// Voter/Candidate pages
import VoterDashboard from "./pages/app/Dashboard";
import VotingPage from "./pages/app/VotingPage";
import ResultsPage from "./pages/app/ResultsPage";
import ProfilePage from "./pages/app/Profile";
import CandidateSettings from "./pages/app/CandidateSettings";
import CandidateDashboard from "./pages/app/CandidateDashboard";
import MySessionsPage from "./pages/app/MySessions";

// Committee pages
import CommitteeDashboard from "./pages/committee/Dashboard";
import CommitteeElectionDetail from "./pages/committee/ElectionDetail";
import ObserverDashboard from "./pages/observer/Dashboard";
import ObserverElectionDetail from "./pages/observer/ElectionDetail";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Global handlers for errors that never reach React (e.g. promise rejections
// in event listeners, network failures). Without this they are silently
// dropped in production. Mounted once at module load.
window.addEventListener("error", (e) => {
    logger.error("Uncaught window error", e.error ?? e.message, { action: "window.onerror" });
});
window.addEventListener("unhandledrejection", (e) => {
    logger.error("Unhandled promise rejection", e.reason, { action: "unhandledrejection" });
});

const App = () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                    <AppBootstrap />
                    <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/invite/:token" element={<AcceptInvite />} />
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
                            <Route path="events/:id/staff" element={<AdminElectionStaff />} />
                            <Route path="users" element={<AdminUsers />} />
                            <Route path="classes" element={<AdminClasses />} />
                            <Route path="invitations" element={<AdminInvitations />} />
                            <Route path="audit-log" element={<AdminAuditLog />} />
                            <Route path="audit-export" element={<AdminAuditExport />} />
                            <Route path="sessions" element={<AdminSessions />} />
                            <Route path="profile" element={<ProfilePage />} />
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
                            <Route path="my-sessions" element={<MySessionsPage />} />
                        </Route>

                        {/* Committee routes */}
                        <Route
                            path="/committee"
                            element={
                                <ProtectedRoute requireRole="committee">
                                    <CommitteeLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<CommitteeDashboard />} />
                            <Route path="election/:electionId" element={<CommitteeElectionDetail />} />
                        </Route>

                        {/* Observer routes */}
                        <Route
                            path="/observer"
                            element={
                                <ProtectedRoute requireRole="observer">
                                    <ObserverLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<ObserverDashboard />} />
                            <Route path="election/:electionId" element={<ObserverElectionDetail />} />
                        </Route>

                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
            </TooltipProvider>
        </QueryClientProvider>
        </ErrorBoundary>
    </ThemeProvider>
);

export default App;
