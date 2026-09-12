<?php

namespace Modules\Routing\App\Services;

use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;
use Modules\Facility\App\Models\Facility;
use Modules\Facility\App\Services\FacilityService;

class RoutingService
{
    protected OsrmService $osrmService;
    protected FacilityService $facilityService;

    public function __construct(OsrmService $osrmService, FacilityService $facilityService)
    {
        $this->osrmService = $osrmService;
        $this->facilityService = $facilityService;
    }

    /**
     * Retrieve the latest live truck location for a shipment.
     */
    public function getLiveLocation(Shipment $shipment): array
    {
        // 1. Fast cache check (sub-5ms response)
        $cached = \Illuminate\Support\Facades\Cache::get("shipment_live_{$shipment->id}");
        if ($cached && is_array($cached)) {
            $cached['status'] = $shipment->status;
            return [
                'success' => true,
                'data' => $cached,
            ];
        }

        $latestTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->where('recorded_at', '<=', now()->addSeconds(5))
            ->orderBy('id', 'desc')
            ->first();

        $lat = $latestTelemetry?->latitude ?? $shipment->current_lat ?? $shipment->origin_lat;
        $lng = $latestTelemetry?->longitude ?? $shipment->current_lng ?? $shipment->origin_lng;

        if (is_null($lat) || is_null($lng)) {
            return [
                'success' => false,
                'message' => 'Current shipment location is unavailable. Telemetry coordinates missing.',
            ];
        }

        $data = [
            'shipment_id' => $shipment->id,
            'tracking_number' => $shipment->tracking_number,
            'product_name' => $shipment->product_name,
            'location' => [
                'latitude' => (float) $lat,
                'longitude' => (float) $lng,
            ],
            'latitude' => (float) $lat,
            'longitude' => (float) $lng,
            'temperature' => (float) ($latestTelemetry?->temperature ?? $shipment->current_temp ?? 4.0),
            'humidity' => (float) ($latestTelemetry?->humidity ?? $shipment->current_humidity ?? 60.0),
            'battery' => (float) ($latestTelemetry?->battery ?? $shipment->current_battery ?? 90.0),
            'status' => $shipment->status,
            'recorded_at' => $latestTelemetry?->recorded_at ? $latestTelemetry->recorded_at->toIso8601String() : now()->toIso8601String(),
        ];

        \Illuminate\Support\Facades\Cache::put("shipment_live_{$shipment->id}", $data, 120);

        return [
            'success' => true,
            'data' => $data,
        ];
    }

    /**
     * Calculate multi-waypoint road route (Origin/Truck -> Emergency Facility -> Receiver).
     */
    public function calculateRoute(Shipment $shipment, ?int $facilityId = null, bool $direct = false, ?float $overrideLat = null, ?float $overrideLng = null, bool $fromOrigin = false): array
    {
        $latestTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->where('recorded_at', '<=', now()->addSeconds(5))
            ->orderBy('id', 'desc')
            ->first();

        $currLat = $overrideLat ?? ($latestTelemetry?->latitude !== null ? (float) $latestTelemetry->latitude : ($shipment->current_lat !== null ? (float) $shipment->current_lat : ($shipment->origin_lat !== null ? (float) $shipment->origin_lat : 15.4647)));
        $currLng = $overrideLng ?? ($latestTelemetry?->longitude !== null ? (float) $latestTelemetry->longitude : ($shipment->current_lng !== null ? (float) $shipment->current_lng : ($shipment->origin_lng !== null ? (float) $shipment->origin_lng : 73.8560)));

        // 1. Determine origin coordinates (from shipment origin if fromOrigin is true or if viewing full route)
        if ($fromOrigin || ($overrideLat === null && $overrideLng === null)) {
            $startLat = (float) ($shipment->origin_lat ?? 15.4647);
            $startLng = (float) ($shipment->origin_lng ?? 73.8560);
        } else {
            $startLat = $currLat;
            $startLng = $currLng;
        }

        // 2. Validate shipment destination coordinates
        if (is_null($shipment->destination_lat) || is_null($shipment->destination_lng)) {
            return [
                'success' => false,
                'message' => 'Shipment destination coordinates are missing.',
            ];
        }

        $destLat = (float) $shipment->destination_lat;
        $destLng = (float) $shipment->destination_lng;

        // 3. Facility Validation / Selection via FacilityService
        $selectedFacility = null;
        $facilityData = null;

        if ($direct) {
            $selectedFacility = null;
        } elseif (!is_null($facilityId)) {
            $facility = Facility::find($facilityId);

            if (!$facility) {
                return [
                    'success' => false,
                    'message' => "Facility with ID {$facilityId} not found.",
                ];
            }

            // Validate facility eligibility using FacilityService rules
            $eligibilityCheck = $this->validateFacilityEligibility($facility, $shipment);
            if (!$eligibilityCheck['eligible']) {
                return [
                    'success' => false,
                    'message' => $eligibilityCheck['reason'],
                ];
            }

            $selectedFacility = $facility;
        } elseif (in_array($shipment->status, ['WARNING', 'CRITICAL', 'REROUTED'])) {
            // Check if FacilityService finds an eligible recommended facility during emergency
            $facilityResult = $this->facilityService->getEligibleFacilitiesForShipment($shipment);
            if ($facilityResult['success'] && !empty($facilityResult['data']['recommended_facility'])) {
                $rec = $facilityResult['data']['recommended_facility'];
                $selectedFacility = Facility::find($rec['id']);
            }
        }

        if ($selectedFacility) {
            $approxDist = round($this->facilityService->calculateHaversineDistance(
                $startLat,
                $startLng,
                (float) $selectedFacility->latitude,
                (float) $selectedFacility->longitude
            ), 2);

            $facilityData = [
                'id' => $selectedFacility->id,
                'name' => $selectedFacility->name,
                'latitude' => (float) $selectedFacility->latitude,
                'longitude' => (float) $selectedFacility->longitude,
                'available_capacity' => (int) $selectedFacility->available_capacity,
                'min_temperature' => (float) $selectedFacility->min_temperature,
                'max_temperature' => (float) $selectedFacility->max_temperature,
                'cost' => (float) $selectedFacility->cost,
                'approximate_distance_km' => $approxDist,
            ];
        }

        // 4. Build Waypoint Sequence
        $waypoints = [];
        $waypoints[] = ['latitude' => $startLat, 'longitude' => $startLng];

        if ($selectedFacility) {
            // Emergency excursion diversion: destination is the cold storage facility
            $waypoints[] = ['latitude' => (float) $selectedFacility->latitude, 'longitude' => (float) $selectedFacility->longitude];
        } else {
            // Standard transit: route directly to destination hospital
            $waypoints[] = ['latitude' => $destLat, 'longitude' => $destLng];
        }

        // 5. Invoke OsrmService for real road routing (cached for fast response)
        $cacheKey = "osrm_route_" . md5(json_encode($waypoints));
        $routeData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 1800, function () use ($waypoints) {
            $res = $this->osrmService->getRoute($waypoints);
            return $res['success'] ? $res['data'] : null;
        });

        if (!$routeData) {
            $osrmResult = $this->osrmService->getRoute($waypoints);
            if (!$osrmResult['success']) {
                return [
                    'success' => false,
                    'message' => $osrmResult['message'],
                ];
            }
            $routeData = $osrmResult['data'];
        }

        // 6. Return Normalized ColdGuard Payload
        return [
            'success' => true,
            'message' => 'Road route calculated successfully.',
            'data' => [
                'shipment' => [
                    'id' => $shipment->id,
                    'tracking_number' => $shipment->tracking_number,
                    'product_name' => $shipment->product_name,
                ],
                'current_location' => [
                    'latitude' => $currLat,
                    'longitude' => $currLng,
                    'recorded_at' => $latestTelemetry?->recorded_at ? $latestTelemetry->recorded_at->toIso8601String() : now()->toIso8601String(),
                ],
                'origin' => [
                    'name' => $shipment->origin_name,
                    'latitude' => (float) ($shipment->origin_lat ?? 15.4647),
                    'longitude' => (float) ($shipment->origin_lng ?? 73.8560),
                ],
                'facility' => $facilityData,
                'destination' => [
                    'name' => $shipment->destination_name,
                    'latitude' => $destLat,
                    'longitude' => $destLng,
                ],
                'distance_km' => $routeData['distance_km'],
                'duration_minutes' => $routeData['duration_minutes'],
                'distance_m' => $routeData['distance_m'],
                'duration_seconds' => $routeData['duration_seconds'],
                'geometry' => $routeData['geometry'],
                'legs' => $routeData['legs'],
                'steps' => $routeData['steps'],
            ]
        ];
    }

    /**
     * Validate facility eligibility using FacilityService constraints.
     */
    protected function validateFacilityEligibility(Facility $facility, Shipment $shipment): array
    {
        if (strtoupper($facility->status) !== 'AVAILABLE') {
            return [
                'eligible' => false,
                'reason' => "Selected facility '{$facility->name}' is currently UNAVAILABLE.",
            ];
        }

        if ((int) $facility->available_capacity < (int) $shipment->quantity) {
            return [
                'eligible' => false,
                'reason' => "Selected facility '{$facility->name}' has insufficient available capacity ({$facility->available_capacity} available vs {$shipment->quantity} required).",
            ];
        }

        if ((float) $facility->min_temperature > (float) $shipment->min_temp || (float) $facility->max_temperature < (float) $shipment->max_temp) {
            return [
                'eligible' => false,
                'reason' => "Selected facility '{$facility->name}' temperature range ({$facility->min_temperature}–{$facility->max_temperature}°C) cannot support required shipment range ({$shipment->min_temp}–{$shipment->max_temp}°C).",
            ];
        }

        if (is_null($facility->latitude) || is_null($facility->longitude)) {
            return [
                'eligible' => false,
                'reason' => "Selected facility '{$facility->name}' has missing GPS coordinates.",
            ];
        }

        return ['eligible' => true, 'reason' => 'Facility is eligible.'];
    }
}
