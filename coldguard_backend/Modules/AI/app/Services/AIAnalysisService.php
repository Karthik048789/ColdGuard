<?php

namespace Modules\AI\App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Shipment\App\Models\Shipment;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Illuminate\Support\Collection;

class AIAnalysisService
{
    protected const SYSTEM_PROMPT = "You are ColdGuard AI, a cold-chain operational decision-support assistant. Analyze only the data provided. Do not invent sensor readings, facility information, routes, coordinates, medical requirements, or shipment details. The numerical risk score and severity are calculated by the ColdGuard deterministic risk engine and must not be changed. Your role is to explain the risk, urgency, and recommended action based only on the provided information. If information is missing, explicitly state that it is unavailable. Return a valid JSON object ONLY with the following exact keys: \"summary\", \"risk_explanation\", \"urgency\", \"recommended_action\", \"confidence_note\". Do not wrap output in markdown code block fences.";

    /**
     * Generate intelligent natural language AI analysis and interpretation.
     */
    public function generateAnalysis(Shipment $shipment, RiskEvent $riskEvent, Collection $recentTelemetry): array
    {
        // 1. Build structured input payload
        $inputPayload = [
            'shipment' => [
                'tracking_number' => $shipment->tracking_number,
                'product' => $shipment->product_name,
                'quantity' => "{$shipment->quantity} {$shipment->quantity_unit}",
                'min_temperature_c' => (float) $shipment->min_temp,
                'max_temperature_c' => (float) $shipment->max_temp,
                'origin' => $shipment->origin_name,
                'destination' => $shipment->destination_name,
                'shipment_value_inr' => (float) $shipment->shipment_value,
            ],
            'risk_engine_evaluation' => [
                'risk_score_percent' => (float) $riskEvent->risk_score,
                'severity' => $riskEvent->severity,
                'predicted_failure_minutes' => $riskEvent->predicted_failure_minutes,
                'deterministic_reason' => $riskEvent->reason,
                'deterministic_recommendation' => $riskEvent->recommendation,
            ],
            'telemetry_state' => [
                'current_temperature_c' => (float) ($shipment->current_temp ?? $shipment->min_temp),
                'current_humidity_percent' => (float) ($shipment->current_humidity ?? 50.0),
                'current_battery_percent' => (float) ($shipment->current_battery ?? 100.0),
                'recent_readings_window' => $recentTelemetry->map(function ($t) {
                    return [
                        'temperature' => (float) $t->temperature,
                        'battery' => (float) $t->battery,
                        'recorded_at' => $t->recorded_at->toIso8601String(),
                    ];
                })->toArray(),
            ]
        ];

        // 2. Prepare Gemini API Request
        $apiKey = config('services.gemini.key') ?? env('GEMINI_API_KEY');
        $model = config('services.gemini.model') ?? env('GEMINI_MODEL', 'gemini-3.6-flash');
        $baseUrl = config('services.gemini.base_url') ?? env('AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta');

        if (empty($apiKey)) {
            Log::warning('GEMINI_API_KEY is not set. Using deterministic fallback.');
            return $this->getFallbackAnalysis($shipment, $riskEvent);
        }

        $endpoint = "{$baseUrl}/models/{$model}:generateContent?key={$apiKey}";

        try {
            $promptText = self::SYSTEM_PROMPT . "\n\nSTRUCTURED DATA PAYLOAD:\n" . json_encode($inputPayload, JSON_PRETTY_PRINT);

            $response = Http::timeout(8)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($endpoint, [
                    'contents' => [
                        [
                            'role' => 'user',
                            'parts' => [
                                ['text' => $promptText]
                            ]
                        ]
                    ],
                    'generationConfig' => [
                        'temperature' => 0.2,
                        'responseMimeType' => 'application/json'
                    ]
                ]);

            if ($response->successful()) {
                $responseData = $response->json();
                $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;

                if ($rawText) {
                    // Clean possible markdown backticks
                    $rawText = trim(preg_replace('/^```json|```$/m', '', trim($rawText)));
                    $parsed = json_decode($rawText, true);

                    if (is_array($parsed) && isset($parsed['summary'], $parsed['risk_explanation'], $parsed['urgency'], $parsed['recommended_action'])) {
                        return [
                            'summary' => $parsed['summary'],
                            'risk_explanation' => $parsed['risk_explanation'],
                            'urgency' => $parsed['urgency'],
                            'recommended_action' => $parsed['recommended_action'],
                            'confidence_note' => $parsed['confidence_note'] ?? 'Generated via Gemini AI decision-support model based on telemetry window.',
                        ];
                    }
                }
            } else {
                Log::warning('Gemini API HTTP Error: ' . $response->status() . ' - ' . $response->body());
            }
        } catch (\Throwable $e) {
            Log::error('Gemini AI Exception: ' . $e->getMessage());
        }

        // 3. Deterministic Safe Fallback if API fails/times out
        return $this->getFallbackAnalysis($shipment, $riskEvent);
    }

    /**
     * Deterministic fallback if AI API is unavailable.
     */
    protected function getFallbackAnalysis(Shipment $shipment, RiskEvent $riskEvent): array
    {
        $urgencyMap = [
            'CRITICAL' => 'CRITICAL URGENCY: Immediate operational action required.',
            'HIGH' => 'HIGH URGENCY: Prepare cold-storage reroute within predicted timeframe.',
            'MEDIUM' => 'MODERATE URGENCY: Check refrigeration unit power and monitor trend.',
            'LOW' => 'NORMAL: Standard transit conditions maintained.',
        ];

        return [
            'summary' => "{$riskEvent->severity} risk level detected for shipment {$shipment->tracking_number} ({$shipment->product_name}).",
            'risk_explanation' => $riskEvent->reason,
            'urgency' => $urgencyMap[$riskEvent->severity] ?? 'Standard monitoring.',
            'recommended_action' => $riskEvent->recommendation ?? 'Maintain thermal monitoring.',
            'confidence_note' => 'Generated via ColdGuard Deterministic Risk Engine (AI offline fallback).',
        ];
    }
}
