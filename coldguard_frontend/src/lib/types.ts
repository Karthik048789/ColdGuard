export interface User {
  id: number;
  name: string;
  email: string;
  role: 'manager' | 'driver' | 'receiver';
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    token: string;
    token_type: string;
  };
}

export interface Shipment {
  id: number;
  tracking_number?: string;
  cargo_type: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'DIVERTED' | 'DELIVERED';
  required_temp_min: number;
  required_temp_max: number;
  driver_id?: number;
  receiver_id?: number;
  created_at: string;
  updated_at: string;
}

export interface TelemetryReading {
  id: number;
  shipment_id: number;
  temperature: number;
  humidity?: number;
  latitude: number;
  longitude: number;
  battery_level?: number;
  door_opened?: boolean;
  recorded_at: string;
}

export interface Facility {
  id: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  min_temp_celsius: number;
  max_temp_celsius: number;
  capacity: number;
  available_capacity: number;
  status: string;
  distance_km?: number;
}

export interface Intervention {
  id: number;
  shipment_id: number;
  facility_id?: number;
  reason: string;
  status: 'ACTIVE' | 'RESOLVED' | 'PENDING' | 'DIVERTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  facility?: Facility;
  created_at: string;
  resolved_at?: string;
}

export interface Alert {
  id: number;
  shipment_id: number;
  intervention_id?: number;
  recipient_role: 'MANAGER' | 'DRIVER' | 'RECEIVER';
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  read_at?: string;
  created_at: string;
}
