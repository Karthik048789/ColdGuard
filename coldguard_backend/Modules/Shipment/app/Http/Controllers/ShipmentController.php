<?php

namespace Modules\Shipment\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Shipment\App\Models\Shipment;
use Illuminate\Support\Str;

class ShipmentController extends Controller
{
    /**
     * Display a listing of shipments along with summary dashboard statistics.
     */
    public function index(Request $request)
    {
        $query = Shipment::query();

        if ($request->has('status') && !empty($request->status)) {
            $query->where('status', $request->status);
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                  ->orWhere('product_name', 'like', "%{$search}%")
                  ->orWhere('origin_name', 'like', "%{$search}%")
                  ->orWhere('destination_name', 'like', "%{$search}%");
            });
        }

        $shipments = $query->orderBy('updated_at', 'desc')->get();

        // Calculate Manager Dashboard Statistics
        $totalShipments = Shipment::count();
        $activeShipments = Shipment::whereIn('status', ['CREATED', 'IN_TRANSIT', 'REROUTED', 'AT_COLD_STORAGE'])->count();
        $atRiskShipments = Shipment::whereIn('status', ['WARNING', 'CRITICAL'])->count();
        $deliveredShipments = Shipment::where('status', 'DELIVERED')->count();
        $totalValueProtected = Shipment::where('status', '!=', 'COMPROMISED')->sum('shipment_value');

        return response()->json([
            'success' => true,
            'data' => [
                'statistics' => [
                    'total_shipments' => $totalShipments,
                    'active_shipments' => $activeShipments,
                    'at_risk_shipments' => $atRiskShipments,
                    'delivered_shipments' => $deliveredShipments,
                    'total_value_protected_inr' => (float) $totalValueProtected,
                ],
                'shipments' => $shipments,
            ]
        ]);
    }

    /**
     * Store a newly created healthcare shipment.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'tracking_number' => 'nullable|string|unique:shipments,tracking_number',
            'product_name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
            'quantity_unit' => 'nullable|string|max:50',
            'origin_name' => 'required|string|max:255',
            'origin_lat' => 'required|numeric',
            'origin_lng' => 'required|numeric',
            'destination_name' => 'required|string|max:255',
            'destination_lat' => 'required|numeric',
            'destination_lng' => 'required|numeric',
            'min_temp' => 'nullable|numeric',
            'max_temp' => 'nullable|numeric',
            'shipment_value' => 'required|numeric|min:0',
            'driver_name' => 'nullable|string|max:255',
            'driver_phone' => 'nullable|string|max:50',
        ]);

        if (empty($validated['tracking_number'])) {
            $validated['tracking_number'] = 'CG-2026-' . strtoupper(Str::random(6));
        }

        $validated['status'] = 'CREATED';
        $validated['current_lat'] = $validated['origin_lat'];
        $validated['current_lng'] = $validated['origin_lng'];
        $validated['current_temp'] = $validated['min_temp'] ?? 2.0;

        $shipment = Shipment::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Shipment created successfully',
            'data' => [
                'shipment' => $shipment,
            ]
        ], 201);
    }

    /**
     * Display details of a specific shipment.
     */
    public function show($id)
    {
        $shipment = Shipment::where('id', $id)
            ->orWhere('tracking_number', $id)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'shipment' => $shipment,
            ]
        ]);
    }

    /**
     * Start/dispatch shipment.
     */
    public function start($id)
    {
        $shipment = Shipment::findOrFail($id);
        $shipment->update([
            'status' => 'IN_TRANSIT',
            'dispatched_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Shipment dispatched successfully',
            'data' => [
                'shipment' => $shipment,
            ]
        ]);
    }

    /**
     * Mark shipment as delivered.
     */
    public function deliver($id)
    {
        $shipment = Shipment::findOrFail($id);
        $shipment->update([
            'status' => 'DELIVERED',
            'delivered_at' => now(),
            'current_lat' => $shipment->destination_lat,
            'current_lng' => $shipment->destination_lng,
        ]);

        // Automatically resolve active interventions when delivered
        $activeInterventions = \Modules\Intervention\App\Models\Intervention::where('shipment_id', $shipment->id)
            ->whereIn('status', ['PENDING', 'ACTIVE', 'FACILITY_SELECTED', 'DIVERTED'])
            ->get();

        $interventionService = app(\Modules\Intervention\App\Services\InterventionService::class);
        foreach ($activeInterventions as $inv) {
            $interventionService->resolveIntervention($inv);
        }

        return response()->json([
            'success' => true,
            'message' => 'Shipment delivered successfully',
            'data' => [
                'shipment' => $shipment,
            ]
        ]);
    }
}
