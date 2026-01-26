/**
 * Courier Provider Interface
 * All shipping carrier integrations must implement this interface
 */

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface PackageDimensions {
  length: number; // cm
  width: number; // cm
  height: number; // cm
  weight: number; // kg
}

export interface RateRequest {
  from: Address;
  to: Address;
  packages: PackageDimensions[];
  shipDate?: Date;
  service?: string; // Specific service code if known
  isReturn?: boolean;
}

export interface RateResponse {
  providerId: string;
  providerName: string;
  serviceCode: string;
  serviceName: string;
  rate: number;
  currency: string;
  estimatedDays: number;
  estimatedDeliveryDate?: Date;
  guaranteedDelivery?: boolean;
  saturdayDelivery?: boolean;
  signatureRequired?: boolean;
  trackingIncluded: boolean;
  insuranceIncluded?: boolean;
  maxInsuranceValue?: number;
  metadata?: Record<string, any>;
}

export interface ShipmentRequest {
  orderId: string;
  from: Address;
  to: Address;
  packages: PackageDimensions[];
  serviceCode: string;
  shipDate?: Date;
  reference1?: string;
  reference2?: string;
  signatureRequired?: boolean;
  saturdayDelivery?: boolean;
  insurance?: {
    amount: number;
    currency: string;
  };
  customsInfo?: CustomsInfo;
  labelFormat?: 'PDF' | 'PNG' | 'ZPL';
}

export interface CustomsInfo {
  contentsType: 'DOCUMENTS' | 'GIFT' | 'MERCHANDISE' | 'SAMPLE' | 'RETURN';
  contentsExplanation?: string;
  nonDeliveryOption: 'RETURN' | 'ABANDON';
  restrictionType?: 'NONE' | 'QUARANTINE' | 'SANITARY_INSPECTION';
  items: CustomsItem[];
  totalValue: number;
  currency: string;
}

export interface CustomsItem {
  description: string;
  quantity: number;
  weight: number; // kg per item
  value: number; // per item
  currency: string;
  hsCode?: string;
  countryOfOrigin: string;
}

export interface ShipmentResponse {
  providerId: string;
  providerName: string;
  shipmentId: string;
  trackingNumber: string;
  trackingUrl?: string;
  labels: LabelData[];
  rate: number;
  currency: string;
  serviceCode: string;
  serviceName: string;
  estimatedDeliveryDate?: Date;
  metadata?: Record<string, any>;
}

export interface LabelData {
  format: 'PDF' | 'PNG' | 'ZPL';
  data: string; // Base64 encoded
  url?: string; // Direct URL if available
  packageIndex: number;
}

export interface TrackingEvent {
  timestamp: Date;
  status: TrackingStatus;
  statusDescription: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  signedBy?: string;
  metadata?: Record<string, any>;
}

export type TrackingStatus =
  | 'UNKNOWN'
  | 'PRE_TRANSIT'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_ATTEMPT'
  | 'EXCEPTION'
  | 'RETURN_TO_SENDER'
  | 'CANCELLED';

export interface TrackingResponse {
  providerId: string;
  providerName: string;
  trackingNumber: string;
  status: TrackingStatus;
  statusDescription: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  signedBy?: string;
  events: TrackingEvent[];
  metadata?: Record<string, any>;
}

export interface AddressValidationResult {
  isValid: boolean;
  normalizedAddress?: Address;
  suggestions?: Address[];
  errors?: string[];
  isResidential?: boolean;
}

export interface PickupRequest {
  from: Address;
  packageCount: number;
  totalWeight: number; // kg
  pickupDate: Date;
  readyTime: string; // HH:MM format
  closeTime: string; // HH:MM format
  specialInstructions?: string;
}

export interface PickupResponse {
  providerId: string;
  providerName: string;
  confirmationNumber: string;
  pickupDate: Date;
  readyTime: string;
  closeTime: string;
  cancellable: boolean;
  metadata?: Record<string, any>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  duration?: number;
}

/**
 * Main Courier Provider Interface
 * All courier implementations must provide these methods
 */
export interface ICourierProvider {
  /** Provider identifier (e.g., 'fedex', 'royal_mail') */
  readonly providerId: string;
  
  /** Human-readable provider name */
  readonly providerName: string;
  
  /** Whether this provider is currently configured and ready to use */
  isConfigured(): boolean;

  /**
   * Test the connection to the carrier API
   */
  testConnection(): Promise<TestConnectionResult>;

  /**
   * Get available shipping rates for a shipment
   */
  getRates(request: RateRequest): Promise<RateResponse[]>;

  /**
   * Create a shipment and generate labels
   */
  createShipment(request: ShipmentRequest): Promise<ShipmentResponse>;

  /**
   * Track a shipment by tracking number
   */
  trackShipment(trackingNumber: string): Promise<TrackingResponse>;

  /**
   * Cancel a shipment (if supported)
   */
  cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }>;

  /**
   * Validate an address
   */
  validateAddress(address: Address): Promise<AddressValidationResult>;

  /**
   * Schedule a pickup (if supported)
   */
  schedulePickup?(request: PickupRequest): Promise<PickupResponse>;

  /**
   * Cancel a scheduled pickup (if supported)
   */
  cancelPickup?(confirmationNumber: string): Promise<{ success: boolean; message: string }>;

  /**
   * Get list of available services for a lane
   */
  getAvailableServices?(from: Address, to: Address): Promise<Array<{ code: string; name: string; description?: string }>>;
}

/**
 * Base class for courier providers with common functionality
 */
export abstract class BaseCourierProvider implements ICourierProvider {
  abstract readonly providerId: string;
  abstract readonly providerName: string;
  
  protected credentials: Record<string, any> = {};
  protected isTestMode: boolean = true;

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    this.credentials = credentials;
    this.isTestMode = isTestMode;
  }

  abstract isConfigured(): boolean;
  abstract testConnection(): Promise<TestConnectionResult>;
  abstract getRates(request: RateRequest): Promise<RateResponse[]>;
  abstract createShipment(request: ShipmentRequest): Promise<ShipmentResponse>;
  abstract trackShipment(trackingNumber: string): Promise<TrackingResponse>;
  abstract cancelShipment(shipmentId: string): Promise<{ success: boolean; message: string }>;
  abstract validateAddress(address: Address): Promise<AddressValidationResult>;

  /**
   * Get the appropriate API base URL based on test mode
   */
  protected abstract getBaseUrl(): string;

  /**
   * Helper to format weight for API calls (some carriers use different units)
   */
  protected convertWeight(weightKg: number, targetUnit: 'kg' | 'lb'): number {
    if (targetUnit === 'lb') {
      return weightKg * 2.20462;
    }
    return weightKg;
  }

  /**
   * Helper to format dimensions for API calls
   */
  protected convertDimensions(cm: number, targetUnit: 'cm' | 'in'): number {
    if (targetUnit === 'in') {
      return cm * 0.393701;
    }
    return cm;
  }
}
