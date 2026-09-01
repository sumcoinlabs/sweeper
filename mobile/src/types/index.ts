export type SweepStep =
  | 'home'
  | 'location'
  | 'network'
  | 'bluetooth'
  | 'checklist'
  | 'camera'
  | 'summary';

export type LocationInfo = {
  lat: number;
  lng: number;
  accuracy?: number;
  name: string;
  address: string;
  locality: string;
  administrativeArea: string;
  country: string;
};

export type BonjourServiceFinding = {
  type: string;
  name: string;
  hostname?: string;
  port?: number;
};

export type SsdpServiceFinding = {
  st?: string;
  usn?: string;
  location?: string;
  server?: string;
};

export type NetworkFingerprint = {
  protocol: 'http' | 'rtsp';
  port: number;
  summary: string;
  cameraHint?: boolean;
  confirmed?: boolean;
};

export type NetworkAssessment = {
  category:
    | 'network_video'
    | 'camera_security'
    | 'media'
    | 'other'
    | 'unknown';
  evidenceLevel: 'none' | 'weak' | 'moderate' | 'strong';
  userTitle: string;
  userSummary: string;
  backendReview: boolean;
  networkOnlyThreatEligible: boolean;
  evidenceCodes: string[];
};

export type NetworkDevice = {
  ip: string;
  hostname?: string;
  icmpResponsive?: boolean;
  icmpRttMs?: number;
  openPorts: number[];
  bonjourServices?: BonjourServiceFinding[];
  ssdpServices?: SsdpServiceFinding[];
  fingerprints?: NetworkFingerprint[];
  assessment?: NetworkAssessment;
  discoverySources?: Array<'icmp' | 'tcp' | 'mdns' | 'ssdp'>;
  suspicionScore: number;
  reasons: string[];
};

export type BleProximity =
  | 'very_close'
  | 'nearby'
  | 'farther'
  | 'unknown';

export type BleAssessment = {
  category:
    | 'camera_security'
    | 'security_ecosystem'
    | 'other'
    | 'unknown';
  evidenceLevel: 'none' | 'weak' | 'moderate' | 'strong';
  userTitle: string;
  userSummary: string;
  matchedVendor?: string;
  backendReview: boolean;
  bluetoothOnlyThreatEligible: boolean;
  evidenceCodes: string[];
};

export type BleDeviceFinding = {
  id: string;
  name: string | null;
  localName?: string | null;
  rssi: number | null;
  averageRssi: number | null;
  strongestRssi: number | null;
  sightings: number;
  proximity: BleProximity;
  serviceUUIDs: string[];
  serviceDataUUIDs: string[];
  manufacturerData?: string | null;
  manufacturerCompanyId?: string | null;
  manufacturerLabel?: string | null;
  txPowerLevel?: number | null;
  isConnectable?: boolean | null;
  serviceSignature?: string | null;
  assessment: BleAssessment;
  suspicionScore: number;
  reasons: string[];
};

export type ChecklistStatus = 'pending' | 'clear' | 'suspicious';

export type ChecklistItem = {
  id: string;
  title: string;
  guidance: string[];
  status: ChecklistStatus;
};

export type EvidencePhoto = {
  path: string;
  checklistItemId?: string;
  createdAt: string;
};

export type RiskResult = {
  score: number;
  label: string;
  reasons: string[];
};

export type SweepSession = {
  anonymousId: string;
  location: LocationInfo | null;
  networkDevices: NetworkDevice[];
  bleDevices: BleDeviceFinding[];
  checklist: ChecklistItem[];
  photos: EvidencePhoto[];
  notes: string;
};
