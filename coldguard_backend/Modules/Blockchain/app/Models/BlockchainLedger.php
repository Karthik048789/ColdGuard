<?php

namespace Modules\Blockchain\App\Models;

use Illuminate\Database\Eloquent\Model;

class BlockchainLedger extends Model
{
    protected $table = 'blockchain_ledger';

    protected $fillable = [
        'shipment_id',
        'block_index',
        'event_type',
        'payload',
        'previous_hash',
        'block_hash',
        'receipt_token',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    public function shipment()
    {
        return $this->belongsTo(\Modules\Shipment\App\Models\Shipment::class, 'shipment_id');
    }
}
