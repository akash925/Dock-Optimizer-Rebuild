import React from 'react';
import { Clock, User, Truck, Package, MapPin, AlertTriangle, CheckCircle, FileText, Paperclip, Building2, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppointmentCardProps {
  appointment: {
    id: number;
    startTime: string;
    endTime: string;
    customerName?: string;
    carrierName?: string;
    facilityName?: string;
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
    confirmationCode?: string;
    appointmentType?: string;
  };
  onClick?: () => void;
  timeFormat?: '12h' | '24h';
  className?: string;
  showTooltip?: boolean;
  compact?: boolean;
}

export function AppointmentCard({ 
  appointment, 
  onClick, 
  timeFormat = '12h',
  className = '',
  showTooltip = true,
  compact = false
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

  // Enhanced tooltip content with comprehensive appointment details
  const tooltipContent = (
    <div className="space-y-3 max-w-xs">
      <div className="font-semibold text-sm border-b pb-2">
        Appointment #{appointment.id}
        {appointment.confirmationCode && (
          <span className="text-xs text-gray-500 ml-2">({appointment.confirmationCode})</span>
        )}
      </div>
      
      {/* Facility and Type Info */}
      <div className="space-y-1">
        {appointment.facilityName && (
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{appointment.facilityName}</span>
          </div>
        )}
        {appointment.appointmentType && (
          <div className="flex items-center gap-2 text-xs">
            <Hash className="h-3 w-3 text-gray-400" />
            <span>{appointment.appointmentType}</span>
          </div>
        )}
      </div>

      {/* Time and Location */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-gray-400" />
          <span>{formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}</span>
        </div>
        {appointment.dockName && (
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3 w-3 text-gray-400" />
            <span>{appointment.dockName}</span>
          </div>
        )}
      </div>

      {/* Contact Information */}
      <div className="space-y-1">
        {(appointment.customerName || appointment.carrierName) && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{appointment.customerName || appointment.carrierName}</span>
          </div>
        )}
        {appointment.driverName && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3 text-gray-400" />
            <span>Driver: {appointment.driverName}</span>
          </div>
        )}
      </div>

      {/* Vehicle Information */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <Truck className="h-3 w-3 text-gray-400" />
          <span>
            Truck: {appointment.truckNumber}
            {appointment.trailerNumber && ` | Trailer: ${appointment.trailerNumber}`}
          </span>
        </div>
      </div>

      {/* Shipment Details */}
      {(appointment.bolNumber || appointment.weight || appointment.palletCount) && (
        <div className="space-y-1">
          {appointment.bolNumber && (
            <div className="flex items-center gap-2 text-xs">
              <FileText className="h-3 w-3 text-gray-400" />
              <span>BOL: {appointment.bolNumber}</span>
            </div>
          )}
          {(appointment.weight || appointment.palletCount) && (
            <div className="flex items-center gap-2 text-xs">
              <Package className="h-3 w-3 text-gray-400" />
              <span>
                {appointment.weight && appointment.weight}
                {appointment.weight && appointment.palletCount && ' | '}
                {appointment.palletCount && `${appointment.palletCount} pallets`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {hasAttachments && (
        <div className="flex items-center gap-2 text-xs text-blue-700">
          <Paperclip className="h-3 w-3" />
          <span>{attachmentCount} BOL document{attachmentCount > 1 ? 's' : ''} attached</span>
        </div>
      )}

      {/* Notes */}
      {appointment.notes && (
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-t">
          <span className="font-medium">Notes:</span><br />
          <span>{appointment.notes}</span>
        </div>
      )}
    </div>
  );

  const cardContent = (
    <Card 
      className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-l-4 ${
        appointment.type === 'inbound' 
          ? 'border-l-blue-500 hover:border-l-blue-600' 
          : 'border-l-green-500 hover:border-l-green-600'
      } ${
        appointment.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-white' :
        appointment.status === 'in-progress' ? 'bg-gradient-to-r from-blue-50 to-white' :
        appointment.status === 'cancelled' ? 'bg-gradient-to-r from-red-50 to-white' :
        'bg-white'
      } ${className}`}
      onClick={onClick}
    >
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {/* Header with status and attachment indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Badge variant={getStatusBadgeVariant()} className="text-xs font-medium">
                {appointment.status.replace('-', ' ')}
              </Badge>
              <Badge 
                variant={appointment.type === 'inbound' ? 'default' : 'secondary'}
                className="text-xs font-medium"
              >
                {appointment.type}
              </Badge>
            </div>
            
            {/* BOL Attachment Indicator */}
            {hasAttachments && (
              <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors">
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
            <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
              </span>
            </div>
            {appointment.dockName && (
              <Badge variant="outline" className="text-xs font-medium border-gray-300">
                📍 {appointment.dockName}
              </Badge>
            )}
          </div>

          {/* Facility name - NEW FEATURE */}
          {appointment.facilityName && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-blue-700">{appointment.facilityName}</span>
            </div>
          )}

          {/* Customer/Carrier and truck information */}
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {(appointment.customerName || appointment.carrierName) && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-semibold text-gray-900">
                  {appointment.customerName || appointment.carrierName}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Truck className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                🚛 {appointment.truckNumber}
                {appointment.trailerNumber && ` | 🚚 ${appointment.trailerNumber}`}
              </span>
            </div>

            {appointment.driverName && !compact && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4 text-gray-400" />
                <span>👤 {appointment.driverName}</span>
              </div>
            )}
          </div>

          {/* BOL and shipment details */}
          {!compact && (appointment.bolNumber || appointment.weight || appointment.palletCount) && (
            <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              {appointment.bolNumber && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="font-medium">BOL #{appointment.bolNumber}</span>
                </div>
              )}
              {appointment.weight && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>⚖️ {appointment.weight}</span>
                </div>
              )}
              {appointment.palletCount && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>📦 {appointment.palletCount} pallets</span>
                </div>
              )}
            </div>
          )}

          {/* Notes preview */}
          {!compact && appointment.notes && (
            <div className="text-xs text-gray-600 bg-amber-50 p-2 rounded border border-amber-200">
              <span className="line-clamp-2">💬 {appointment.notes}</span>
            </div>
          )}

          {/* Confirmation code for quick reference */}
          {appointment.confirmationCode && (
            <div className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded text-center">
              #{appointment.confirmationCode}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Wrap with tooltip if enabled
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-white border border-gray-200 shadow-lg">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
} 