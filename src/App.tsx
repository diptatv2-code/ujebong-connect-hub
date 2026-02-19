import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import AppHeader from "./components/AppHeader";
import FeedsPage from "./pages/FeedsPage";
import FriendsPage from "./pages/FriendsPage";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import GroupPage from "./pages/GroupPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="mx-auto max-w-lg">
          <AppHeader />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<FeedsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/group/:groupId" element={<GroupPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
