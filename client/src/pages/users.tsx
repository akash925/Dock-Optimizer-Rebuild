import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Role } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, PlusCircle, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UserForm from "@/components/users/user-form";
import { ColumnDef } from "@tanstack/react-table";

export default function Users() {
  const { toast } = useToast();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Fetch users with strict cache control for tenant isolation
  const { data: users = [], isLoading } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
    staleTime: 0,
    gcTime: 0,
  });
  
  // Role badge variants
  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      case "worker":
        return "secondary";
      default:
        return "outline";
    }
  };
  
  // User columns definition
  const columns: ColumnDef<Omit<User, "password">>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({
        row
      }: any) => (
        <span className="text-xs text-neutral-500">#{row.getValue("id")}</span>
      ),
    },
    {
      accessorKey: "username",
      header: "User",
      cell: ({
        row
      }: any) => {
        const user = row.original;
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.username}</div>
              <div className="text-xs text-neutral-500">
                {user.firstName} {user.lastName}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({
        row
      }: any) => {
        const role = row.getValue("role") as Role;
        return (
          <Badge variant={getRoleBadgeVariant(role)}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({
        row
      }: any) => {
        const createdAt = row.getValue("createdAt") as string;
        return new Date(createdAt).toLocaleDateString();
      },
    },
    {
      id: "actions",
      cell: ({
        row
      }: any) => {
        return (
          <Button
            variant="ghost" 
            onClick={() => setSelectedUser(row.original as User)}
            className="p-0 h-8 px-2"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">User Management</h2>
        <Button onClick={() => setIsAddUserOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={users} 
            searchKey="username"
            searchPlaceholder="Search users..."
          />
        </CardContent>
      </Card>
      
      {/* User details dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-xl">
                    {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">First Name</p>
                  <p className="font-medium">{selectedUser.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Last Name</p>
                  <p className="font-medium">{selectedUser.lastName}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-neutral-500">Username</p>
                <p className="font-medium">{selectedUser.username}</p>
              </div>
              
              <div>
                <p className="text-sm text-neutral-500">Email</p>
                <p className="font-medium">{selectedUser.email}</p>
              </div>
              
              <div>
                <p className="text-sm text-neutral-500">Role</p>
                <Badge variant={getRoleBadgeVariant(selectedUser.role as Role)} className="mt-1">
                  {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm text-neutral-500">Created At</p>
                <p className="font-medium">
                  {new Date(selectedUser.createdAt).toLocaleDateString()} at {new Date(selectedUser.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      <UserForm
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        {...{} as any} // Additional props for UserFormProps compatibility
      />
    </div>
  );
}
