/**
 * Legacy Courier Providers
 * 
 * These providers implement the legacy CourierProvider interface and are used
 * with CourierService for backward compatibility. They use simulated rates
 * and mock label generation.
 * 
 * For production use with real API integration, use the new providers:
 * - RoyalMailProvider
 * - FedExProvider  
 * - DHLProvider
 * 
 * These are loaded dynamically by CourierFactoryService with credentials
 * from the IntegrationConfig database table.
 */
export { RoyalMailLegacyProvider } from './royal-mail-legacy.provider';
export { FedExLegacyProvider } from './fedex-legacy.provider';
export { DHLLegacyProvider } from './dhl-legacy.provider';
