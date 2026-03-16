/**
 * Legacy Courier Providers
 *
 * These providers implement the legacy CourierProvider interface and are used
 * with CourierService for backward compatibility. They use simulated rates
 * and mock label generation.
 *
 * For production use with real API integration, use the new providers
 * loaded dynamically by CourierFactoryService with credentials
 * from the IntegrationConfig database table.
 */
export { FedExLegacyProvider } from './fedex-legacy.provider';
export { DHLLegacyProvider } from './dhl-legacy.provider';
