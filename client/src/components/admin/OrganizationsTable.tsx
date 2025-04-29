import React from 'react';
import { useLocation } from 'wouter';
import { Edit, Users, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tenant } from '@shared/schema';

// Extended tenant type with additional counts
type EnhancedTenant = Tenant & {
  userCount: number;
  moduleCount: number;
};

interface OrganizationsTableProps {
  organizations: EnhancedTenant[];
}

// Get status badge variant
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return <Badge className="bg-green-500">Active</Badge>;
    case 'SUSPENDED':
      return <Badge variant="destructive">Suspended</Badge>;
    case 'TRIAL':
      return <Badge className="bg-blue-500">Trial</Badge>;
    case 'PENDING':
      return <Badge variant="outline">Pending</Badge>;
    case 'INACTIVE':
      return <Badge variant="secondary">Inactive</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Memoized OrganizationsTable component
const OrganizationsTable = React.memo(function OrganizationsTable({ organizations }: OrganizationsTableProps) {
  const [, navigate] = useLocation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Users
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" /> Modules
            </div>
          </TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations && organizations.length > 0 ? (
          organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.name}</TableCell>
              <TableCell>{getStatusBadge(org.status || 'ACTIVE')}</TableCell>
              <TableCell>{org.userCount}</TableCell>
              <TableCell>{org.moduleCount}</TableCell>
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
            <TableCell colSpan={5} className="h-24 text-center">
              No organizations found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
});

export default OrganizationsTable;