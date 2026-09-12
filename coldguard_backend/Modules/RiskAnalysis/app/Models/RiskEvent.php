<?php

namespace Modules\RiskAnalysis\App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RiskEvent extends Model
{
    use HasFactory;

    protected $table = 'risk_events';

    protected $fillable = [
        'shipment_id',
        'risk_score',
        'severity',
        'predicted_failure_minutes',
        'reason',
        'recommendation',
    ];

    protected $casts = [
        'shipment_id' => 'integer',
        'risk_score' => 'float',
        'predicted_failure_minutes' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship: RiskEvent belongs to a Shipment.
     */
    public function shipment()
    {
        return $this->belongsTo(\Modules\Shipment\App\Models\Shipment::class, 'shipment_id');
    }
}
