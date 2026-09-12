<?php

namespace Modules\Intervention\App\Services;

use Modules\Intervention\App\Models\Alert;
use Modules\Intervention\App\Models\Intervention;
use Modules\Shipment\App\Models\Shipment;

class AlertService
{
    /**
     * Create a single alert record.
     */
    public function createAlert(
        Shipment $shipment,
        ?Intervention $intervention,
        string $role,
        string $type,
        string $title,
        string $message,
        string $severity = 'HIGH'
    ): Alert {
        return Alert::create([
            'shipment_id' => $shipment->id,
            'intervention_id' => $intervention?->id,
            'recipient_role' => strtoupper($role),
            'type' => strtoupper($type),
            'title' => $title,
            'message' => $message,
            'severity' => strtoupper($severity),
        ]);
    }

    /**
     * Create dynamic recipient alerts for Manager, Driver, and Receiver when an intervention is activated.
     */
    public function createInterventionAlerts(
        Shipment $shipment,
        Intervention $intervention,
        ?array $facilityData = null,
        ?array $routeData = null
    ): array {
        $alerts = [];
        $facilityName = $facilityData['name'] ?? 'Nearest Emergency Storage';
        $currentTemp = $shipment->current_temp ?? $shipment->min_temp;
        $minTemp = $shipment->min_temp;
        $maxTemp = $shipment->max_temp;
        $distKm = $routeData['distance_km'] ?? $facilityData['approximate_distance_km'] ?? 'N/A';
        $durationMin = $routeData['duration_minutes'] ?? 'N/A';
        $destName = $shipment->destination_name;

        // 1. MANAGER ALERT
        $managerTitle = "Critical Cold-Chain Risk: {$shipment->tracking_number}";
        $managerMsg = "Shipment {$shipment->tracking_number} ({$shipment->product_name}) has exceeded its safe temperature range ({$minTemp}°C–{$maxTemp}°C). Current temperature: {$currentTemp}°C.\n" .
            "Recommended Action: Divert to {$facilityName}.\n" .
            "Route: Truck → {$facilityName} → {$destName}.\n" .
            "Distance: {$distKm} km | ETA: {$durationMin} mins.";

        $alerts[] = $this->createAlert(
            $shipment,
            $intervention,
            'MANAGER',
            'FACILITY_SELECTED',
            $managerTitle,
            $managerMsg,
            $intervention->severity
        );

        // 2. DRIVER ALERT
        $driverTitle = "Cold-Chain Diversion Required: Proceed to {$facilityName}";
        $driverMsg = "ATTENTION DRIVER: Shipment {$shipment->tracking_number} requires immediate cold-storage intervention.\n" .
            "Proceed immediately to: {$facilityName}\n" .
            "Distance: {$distKm} km | ETA: {$durationMin} mins.\n" .
            "After temperature stabilization, continue to destination: {$destName}.\n" .
            "Reason: Temperature excursion detected ({$currentTemp}°C).";

        $alerts[] = $this->createAlert(
            $shipment,
            $intervention,
            'DRIVER',
            'DIVERSION_REQUIRED',
            $driverTitle,
            $driverMsg,
            $intervention->severity
        );

        // 3. RECEIVER ALERT
        $receiverTitle = "Shipment {$shipment->tracking_number} Temporarily Diverted";
        $receiverMsg = "Notice to Receiver ({$destName}): Shipment {$shipment->tracking_number} ({$shipment->product_name}) is being temporarily diverted to {$facilityName} due to a cold-chain temperature excursion.\n" .
            "The shipment will resume transit to your facility after thermal stabilization.";

        $alerts[] = $this->createAlert(
            $shipment,
            $intervention,
            'RECEIVER',
            'ROUTE_UPDATED',
            $receiverTitle,
            $receiverMsg,
            'MEDIUM'
        );

        return $alerts;
    }

    /**
     * Create critical alert when no eligible cold-storage facility is available.
     */
    public function createNoFacilityAlert(Shipment $shipment, Intervention $intervention): Alert
    {
        $title = "CRITICAL: No Cold-Storage Facility Available for {$shipment->tracking_number}";
        $msg = "Shipment {$shipment->tracking_number} ({$shipment->product_name}) is experiencing a critical temperature excursion ({$shipment->current_temp}°C vs max {$shipment->max_temp}°C).\n" .
            "WARNING: No eligible cold-storage facility with matching temperature range and available capacity is currently reachable in the vicinity. Manual intervention required immediately!";

        return $this->createAlert(
            $shipment,
            $intervention,
            'MANAGER',
            'COLD_CHAIN_CRITICAL',
            $title,
            $msg,
            'CRITICAL'
        );
    }

    /**
     * Create alert when route updates dynamically during active intervention.
     */
    public function createRouteUpdatedAlert(Shipment $shipment, Intervention $intervention, array $routeData): Alert
    {
        $distKm = $routeData['distance_km'] ?? 'N/A';
        $durationMin = $routeData['duration_minutes'] ?? 'N/A';
        $facilityName = $intervention->facility?->name ?? 'Cold Storage Facility';

        $title = "Diversion Route Updated for {$shipment->tracking_number}";
        $msg = "Diversion route to {$facilityName} updated from current truck position. Remaining distance: {$distKm} km | ETA: {$durationMin} mins.";

        return $this->createAlert(
            $shipment,
            $intervention,
            'DRIVER',
            'ROUTE_UPDATED',
            $title,
            $msg,
            'MEDIUM'
        );
    }

    /**
     * Create resolution alerts when intervention is resolved.
     */
    public function createResolutionAlerts(Shipment $shipment, Intervention $intervention): array
    {
        $alerts = [];
        $title = "Intervention Resolved for Shipment {$shipment->tracking_number}";
        $msg = "The cold-chain intervention for shipment {$shipment->tracking_number} ({$shipment->product_name}) has been successfully resolved. Normal transit status restored.";

        foreach (['MANAGER', 'DRIVER', 'RECEIVER'] as $role) {
            $alerts[] = $this->createAlert(
                $shipment,
                $intervention,
                $role,
                'INTERVENTION_RESOLVED',
                $title,
                $msg,
                'LOW'
            );
        }

        return $alerts;
    }
}
