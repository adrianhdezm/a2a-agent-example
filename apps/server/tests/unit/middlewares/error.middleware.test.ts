import createError from 'http-errors';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../../src/middlewares/error.middleware.ts';
import { mockLog, mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';

describe('errorHandler', () => {
  it('answers an exposed client error with its message and logs it at warn', () => {
    // Arrange
    const log = mockLog();
    const { res, status, json } = mockResponse();
    const err = createError(404, 'Not Found: GET /agents', { expose: true });

    // Act
    errorHandler(err, mockRequest({ log }), res, mockNext());

    // Assert
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ status: 'error', message: 'Not Found: GET /agents' });
    expect(log.warn).toHaveBeenCalledWith({ err }, 'Not Found: GET /agents');
  });

  it.each([
    ['an unexpected error', new Error('connection reset')],
    ['an http error that is not exposed', createError(500, 'pool exhausted')]
  ])('hides %s behind a 500 and logs it at error', (_case, err) => {
    const log = mockLog();
    const { res, status, json } = mockResponse();

    errorHandler(err, mockRequest({ log }), res, mockNext());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ status: 'error', message: 'Internal Server Error' });
    expect(log.error).toHaveBeenCalledWith({ err }, 'Internal Server Error');
  });

  it('hands the error on to Express when the headers already went out', () => {
    const { res, status } = mockResponse(true);
    const next = mockNext();
    const err = new Error('late failure');

    errorHandler(err, mockRequest(), res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(status).not.toHaveBeenCalled();
  });
});
