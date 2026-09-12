<?php

namespace Modules\AI\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Modules\RiskAnalysis\App\Services\RiskEngineService;
use Modules\AI\App\Services\AIAnalysisService;

class AIController extends Controller
{
    protected AIAnalysisService $aiService;
    protected RiskEngineService $riskEngine;

    public function __construct(AIAnalysisService $aiService, RiskEngineService $riskEngine)
    {
        $this->aiService = $aiService;
        $this->riskEngine = $riskEngine;
    }

    /**
     * Generate AI explanation and contextual recommendation for a shipment.
     * POST /api/shipments/{id}/ai-analysis
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

        // 1. Get latest RiskEvent (or evaluate if none exists)
        $latestRisk = RiskEvent::where('shipment_id', $shipment->id)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$latestRisk) {
            $latestRisk = $this->riskEngine->evaluateRisk($shipment);
        }

        // 2. Get recent telemetry window (last 6 readings)
        $recentTelemetry = Telemetry::where('shipment_id', $shipment->id)
            ->orderBy('recorded_at', 'desc')
            ->limit(6)
            ->get()
            ->reverse()
            ->values();

        // 3. Generate AI Analysis
        $aiResult = $this->aiService->generateAnalysis($shipment, $latestRisk, $recentTelemetry);

        // 4. Return combined response preserving deterministic numerical values
        return response()->json([
            'success' => true,
            'data' => [
                'shipment' => [
                    'id' => $shipment->id,
                    'tracking_number' => $shipment->tracking_number,
                    'product_name' => $shipment->product_name,
                    'current_temperature' => (float) ($shipment->current_temp ?? $shipment->min_temp),
                    'min_temp' => (float) $shipment->min_temp,
                    'max_temp' => (float) $shipment->max_temp,
                    'status' => $shipment->status,
                ],
                'deterministic_risk' => [
                    'risk_score' => (float) $latestRisk->risk_score,
                    'severity' => $latestRisk->severity,
                    'predicted_failure_minutes' => $latestRisk->predicted_failure_minutes,
                ],
                'ai_interpretation' => [
                    'summary' => $aiResult['summary'],
                    'risk_explanation' => $aiResult['risk_explanation'],
                    'urgency' => $aiResult['urgency'],
                    'recommended_action' => $aiResult['recommended_action'],
                    'confidence_note' => $aiResult['confidence_note'],
                ]
            ]
        ]);
    }
}
