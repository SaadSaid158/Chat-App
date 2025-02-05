import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import ChatPage from "@/pages/chat-page";
import AdminPage from "@/pages/admin-page";
import SettingsPage from "@/pages/settings-page";
import { ProtectedRoute } from "./lib/protected-route";
import { BottomNav } from "@/components/ui/bottom-nav";

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen pb-16">
      {children}
      {user && <BottomNav />}
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/chat/:userId" component={ChatPage} />
        <ProtectedRoute path="/admin" component={AdminPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;