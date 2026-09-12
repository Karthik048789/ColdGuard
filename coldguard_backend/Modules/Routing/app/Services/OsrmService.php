<?php

namespace Modules\Routing\App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OsrmService
{
    protected string $baseUrl;
    protected int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('services.osrm.base_url') ?? env('OSRM_BASE_URL', 'https://router.project-osrm.org');
        $this->timeout = (int) (config('services.osrm.timeout') ?? env('OSRM_TIMEOUT', 10));
    }

    /**
     * Calculate multi-waypoint road route via OSRM.
     * 
     * @param array $waypoints Array of ['latitude' => float, 'longitude' => float]
     * @return array
     */
    public function getRoute(array $waypoints): array
    {
        if (count($waypoints) < 2) {
            return [
                'success' => false,
                'message' => 'At least 2 waypoints (origin and destination) are required to compute a route.',
            ];
        }

        // 1. Format coordinates: OSRM expects LON,LAT
        $coordStrings = array_map(function ($wp) {
            $lat = (float) $wp['latitude'];
            $lon = (float) $wp['longitude'];
            return "{$lon},{$lat}";
        }, $waypoints);

        $coordinatesPath = implode(';', $coordStrings);
        $url = rtrim($this->baseUrl, '/') . "/route/v1/driving/{$coordinatesPath}";

        try {
            $response = Http::withoutVerifying()
                ->timeout($this->timeout)
                ->get($url, [
                    'overview' => 'full',
                    'geometries' => 'geojson',
                    'steps' => 'true',
                ]);

            if (!$response->successful()) {
                Log::error('OSRM API HTTP Error: ' . $response->status() . ' - ' . $response->body());
                return [
                    'success' => false,
                    'message' => 'Unable to calculate road route at this time.',
                ];
            }

            $data = $response->json();

            if (!is_array($data) || ($data['code'] ?? '') !== 'Ok' || empty($data['routes'])) {
                Log::error('OSRM API Error Code / Missing Routes: ' . json_encode($data));
                return [
                    'success' => false,
                    'message' => 'Unable to calculate road route at this time.',
                ];
            }

            $route = $data['routes'][0];

            return [
                'success' => true,
                'data' => $this->normalizeRouteResponse($route, $data['waypoints'] ?? [])
            ];

        } catch (\Throwable $e) {
            Log::error('OSRM Service Exception: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Unable to calculate road route at this time.',
            ];
        }
    }

    /**
     * Normalize OSRM raw response into clean ColdGuard format.
     */
    protected function normalizeRouteResponse(array $route, array $osrmWaypoints): array
    {
        $distanceM = (float) ($route['distance'] ?? 0);
        $durationSec = (float) ($route['duration'] ?? 0);

        $distanceKm = round($distanceM / 1000.0, 2);
        $durationMin = (int) round($durationSec / 60.0);

        $geometry = $route['geometry'] ?? [
            'type' => 'LineString',
            'coordinates' => []
        ];

        $rawLegs = $route['legs'] ?? [];
        $normalizedLegs = [];
        $allSteps = [];

        foreach ($rawLegs as $legIdx => $leg) {
            $legDistM = (float) ($leg['distance'] ?? 0);
            $legDurSec = (float) ($leg['duration'] ?? 0);

            $legSteps = [];
            if (!empty($leg['steps'])) {
                foreach ($leg['steps'] as $step) {
                    $stepInstruction = $this->formatStepInstruction($step);
                    $stepLoc = $step['maneuver']['location'] ?? [0, 0];
                    
                    $normalizedStep = [
                        'instruction' => $stepInstruction,
                        'distance_m' => round((float) ($step['distance'] ?? 0), 1),
                        'duration_seconds' => (int) round((float) ($step['duration'] ?? 0)),
                        'location' => [
                            'latitude' => (float) ($stepLoc[1] ?? 0),
                            'longitude' => (float) ($stepLoc[0] ?? 0),
                        ]
                    ];

                    $legSteps[] = $normalizedStep;
                    $allSteps[] = $normalizedStep;
                }
            }

            $normalizedLegs[] = [
                'leg_number' => $legIdx + 1,
                'summary' => $leg['summary'] ?? '',
                'distance_km' => round($legDistM / 1000.0, 2),
                'duration_minutes' => (int) round($legDurSec / 60.0),
                'steps' => $legSteps,
            ];
        }

        return [
            'distance_km' => $distanceKm,
            'duration_minutes' => $durationMin,
            'distance_m' => round($distanceM, 1),
            'duration_seconds' => (int) round($durationSec),
            'geometry' => $geometry,
            'legs' => $normalizedLegs,
            'steps' => $allSteps,
        ];
    }

    /**
     * Format maneuver steps into readable navigation instructions.
     */
    protected function formatStepInstruction(array $step): string
    {
        $maneuver = $step['maneuver'] ?? [];
        $type = $maneuver['type'] ?? 'move';
        $modifier = $maneuver['modifier'] ?? '';
        $name = $step['name'] ?? '';

        $text = ucfirst(str_replace('_', ' ', $type));
        if ($modifier) {
            $text .= ' ' . str_replace('_', ' ', $modifier);
        }
        if ($name) {
            $text .= " onto {$name}";
        }

        return trim($text);
    }
}
