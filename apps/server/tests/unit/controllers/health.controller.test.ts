import { describe, expect, it } from 'vitest';
import { getHealth } from '../../../src/controllers/health.controller.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';

describe('health.controller', () => {
  describe('getHealth', () => {
    it('answers ok with the current time', async () => {
      const { res, json } = mockResponse();

      await getHealth(mockRequest(), res, mockNext());

      expect(json).toHaveBeenCalledWith({ status: 'ok', timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown });
    });
  });
});
