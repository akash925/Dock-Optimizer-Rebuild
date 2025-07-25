import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { schedules } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Create the missing schema locally
const insertScheduleSchema = createInsertSchema(schedules);
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Schedule, Dock, Carrier } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

// Extend the schedule schema with formatting
const scheduleFormSchema = insertScheduleSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
  dockId: z.coerce.number(),
  carrierId: z.coerce.number(),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

interface ScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  mode: "create" | "edit";
}

export default function ScheduleForm({
  isOpen,
  onClose,
  initialData,
  mode,
}: ScheduleFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Set up the form
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          startTime: format(new Date(initialData.startTime), "yyyy-MM-dd'T'HH:mm"),
          endTime: format(new Date(initialData.endTime), "yyyy-MM-dd'T'HH:mm"),
        }
      : {
          dockId: 0,
          carrierId: 0,
          truckNumber: "",
          startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          endTime: format(new Date(new Date().getTime() + 2 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
          type: "inbound",
          status: "scheduled",
          notes: "",
          createdBy: user?.id || 0,
        },
  });
  
  // Create mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: ScheduleFormValues) => {
      const res = await apiRequest("POST", "/api/schedules", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule created",
        description: "The schedule has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create schedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ScheduleFormValues> }) => {
      const res = await apiRequest("PUT", `/api/schedules/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule updated",
        description: "The schedule has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update schedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  async function onSubmit(data: ScheduleFormValues) {
    setIsSubmitting(true);
    
    try {
      if (mode === "create") {
        await createScheduleMutation.mutateAsync(data);
      } else if (mode === "edit" && initialData) {
        await updateScheduleMutation.mutateAsync({ id: initialData.id, data });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Schedule" : "Edit Schedule"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Add a new dock schedule for trucks." 
              : "Make changes to the existing schedule."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dockId"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Dock</FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dock" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {docks.map((dock: any) => <SelectItem key={dock.id} value={dock.id.toString()}>
                          {dock.name}
                        </SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="carrierId"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {carriers.map((carrier: any) => <SelectItem key={carrier.id} value={carrier.id.toString()}>
                          {carrier.name}
                        </SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="truckNumber"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Truck Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter truck identification" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endTime"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional information about this schedule"
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
