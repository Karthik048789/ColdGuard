<?php

namespace Modules\Routing\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Modules\Routing\App\Services\RoutingService;
use Modules\Shipment\App\Models\Shipment;

class RoutingController extends Controller
{
    protected RoutingService $routingService;

    public function __construct(RoutingService $routingService)
    {
        $this->routingService = $routingService;
    }

    /**
     * GET /api/shipments/{id}/location
     * Retrieve the latest known live truck location and sensor telemetry for a shipment.
     */
    public function location(int $id): JsonResponse
    {
        // 1. Instant Cache Hit (<5ms) without waiting on remote PostgreSQL Singapore connection
        $cached = \Illuminate\Support\Facades\Cache::get("shipment_live_{$id}");
        if ($cached && is_array($cached)) {
            return response()->json([
                'success' => true,
                'data' => $cached
            ], 200);
        }

        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $result = $this->routingService->getLiveLocation($shipment);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message']
            ], 400);
        }

        return response()->json([
            'success' => true,
            'data' => $result['data']
        ], 200);
    }

    /**
     * GET /api/shipments/{id}/route
     * Calculate multi-waypoint road route (Origin/Truck -> Emergency Facility -> Receiver) via OSRM.
     */
    public function route(Request $request, int $id): JsonResponse
    {
        $cacheKey = "route_resp_{$id}_" . md5((string) $request->getQueryString());
        $cached = \Illuminate\Support\Facades\Cache::get($cacheKey);
        if ($cached && is_array($cached)) {
            return response()->json($cached, 200);
        }

        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $facilityId = $request->query('facility_id') && is_numeric($request->query('facility_id'))
            ? (int) $request->query('facility_id')
            : null;
        $direct = $request->boolean('direct') || $request->query('facility_id') === 'none' || $request->query('facility_id') === '0';

        $overrideLat = $request->has('lat') ? (float) $request->query('lat') : null;
        $overrideLng = $request->has('lng') ? (float) $request->query('lng') : null;
        $fromOrigin = $request->boolean('from_origin') || ($overrideLat === null && $overrideLng === null);
        $result = $this->routingService->calculateRoute($shipment, $facilityId, $direct, $overrideLat, $overrideLng, $fromOrigin);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message']
            ], 400);
        }

        $responsePayload = [
            'success' => true,
            'message' => $result['message'],
            'data' => $result['data']
        ];

        \Illuminate\Support\Facades\Cache::put($cacheKey, $responsePayload, 1800);

        return response()->json($responsePayload, 200);
    }
}
