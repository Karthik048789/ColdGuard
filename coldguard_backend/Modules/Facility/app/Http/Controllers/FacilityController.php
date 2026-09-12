<?php

namespace Modules\Facility\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Modules\Facility\App\Services\FacilityService;
use Modules\Shipment\App\Models\Shipment;

class FacilityController extends Controller
{
    protected FacilityService $facilityService;

    public function __construct(FacilityService $facilityService)
    {
        $this->facilityService = $facilityService;
    }

    /**
     * GET /api/facilities
     * List all cold-storage facilities, optionally filtered by status.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $facilities = $this->facilityService->getAllFacilities($status);

        return response()->json([
            'success' => true,
            'data' => $facilities,
        ], 200);
    }

    /**
     * GET /api/shipments/{id}/facilities/eligible
     * Retrieve eligible cold-storage facilities ranked by approximate distance for a shipment.
     */
    public function eligible(int $id): JsonResponse
    {
        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $result = $this->facilityService->getEligibleFacilitiesForShipment($shipment);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => $result['data']
        ], 200);
    }
}
