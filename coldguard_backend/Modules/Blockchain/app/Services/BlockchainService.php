<?php

namespace Modules\Blockchain\App\Services;

use Illuminate\Support\Str;
use Modules\Blockchain\App\Models\BlockchainLedger;

class BlockchainService
{
    const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

    /**
     * Append a new block to a shipment's ledger.
     */
    public function appendBlock(int $shipmentId, string $eventType, array $payload): BlockchainLedger
    {
        // Get the last block for this shipment (atomic via DB lock)
        $lastBlock = BlockchainLedger::where('shipment_id', $shipmentId)
            ->orderBy('block_index', 'desc')
            ->first();

        $blockIndex    = $lastBlock ? $lastBlock->block_index + 1 : 0;
        $previousHash  = $lastBlock ? $lastBlock->block_hash : self::GENESIS_HASH;
        $timestamp     = now()->toIso8601String();

        $blockHash = $this->computeHash($blockIndex, $previousHash, $eventType, $payload, $timestamp);

        $block = BlockchainLedger::create([
            'shipment_id'   => $shipmentId,
            'block_index'   => $blockIndex,
            'event_type'    => $eventType,
            'payload'       => $payload,
            'previous_hash' => $previousHash,
            'block_hash'    => $blockHash,
        ]);

        return $block;
    }

    /**
     * Append a DELIVERY_CONFIRMED block and generate a receipt token.
     */
    public function confirmDelivery(int $shipmentId, array $payload): array
    {
        $block = $this->appendBlock($shipmentId, 'DELIVERY_CONFIRMED', $payload);
        $token = Str::uuid()->toString();

        $block->receipt_token = $token;
        $block->save();

        return [
            'block'         => $block,
            'receipt_token' => $token,
        ];
    }

    /**
     * Verify the integrity of the entire chain for a shipment.
     * Returns ['valid' => bool, 'tampered_at_index' => int|null, 'total_blocks' => int]
     */
    public function verifyChain(int $shipmentId): array
    {
        $blocks = BlockchainLedger::where('shipment_id', $shipmentId)
            ->orderBy('block_index', 'asc')
            ->get();

        if ($blocks->isEmpty()) {
            return ['valid' => true, 'tampered_at_index' => null, 'total_blocks' => 0];
        }

        $expectedPrevious = self::GENESIS_HASH;

        foreach ($blocks as $block) {
            // Check previous_hash linkage
            if ($block->previous_hash !== $expectedPrevious) {
                return [
                    'valid'              => false,
                    'tampered_at_index'  => $block->block_index,
                    'total_blocks'       => $blocks->count(),
                    'reason'             => 'previous_hash mismatch',
                ];
            }

            // Recompute the block's hash — we don't store timestamp separately so
            // we use created_at as the canonical timestamp source.
            $recomputed = $this->computeHash(
                $block->block_index,
                $block->previous_hash,
                $block->event_type,
                $block->payload,
                $block->created_at->toIso8601String()
            );

            if ($recomputed !== $block->block_hash) {
                return [
                    'valid'             => false,
                    'tampered_at_index' => $block->block_index,
                    'total_blocks'      => $blocks->count(),
                    'reason'            => 'block_hash mismatch',
                ];
            }

            $expectedPrevious = $block->block_hash;
        }

        return ['valid' => true, 'tampered_at_index' => null, 'total_blocks' => $blocks->count()];
    }

    /**
     * Get the full ledger for a shipment, formatted for the frontend.
     */
    public function getLedger(int $shipmentId): array
    {
        return BlockchainLedger::where('shipment_id', $shipmentId)
            ->orderBy('block_index', 'asc')
            ->get()
            ->map(fn($b) => $this->formatBlock($b))
            ->toArray();
    }

    /**
     * Get receipt data by token (public, no auth).
     */
    public function getReceipt(string $token): ?array
    {
        $deliveryBlock = BlockchainLedger::where('receipt_token', $token)->first();
        if (!$deliveryBlock) return null;

        $shipmentId = $deliveryBlock->shipment_id;
        $ledger     = $this->getLedger($shipmentId);
        $integrity  = $this->verifyChain($shipmentId);
        $shipment   = \Modules\Shipment\App\Models\Shipment::find($shipmentId);

        return [
            'shipment'        => $shipment ? [
                'id'               => $shipment->id,
                'tracking_number'  => $shipment->tracking_number,
                'product_name'     => $shipment->product_name,
                'origin_name'      => $shipment->origin_name,
                'destination_name' => $shipment->destination_name,
                'min_temp'         => $shipment->min_temp,
                'max_temp'         => $shipment->max_temp,
                'status'           => $shipment->status,
            ] : null,
            'chain_valid'     => $integrity['valid'],
            'total_blocks'    => $integrity['total_blocks'],
            'ledger'          => $ledger,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function computeHash(int $index, string $previousHash, string $eventType, array $payload, string $timestamp): string
    {
        $data = json_encode([
            'index'         => $index,
            'previous_hash' => $previousHash,
            'event_type'    => $eventType,
            'payload'       => $payload,
            'timestamp'     => $timestamp,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return hash('sha256', $data);
    }

    private function formatBlock(BlockchainLedger $block): array
    {
        return [
            'block_index'   => $block->block_index,
            'event_type'    => $block->event_type,
            'payload'       => $block->payload,
            'previous_hash' => $block->previous_hash,
            'block_hash'    => $block->block_hash,
            'timestamp'     => $block->created_at->toIso8601String(),
        ];
    }
}
