<?php

namespace Modules\Telemetry\App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Telemetry extends Model
{
    use HasFactory;

    protected $table = 'telemetry';

    protected $fillable = [
        'shipment_id',
        'temperature',
        'humidity',
        'battery',
        'latitude',
        'longitude',
        'recorded_at',
        'is_anomaly',
    ];

    protected $casts = [
        'shipment_id' => 'integer',
        'temperature' => 'float',
        'humidity' => 'float',
        'battery' => 'float',
        'latitude' => 'float',
        'longitude' => 'float',
        'recorded_at' => 'datetime',
        'is_anomaly' => 'boolean',
    ];

    /**
     * Relationship: Telemetry belongs to a Shipment.
     */
    public function shipment()
    {
        return $this->belongsTo(\Modules\Shipment\App\Models\Shipment::class, 'shipment_id');
    }
}
