import { Request, Response } from 'express';
import { getStorage } from '../../storage';
import { mediaService } from '../../services/MediaService';
import { User } from '@shared/types/user';

interface AuthenticatedRequest extends Request {
  user: User;
}

/**
 * Generate presigned URL for BOL document upload
 * POST /api/bol-upload/presign
 */
export const presignBolUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if S3 is configured
    if (!mediaService.isConfigured()) {
      return res.status(503).json({ 
        error: 'File upload service is not configured. Please contact system administrator.' 
      });
    }

    const { fileName, fileType, fileSize, scheduleId, appointmentId } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    const finalAppointmentId = appointmentId || scheduleId;

    // Validate file type for BOL documents
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(fileType) && !fileType.startsWith('image/')) {
      return res.status(400).json({
        error: `File type ${fileType} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Validate file size (10MB limit for BOL documents)
    const maxSize = 10 * 1024 * 1024;
    if (fileSize && fileSize > maxSize) {
      return res.status(400).json({
        error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes`
      });
    }

    // Validate appointment belongs to tenant if provided
    if (finalAppointmentId) {
      const storage = await getStorage();
      const appointment = await storage.getSchedule(parseInt(finalAppointmentId));
      
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      // Validate tenant access through facility relationship
      if (appointment.facilityId && req.user?.tenantId) {
        const facility = await storage.getFacility(appointment.facilityId);
        if (facility && facility.tenantId !== req.user?.tenantId) {
          return res.status(403).json({ error: 'Forbidden - Appointment does not belong to your organization' });
        }
      }
    }

    // Generate presigned URL
    const tenantId = req.user?.tenantId || 1; // Default to tenant 1 if not set
    const presignedResponse = await mediaService.generatePresignedUpload(
      fileName,
      fileType,
      {
        tenantId,
        uploadedBy: req.user?.id,
        folder: 'bol-documents',
        maxSizeBytes: maxSize,
        allowedMimeTypes: allowedTypes,
      }
    );

    return res.json({
      uploadUrl: presignedResponse.uploadUrl,
      key: presignedResponse.key,
      publicUrl: presignedResponse.publicUrl,
      expiresAt: presignedResponse.expiresAt,
      appointmentId: finalAppointmentId,
    });

  } catch (error) {
    console.error('Error generating presigned URL for BOL upload:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
};

/**
 * Upload BOL document with streaming support
 * POST /api/bol-upload/upload
 */
export const uploadBol = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let Busboy: any;
    try {
      // Use dynamic require to avoid TypeScript compilation issues
      Busboy = eval('require')('busboy');
    } catch (err) {
      return res.status(500).json({ error: 'Busboy module not available' });
    }
    const { PassThrough } = await import('stream');
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = process.env.AWS_S3_BUCKET!;
    const tenantId = req.user?.tenantId || 1; // Default to tenant 1 if null
    let uploadCompleted = false;
    
    // Configure busboy for streaming uploads
    const bb = Busboy({ 
      headers: req.headers, 
      limits: { 
        fileSize: 20 * 1024 * 1024 // 20 MiB limit
      } 
    });

    bb.on('file', async (name, file, info) => {
      try {
        const { filename, mimeType } = info;
        
        // Generate S3 key with tenant isolation
        const key = `bols/${tenantId}/${Date.now()}_${filename}`;
        
        // Create pass-through stream for S3 upload
        const passThrough = new PassThrough();
        
        // Start S3 upload
        const uploadCommand = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: passThrough,
          ContentType: mimeType,
          Metadata: {
            tenantId: tenantId.toString(),
            uploadedAt: new Date().toISOString(),
          },
        });

        // Pipeline file stream to S3
        const uploadPromise = s3Client.send(uploadCommand);
        
        // Pipe file to pass-through stream (which goes to S3)
        file.pipe(passThrough);

        // Wait for upload to complete
        await uploadPromise;
        
        // Enqueue OCR job
        const storage = await getStorage();
        await storage.createOcrJob({
          tenantId,
          s3Key: key,
          status: 'queued',
        });

        uploadCompleted = true;
        console.log(`[BOL Upload] File uploaded to S3: ${key}, OCR job queued for tenant ${tenantId}`);
        
      } catch (error) {
        console.error('[BOL Upload] Error during file upload:', error);
        res.status(500).json({ error: 'Failed to upload file to S3' });
      }
    });

    bb.on('field', (name, value) => {
      // Handle form fields if needed
      console.log(`[BOL Upload] Form field: ${name} = ${value}`);
    });

    bb.on('filesLimit', () => {
      console.log('[BOL Upload] File size limit exceeded');
      res.status(413).json({ error: 'File size exceeds 20 MiB limit' });
    });

    bb.on('finish', () => {
      if (uploadCompleted) {
        res.status(200).json({ 
          success: true, 
          message: 'File uploaded successfully and OCR job queued',
          tenantId: tenantId 
        });
      }
    });

    bb.on('error', (error) => {
      console.error('[BOL Upload] Busboy error:', error);
      res.status(500).json({ error: 'Upload processing error' });
    });

    // Pipe request to busboy
    req.pipe(bb);

  } catch (error) {
    console.error('[BOL Upload] Error in upload route:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
};

/**
 * Confirm BOL upload and link to appointment
 * POST /api/bol-upload/confirm
 */
export const confirmBolUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if S3 is configured (skip check if linkOnly mode)
    if (!req.body.linkOnly && !mediaService.isConfigured()) {
      return res.status(503).json({ 
        error: 'File upload service is not configured. Please contact system administrator.' 
      });
    }

    const {
      key,
      fileName,
      fileType,
      scheduleId,
      appointmentId,
      bolNumber,
      customerName,
      carrierName,
      mcNumber,
      weight,
      fromAddress,
      toAddress,
      pickupOrDropoff,
      extractionMethod,
      extractionConfidence,
      processingTimestamp,
      linkOnly = false
    } = req.body;

    if (!key || !fileName || !fileType) {
      return res.status(400).json({ error: 'key, fileName, and fileType are required' });
    }

    const finalAppointmentId = appointmentId || scheduleId;
    let fileRecord: any;

    if (linkOnly) {
      // Skip file re-upload, just link existing file
      fileRecord = {
        id: key, // Use key as temporary ID
        originalName: fileName,
        publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`,
        size: 0 // Unknown size for link-only mode
      };
    } else {
      // Confirm upload and get file record
      fileRecord = await mediaService.confirmUpload(
        key,
        fileName,
        fileType,
        {
          tenantId: req.user?.tenantId || 1, // Default to tenant 1 if null
          uploadedBy: req.user?.id,
          folder: 'bol-documents',
        }
      );
    }

    // Validate and update appointment if provided
    if (finalAppointmentId) {
      const storage = await getStorage();
      const appointment = await storage.getSchedule(parseInt(finalAppointmentId));
      
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      // TENANT VALIDATION: Ensure appointment belongs to user's tenant (through facility relationship)
      if (appointment.facilityId && req.user?.tenantId) {
        const facility = await storage.getFacility(appointment.facilityId);
        if (!facility) {
          return res.status(404).json({ error: 'Facility associated with appointment not found' });
        }
        if (facility.tenantId !== req.user?.tenantId) {
          return res.status(403).json({ error: 'Forbidden - Appointment does not belong to your organization' });
        }
      }

      // Update appointment with BOL info and extracted metadata
      const updateData: any = {
        bolNumber: bolNumber || fileRecord.originalName,
        lastModifiedAt: new Date(),
        customFormData: {
          ...(appointment.customFormData || {}),
          bolFileUploaded: true,
          bolFileId: fileRecord.id,
          bolFileName: fileRecord.originalName,
          bolData: {
            fileName: fileRecord.originalName,
            fileUrl: fileRecord.publicUrl,
            fileSize: fileRecord.size,
            uploadedAt: new Date().toISOString(),
            // Include extracted OCR data if available
            bolNumber,
            customerName,
            carrierName,
            mcNumber,
            weight,
            fromAddress,
            toAddress,
            pickupOrDropoff,
            extractionMethod,
            extractionConfidence: parseInt(extractionConfidence || '0'),
            processingTimestamp
          }
        }
      };
      
      console.log('🔍 [BOL Upload] Updating appointment with BOL data:', JSON.stringify(updateData, null, 2));
      console.log('🔍 [BOL Upload] Merged customFormData:', JSON.stringify(updateData.customFormData, null, 2));

      // Update related fields if they were extracted
      if (customerName) updateData.customerName = customerName;
      if (carrierName) updateData.carrierName = carrierName;
      if (mcNumber) updateData.mcNumber = mcNumber;
      if (weight) updateData.weight = weight;

      await storage.updateSchedule(parseInt(finalAppointmentId), updateData);
      console.log(`[BOL Upload] Updated appointment ${finalAppointmentId} with BOL info and OCR data`);
    }

    // Return consistent JSON shape as specified
    res.json({
      scheduleId: finalAppointmentId ? parseInt(finalAppointmentId) : null,
      fileUrl: fileRecord.publicUrl,
      filename: fileRecord.originalName,
      extractedFields: {
        bolNumber,
        customerName,
        carrierName,
        mcNumber,
        weight,
        fromAddress,
        toAddress,
        pickupOrDropoff,
        extractionMethod,
        extractionConfidence: parseInt(extractionConfidence || '0'),
        processingTimestamp
      },
      appointmentLinked: !!finalAppointmentId,
      success: true,
      fileId: fileRecord.id,
      originalName: fileRecord.originalName,
      size: fileRecord.size,
      documentId: fileRecord.id,
      appointmentId: finalAppointmentId,
      message: 'BOL document uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Error confirming BOL upload:', error);
    res.status(500).json({ error: 'Failed to confirm BOL upload' });
  }
}; 