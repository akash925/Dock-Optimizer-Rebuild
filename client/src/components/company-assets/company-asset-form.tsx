import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { 
  AssetCategory, 
  AssetLocation, 
  AssetStatus,
  insertCompanyAssetSchema, 
  InsertCompanyAsset, 
  CompanyAsset 
} from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, UploadCloud, Tags, Calendar, DollarSign, Map, AlertCircle } from 'lucide-react';
import AssetPhotoDropzone from '@/components/AssetPhotoDropzone';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface CompanyAssetFormProps {
  assetToEdit?: CompanyAsset;
  onSuccess?: () => void;
}

export function CompanyAssetForm({ assetToEdit, onSuccess }: CompanyAssetFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!assetToEdit;

  // Format date for display
  const formatDate = (date: Date | string | null | undefined): string | undefined => {
    if (!date) return undefined;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'yyyy-MM-dd');
  };

  // Parse tags from JSON to array to string
  const parseTagsToString = (tags: any | null | undefined): string => {
    if (!tags) return '';
    try {
      if (typeof tags === 'string') {
        const parsed = JSON.parse(tags);
        return Array.isArray(parsed) ? parsed.join(', ') : '';
      }
      return Array.isArray(tags) ? tags.join(', ') : '';
    } catch (e) {
      return typeof tags === 'string' ? tags : '';
    }
  };

  // Define form with validation
  const form = useForm<InsertCompanyAsset>({
    resolver: zodResolver(insertCompanyAssetSchema.omit({ photoUrl: true, tags: true, documentUrls: true })),
    defaultValues: {
      name: assetToEdit?.name || '',
      manufacturer: assetToEdit?.manufacturer || '',
      owner: assetToEdit?.owner || '',
      department: assetToEdit?.department || '',
      category: assetToEdit?.category || AssetCategory.EQUIPMENT,
      barcode: assetToEdit?.barcode || '',
      serialNumber: assetToEdit?.serialNumber || '',
      description: assetToEdit?.description || '',
      
      // Financial information
      purchasePrice: assetToEdit?.purchasePrice || '',
      currency: assetToEdit?.currency || 'USD',
      purchaseDate: assetToEdit?.purchaseDate ? formatDate(assetToEdit.purchaseDate) : undefined,
      implementedDate: assetToEdit?.implementedDate ? formatDate(assetToEdit.implementedDate) : undefined,
      warrantyExpiration: assetToEdit?.warrantyExpiration ? formatDate(assetToEdit.warrantyExpiration) : undefined,
      depreciation: assetToEdit?.depreciation || '',
      assetValue: assetToEdit?.assetValue || '',
      
      // Location and status
      location: assetToEdit?.location || AssetLocation.WAREHOUSE,
      status: assetToEdit?.status || AssetStatus.ACTIVE,
      
      // Template
      template: assetToEdit?.template || '',
      
      // Additional metadata
      model: assetToEdit?.model || '',
      assetCondition: assetToEdit?.assetCondition || '',
      notes: assetToEdit?.notes || '',
      manufacturerPartNumber: assetToEdit?.manufacturerPartNumber || '',
      supplierName: assetToEdit?.supplierName || '',
      poNumber: assetToEdit?.poNumber || '',
      vendorInformation: assetToEdit?.vendorInformation || '',
      
      // Tracking dates and maintenance info
      lastServiceDate: assetToEdit?.lastServiceDate ? formatDate(assetToEdit.lastServiceDate) : undefined,
      nextServiceDate: assetToEdit?.nextServiceDate ? formatDate(assetToEdit.nextServiceDate) : undefined,
      maintenanceSchedule: assetToEdit?.maintenanceSchedule || '',
      certificationDate: assetToEdit?.certificationDate ? formatDate(assetToEdit.certificationDate) : undefined,
      certificationExpiry: assetToEdit?.certificationExpiry ? formatDate(assetToEdit.certificationExpiry) : undefined,
    },
  });

  // Set photo preview if editing and has photo
  useEffect(() => {
    if (assetToEdit?.photoUrl) {
      setPhotoPreview(assetToEdit.photoUrl);
    }
    if (assetToEdit?.tags) {
      setTagsInput(parseTagsToString(assetToEdit.tags));
    }
  }, [assetToEdit]);



  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertCompanyAsset) => {
      const formData = new FormData();
      
      // Add form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      
      // Add tags as JSON array
      if (tagsInput.trim()) {
        const tagsArray = tagsInput.split(',').map(tag => tag.trim());
        formData.append('tags', JSON.stringify(tagsArray));
      }
      
      // Add photo if selected
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await apiRequest('POST', '/api/company-assets', formData, { useFormData: true });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Asset created',
        description: 'Company asset has been created successfully.',
      });
      
      // Reset form
      form.reset();
      setPhotoFile(null);
      setPhotoPreview(null);
      setTagsInput('');
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['companyAssets', user?.tenantId] });
      
      // Call success callback if provided
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InsertCompanyAsset) => {
      if (!assetToEdit) throw new Error('No asset to update');
      
      const formData = new FormData();
      
      // Add form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      
      // Add tags as JSON array
      if (tagsInput.trim()) {
        const tagsArray = tagsInput.split(',').map(tag => tag.trim());
        formData.append('tags', JSON.stringify(tagsArray));
      }
      
      // Add photo if selected
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await apiRequest('PUT', `/api/company-assets/${assetToEdit.id}`, formData, { useFormData: true });
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Asset updated',
        description: 'Company asset has been updated successfully.',
      });
      
      // Reset form state
      setPhotoFile(null);
      setPhotoPreview(null);
      setTagsInput('');
      
      // Invalidate queries to refresh lists - this will match all query keys that start with this prefix
      // ensuring that searches with different filter parameters are also refreshed
      queryClient.invalidateQueries({
        queryKey: ['companyAssets', user?.tenantId],
        exact: false
      });
      
      // Call success callback if provided
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: InsertCompanyAsset) => {
    console.log("=== ASSET FORM SUBMISSION ===");
    console.log("Form submission data:", data);
    console.log("Is editing:", isEditing);
    console.log("Asset to edit:", assetToEdit);
    console.log("Form validation errors:", form.formState.errors);
    
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Check if form is submitting
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Format field labels from keys
  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Asset' : 'Add New Asset'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 mb-6">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              </TabsList>
              
              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Asset Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter asset name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Asset Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AssetCategory).map(([key, value]) => (
                              <SelectItem key={value} value={value}>
                                {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Manufacturer */}
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter manufacturer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Model */}
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter model number/name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Owner */}
                  <FormField
                    control={form.control}
                    name="owner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter owner/responsible person" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Department */}
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department or business unit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AssetStatus).map(([key, value]) => (
                              <SelectItem key={value} value={value}>
                                {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Location</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AssetLocation).map(([key, value]) => (
                              <SelectItem key={value} value={value}>
                                {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter asset description" 
                            className="min-h-[100px]" 
                            {...field} 
                            value={field.value || ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Barcode */}
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter barcode" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Serial Number */}
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter serial number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Template */}
                  <FormField
                    control={form.control}
                    name="template"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter template name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Manufacturer Part Number */}
                  <FormField
                    control={form.control}
                    name="manufacturerPartNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer Part #</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter manufacturer part number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Condition */}
                  <FormField
                    control={form.control}
                    name="assetCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter asset condition" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Supplier Name */}
                  <FormField
                    control={form.control}
                    name="supplierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter supplier/vendor name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Purchase Order Number */}
                  <FormField
                    control={form.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter purchase order reference" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Vendor Information */}
                  <FormField
                    control={form.control}
                    name="vendorInformation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Information</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter additional vendor details" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tags */}
                  <div className="col-span-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <div className="flex items-center mt-1.5">
                      <Tags className="mr-2 h-4 w-4 opacity-70" />
                      <Input
                        id="tags"
                        placeholder="Enter tags separated by commas (e.g., warehouse, dock, heavy)"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tags help with filtering and searching for assets
                    </p>
                  </div>

                  {/* Last Service Date */}
                  <FormField
                    control={form.control}
                    name="lastServiceDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Last Service Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Next Service Date */}
                  <FormField
                    control={form.control}
                    name="nextServiceDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Next Service Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter additional notes about this asset" 
                            className="min-h-[100px]" 
                            {...field} 
                            value={field.value || ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              {/* Financial Tab */}
              <TabsContent value="financial" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Purchase Price */}
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="text" 
                              placeholder="0.00" 
                              className="pl-8" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Currency */}
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CAD">CAD ($)</SelectItem>
                            <SelectItem value="AUD">AUD ($)</SelectItem>
                            <SelectItem value="JPY">JPY (¥)</SelectItem>
                            <SelectItem value="CNY">CNY (¥)</SelectItem>
                            <SelectItem value="INR">INR (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Purchase Date */}
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Purchase Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Implemented Date */}
                  <FormField
                    control={form.control}
                    name="implementedDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Implementation Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Warranty Expiration */}
                  <FormField
                    control={form.control}
                    name="warrantyExpiration"
                    render={({ field }) => (
                      <FormItem className="flex flex-col col-span-2">
                        <FormLabel>Warranty Expiration Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Depreciation */}
                  <FormField
                    control={form.control}
                    name="depreciation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter depreciation amount or schedule" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter depreciation schedule or amount per year
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Asset Value */}
                  <FormField
                    control={form.control}
                    name="assetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Value</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="text" 
                              placeholder="0.00" 
                              className="pl-8" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Current book value of the asset
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              {/* Maintenance Tab */}
              <TabsContent value="maintenance" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Last Maintenance Date */}
                  <FormField
                    control={form.control}
                    name="lastMaintenanceDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Last Maintenance Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Next Maintenance Date */}
                  <FormField
                    control={form.control}
                    name="nextMaintenanceDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Next Maintenance Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Maintenance Schedule */}
                  <FormField
                    control={form.control}
                    name="maintenanceSchedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maintenance Schedule</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Monthly, Quarterly, Annually" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          How often maintenance should be performed
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Maintenance Contact */}
                  <FormField
                    control={form.control}
                    name="maintenanceContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maintenance Contact</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter maintenance contact person or company" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Maintenance Notes */}
                  <FormField
                    control={form.control}
                    name="maintenanceNotes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Maintenance Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter maintenance history or requirements" 
                            className="min-h-[100px]" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Implementation Date */}
                  <FormField
                    control={form.control}
                    name="implementationDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Implementation Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          When the asset was initially deployed
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Expected Lifetime */}
                  <FormField
                    control={form.control}
                    name="expectedLifetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Lifetime</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 5 years" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Expected operational lifespan of the asset
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              

            </Tabs>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="min-w-32"
                size="lg"
                onClick={() => {
                  console.log("=== ASSET FORM BUTTON CLICKED ===");
                  console.log("Form state:", form.formState);
                  console.log("Form errors:", form.formState.errors);
                  console.log("Form values:", form.getValues());
                  console.log("Is editing:", isEditing);
                  console.log("Asset to edit:", assetToEdit);
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {isEditing ? 'Update Asset' : 'Create Asset'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}