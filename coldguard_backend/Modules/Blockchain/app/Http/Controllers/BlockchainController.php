<?php

namespace Modules\Blockchain\App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Blockchain\App\Services\BlockchainService;
use Modules\Shipment\App\Models\Shipment;

class BlockchainController extends Controller
{
    public function __construct(private BlockchainService $blockchain) {}

    /**
     * GET /api/blockchain/{shipment_id}/logs
     * Full ledger for a shipment (manager view, requires auth).
     */
    public function logs($shipmentId)
    {
        $shipment = Shipment::find($shipmentId);
        if (!$shipment) {
            return response()->json(['success' => false, 'message' => 'Shipment not found'], 404);
        }

        $ledger    = $this->blockchain->getLedger($shipmentId);
        $integrity = $this->blockchain->verifyChain($shipmentId);

        return response()->json([
            'success'      => true,
            'chain_valid'  => $integrity['valid'],
            'total_blocks' => $integrity['total_blocks'],
            'ledger'       => $ledger,
        ]);
    }

    /**
     * GET /api/blockchain/{shipment_id}/verify
     * Verify chain integrity (manager use).
     */
    public function verify($shipmentId)
    {
        $integrity = $this->blockchain->verifyChain((int) $shipmentId);

        return response()->json([
            'success'           => true,
            'chain_valid'       => $integrity['valid'],
            'total_blocks'      => $integrity['total_blocks'],
            'tampered_at_index' => $integrity['tampered_at_index'] ?? null,
        ]);
    }

    /**
     * POST /api/blockchain/{shipment_id}/confirm-delivery
     * Driver/Manager confirms delivery. Appends DELIVERY_CONFIRMED block.
     * Returns a receipt_token for QR code generation.
     */
    public function confirmDelivery(Request $request, $shipmentId)
    {
        $shipment = Shipment::find($shipmentId);
        if (!$shipment) {
            return response()->json(['success' => false, 'message' => 'Shipment not found'], 404);
        }

        // Check if already confirmed
        $existing = \Modules\Blockchain\App\Models\BlockchainLedger::where('shipment_id', $shipmentId)
            ->where('event_type', 'DELIVERY_CONFIRMED')
            ->first();

        if ($existing) {
            return response()->json([
                'success'       => true,
                'message'       => 'Delivery already confirmed',
                'receipt_token' => $existing->receipt_token,
            ]);
        }

        $payload = [
            'confirmed_by'    => $request->input('confirmed_by', 'manager'),
            'confirmed_at'    => now()->toIso8601String(),
            'destination_name' => $shipment->destination_name,
            'tracking_number' => $shipment->tracking_number,
            'product_name'    => $shipment->product_name,
            'final_temp'      => $shipment->current_temp,
            'final_status'    => $shipment->status,
        ];

        $result = $this->blockchain->confirmDelivery((int) $shipmentId, $payload);

        // Mark shipment as delivered
        $shipment->update([
            'status'       => 'DELIVERED',
            'delivered_at' => now(),
        ]);

        return response()->json([
            'success'       => true,
            'message'       => 'Delivery confirmed and blockchain log sealed',
            'receipt_token' => $result['receipt_token'],
        ]);
    }

    /**
     * GET /api/blockchain/receipt/{token}
     * PUBLIC — no auth. Used by receiver scanning the QR code.
     */
    public function receipt($token)
    {
        $data = $this->blockchain->getReceipt($token);

        if (!$data) {
            return response()->json(['success' => false, 'message' => 'Invalid or expired receipt token'], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }
}
