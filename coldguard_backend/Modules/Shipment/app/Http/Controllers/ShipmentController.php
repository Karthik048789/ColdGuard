<?php

namespace Modules\Shipment\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Shipment\App\Models\Shipment;
use Modules\Shipment\App\Models\Receiver;
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
            'product_name'    => 'required|string|max:255',
            'quantity'        => 'required|integer|min:1',
            'quantity_unit'   => 'nullable|string|max:50',
            'origin_name'     => 'required|string|max:255',
            'origin_lat'      => 'required|numeric',
            'origin_lng'      => 'required|numeric',
            'destination_name' => 'required|string|max:255',
            'destination_lat' => 'required|numeric',
            'destination_lng' => 'required|numeric',
            'min_temp'        => 'nullable|numeric',
            'max_temp'        => 'nullable|numeric',
            'shipment_value'  => 'required|numeric|min:0',
            'driver_name'     => 'nullable|string|max:255',
            'driver_phone'    => 'nullable|string|max:50',
            'receiver_email'  => 'nullable|email|max:255',
            'receiver_name'   => 'nullable|string|max:255',
        ]);

        if (!empty($validated['driver_name'])) {
            $activeDriverShipment = Shipment::where('driver_name', $validated['driver_name'])
                ->whereNotIn('status', ['DELIVERED', 'COMPROMISED', 'CANCELLED'])
                ->first();

            if ($activeDriverShipment) {
                return response()->json([
                    'success' => false,
                    'message' => "Driver '{$validated['driver_name']}' is currently assigned to active shipment {$activeDriverShipment->tracking_number} (status: {$activeDriverShipment->status}). Only after delivering that shipment can this driver be assigned to a new one.",
                ], 422);
            }
        }

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
            'data'    => ['shipment' => $shipment],
        ], 201);
    }

    /**
     * GET /api/receivers
     * List all predefined receivers for the dispatch form dropdown.
     */
    public function receivers()
    {
        $receivers = Receiver::orderBy('name')->get();
        return response()->json(['success' => true, 'data' => $receivers]);
    }

    /**
     * POST /api/shipments/by-receiver
     * Return all shipments assigned to a specific receiver email.
     * Public endpoint — receiver enters their email to view their shipments.
     */
    public function byReceiver(Request $request)
    {
        $email = $request->input('email');
        if (!$email) {
            return response()->json(['success' => false, 'message' => 'Email is required'], 422);
        }

        $receiver = Receiver::where('email', $email)->first();
        if (!$receiver) {
            return response()->json(['success' => false, 'message' => 'No receiver account found for this email'], 404);
        }

        $shipments = Shipment::where('receiver_email', $email)
            ->orderBy('updated_at', 'desc')
            ->get();

        // For each delivered shipment, fetch its receipt token from blockchain ledger
        $shipmentsWithToken = $shipments->map(function ($s) {
            $data = $s->toArray();
            if ($s->status === 'DELIVERED') {
                $block = \Modules\Blockchain\App\Models\BlockchainLedger::where('shipment_id', $s->id)
                    ->where('event_type', 'DELIVERY_CONFIRMED')
                    ->first();
                $data['receipt_token'] = $block?->receipt_token;
            }
            return $data;
        });

        return response()->json([
            'success'  => true,
            'receiver' => $receiver,
            'data'     => $shipmentsWithToken,
        ]);
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
            'status'       => 'IN_TRANSIT',
            'dispatched_at' => now(),
        ]);

        // ── Blockchain: record journey start ───────────────────────────────────
        try {
            $blockchain = app(\Modules\Blockchain\App\Services\BlockchainService::class);
            $blockchain->appendBlock($shipment->id, 'JOURNEY_STARTED', [
                'tracking_number'  => $shipment->tracking_number,
                'product_name'     => $shipment->product_name,
                'driver_name'      => $shipment->driver_name,
                'origin_name'      => $shipment->origin_name,
                'destination_name' => $shipment->destination_name,
                'dispatched_at'    => now()->toIso8601String(),
                'min_temp'         => $shipment->min_temp,
                'max_temp'         => $shipment->max_temp,
                'origin_lat'       => $shipment->origin_lat,
                'origin_lng'       => $shipment->origin_lng,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Blockchain JOURNEY_STARTED failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Shipment dispatched successfully',
            'data'    => [
                'shipment' => $shipment,
            ]
        ]);
    }

    /**
     * Mark shipment as rerouted to an emergency cold-storage facility.
     */
    public function reroute(Request $request, $id)
    {
        $shipment = Shipment::findOrFail($id);
        $facilityId = $request->input('facility_id');
        $facilityName = $request->input('facility_name');
        $temp = $request->input('temperature', $shipment->current_temp);

        $shipment->update([
            'status' => 'REROUTED',
        ]);

        // ── Blockchain: record REROUTED event ──────────
        try {
            $blockchain = app(\Modules\Blockchain\App\Services\BlockchainService::class);
            $blockchain->appendBlock($shipment->id, 'REROUTED', [
                'tracking_number' => $shipment->tracking_number,
                'facility_id'     => $facilityId,
                'facility_name'   => $facilityName,
                'temperature'     => $temp,
                'reason'          => 'Emergency temperature excursion breach — cold chain stabilized via nearby storage facility',
                'timestamp'       => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Blockchain REROUTED block failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Shipment successfully rerouted',
            'data'    => [
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
            'status'       => 'DELIVERED',
            'delivered_at' => now(),
            'current_lat'  => $shipment->destination_lat,
            'current_lng'  => $shipment->destination_lng,
        ]);

        // Automatically resolve active interventions when delivered
        $activeInterventions = \Modules\Intervention\App\Models\Intervention::where('shipment_id', $shipment->id)
            ->whereIn('status', ['PENDING', 'ACTIVE', 'FACILITY_SELECTED', 'DIVERTED'])
            ->get();

        $interventionService = app(\Modules\Intervention\App\Services\InterventionService::class);
        foreach ($activeInterventions as $inv) {
            $interventionService->resolveIntervention($inv);
        }

        // ── Blockchain: seal delivery record & generate receipt token ──────────
        $receiptToken = null;
        try {
            $blockchain = app(\Modules\Blockchain\App\Services\BlockchainService::class);

            // Check if already confirmed to avoid duplicate blocks
            $alreadyConfirmed = \Modules\Blockchain\App\Models\BlockchainLedger::where('shipment_id', $shipment->id)
                ->where('event_type', 'DELIVERY_CONFIRMED')
                ->first();

            if (!$alreadyConfirmed) {
                $result = $blockchain->confirmDelivery($shipment->id, [
                    'tracking_number'  => $shipment->tracking_number,
                    'product_name'     => $shipment->product_name,
                    'destination_name' => $shipment->destination_name,
                    'confirmed_by'     => 'driver',
                    'confirmed_at'     => now()->toIso8601String(),
                    'final_temp'       => $shipment->current_temp,
                    'final_status'     => 'DELIVERED',
                ]);
                $receiptToken = $result['receipt_token'];
            } else {
                $receiptToken = $alreadyConfirmed->receipt_token;
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Blockchain DELIVERY_CONFIRMED failed: ' . $e->getMessage());
        }

        return response()->json([
            'success'       => true,
            'message'       => 'Shipment delivered successfully',
            'receipt_token' => $receiptToken,
            'data'          => [
                'shipment' => $shipment,
            ]
        ]);
    }
}
