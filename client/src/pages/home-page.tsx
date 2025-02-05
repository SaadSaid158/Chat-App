import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, UserPlus, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: contacts, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/contacts"],
    retry: 1,
  });

  const addContactMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("POST", "/api/contacts", { username });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact added",
        description: "User has been added to your contacts",
      });
      setUsername("");
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-destructive mb-2">Failed to load contacts</h2>
              <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/contacts"] })}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">SecureChat</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <UserPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
                <DialogDescription>
                  Enter a username to add them to your contacts
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addContactMutation.mutate(username);
                }}
                className="space-y-4"
              >
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
                <Button type="submit" className="w-full" disabled={!username.trim() || addContactMutation.isPending}>
                  {addContactMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {contacts?.length === 0 ? (
          <Card className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">No contacts yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first contact to start chatting securely
            </p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts?.map((contact) => (
              <Card
                key={contact.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setLocation(`/chat/${contact.id}`)}
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>{contact.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-medium">{contact.username}</h3>
                    <Badge
                      variant={contact.status === "online" ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {contact.status}
                    </Badge>
                  </div>
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}