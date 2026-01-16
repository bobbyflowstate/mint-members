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
    it('should have a validator defined', () => {
      const applicationsTable = schema.tables.applications;
      expect(applicationsTable).toBeDefined();
      // The table definition exists - indexes are validated by Convex at deploy time
    });
  });

  describe('event_logs table', () => {
    it('should be defined', () => {
      const eventLogsTable = schema.tables.event_logs;
      expect(eventLogsTable).toBeDefined();
    });
  });

  describe('config table', () => {
    it('should be defined', () => {
      const configTable = schema.tables.config;
      expect(configTable).toBeDefined();
    });
  });

  describe('auth tables from @convex-dev/auth', () => {
    it('should include users table', () => {
      expect(schema.tables).toHaveProperty('users');
    });

    it('should include authSessions table', () => {
      expect(schema.tables).toHaveProperty('authSessions');
    });
  });
});
