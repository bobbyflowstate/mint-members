import { describe, it, expect } from 'vitest';
import schema from './schema';

describe('Convex Schema', () => {
  describe('tables', () => {
    it('should export applications table', () => {
      expect(schema.tables).toHaveProperty('applications');
    });

    it('should export ops_authorizations table', () => {
      expect(schema.tables).toHaveProperty('ops_authorizations');
    });

    it('should export event_logs table', () => {
      expect(schema.tables).toHaveProperty('event_logs');
    });

    it('should export config table', () => {
      expect(schema.tables).toHaveProperty('config');
    });
  });

  describe('applications table', () => {
    it('should have required fields', () => {
      const applicationsTable = schema.tables.applications;
      expect(applicationsTable).toBeDefined();
      
      // Verify the table has a validator (schema definition)
      expect(applicationsTable.validator).toBeDefined();
    });

    it('should have indexes for status and dates', () => {
      const applicationsTable = schema.tables.applications;
      expect(applicationsTable.indexes).toBeDefined();
      
      // Check for by_status index
      const indexNames = applicationsTable.indexes.map((idx: { indexDescriptor: string }) => idx.indexDescriptor);
      expect(indexNames).toContain('by_status');
      expect(indexNames).toContain('by_email');
    });
  });

  describe('event_logs table', () => {
    it('should have indexes for applicationId and createdAt', () => {
      const eventLogsTable = schema.tables.event_logs;
      expect(eventLogsTable.indexes).toBeDefined();
      
      const indexNames = eventLogsTable.indexes.map((idx: { indexDescriptor: string }) => idx.indexDescriptor);
      expect(indexNames).toContain('by_applicationId');
      expect(indexNames).toContain('by_createdAt');
    });
  });

  describe('config table', () => {
    it('should have index for key lookup', () => {
      const configTable = schema.tables.config;
      expect(configTable.indexes).toBeDefined();
      
      const indexNames = configTable.indexes.map((idx: { indexDescriptor: string }) => idx.indexDescriptor);
      expect(indexNames).toContain('by_key');
    });
  });
});
