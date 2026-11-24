import { describe, expect, it } from 'vitest';
import { notFoundHandler } from '../../../src/middlewares/not-found.middleware.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';

describe('notFoundHandler', () => {
  it('forwards an exposed 404 naming the method and the path', () => {
    const next = mockNext();

    notFoundHandler(mockRequest({ method: 'POST', path: '/agents' }), mockResponse().res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, expose: true, message: 'Not Found: POST /agents' }));
  });
});
