import React from "react";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

// User type with roles
interface UserWithRoles {
  userId: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: {
    orgId: number;
    orgName: string;
    roleName: string;
  }[];
}

interface UsersTableProps {
  users: UserWithRoles[];
}

const UsersTable: React.FC<UsersTableProps> = React.memo(({ users }) => {
  const [, navigate] = useLocation();

  // Format roles as a comma-separated list
  const formatRoles = (roles: UserWithRoles["roles"]) => {
    if (!roles || roles.length === 0) return "None";
    return roles.map((role) => `${role.orgName} (${role.roleName})`).join(", ");
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Organizations & Roles</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users && users.length > 0 ? (
          users.map((user) => (
            <TableRow key={user.userId}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>
                {user.firstName} {user.lastName}
              </TableCell>
              <TableCell>{formatRoles(user.roles)}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/users/${user.userId}`)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="h-24 text-center">
              No users found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
});

UsersTable.displayName = "UsersTable";

export default UsersTable;