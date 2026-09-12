<?php

namespace Modules\Intervention\App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Modules\Shipment\App\Models\Shipment;
use Modules\RiskAnalysis\App\Models\RiskEvent;
use Modules\Facility\App\Models\Facility;

class Intervention extends Model
{
    use HasFactory;

    protected $table = 'interventions';

    protected $fillable = [
        'shipment_id',
        'risk_event_id',
        'facility_id',
        'reason',
        'status', // PENDING, ACTIVE, FACILITY_SELECTED, DIVERTED, RESOLVED, CANCELLED
        'severity', // HIGH, CRITICAL
        'risk_score',
        'original_destination_lat',
        'original_destination_lng',
        'resolved_at',
    ];

    protected $casts = [
        'risk_score' => 'float',
        'original_destination_lat' => 'float',
        'original_destination_lng' => 'float',
        'resolved_at' => 'datetime',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class, 'shipment_id');
    }

    public function riskEvent()
    {
        return $this->belongsTo(RiskEvent::class, 'risk_event_id');
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class, 'facility_id');
    }

    public function alerts()
    {
        return $this->hasMany(Alert::class, 'intervention_id');
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', ['PENDING', 'ACTIVE', 'FACILITY_SELECTED', 'DIVERTED']);
    }
}
