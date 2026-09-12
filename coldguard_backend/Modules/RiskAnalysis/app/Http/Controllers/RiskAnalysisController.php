<?php

namespace Modules\RiskAnalysis\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Shipment\App\Models\Shipment;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Modules\RiskAnalysis\App\Services\RiskEngineService;

class RiskAnalysisController extends Controller
{
    protected RiskEngineService $riskEngine;

    public function __construct(RiskEngineService $riskEngine)
    {
        $this->riskEngine = $riskEngine;
    }

    /**
     * Trigger risk analysis evaluation on a shipment.
     * POST /api/shipments/{id}/analyze-risk
     */
    public function analyze(Request $request, $id)
    {
        $shipment = Shipment::where('id', $id)
            ->orWhere('tracking_number', $id)
            ->first();

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => 'Shipment not found',
            ], 404);
        }

        $riskEvent = $this->riskEngine->evaluateRisk($shipment);

        return response()->json([
            'success' => true,
            'message' => 'Risk analysis evaluated successfully',
            'data' => [
                'id' => $riskEvent->id,
                'shipment_id' => $riskEvent->shipment_id,
                'tracking_number' => $shipment->tracking_number,
                'current_temperature' => (float) $shipment->current_temp,
                'required_temp_range' => "{$shipment->min_temp}°C to {$shipment->max_temp}°C",
                'risk_score' => (float) $riskEvent->risk_score,
                'severity' => $riskEvent->severity,
                'predicted_failure_minutes' => $riskEvent->predicted_failure_minutes,
                'reason' => $riskEvent->reason,
                'recommendation' => $riskEvent->recommendation,
                'evaluated_at' => $riskEvent->created_at->toIso8601String(),
            ]
        ]);
    }

    /**
     * Get risk evaluation event history for a shipment.
     * GET /api/shipments/{id}/risk-events
     */
    public function index($id)
    {
        $shipment = Shipment::where('id', $id)
            ->orWhere('tracking_number', $id)
            ->first();

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => 'Shipment not found',
            ], 404);
        }

        $events = RiskEvent::where('shipment_id', $shipment->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($e) {
                return [
                    'id' => $e->id,
                    'shipment_id' => $e->shipment_id,
                    'risk_score' => (float) $e->risk_score,
                    'severity' => $e->severity,
                    'predicted_failure_minutes' => $e->predicted_failure_minutes,
                    'reason' => $e->reason,
                    'recommendation' => $e->recommendation,
                    'created_at' => $e->created_at->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $events,
        ]);
    }

    /**
     * Get latest risk evaluation event for a shipment.
     * GET /api/shipments/{id}/risk-events/latest
     */
    public function latest($id)
    {
        $shipment = Shipment::where('id', $id)
            ->orWhere('tracking_number', $id)
            ->first();

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => 'Shipment not found',
            ], 404);
        }

        $latest = RiskEvent::where('shipment_id', $shipment->id)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$latest) {
            // Evaluate on-the-fly if no prior risk event exists
            $latest = $this->riskEngine->evaluateRisk($shipment);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $latest->id,
                'shipment_id' => $latest->shipment_id,
                'tracking_number' => $shipment->tracking_number,
                'current_temperature' => (float) $shipment->current_temp,
                'required_temp_range' => "{$shipment->min_temp}°C to {$shipment->max_temp}°C",
                'risk_score' => (float) $latest->risk_score,
                'severity' => $latest->severity,
                'predicted_failure_minutes' => $latest->predicted_failure_minutes,
                'reason' => $latest->reason,
                'recommendation' => $latest->recommendation,
                'evaluated_at' => $latest->created_at->toIso8601String(),
            ]
        ]);
    }
}
