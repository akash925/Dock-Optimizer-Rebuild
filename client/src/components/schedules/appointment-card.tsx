import React from 'react';
import { Clock, User, Truck, Package, MapPin, AlertTriangle, CheckCircle, FileText, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AppointmentCardProps {
  appointment: {
    id: number;
    startTime: string;
    endTime: string;
    customerName?: string;
    carrierName?: string;
    type: 'inbound' | 'outbound';
    status: string;
    dockName?: string;
    truckNumber: string;
    trailerNumber?: string;
    driverName?: string;
    bolNumber?: string;
    bolDocumentPath?: string;
    customFormData?: any;
    bolDocuments?: any[];
    weight?: string;
    palletCount?: string;
    notes?: string;
  };
  onClick?: () => void;
  timeFormat?: '12h' | '24h';
  className?: string;
}

export function AppointmentCard({ 
  appointment, 
  onClick, 
  timeFormat = '12h',
  className = '' 
}: AppointmentCardProps) {
  // Helper function to check if BOL documents are attached
  const hasBolAttachments = () => {
    // Check multiple sources for BOL attachments
    if (appointment.bolNumber || appointment.bolDocumentPath) return true;
    if (appointment.bolDocuments && appointment.bolDocuments.length > 0) return true;
    
    // Check customFormData for BOL data
    if (appointment.customFormData) {
      try {
        const parsedData = typeof appointment.customFormData === 'string' 
          ? JSON.parse(appointment.customFormData) 
          : appointment.customFormData;
        
        if (parsedData?.bolData || parsedData?.bolFiles?.length > 0 || parsedData?.bolUpload) {
          return true;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return false;
  };

  // Get BOL attachment count
  const getBolAttachmentCount = () => {
    let count = 0;
    
    if (appointment.bolDocuments && appointment.bolDocuments.length > 0) {
      count += appointment.bolDocuments.length;
    }
    
    if (appointment.customFormData) {
      try {
        const parsedData = typeof appointment.customFormData === 'string' 
          ? JSON.parse(appointment.customFormData) 
          : appointment.customFormData;
        
        if (parsedData?.bolFiles?.length > 0) {
          count += parsedData.bolFiles.length;
        } else if (parsedData?.bolUpload || parsedData?.bolData) {
          count += 1;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // If we found a BOL number or document path but no files, count as 1
    if (count === 0 && (appointment.bolNumber || appointment.bolDocumentPath)) {
      count = 1;
    }
    
    return count;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return timeFormat === '24h' 
      ? format(date, 'HH:mm')
      : format(date, 'h:mm a');
  };

  const getStatusIcon = () => {
    switch (appointment.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = () => {
    switch (appointment.status) {
      case 'completed':
        return 'default';
      case 'in-progress':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const attachmentCount = getBolAttachmentCount();
  const hasAttachments = hasBolAttachments();

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with status and attachment indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Badge variant={getStatusBadgeVariant()} className="text-xs">
                {appointment.status.replace('-', ' ')}
              </Badge>
              <Badge 
                variant={appointment.type === 'inbound' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {appointment.type}
              </Badge>
            </div>
            
            {/* BOL Attachment Indicator */}
            {hasAttachments && (
              <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
                <Paperclip className="h-3 w-3" />
                {attachmentCount > 1 && (
                  <span className="text-xs font-medium">{attachmentCount}</span>
                )}
                <span className="text-xs font-medium">BOL</span>
              </div>
            )}
          </div>

          {/* Time and dock information */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
              </span>
            </div>
            {appointment.dockName && (
              <Badge variant="outline" className="text-xs">
                {appointment.dockName}
              </Badge>
            )}
          </div>

          {/* Customer/Carrier and truck information */}
          <div className="space-y-2">
            {(appointment.customerName || appointment.carrierName) && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">
                  {appointment.customerName || appointment.carrierName}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Truck className="h-4 w-4 text-gray-400" />
              <span>
                {appointment.truckNumber}
                {appointment.trailerNumber && ` / ${appointment.trailerNumber}`}
              </span>
            </div>

            {appointment.driverName && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4 text-gray-400" />
                <span>{appointment.driverName}</span>
              </div>
            )}
          </div>

          {/* BOL and shipment details */}
          {(appointment.bolNumber || appointment.weight || appointment.palletCount) && (
            <div className="flex items-center gap-4 text-xs text-gray-600">
              {appointment.bolNumber && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>BOL #{appointment.bolNumber}</span>
                </div>
              )}
              {appointment.weight && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{appointment.weight}</span>
                </div>
              )}
              {appointment.palletCount && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{appointment.palletCount} pallets</span>
                </div>
              )}
            </div>
          )}

          {/* Notes preview */}
          {appointment.notes && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
              <span className="line-clamp-2">{appointment.notes}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 