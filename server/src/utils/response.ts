import { ApiResponse } from '#src/types/common.types.js';

/**
 * Create a standardized success response.
 */
export function success<T>(data: T, message?: string, meta?: ApiResponse['meta']): ApiResponse<T> {
    return {
        success: true,
        data,
        message,
        meta,
    };
}

/**
 * Create a standardized error response.
 */
export function error(message: string, statusCode: number = 500): ApiResponse {
    return {
        success: false,
        error: message,
    };
}
