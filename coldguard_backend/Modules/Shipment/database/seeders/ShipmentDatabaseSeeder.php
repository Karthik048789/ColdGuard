<?php

namespace Modules\Shipment\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Shipment\App\Models\Shipment;

class ShipmentDatabaseSeeder extends Seeder
{
    /**
     * Seed realistic Kerala healthcare shipments.
     */
    public function run(): void
    {
        // 1. Primary Demo Shipment (Kochi -> Thrissur)
        Shipment::updateOrCreate(
            ['tracking_number' => 'CG-2026-VACC-001'],
            [
                'product_name' => 'Measles-Rubella (MR) Vaccine',
                'quantity' => 500,
                'quantity_unit' => 'doses',
                'origin_name' => 'Kochi Medical Cold Hub',
                'origin_lat' => 9.9312,
                'origin_lng' => 76.2673,
                'destination_name' => 'Thrissur District Hospital',
                'destination_lat' => 10.5276,
                'destination_lng' => 76.2144,
                'min_temp' => 2.00,
                'max_temp' => 8.00,
                'shipment_value' => 50000.00,
                'status' => 'IN_TRANSIT',
                'driver_name' => 'Rajesh Kumar',
                'driver_phone' => '+91 9876543211',
                'current_lat' => 10.0150, // Moving along Kochi -> Thrissur NH66
                'current_lng' => 76.2500,
                'current_temp' => 6.10,
                'current_humidity' => 52.00,
                'current_battery' => 88.00,
                'dispatched_at' => now()->subMinutes(45),
            ]
        );

        // 2. Second Active Shipment (Alappuzha -> Ernakulam)
        Shipment::updateOrCreate(
            ['tracking_number' => 'CG-2026-POLIO-002'],
            [
                'product_name' => 'Oral Polio Vaccine (OPV)',
                'quantity' => 1200,
                'quantity_unit' => 'doses',
                'origin_name' => 'Alappuzha General Hospital',
                'origin_lat' => 9.4981,
                'origin_lng' => 76.3388,
                'destination_name' => 'Ernakulam Medical Center',
                'destination_lat' => 9.9816,
                'destination_lng' => 76.2999,
                'min_temp' => 2.00,
                'max_temp' => 8.00,
                'shipment_value' => 85000.00,
                'status' => 'IN_TRANSIT',
                'driver_name' => 'Suresh Nair',
                'driver_phone' => '+91 9876543215',
                'current_lat' => 9.6800,
                'current_lng' => 76.3200,
                'current_temp' => 4.50,
                'current_humidity' => 48.00,
                'current_battery' => 95.00,
                'dispatched_at' => now()->subMinutes(30),
            ]
        );

        // 3. Completed Shipment (Palakkad -> Kozhikode)
        Shipment::updateOrCreate(
            ['tracking_number' => 'CG-2026-INS-003'],
            [
                'product_name' => 'Human Insulin Vials',
                'quantity' => 300,
                'quantity_unit' => 'vials',
                'origin_name' => 'Palakkad Storage Facility',
                'origin_lat' => 10.7867,
                'origin_lng' => 76.6548,
                'destination_name' => 'Kozhikode Medical College',
                'destination_lat' => 11.2588,
                'destination_lng' => 75.7804,
                'min_temp' => 2.00,
                'max_temp' => 8.00,
                'shipment_value' => 120000.00,
                'status' => 'DELIVERED',
                'driver_name' => 'Vijay Menon',
                'driver_phone' => '+91 9876543219',
                'current_lat' => 11.2588,
                'current_lng' => 75.7804,
                'current_temp' => 5.20,
                'current_humidity' => 50.00,
                'current_battery' => 76.00,
                'dispatched_at' => now()->subHours(6),
                'delivered_at' => now()->subMinutes(20),
            ]
        );
    }
}
