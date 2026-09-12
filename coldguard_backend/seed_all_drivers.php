<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Modules\Shipment\App\Models\Shipment;
use Modules\Telemetry\App\Models\Telemetry;

// 1. Ensure/Update 3 Drivers
$drivers = [
    [
        'email' => 'driver@coldguard.ai',
        'name' => 'Rajesh Kumar',
        'phone' => '+91 98765 43211',
        'password' => bcrypt('password123'),
        'role' => 'driver',
    ],
    [
        'email' => 'suresh@coldguard.ai',
        'name' => 'Suresh Nair',
        'phone' => '+91 98470 12345',
        'password' => bcrypt('password123'),
        'role' => 'driver',
    ],
    [
        'email' => 'manoj@coldguard.ai',
        'name' => 'Manoj Varma',
        'phone' => '+91 98950 67890',
        'password' => bcrypt('password123'),
        'role' => 'driver',
    ],
];

foreach ($drivers as $d) {
    $u = User::where('email', $d['email'])->first();
    if (!$u) {
        $u = new User();
        $u->email = $d['email'];
    }
    $u->name = $d['name'];
    $u->password = $d['password'];
    $u->role = $d['role'];
    $u->phone = $d['phone'];
    $u->save();
    echo "Driver: " . $u->name . " (" . $u->email . ") saved\n";
}

// 2. Ensure active shipments for each driver
// Driver 1: Rajesh Kumar -> Shipment #9
$s1 = Shipment::where('driver_name', 'Rajesh Kumar')->where('status', 'IN_TRANSIT')->first();
if (!$s1) {
    $s1 = Shipment::find(9);
    if ($s1) {
        $s1->status = 'IN_TRANSIT';
        $s1->driver_name = 'Rajesh Kumar';
        $s1->driver_phone = '+91 98765 43211';
        $s1->save();
    }
}
echo "Rajesh Shipment: ID " . ($s1 ? $s1->id : 'none') . "\n";

// Driver 2: Suresh Nair -> Shipment
$s2 = Shipment::where('driver_name', 'Suresh Nair')->where('status', 'IN_TRANSIT')->first();
if (!$s2) {
    $s2 = Shipment::create([
        'tracking_number' => 'CG-2026-GOA-002',
        'product_name' => 'Polio & Rotavirus Vaccine Consignment',
        'quantity' => 280,
        'quantity_unit' => 'vials',
        'origin_name' => 'Sub District Hospital, Ponda, Goa',
        'origin_lat' => 15.4026,
        'origin_lng' => 74.0152,
        'destination_name' => 'North Goa District Hospital, Mapusa, Goa',
        'destination_lat' => 15.5925,
        'destination_lng' => 73.8166,
        'min_temp' => 2.0,
        'max_temp' => 8.0,
        'shipment_value' => 380000.0,
        'status' => 'IN_TRANSIT',
        'driver_name' => 'Suresh Nair',
        'driver_phone' => '+91 98470 12345',
        'current_lat' => 15.4200,
        'current_lng' => 73.9800,
        'current_temp' => 4.2,
        'current_humidity' => 64.0,
        'current_battery' => 91.0,
        'dispatched_at' => now(),
    ]);
    
    Telemetry::create([
        'shipment_id' => $s2->id,
        'temperature' => 4.2,
        'humidity' => 64.0,
        'battery' => 91.0,
        'latitude' => 15.4200,
        'longitude' => 73.9800,
        'recorded_at' => now(),
    ]);
}
echo "Suresh Shipment: ID " . $s2->id . "\n";

// Driver 3: Manoj Varma -> Shipment
$s3 = Shipment::where('driver_name', 'Manoj Varma')->where('status', 'IN_TRANSIT')->first();
if (!$s3) {
    $s3 = Shipment::create([
        'tracking_number' => 'CG-2026-GOA-003',
        'product_name' => 'Cold-Chain Insulin & Blood Plasma Consignment',
        'quantity' => 190,
        'quantity_unit' => 'units',
        'origin_name' => 'Goa Medical College (GMC) Central Vault, Bambolim',
        'origin_lat' => 15.4647,
        'origin_lng' => 73.8560,
        'destination_name' => 'Sub District Hospital, Chicalim, Vasco da Gama, Goa',
        'destination_lat' => 15.3942,
        'destination_lng' => 73.8406,
        'min_temp' => 2.0,
        'max_temp' => 8.0,
        'shipment_value' => 520000.0,
        'status' => 'IN_TRANSIT',
        'driver_name' => 'Manoj Varma',
        'driver_phone' => '+91 98950 67890',
        'current_lat' => 15.4500,
        'current_lng' => 73.8580,
        'current_temp' => 3.8,
        'current_humidity' => 62.0,
        'current_battery' => 95.0,
        'dispatched_at' => now(),
    ]);
    
    Telemetry::create([
        'shipment_id' => $s3->id,
        'temperature' => 3.8,
        'humidity' => 62.0,
        'battery' => 95.0,
        'latitude' => 15.4500,
        'longitude' => 73.8580,
        'recorded_at' => now(),
    ]);
}
echo "Manoj Shipment: ID " . $s3->id . "\n";
