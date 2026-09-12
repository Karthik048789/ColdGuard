<?php

namespace Modules\RiskAnalysis\App\Services;

use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Carbon\Carbon;

class RiskEngineService
{
    /**
     * Evaluate risk for a given shipment based on its recent telemetry.
     */
    public function evaluateRisk(Shipment $shipment): RiskEvent
    {
        // 1. Fetch recent telemetry readings up to current moment
        $readings = Telemetry::where('shipment_id', $shipment->id)
            ->where('recorded_at', '<=', now()->addSeconds(5))
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get()
            ->reverse()
            ->values();

        $minTemp = (float) ($shipment->min_temp ?? 2.0);
        $maxTemp = (float) ($shipment->max_temp ?? 8.0);

        // Default if no telemetry exists yet
        if ($readings->isEmpty()) {
            return RiskEvent::create([
                'shipment_id' => $shipment->id,
                'risk_score' => 5.0,
                'severity' => 'LOW',
                'predicted_failure_minutes' => null,
                'reason' => "No telemetry recorded yet. Shipment is within initial parameters.",
                'recommendation' => "Begin telemetry logging to enable active AI risk monitoring.",
            ]);
        }

        $latest = $readings->last();
        // The authoritative current temperature is shipment's current_temp or latest reading
        $currentTemp = !is_null($shipment->current_temp) ? (float) $shipment->current_temp : (float) $latest->temperature;
        $battery = (float) $latest->battery;
        $humidity = (float) $latest->humidity;

        // 2. Compute Temperature Slope (dT/dt in °C per minute)
        $slopePerMin = 0.0;
        if ($readings->count() >= 2) {
            $first = $readings->first();
            $timeDiffMins = max(1, Carbon::parse($first->recorded_at)->diffInMinutes(Carbon::parse($latest->recorded_at)));
            $tempDiff = $currentTemp - $first->temperature;
            $slopePerMin = round($tempDiff / $timeDiffMins, 3);
        }

        // 3. Evaluate Risk Scenarios

        // SCENARIO A: Already Breached (Excursion beyond limits)
        if ($currentTemp > $maxTemp || $currentTemp < $minTemp) {
            $breachType = $currentTemp > $maxTemp ? "exceeded maximum threshold ({$maxTemp}°C)" : "dropped below minimum threshold ({$minTemp}°C)";
            // Differentiate CRITICAL (> max + 1.5°C or < min - 1.5°C) from WARNING
            $isCritical = ($currentTemp > ($maxTemp + 1.5) || $currentTemp < ($minTemp - 1.5));
            $riskScore = $isCritical ? 98.0 : 85.0;
            $severity = $isCritical ? 'CRITICAL' : 'WARNING';
            $predictedFailureMins = 0;
            $reason = ($isCritical ? "CRITICAL" : "HIGH") . " TEMPERATURE BREACH: Current temperature ({$currentTemp}°C) has {$breachType}.";
            $recommendation = "IMMEDIATE INTERVENTION REQUIRED: Cold-chain integrity is compromised. Reroute to nearest cold-storage facility immediately.";

            $shipment->update(['status' => $severity]);
        }
        // SCENARIO B: Rising Temperature approaching Max Limit (HIGH Risk)
        elseif ($slopePerMin > 0 && ($maxTemp - $currentTemp) <= 1.8) {
            $tempMargin = $maxTemp - $currentTemp;
            $minutesToFailure = ($slopePerMin > 0) ? (int) round($tempMargin / $slopePerMin) : 15;
            $minutesToFailure = max(1, $minutesToFailure);

            // Risk score formula: Higher score as temperature gets closer and slope is higher
            $riskScore = min(95.0, round(75.0 + (1.8 - $tempMargin) * 10.0 + ($slopePerMin * 20.0), 1));
            $severity = 'HIGH';
            $predictedFailureMins = $minutesToFailure;
            $reason = "HIGH RISK: Temperature is continuously increasing at +{$slopePerMin}°C/min. At this rate, max threshold ({$maxTemp}°C) will be breached in ~{$minutesToFailure} minutes.";
            $recommendation = "Cold-chain failure predicted in ~{$minutesToFailure} minutes. Prepare nearby cold-storage facility intervention reroute.";

            $shipment->update(['status' => 'WARNING']);
        }
        // SCENARIO C: Elevated Trend or Low Battery (MEDIUM Risk)
        elseif ($slopePerMin > 0.15 || $battery < 25.0) {
            $riskScore = round(45.0 + ($slopePerMin * 30.0) + ($battery < 25.0 ? 15.0 : 0.0), 1);
            $severity = 'MEDIUM';
            $predictedFailureMins = 45;
            $reason = "MEDIUM RISK: Temperature is rising (+{$slopePerMin}°C/min) or refrigeration unit battery is low ({$battery}%).";
            $recommendation = "Monitor telemetry closely and inspect refrigeration unit power supply.";

            if ($shipment->status === 'CREATED') {
                $shipment->update(['status' => 'IN_TRANSIT']);
            }
        }
        // SCENARIO D: Safe Conditions (LOW Risk)
        else {
            $riskScore = round(5.0 + (abs($currentTemp - (($minTemp + $maxTemp) / 2)) * 2.0), 1);
            $severity = 'LOW';
            $predictedFailureMins = null;
            $reason = "SAFE: Cold-chain temperature is stable ({$currentTemp}°C within required {$minTemp}°C–{$maxTemp}°C range).";
            $recommendation = "Continue standard transit route.";

            // If temperature is within safe range, de-escalate from WARNING or CRITICAL
            if (in_array($shipment->status, ['CREATED', 'WARNING', 'CRITICAL'])) {
                $hasActiveDiversion = \Modules\Intervention\App\Models\Intervention::where('shipment_id', $shipment->id)
                    ->whereIn('status', ['ACTIVE', 'DIVERTED', 'FACILITY_SELECTED'])
                    ->whereNotNull('facility_id')
                    ->exists();

                $shipment->update([
                    'status' => $hasActiveDiversion ? 'REROUTED' : 'IN_TRANSIT'
                ]);
            }
        }

        // Save and return RiskEvent
        return RiskEvent::create([
            'shipment_id' => $shipment->id,
            'risk_score' => $riskScore,
            'severity' => $severity,
            'predicted_failure_minutes' => $predictedFailureMins,
            'reason' => $reason,
            'recommendation' => $recommendation,
        ]);
    }
}
