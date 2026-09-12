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
        $latestTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->latest('recorded_at')
            ->first();

        if (!$latestTelemetry || is_null($latestTelemetry->latitude) || is_null($latestTelemetry->longitude)) {
            return [
                'success' => false,
                'message' => 'Current shipment location is unavailable. Telemetry coordinates missing.',
            ];
        }

        return [
            'success' => true,
            'data' => [
                'shipment_id' => $shipment->id,
                'tracking_number' => $shipment->tracking_number,
                'product_name' => $shipment->product_name,
                'location' => [
                    'latitude' => (float) $latestTelemetry->latitude,
                    'longitude' => (float) $latestTelemetry->longitude,
                ],
                'temperature' => (float) $latestTelemetry->temperature,
                'humidity' => (float) $latestTelemetry->humidity,
                'battery' => (float) $latestTelemetry->battery,
                'recorded_at' => $latestTelemetry->recorded_at->toIso8601String(),
            ]
        ];
    }

    /**
     * Calculate multi-waypoint road route (Truck -> Emergency Facility -> Receiver).
     */
    public function calculateRoute(Shipment $shipment, ?int $facilityId = null): array
    {
        // 1. Fetch latest telemetry for current truck GPS coordinates
        $latestTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->latest('recorded_at')
            ->first();

        if (!$latestTelemetry || is_null($latestTelemetry->latitude) || is_null($latestTelemetry->longitude)) {
            return [
                'success' => false,
                'message' => 'Current shipment location is unavailable. Telemetry coordinates missing.',
            ];
        }

        $truckLat = (float) $latestTelemetry->latitude;
        $truckLng = (float) $latestTelemetry->longitude;

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

        if (!is_null($facilityId)) {
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
        } else {
            // Check if FacilityService finds an eligible recommended facility
            $facilityResult = $this->facilityService->getEligibleFacilitiesForShipment($shipment);
            if ($facilityResult['success'] && !empty($facilityResult['data']['recommended_facility'])) {
                $rec = $facilityResult['data']['recommended_facility'];
                $selectedFacility = Facility::find($rec['id']);
            }
        }

        if ($selectedFacility) {
            $approxDist = round($this->facilityService->calculateHaversineDistance(
                $truckLat,
                $truckLng,
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

        // 4. Build Multi-Waypoint Sequence: Truck -> Facility (optional) -> Receiver Destination
        $waypoints = [];
        $waypoints[] = ['latitude' => $truckLat, 'longitude' => $truckLng];

        if ($selectedFacility) {
            $waypoints[] = ['latitude' => (float) $selectedFacility->latitude, 'longitude' => (float) $selectedFacility->longitude];
        }

        $waypoints[] = ['latitude' => $destLat, 'longitude' => $destLng];

        // 5. Invoke OsrmService for real road routing
        $osrmResult = $this->osrmService->getRoute($waypoints);

        if (!$osrmResult['success']) {
            return [
                'success' => false,
                'message' => $osrmResult['message'],
            ];
        }

        $routeData = $osrmResult['data'];

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
                    'latitude' => $truckLat,
                    'longitude' => $truckLng,
                    'recorded_at' => $latestTelemetry->recorded_at->toIso8601String(),
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
