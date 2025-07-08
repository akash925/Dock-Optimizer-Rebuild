/**
 * Mock AWS S3 Client for testing
 * 
 * This mock provides deterministic responses for S3 operations
 * to avoid real network calls during testing.
 */

import { vi } from 'vitest';

export const mockSend = vi.fn();
export const mockS3Client = vi.fn().mockImplementation(() => ({
  send: mockSend,
}));

export const S3Client = mockS3Client;

export const PutObjectCommand = vi.fn().mockImplementation((params) => ({
  input: params,
  middlewareStack: {},
}));

export const HeadObjectCommand = vi.fn().mockImplementation((params) => ({
  input: params,
  middlewareStack: {},
}));

export const GetObjectCommand = vi.fn().mockImplementation((params) => ({
  input: params,
  middlewareStack: {},
}));

// Mock successful responses
export const mockSuccessfulPutResponse = {
  ETag: '"mock-etag-12345"',
  VersionId: 'mock-version-id',
};

export const mockSuccessfulHeadResponse = {
  ContentLength: 1024,
  ContentType: 'image/jpeg',
  LastModified: new Date('2025-01-24T12:00:00.000Z'),
  ETag: '"mock-etag-12345"',
};

// Reset function for tests
export const resetMocks = () => {
  mockSend.mockClear();
  mockS3Client.mockClear();
  PutObjectCommand.mockClear();
  HeadObjectCommand.mockClear();
  GetObjectCommand.mockClear();
};

// Default implementation - returns successful upload
mockSend.mockResolvedValue(mockSuccessfulPutResponse); 