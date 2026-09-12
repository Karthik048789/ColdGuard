<?php

namespace Modules\Facility\App\Services;

use Modules\Facility\App\Models\Facility;
use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;
use Illuminate\Support\Collection;

class FacilityService
{
    /**
     * Retrieve all facilities, optionally filtered by status.
     */
    public function getAllFacilities(?string $status = null): Collection
    {
        $query = Facility::query();

        if ($status) {
            $query->where('status', strtoupper($status));
        }

        return $query->get();
    }

    /**
     * Find and rank eligible cold-storage facilities for a given shipment.
     */
    public function getEligibleFacilitiesForShipment(Shipment $shipment): array
    {
        // 1. Fetch latest telemetry for current truck GPS location
        $latestTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->latest('recorded_at')
            ->first();

        if (!$latestTelemetry || is_null($latestTelemetry->latitude) || is_null($latestTelemetry->longitude)) {
            return [
                'success' => false,
                'message' => 'Current shipment location is unavailable. Telemetry coordinates missing.',
                'data' => null
            ];
        }

        $truckLat = (float) $latestTelemetry->latitude;
        $truckLng = (float) $latestTelemetry->longitude;

        $shipmentMinTemp = (float) $shipment->min_temp;
        $shipmentMaxTemp = (float) $shipment->max_temp;
        $shipmentQty = (int) $shipment->quantity;

        // 2. Query candidates from database
        $facilities = Facility::all();

        // 3. Filter hard eligibility constraints
        $eligible = $facilities->filter(function (Facility $facility) use ($shipmentMinTemp, $shipmentMaxTemp, $shipmentQty) {
            // Constraint 1: Status must be AVAILABLE
            if (strtoupper($facility->status) !== 'AVAILABLE') {
                return false;
            }

            // Constraint 2: Sufficient available capacity
            if ((int) $facility->available_capacity < $shipmentQty) {
                return false;
            }

            // Constraint 3: Temperature range complete containment
            // Facility must support the complete required shipment temperature range
            if ((float) $facility->min_temperature > $shipmentMinTemp || (float) $facility->max_temperature < $shipmentMaxTemp) {
                return false;
            }

            // Constraint 4: Valid GPS coordinates
            if (is_null($facility->latitude) || is_null($facility->longitude)) {
                return false;
            }

            return true;
        });

        // 4. Calculate Haversine candidate distance & attach metric
        $candidates = $eligible->map(function (Facility $facility) use ($truckLat, $truckLng) {
            $distKm = $this->calculateHaversineDistance(
                $truckLat,
                $truckLng,
                (float) $facility->latitude,
                (float) $facility->longitude
            );

            $facilityArray = $facility->toArray();
            $facilityArray['approximate_distance_km'] = round($distKm, 2);
            return $facilityArray;
        })->values();

        // 5. Deterministic Ranking: prioritize closest approximate distance, then cost
        $sortedCandidates = $candidates->sort(function ($a, $b) {
            if ($a['approximate_distance_km'] == $b['approximate_distance_km']) {
                return $a['cost'] <=> $b['cost'];
            }
            return $a['approximate_distance_km'] <=> $b['approximate_distance_km'];
        })->values();

        // 6. Build recommended facility summary if eligible facilities exist
        $recommendedFacility = null;
        if ($sortedCandidates->isNotEmpty()) {
            $top = $sortedCandidates->first();
            $recommendedFacility = [
                'id' => $top['id'],
                'name' => $top['name'],
                'latitude' => $top['latitude'],
                'longitude' => $top['longitude'],
                'available_capacity' => $top['available_capacity'],
                'min_temperature' => $top['min_temperature'],
                'max_temperature' => $top['max_temperature'],
                'cost' => $top['cost'],
                'approximate_distance_km' => $top['approximate_distance_km'],
                'reason' => "Eligible temperature range ({$top['min_temperature']}–{$top['max_temperature']}°C), sufficient capacity ({$top['available_capacity']} units), available, and closest candidate facility ({$top['approximate_distance_km']} km away)."
            ];
        }

        return [
            'success' => true,
            'message' => $sortedCandidates->isEmpty()
                ? 'No eligible cold-storage facilities are currently available for this shipment.'
                : 'Eligible facilities retrieved and ranked successfully.',
            'data' => [
                'shipment' => [
                    'id' => $shipment->id,
                    'tracking_number' => $shipment->tracking_number,
                    'product_name' => $shipment->product_name,
                    'required_temperature' => [
                        'min' => $shipmentMinTemp,
                        'max' => $shipmentMaxTemp,
                    ],
                    'quantity' => $shipmentQty,
                ],
                'current_location' => [
                    'latitude' => $truckLat,
                    'longitude' => $truckLng,
                    'last_updated_at' => $latestTelemetry->recorded_at->toIso8601String(),
                ],
                'facilities' => $sortedCandidates->toArray(),
                'recommended_facility' => $recommendedFacility,
            ]
        ];
    }

    /**
     * Calculate approximate straight-line geodesic distance using Haversine formula (in km).
     */
    public function calculateHaversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371.0;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadiusKm * $c;
    }
}
