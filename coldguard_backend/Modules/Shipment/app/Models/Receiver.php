<?php

namespace Modules\Shipment\App\Models;

use Illuminate\Database\Eloquent\Model;

class Receiver extends Model
{
    protected $table = 'receivers';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'organization',
        'designation',
    ];

    /**
     * Relationship: Receiver has many Shipments.
     */
    public function shipments()
    {
        return $this->hasMany(Shipment::class, 'receiver_email', 'email');
    }
}
