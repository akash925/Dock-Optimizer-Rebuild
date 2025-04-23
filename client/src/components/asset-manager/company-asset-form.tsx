import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AssetCategory, insertCompanyAssetSchema, InsertCompanyAsset, CompanyAsset } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, UploadCloud } from 'lucide-react';

interface CompanyAssetFormProps {
  assetToEdit?: CompanyAsset;
  onSuccess?: () => void;
}

export function CompanyAssetForm({ assetToEdit, onSuccess }: CompanyAssetFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!assetToEdit;

  // Define form with validation
  const form = useForm<InsertCompanyAsset>({
    resolver: zodResolver(insertCompanyAssetSchema.omit({ photoUrl: true })),
    defaultValues: {
      name: assetToEdit?.name || '',
      manufacturer: assetToEdit?.manufacturer || '',
      owner: assetToEdit?.owner || '',
      category: assetToEdit?.category || AssetCategory.EQUIPMENT,
      description: assetToEdit?.description || '',
      barcode: assetToEdit?.barcode || '',
    },
  });

  // Set photo preview if editing and has photo
  useEffect(() => {
    if (assetToEdit?.photoUrl) {
      setPhotoPreview(assetToEdit.photoUrl);
    }
  }, [assetToEdit]);

  // Handle photo file change
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
      
      // Add photo if selected
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await fetch('/api/asset-manager/company-assets', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create company asset');
      }
      
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
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['/api/asset-manager/company-assets'] });
      
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
      
      // Add photo if selected
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await fetch(`/api/asset-manager/company-assets/${assetToEdit.id}`, {
        method: 'PUT',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update company asset');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Asset updated',
        description: 'Company asset has been updated successfully.',
      });
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['/api/asset-manager/company-assets'] });
      
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
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Check if form is submitting
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    defaultValue={field.value}
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
                    <Input placeholder="Enter manufacturer" {...field} />
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
                    <Input placeholder="Enter owner name or department" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Barcode */}
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barcode/Serial Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter barcode or serial number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
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

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              
              {photoPreview && (
                <div className="my-4 w-40 h-40 relative">
                  <img 
                    src={photoPreview} 
                    alt="Asset preview" 
                    className="w-full h-full object-cover rounded-md" 
                  />
                </div>
              )}
              
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              <FormDescription>
                Upload a photo of the asset (optional)
              </FormDescription>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full"
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}