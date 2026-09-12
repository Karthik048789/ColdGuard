<?php

namespace Modules\Intervention\App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Modules\Shipment\App\Models\Shipment;

class Alert extends Model
{
    use HasFactory;

    protected $table = 'alerts';

    protected $fillable = [
        'shipment_id',
        'intervention_id',
        'recipient_role', // MANAGER, DRIVER, RECEIVER
        'type', // COLD_CHAIN_WARNING, COLD_CHAIN_CRITICAL, DIVERSION_REQUIRED, FACILITY_SELECTED, ROUTE_UPDATED, INTERVENTION_RESOLVED
        'title',
        'message',
        'severity', // LOW, MEDIUM, HIGH, CRITICAL
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class, 'shipment_id');
    }

    public function intervention()
    {
        return $this->belongsTo(Intervention::class, 'intervention_id');
    }

    public function scopeForManager($query)
    {
        return $query->where('recipient_role', 'MANAGER');
    }

    public function scopeForDriver($query)
    {
        return $query->where('recipient_role', 'DRIVER');
    }

    public function scopeForReceiver($query)
    {
        return $query->where('recipient_role', 'RECEIVER');
    }
}
