<?php

namespace Modules\Intervention\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Modules\Intervention\App\Services\InterventionService;
use Modules\Intervention\App\Models\Intervention;
use Modules\Intervention\App\Models\Alert;
use Modules\Shipment\App\Models\Shipment;

class InterventionController extends Controller
{
    protected InterventionService $interventionService;

    public function __construct(InterventionService $interventionService)
    {
        $this->interventionService = $interventionService;
    }

    /**
     * GET /api/shipments/{id}/intervention
     * Get active intervention details for a shipment.
     */
    public function showActive(int $id): JsonResponse
    {
        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $activeData = $this->interventionService->getActiveInterventionForShipment($shipment);

        if (!$activeData) {
            return response()->json([
                'success' => true,
                'message' => 'No active intervention for this shipment.',
                'data' => null,
            ], 200);
        }

        return response()->json([
            'success' => true,
            'data' => $activeData,
        ], 200);
    }

    /**
     * GET /api/shipments/{id}/interventions
     * Get full historical interventions list for a shipment.
     */
    public function history(int $id): JsonResponse
    {
        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $history = $this->interventionService->getInterventionHistoryForShipment($shipment);

        return response()->json([
            'success' => true,
            'data' => $history,
        ], 200);
    }

    /**
     * GET /api/shipments/{id}/alerts
     * Get alerts for a shipment, optionally filtered by recipient_role (MANAGER, DRIVER, RECEIVER).
     */
    public function alerts(Request $request, int $id): JsonResponse
    {
        $shipment = Shipment::find($id);

        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => "Shipment with ID {$id} not found."
            ], 404);
        }

        $query = Alert::where('shipment_id', $shipment->id);

        if ($request->has('role') && !empty($request->query('role'))) {
            $role = strtoupper($request->query('role'));
            $query->where('recipient_role', $role);
        }

        $alerts = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $alerts,
        ], 200);
    }

    /**
     * POST /api/interventions/{id}/acknowledge
     * Acknowledge/mark alerts for an intervention as read.
     */
    public function acknowledge(int $id): JsonResponse
    {
        $intervention = Intervention::find($id);

        if (!$intervention) {
            return response()->json([
                'success' => false,
                'message' => "Intervention with ID {$id} not found."
            ], 404);
        }

        Alert::where('intervention_id', $intervention->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => "Alerts for intervention {$id} acknowledged successfully.",
        ], 200);
    }

    /**
     * POST /api/interventions/{id}/resolve
     * Resolve an active intervention.
     */
    public function resolve(int $id): JsonResponse
    {
        $intervention = Intervention::find($id);

        if (!$intervention) {
            return response()->json([
                'success' => false,
                'message' => "Intervention with ID {$id} not found."
            ], 404);
        }

        $result = $this->interventionService->resolveIntervention($intervention);

        return response()->json($result, 200);
    }
}
