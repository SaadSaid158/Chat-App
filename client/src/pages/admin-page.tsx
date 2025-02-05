import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, UserX, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: 1,
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: number; updates: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User updated",
        description: "User has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User deleted",
        description: "User has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-xl font-bold text-destructive">Access Denied</h1>
            <p className="mt-2">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-xl font-bold text-destructive">Error</h1>
            <p className="mt-2">{error.message}</p>
            <Button 
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((userRow) => (
                <TableRow key={userRow.id}>
                  <TableCell>{userRow.id}</TableCell>
                  <TableCell>{userRow.username}</TableCell>
                  <TableCell>{userRow.status}</TableCell>
                  <TableCell>
                    {userRow.lastSeen ? new Date(userRow.lastSeen).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={userRow.isAdmin}
                      disabled={userRow.id === user.id}
                      onCheckedChange={(checked) =>
                        updateUserMutation.mutate({
                          userId: userRow.id,
                          updates: { isAdmin: checked },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={userRow.id === user.id}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Ban
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Ban User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to ban {userRow.username}? This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(userRow.id)}
                            >
                              Ban User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}