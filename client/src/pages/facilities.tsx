import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Clock, 
  Edit, 
  Loader2, 
  MoreHorizontal, 
  MapPin, 
  Plus, 
  Settings, 
  Trash
} from "lucide-react";
import Layout from "@/components/layout/layout";
import { useToast } from "@/hooks/use-toast";
import { Facility } from "@shared/schema";

export default function FacilitiesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Fetch facilities
  const { data: facilities, isLoading } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
    queryFn: async () => {
      const response = await fetch('/api/facilities');
      if (!response.ok) {
        throw new Error('Failed to fetch facilities');
      }
      return response.json();
    },
  });
  
  // Handle edit facility
  const handleEditFacility = (id: number) => {
    setLocation(`/facility-settings/${id}`);
  };
  
  // Handle view facility schedule
  const handleViewFacilitySchedule = (id: number) => {
    setLocation(`/schedules?facilityId=${id}`);
  };
  
  // Format facility address
  const formatAddress = (facility: Facility) => {
    return [
      facility.address1,
      facility.address2,
      `${facility.city}, ${facility.state} ${facility.pincode}`,
      facility.country
    ].filter(Boolean).join(", ");
  };
  
  // Display loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Facilities</h1>
          <Button onClick={() => setLocation("/facility-settings")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Facility
          </Button>
        </div>
        
        {/* Facilities list */}
        {facilities?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <p className="text-muted-foreground mb-4 text-center">
                No facilities found. Add your first facility to get started.
              </p>
              <Button onClick={() => setLocation("/facility-settings")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Facility
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Facilities</CardTitle>
              <CardDescription>
                Manage your facilities and their operating hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilities?.map((facility) => (
                    <TableRow key={facility.id}>
                      <TableCell className="font-medium">{facility.name}</TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span>{formatAddress(facility)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{facility.timezone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditFacility(facility.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Facility
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewFacilitySchedule(facility.id)}>
                              <Clock className="mr-2 h-4 w-4" />
                              View Schedule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}