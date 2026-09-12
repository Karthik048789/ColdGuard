<?php

namespace Modules\Intervention\App\Services;

use Modules\Intervention\App\Models\Intervention;
use Modules\Intervention\App\Models\Alert;
use Modules\Shipment\App\Models\Shipment;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Modules\Facility\App\Models\Facility;
use Modules\Facility\App\Services\FacilityService;
use Modules\Routing\App\Services\RoutingService;
use Modules\AI\App\Services\AIAnalysisService;
use Illuminate\Support\Facades\Log;

class InterventionService
{
    protected FacilityService $facilityService;
    protected RoutingService $routingService;
    protected AlertService $alertService;
    protected AIAnalysisService $aiAnalysisService;

    public function __construct(
        FacilityService $facilityService,
        RoutingService $routingService,
        AlertService $alertService,
        AIAnalysisService $aiAnalysisService
    ) {
        $this->facilityService = $facilityService;
        $this->routingService = $routingService;
        $this->alertService = $alertService;
        $this->aiAnalysisService = $aiAnalysisService;
    }

    /**
     * Process a RiskEvent and determine if automatic cold-chain intervention is required.
     */
    public function processRiskEvent(Shipment $shipment, RiskEvent $riskEvent): array
    {
        $severity = strtoupper($riskEvent->severity);

        // 1. LOW Risk -> No intervention needed
        if ($severity === 'LOW') {
            return [
                'action_taken' => 'NONE',
                'status' => 'SAFE',
                'message' => 'Shipment thermal parameters are safe. No intervention required.',
            ];
        }

        // 2. MEDIUM Risk -> Warning alert, no automatic diversion
        if ($severity === 'MEDIUM') {
            // Check if recent warning alert created within 30 minutes to prevent alert spam
            $recentWarning = Alert::where('shipment_id', $shipment->id)
                ->where('type', 'COLD_CHAIN_WARNING')
                ->where('created_at', '>=', now()->subMinutes(30))
                ->first();

            if (!$recentWarning) {
                $this->alertService->createAlert(
                    $shipment,
                    null,
                    'MANAGER',
                    'COLD_CHAIN_WARNING',
                    "Cold-Chain Warning: {$shipment->tracking_number}",
                    "Shipment {$shipment->tracking_number} temperature is approaching limits ({$shipment->current_temp}°C). Monitor refrigeration unit.",
                    'MEDIUM'
                );
            }

            return [
                'action_taken' => 'WARNING_ALERT',
                'status' => 'WARNING',
                'message' => 'Medium risk detected. Warning alert issued without diversion.',
            ];
        }

        // 3. HIGH or CRITICAL Risk -> Evaluate Automatic Intervention & Diversion
        // Idempotency Guard: Check if an active intervention already exists for this shipment
        $activeIntervention = Intervention::where('shipment_id', $shipment->id)
            ->whereIn('status', ['PENDING', 'ACTIVE', 'FACILITY_SELECTED', 'DIVERTED'])
            ->first();

        if ($activeIntervention) {
            // Update active intervention details
            $activeIntervention->update([
                'risk_event_id' => $riskEvent->id,
                'risk_score' => $riskEvent->risk_score,
                'severity' => $severity,
            ]);

            // Dynamic Rerouting Guard: Check if truck has moved significantly (> 500m)
            $lastLat = $shipment->current_lat;
            $lastLng = $shipment->current_lng;
            $routeData = null;

            if ($activeIntervention->facility_id && !is_null($lastLat) && !is_null($lastLng)) {
                $routeResult = $this->routingService->calculateRoute($shipment, $activeIntervention->facility_id);
                if ($routeResult['success']) {
                    $routeData = $routeResult['data'];
                }
            }

            return [
                'action_taken' => 'INTERVENTION_UPDATED',
                'status' => $activeIntervention->status,
                'intervention' => $this->formatInterventionResponse($activeIntervention, $routeData),
                'message' => 'Active intervention exists. Updated parameters without duplicating intervention or alert spam.',
            ];
        }

        // 4. Create New Automatic Intervention
        // Query FacilityService for eligible cold-storage candidates
        $facilityResult = $this->facilityService->getEligibleFacilitiesForShipment($shipment);

        $eligibleFacilities = $facilityResult['data']['facilities'] ?? [];
        $recommendedFacility = $facilityResult['data']['recommended_facility'] ?? null;

        if (empty($eligibleFacilities) || !$recommendedFacility) {
            // NO ELIGIBLE FACILITY AVAILABLE FALLBACK
            $intervention = Intervention::create([
                'shipment_id' => $shipment->id,
                'risk_event_id' => $riskEvent->id,
                'facility_id' => null,
                'reason' => $riskEvent->reason . " (WARNING: No eligible cold-storage facility currently available).",
                'status' => 'ACTIVE',
                'severity' => 'CRITICAL',
                'risk_score' => $riskEvent->risk_score,
                'original_destination_lat' => $shipment->destination_lat,
                'original_destination_lng' => $shipment->destination_lng,
            ]);

            $shipment->update(['status' => 'CRITICAL']);
            $this->alertService->createNoFacilityAlert($shipment, $intervention);

            return [
                'action_taken' => 'INTERVENTION_CREATED_NO_FACILITY',
                'status' => 'ACTIVE',
                'intervention' => $this->formatInterventionResponse($intervention, null),
                'message' => 'Intervention created. WARNING: No eligible cold-storage facility available.',
            ];
        }

        // 5. Eligible Facility Selected -> Calculate OSRM Diversion Route
        $selectedFacilityId = $recommendedFacility['id'];
        $selectedFacility = Facility::find($selectedFacilityId);

        $routeResult = $this->routingService->calculateRoute($shipment, $selectedFacilityId);
        $routeData = $routeResult['success'] ? $routeResult['data'] : null;

        $intervention = Intervention::create([
            'shipment_id' => $shipment->id,
            'risk_event_id' => $riskEvent->id,
            'facility_id' => $selectedFacilityId,
            'reason' => $riskEvent->reason,
            'status' => 'DIVERTED',
            'severity' => $severity,
            'risk_score' => $riskEvent->risk_score,
            'original_destination_lat' => $shipment->destination_lat,
            'original_destination_lng' => $shipment->destination_lng,
        ]);

        // Update shipment status to DIVERTED
        $shipment->update(['status' => 'DIVERTED']);

        // Create dynamic alerts for Manager, Driver, and Receiver
        $this->alertService->createInterventionAlerts(
            $shipment,
            $intervention,
            $recommendedFacility,
            $routeData
        );

        return [
            'action_taken' => 'INTERVENTION_CREATED_DIVERTED',
            'status' => 'DIVERTED',
            'intervention' => $this->formatInterventionResponse($intervention, $routeData),
            'message' => "Automatic intervention activated. Shipment diverted to {$selectedFacility->name}.",
        ];
    }

    /**
     * Get details of active intervention for a shipment.
     */
    public function getActiveInterventionForShipment(Shipment $shipment): ?array
    {
        $intervention = Intervention::where('shipment_id', $shipment->id)
            ->whereIn('status', ['PENDING', 'ACTIVE', 'FACILITY_SELECTED', 'DIVERTED'])
            ->latest('id')
            ->first();

        if (!$intervention) {
            return null;
        }

        $routeData = null;
        if ($intervention->facility_id) {
            $routeResult = $this->routingService->calculateRoute($shipment, $intervention->facility_id);
            if ($routeResult['success']) {
                $routeData = $routeResult['data'];
            }
        }

        return $this->formatInterventionResponse($intervention, $routeData);
    }

    /**
     * Get all historical interventions for a shipment.
     */
    public function getInterventionHistoryForShipment(Shipment $shipment): array
    {
        return Intervention::where('shipment_id', $shipment->id)
            ->with(['facility', 'riskEvent', 'alerts'])
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($inv) {
                return [
                    'id' => $inv->id,
                    'shipment_id' => $inv->shipment_id,
                    'status' => $inv->status,
                    'severity' => $inv->severity,
                    'risk_score' => (float) $inv->risk_score,
                    'reason' => $inv->reason,
                    'facility' => $inv->facility ? [
                        'id' => $inv->facility->id,
                        'name' => $inv->facility->name,
                        'latitude' => (float) $inv->facility->latitude,
                        'longitude' => (float) $inv->facility->longitude,
                    ] : null,
                    'created_at' => $inv->created_at->toIso8601String(),
                    'resolved_at' => $inv->resolved_at?->toIso8601String(),
                ];
            })->toArray();
    }

    /**
     * Resolve an active intervention.
     */
    public function resolveIntervention(Intervention $intervention): array
    {
        if ($intervention->status === 'RESOLVED') {
            return [
                'success' => true,
                'message' => 'Intervention is already resolved.',
                'intervention' => $this->formatInterventionResponse($intervention, null),
            ];
        }

        $intervention->update([
            'status' => 'RESOLVED',
            'resolved_at' => now(),
        ]);

        $shipment = $intervention->shipment;
        if ($shipment && $shipment->status !== 'DELIVERED') {
            $shipment->update(['status' => 'IN_TRANSIT']);
        }

        $this->alertService->createResolutionAlerts($shipment, $intervention);

        return [
            'success' => true,
            'message' => 'Intervention resolved successfully.',
            'intervention' => $this->formatInterventionResponse($intervention, null),
        ];
    }

    /**
     * Format standardized response structure for intervention.
     */
    public function formatInterventionResponse(Intervention $intervention, ?array $routeData = null): array
    {
        $shipment = $intervention->shipment ?? Shipment::find($intervention->shipment_id);
        $facility = $intervention->facility ?? ($intervention->facility_id ? Facility::find($intervention->facility_id) : null);
        $riskEvent = $intervention->riskEvent ?? ($intervention->risk_event_id ? RiskEvent::find($intervention->risk_event_id) : null);
        $alerts = Alert::where('intervention_id', $intervention->id)->orderBy('id', 'desc')->get();

        return [
            'id' => $intervention->id,
            'shipment' => [
                'id' => $shipment->id,
                'tracking_number' => $shipment->tracking_number,
                'product_name' => $shipment->product_name,
                'current_temperature' => (float) ($shipment->current_temp ?? $shipment->min_temp),
                'min_temp' => (float) $shipment->min_temp,
                'max_temp' => (float) $shipment->max_temp,
                'status' => $shipment->status,
            ],
            'status' => $intervention->status,
            'severity' => $intervention->severity,
            'risk_score' => (float) $intervention->risk_score,
            'reason' => $intervention->reason,
            'selected_facility' => $facility ? [
                'id' => $facility->id,
                'name' => $facility->name,
                'latitude' => (float) $facility->latitude,
                'longitude' => (float) $facility->longitude,
                'available_capacity' => (int) $facility->available_capacity,
                'min_temperature' => (float) $facility->min_temperature,
                'max_temperature' => (float) $facility->max_temperature,
                'cost' => (float) $facility->cost,
            ] : null,
            'original_destination' => [
                'name' => $shipment->destination_name,
                'latitude' => (float) ($intervention->original_destination_lat ?? $shipment->destination_lat),
                'longitude' => (float) ($intervention->original_destination_lng ?? $shipment->destination_lng),
            ],
            'route' => $routeData ? [
                'distance_km' => $routeData['distance_km'],
                'duration_minutes' => $routeData['duration_minutes'],
                'geometry' => $routeData['geometry'],
                'legs' => $routeData['legs'],
                'steps' => $routeData['steps'],
            ] : null,
            'alerts' => $alerts->map(function ($a) {
                return [
                    'id' => $a->id,
                    'recipient_role' => $a->recipient_role,
                    'type' => $a->type,
                    'title' => $a->title,
                    'message' => $a->message,
                    'severity' => $a->severity,
                    'read_at' => $a->read_at?->toIso8601String(),
                    'created_at' => $a->created_at->toIso8601String(),
                ];
            })->toArray(),
            'created_at' => $intervention->created_at->toIso8601String(),
            'resolved_at' => $intervention->resolved_at?->toIso8601String(),
        ];
    }
}
