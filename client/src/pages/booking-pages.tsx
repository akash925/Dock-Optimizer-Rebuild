import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { PlusCircle, Edit, Trash2, ExternalLink, Check, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BookingPage } from "@shared/schema";
import BookingPageForm from "@/components/booking-pages/booking-page-form";

export default function BookingPages() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentBookingPage, setCurrentBookingPage] = useState<BookingPage | null>(null);

  // Query to fetch booking pages
  const {
    data: bookingPages,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/booking-pages'],
    retry: false
  });

  // Mutation to delete booking page
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/booking-pages/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking page deleted successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting booking page:", error);
      toast({
        title: "Error",
        description: "Failed to delete booking page",
        variant: "destructive",
      });
    }
  });

  // Mutation to toggle booking page active state
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/booking-pages/${id}`, { isActive });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
      toast({
        title: "Success",
        description: "Booking page status updated",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error updating booking page status:", error);
      toast({
        title: "Error",
        description: "Failed to update booking page status",
        variant: "destructive",
      });
    }
  });

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditClick = (bookingPage: BookingPage) => {
    setCurrentBookingPage(bookingPage);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (bookingPage: BookingPage) => {
    setCurrentBookingPage(bookingPage);
    setIsDeleteDialogOpen(true);
  };

  const handleToggleActive = (bookingPage: BookingPage) => {
    toggleActiveMutation.mutate({
      id: bookingPage.id,
      isActive: !bookingPage.isActive
    });
  };

  const getExternalUrl = (slug: string) => {
    return `/external/${slug}`;
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <h1 className="text-2xl font-bold mb-6">Booking Pages</h1>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <h1 className="text-2xl font-bold mb-6">Booking Pages</h1>
        <div className="bg-destructive/10 p-4 rounded-md text-destructive">
          Error loading booking pages. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Booking Pages</h1>
        <Button onClick={handleCreateClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Booking Page
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="all">All Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Booking Pages</CardTitle>
              <CardDescription>
                These booking pages are currently available to visitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bookingPages && bookingPages.filter(page => page.isActive).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingPages
                      .filter(page => page.isActive)
                      .map((page) => (
                        <TableRow key={page.id}>
                          <TableCell className="font-medium">{page.name}</TableCell>
                          <TableCell>{page.slug}</TableCell>
                          <TableCell>{page.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Switch
                                checked={page.isActive}
                                onCheckedChange={() => handleToggleActive(page)}
                                id={`active-switch-${page.id}`}
                              />
                              <Label htmlFor={`active-switch-${page.id}`} className="ml-2">
                                {page.isActive ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <Check className="h-3 w-3 mr-1" /> Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                    <X className="h-3 w-3 mr-1" /> Inactive
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => window.open(getExternalUrl(page.slug), '_blank')}
                                title="View booking page"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEditClick(page)}
                                title="Edit booking page"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteClick(page)}
                                title="Delete booking page"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No active booking pages found. Create a new one or activate an existing page.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Booking Pages</CardTitle>
              <CardDescription>
                View and manage all your booking pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bookingPages && bookingPages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingPages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell className="font-medium">{page.name}</TableCell>
                        <TableCell>{page.slug}</TableCell>
                        <TableCell>{page.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Switch
                              checked={page.isActive}
                              onCheckedChange={() => handleToggleActive(page)}
                              id={`all-active-switch-${page.id}`}
                            />
                            <Label htmlFor={`all-active-switch-${page.id}`} className="ml-2">
                              {page.isActive ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <Check className="h-3 w-3 mr-1" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                  <X className="h-3 w-3 mr-1" /> Inactive
                                </Badge>
                              )}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(getExternalUrl(page.slug), '_blank')}
                              title="View booking page"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEditClick(page)}
                              title="Edit booking page"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDeleteClick(page)}
                              title="Delete booking page"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No booking pages found. Create a new one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Booking Page</DialogTitle>
            <DialogDescription>
              Create a new external booking page for carriers and customers.
            </DialogDescription>
          </DialogHeader>
          <BookingPageForm
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Booking Page</DialogTitle>
            <DialogDescription>
              Modify the selected booking page.
            </DialogDescription>
          </DialogHeader>
          {currentBookingPage && (
            <BookingPageForm
              bookingPage={currentBookingPage}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this booking page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => currentBookingPage && deleteMutation.mutate(currentBookingPage.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}