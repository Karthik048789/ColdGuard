<?php

namespace Modules\Facility\App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Facility extends Model
{
    use HasFactory;

    protected $table = 'facilities';

    protected $fillable = [
        'name',
        'latitude',
        'longitude',
        'capacity',
        'available_capacity',
        'min_temperature',
        'max_temperature',
        'cost',
        'status',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'capacity' => 'integer',
        'available_capacity' => 'integer',
        'min_temperature' => 'float',
        'max_temperature' => 'float',
        'cost' => 'float',
    ];
}
