<?php

namespace Modules\Telemetry\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;
use Carbon\Carbon;

class TelemetryController extends Controller
{
    /**
     * Store a single telemetry reading for a shipment.
     * POST /api/shipments/{id}/telemetry
     */
    public function store(Request $request, $id)
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

        $validated = $request->validate([
            'temperature' => 'required|numeric',
            'humidity' => 'required|numeric|between:0,100',
            'battery' => 'required|numeric|between:0,100',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'recorded_at' => 'required|date',
        ]);

        $telemetry = Telemetry::create([
            'shipment_id' => $shipment->id,
            'temperature' => $validated['temperature'],
            'humidity' => $validated['humidity'],
            'battery' => $validated['battery'],
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'recorded_at' => Carbon::parse($validated['recorded_at']),
            'is_anomaly' => ($validated['temperature'] < $shipment->min_temp || $validated['temperature'] > $shipment->max_temp),
        ]);

        // Update current shipment location & telemetry state
        $shipment->update([
            'current_temp' => $validated['temperature'],
            'current_humidity' => $validated['humidity'],
            'current_battery' => $validated['battery'],
            'current_lat' => $validated['latitude'],
            'current_lng' => $validated['longitude'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Telemetry recorded successfully',
            'data' => [
                'id' => $telemetry->id,
                'shipment_id' => $telemetry->shipment_id,
                'temperature' => (float) $telemetry->temperature,
                'humidity' => (float) $telemetry->humidity,
                'battery' => (float) $telemetry->battery,
                'latitude' => (float) $telemetry->latitude,
                'longitude' => (float) $telemetry->longitude,
                'recorded_at' => $telemetry->recorded_at->toIso8601String(),
            ]
        ], 201);
    }

    /**
     * Get all telemetry readings for a shipment ordered by recorded_at ASC.
     * GET /api/shipments/{id}/telemetry
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

        $readings = Telemetry::where('shipment_id', $shipment->id)
            ->orderBy('recorded_at', 'asc')
            ->get()
            ->map(function ($t) {
                return [
                    'id' => $t->id,
                    'shipment_id' => $t->shipment_id,
                    'temperature' => (float) $t->temperature,
                    'humidity' => (float) $t->humidity,
                    'battery' => (float) $t->battery,
                    'latitude' => (float) $t->latitude,
                    'longitude' => (float) $t->longitude,
                    'recorded_at' => $t->recorded_at->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $readings,
        ]);
    }

    /**
     * Get the latest telemetry reading for a shipment.
     * GET /api/shipments/{id}/telemetry/latest
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

        $latest = Telemetry::where('shipment_id', $shipment->id)
            ->orderBy('recorded_at', 'desc')
            ->orderBy('id', 'desc')
            ->first();

        if (!$latest) {
            return response()->json([
                'success' => true,
                'data' => [
                    'temperature' => (float) ($shipment->current_temp ?? 5.0),
                    'humidity' => (float) ($shipment->current_humidity ?? 50.0),
                    'battery' => (float) ($shipment->current_battery ?? 100.0),
                    'latitude' => (float) ($shipment->current_lat ?? $shipment->origin_lat),
                    'longitude' => (float) ($shipment->current_lng ?? $shipment->origin_lng),
                    'recorded_at' => now()->toIso8601String(),
                ]
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $latest->id,
                'shipment_id' => $latest->shipment_id,
                'temperature' => (float) $latest->temperature,
                'humidity' => (float) $latest->humidity,
                'battery' => (float) $latest->battery,
                'latitude' => (float) $latest->latitude,
                'longitude' => (float) $latest->longitude,
                'recorded_at' => $latest->recorded_at->toIso8601String(),
            ]
        ]);
    }

    /**
     * Controlled Telemetry Simulation.
     * POST /api/shipments/{id}/telemetry/simulate
     */
    public function simulate(Request $request, $id)
    {
        $validated = $request->validate([
            'scenario' => 'required|string|in:normal,failure',
        ]);

        $shipment = Shipment::where('id', $id)
            ->orWhere('tracking_number', $id)
            ->first();

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => 'Shipment not found',
            ], 404);
        }

        $scenario = $validated['scenario'];
        $steps = 6;
        $now = now();
        $generatedReadings = [];

        // Route coordinates interpolation
        $startLat = $shipment->origin_lat;
        $startLng = $shipment->origin_lng;
        $endLat = $shipment->destination_lat;
        $endLng = $shipment->destination_lng;

        // Base values
        $baseTemp = 6.1;
        $baseHumidity = 72.0;
        $baseBattery = 92.0;

        for ($i = 0; $i < $steps; $i++) {
            $progress = $i / ($steps - 1);
            $lat = round($startLat + ($endLat - $startLat) * $progress * 0.4, 7); // Truck is partially along route
            $lng = round($startLng + ($endLng - $startLng) * $progress * 0.4, 7);
            
            if ($scenario === 'normal') {
                // Temp stays safe (6.1, 6.2, 6.3, 6.4, 6.5, 6.6)
                $temp = round($baseTemp + ($i * 0.1), 2);
            } else {
                // Failure scenario: progressive rise (6.1, 6.5, 6.9, 7.3, 7.8, 8.4)
                $temp = round($baseTemp + ($i * 0.46), 2);
            }

            $humidity = round($baseHumidity - ($i * 0.5) + (rand(-10, 10) / 10), 2);
            $battery = round($baseBattery - ($i * 0.8), 2);
            $recordedAt = (clone $now)->addMinutes($i * 3);

            $telemetry = Telemetry::create([
                'shipment_id' => $shipment->id,
                'temperature' => $temp,
                'humidity' => max(0, min(100, $humidity)),
                'battery' => max(0, min(100, $battery)),
                'latitude' => $lat,
                'longitude' => $lng,
                'recorded_at' => $recordedAt,
                'is_anomaly' => ($temp > $shipment->max_temp || $temp < $shipment->min_temp),
            ]);

            $generatedReadings[] = [
                'id' => $telemetry->id,
                'temperature' => (float) $telemetry->temperature,
                'humidity' => (float) $telemetry->humidity,
                'battery' => (float) $telemetry->battery,
                'latitude' => (float) $telemetry->latitude,
                'longitude' => (float) $telemetry->longitude,
                'recorded_at' => $telemetry->recorded_at->toIso8601String(),
            ];

            // Update shipment's current latest state
            $shipment->update([
                'current_temp' => $temp,
                'current_humidity' => $humidity,
                'current_battery' => $battery,
                'current_lat' => $lat,
                'current_lng' => $lng,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Telemetry simulation completed ({$scenario} scenario)",
            'data' => [
                'scenario' => $scenario,
                'shipment_id' => $shipment->id,
                'tracking_number' => $shipment->tracking_number,
                'total_generated' => count($generatedReadings),
                'latest_reading' => end($generatedReadings),
                'readings' => $generatedReadings,
            ]
        ]);
    }
}
