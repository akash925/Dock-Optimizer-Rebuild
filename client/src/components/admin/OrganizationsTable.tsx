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
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";
import { TenantStatus } from "@shared/schema";

// Interface for orgs with count information
interface EnhancedTenant {
  id: number;
  name: string;
  subdomain: string;
  status: TenantStatus | null;
  userCount: number;
  moduleCount: number;
  createdAt: string;
}

interface OrganizationsTableProps {
  organizations: EnhancedTenant[];
}

const OrganizationsTable: React.FC<OrganizationsTableProps> = React.memo(({ organizations }) => {
  const [, navigate] = useLocation();

  // Format badge color based on status
  const getStatusBadge = (status: TenantStatus | null) => {
    switch (status) {
      case TenantStatus.ACTIVE:
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case TenantStatus.INACTIVE:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Inactive</Badge>;
      case TenantStatus.SUSPENDED:
        return <Badge className="bg-red-500 hover:bg-red-600">Suspended</Badge>;
      case TenantStatus.TRIAL:
        return <Badge className="bg-blue-500 hover:bg-blue-600">Trial</Badge>;
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600">Unknown</Badge>;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  // Display module count
  const displayModuleCount = (moduleCount: number) => {
    return moduleCount ? moduleCount.toString() : "0";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Active Modules</TableHead>
          <TableHead>Users</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations && organizations.length > 0 ? (
          organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.name}</TableCell>
              <TableCell>{getStatusBadge(org.status)}</TableCell>
              <TableCell>{displayModuleCount(org.moduleCount)}</TableCell>
              <TableCell>{org.userCount}</TableCell>
              <TableCell>{formatDate(org.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/orgs/${org.id}`)}
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
            <TableCell colSpan={6} className="h-24 text-center">
              No organizations found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
});

OrganizationsTable.displayName = "OrganizationsTable";

export default OrganizationsTable;