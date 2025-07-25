/**
 * Metrics Logger
 * 
 * A utility for recording performance metrics and document processing statistics
 * to help identify bottlenecks and optimize the OCR processing pipeline.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const logger = require('../logger');

// In-memory metrics store for aggregation
const metricsStore = {
  processingTimes: [],
  successRates: {
    success: 0,
    failed: 0,
    total: 0
  },
  documentTypes: {},
  documentSizes: {},
  errorTypes: {}
};

/**
 * Record document processing metrics
 * 
 * @param {Object} metrics - Metrics data to record
 * @param {string} metrics.documentType - Type of document (PDF, JPEG, etc.)
 * @param {number} metrics.documentSize - Size of document in bytes
 * @param {number} metrics.processingTime - Time taken to process in milliseconds
 * @param {boolean} metrics.success - Whether processing was successful
 * @param {string} metrics.errorType - Type of error if unsuccessful
 * @param {number} metrics.tenantId - ID of tenant who uploaded the document
 */
function recordDocumentProcessingMetrics(metrics: any) {
  try {
    const {
      documentType,
      documentSize,
      processingTime,
      success,
      errorType,
      tenantId
    } = metrics;
    
    // Record in-memory metrics
    if (processingTime) {
      metricsStore.processingTimes.push(processingTime);
    }
    
    // Track success rates
    metricsStore.successRates.total++;
    if (success) {
      metricsStore.successRates.success++;
    } else {
      metricsStore.successRates.failed++;
    }
    
    // Track document types
    if (documentType) {
      metricsStore.documentTypes[documentType] = (metricsStore.documentTypes[documentType] || 0) + 1;
    }
    
    // Track document sizes in ranges
    if (documentSize) {
      const sizeRange = getSizeRange(documentSize);
      metricsStore.documentSizes[sizeRange] = (metricsStore.documentSizes[sizeRange] || 0) + 1;
    }
    
    // Track error types
    if (errorType) {
      metricsStore.errorTypes[errorType] = (metricsStore.errorTypes[errorType] || 0) + 1;
    }
    
    // Log to database for persistent storage and analysis
    logMetricsToDatabase(metrics)
      .catch((err: any) => logger.error('Metrics-Logger', 'Failed to log metrics to database', err));
    
    // Log summary for quick reference
    logger.info('Metrics-Logger', 'Document processing metrics recorded', {
      documentType,
      size: formatBytes(documentSize),
      time: `${processingTime}ms`,
      success,
      errorType: errorType || 'none'
    });
    
  } catch (error) {
    logger.error('Metrics-Logger', 'Error recording metrics', error);
  }
}

/**
 * Get size range string for categorizing document sizes
 * 
 * @param {number} sizeInBytes - Size in bytes
 * @returns {string} - Size range category
 */
function getSizeRange(sizeInBytes: any) {
  if (sizeInBytes < 100 * 1024) {
    return '< 100KB';
  } else if (sizeInBytes < 500 * 1024) {
    return '100KB-500KB';
  } else if (sizeInBytes < 1024 * 1024) {
    return '500KB-1MB';
  } else if (sizeInBytes < 5 * 1024 * 1024) {
    return '1MB-5MB';
  } else {
    return '> 5MB';
  }
}

/**
 * Log metrics to database for persistent storage
 * 
 * @param {Object} metrics - Metrics to log
 * @returns {Promise<void>}
 */
async function logMetricsToDatabase(metrics: any) {
  try {
    const query = `
      INSERT INTO document_processing_metrics
      (document_type, document_size, processing_time, success, error_type, tenant_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    const values = [
      metrics.documentType || 'unknown',
      metrics.documentSize || 0,
      metrics.processingTime || 0,
      metrics.success || false,
      metrics.errorType || null,
      metrics.tenantId || null
    ];
    
    await pool.query(query, values);
    
  } catch (error) {
    // If table doesn't exist, create it
    if (error.code === '42P01') { // PostgreSQL error code for undefined_table
      try {
        await createMetricsTable();
        // Try inserting again
        return logMetricsToDatabase(metrics);
      } catch (tableError) {
        logger.error('Metrics-Logger', 'Failed to create metrics table', tableError);
      }
    } else {
      logger.error('Metrics-Logger', 'Failed to log metrics to database', error);
    }
  }
}

/**
 * Create the metrics table if it doesn't exist
 * 
 * @returns {Promise<void>}
 */
async function createMetricsTable() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS document_processing_metrics (
        id SERIAL PRIMARY KEY,
        document_type VARCHAR(50) NOT NULL,
        document_size INTEGER NOT NULL,
        processing_time INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error_type VARCHAR(100),
        tenant_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    await pool.query(query);
    logger.info('Metrics-Logger', 'Created document_processing_metrics table');
    
  } catch (error) {
    logger.error('Metrics-Logger', 'Error creating metrics table', error);
    throw error;
  }
}

/**
 * Get processing performance metrics summary
 * 
 * @returns {Object} - Metrics summary
 */
function getPerformanceMetrics() {
  const { processingTimes, successRates, documentTypes, documentSizes, errorTypes } = metricsStore;
  
  // Calculate average processing time
  const avgProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    : 0;
  
  // Calculate success rate percentage
  const successRatePercent = successRates.total > 0
    ? (successRates.success / successRates.total) * 100
    : 0;
  
  return {
    avgProcessingTime: Math.round(avgProcessingTime),
    totalDocumentsProcessed: successRates.total,
    successRate: `${successRatePercent.toFixed(1)}%`,
    documentTypes,
    documentSizes,
    errorTypes,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string
 */
function formatBytes(bytes: any, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

module.exports = {
  recordDocumentProcessingMetrics,
  getPerformanceMetrics
};