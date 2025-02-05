import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { MessageCircle, Users, Settings, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t h-16 px-4 flex items-center justify-around">
      <Link href="/">
        <a className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
          <Users className="h-6 w-6" />
          <span className="text-xs mt-1">Users</span>
        </a>
      </Link>
      <Link href="/chat">
        <a className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs mt-1">Chats</span>
        </a>
      </Link>
      <Link href="/settings">
        <a className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="h-6 w-6" />
          <span className="text-xs mt-1">Settings</span>
        </a>
      </Link>
      {isAdmin && (
        <Link href="/admin">
          <a className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-6 w-6" />
            <span className="text-xs mt-1">Admin</span>
          </a>
        </Link>
      )}
    </nav>
  );
}
