import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@shared/schema";
import AdminLayout from "@/components/layout/admin-layout";
import OrganizationsTable from "@/components/admin/OrganizationsTable";
import debounce from "lodash.debounce";

// Extended tenant type with additional counts
type EnhancedTenant = Tenant & {
  userCount: number;
  moduleCount: number;
};

export default function OrganizationsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOrganizations, setFilteredOrganizations] = useState<EnhancedTenant[]>([]);

  // Fetch organizations data
  const { data: organizations, isLoading, error } = useQuery<EnhancedTenant[]>({
    queryKey: ['/api/admin/orgs'], // Using the existing endpoint
    onSuccess: (data) => {
      setFilteredOrganizations(data || []);
    }
  });

  // Handle add organization
  const handleAddOrganization = () => {
    navigate('/admin/orgs/new');
  };

  // Handle search with debounce
  const handleSearch = useCallback(
    debounce((searchValue: string) => {
      if (!organizations) return;
      
      setSearchTerm(searchValue);
      if (!searchValue.trim()) {
        setFilteredOrganizations(organizations);
        return;
      }
      
      const lowerCaseSearch = searchValue.toLowerCase();
      const filtered = organizations.filter(org => 
        org.name.toLowerCase().includes(lowerCaseSearch) || 
        org.subdomain?.toLowerCase().includes(lowerCaseSearch) ||
        org.status?.toLowerCase().includes(lowerCaseSearch)
      );
      
      setFilteredOrganizations(filtered);
    }, 300),
    [organizations]
  );

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
          <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
          <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle />
                <span>Failed to load organizations: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
            <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          </div>
          <Button onClick={handleAddOrganization} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Organization
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Organization List</CardTitle>
            <CardDescription>
              View and manage all organizations in the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search organizations..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            
            {/* Memoized organizations table component */}
            <OrganizationsTable organizations={filteredOrganizations} />
            
            {/* Empty state when filtered results are empty */}
            {filteredOrganizations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p>No organizations found matching "{searchTerm}"</p>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setSearchTerm("");
                      setFilteredOrganizations(organizations || []);
                    }}
                  >
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}