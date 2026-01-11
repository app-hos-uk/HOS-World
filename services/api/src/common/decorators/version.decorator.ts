import { Version } from '@nestjs/common';

/**
 * Decorator to specify API version for a controller or route
 * Usage: @Version('1') or @Version(['1', '2'])
 */
export const ApiVersion = Version;
