<?php

namespace Modules\Shipment\App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    use HasFactory;

    protected $table = 'shipments';

    protected $fillable = [
        'tracking_number',
        'product_name',
        'quantity',
        'quantity_unit',
        'origin_name',
        'origin_lat',
        'origin_lng',
        'destination_name',
        'destination_lat',
        'destination_lng',
        'min_temp',
        'max_temp',
        'shipment_value',
        'status', // CREATED, IN_TRANSIT, WARNING, CRITICAL, REROUTED, AT_COLD_STORAGE, DELIVERED, COMPROMISED
        'driver_name',
        'driver_phone',
        'current_lat',
        'current_lng',
        'current_temp',
        'current_humidity',
        'current_battery',
        'dispatched_at',
        'delivered_at',
    ];

    protected $casts = [
        'origin_lat' => 'float',
        'origin_lng' => 'float',
        'destination_lat' => 'float',
        'destination_lng' => 'float',
        'current_lat' => 'float',
        'current_lng' => 'float',
        'min_temp' => 'float',
        'max_temp' => 'float',
        'current_temp' => 'float',
        'current_humidity' => 'float',
        'current_battery' => 'float',
        'shipment_value' => 'float',
        'dispatched_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    /**
     * Relationship: Shipment has many Telemetry readings.
     */
    public function telemetry()
    {
        return $this->hasMany(\Modules\Telemetry\App\Models\Telemetry::class, 'shipment_id');
    }

    /**
     * Relationship: Shipment has many RiskEvents.
     */
    public function riskEvents()
    {
        return $this->hasMany(\Modules\RiskAnalysis\App\Models\RiskEvent::class, 'shipment_id');
    }
}
