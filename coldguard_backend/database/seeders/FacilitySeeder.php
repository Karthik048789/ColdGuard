<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Facility\App\Models\Facility;

class FacilitySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $facilities = [
            [
                'name' => 'ColdGuard Kakkanad Storage B (Demo)',
                'latitude' => 10.0250,
                'longitude' => 76.3500,
                'capacity' => 1500,
                'available_capacity' => 1200,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 650.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'ColdGuard Kochi Central Vault (Demo)',
                'latitude' => 9.9816,
                'longitude' => 76.2999,
                'capacity' => 2000,
                'available_capacity' => 1500,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 500.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Aluva Med-Hub Emergency Cold Store (Demo)',
                'latitude' => 10.1004,
                'longitude' => 76.3570,
                'capacity' => 1500,
                'available_capacity' => 1200,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 450.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Kalamassery Biotech Wide-Range Storage (Demo)',
                'latitude' => 10.0538,
                'longitude' => 76.3215,
                'capacity' => 1000,
                'available_capacity' => 800,
                'min_temperature' => 0.0,
                'max_temperature' => 10.0,
                'cost' => 600.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Angamaly Deep Freeze Cryo Depot (Demo)',
                'latitude' => 10.1960,
                'longitude' => 76.3860,
                'capacity' => 3000,
                'available_capacity' => 2500,
                'min_temperature' => -20.0,
                'max_temperature' => -10.0,
                'cost' => 1200.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Kottayam Incompatible Warm Storage (Demo)',
                'latitude' => 9.5916,
                'longitude' => 76.5222,
                'capacity' => 800,
                'available_capacity' => 600,
                'min_temperature' => 5.0,
                'max_temperature' => 15.0,
                'cost' => 400.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Vytilla Low Capacity Hub (Demo)',
                'latitude' => 9.9667,
                'longitude' => 76.3167,
                'capacity' => 500,
                'available_capacity' => 100,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 700.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Thrissur Emergency Standby (Offline Demo)',
                'latitude' => 10.5276,
                'longitude' => 76.2144,
                'capacity' => 1200,
                'available_capacity' => 1000,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 550.00,
                'status' => 'UNAVAILABLE',
            ],
            [
                'name' => 'Cherthala Pharma Emergency Depot (Demo)',
                'latitude' => 9.6845,
                'longitude' => 76.3315,
                'capacity' => 1000,
                'available_capacity' => 750,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 480.00,
                'status' => 'AVAILABLE',
            ],
            [
                'name' => 'Perumbavoor Cold Reserve Vault (Demo)',
                'latitude' => 10.1147,
                'longitude' => 76.4789,
                'capacity' => 600,
                'available_capacity' => 450,
                'min_temperature' => 2.0,
                'max_temperature' => 8.0,
                'cost' => 520.00,
                'status' => 'AVAILABLE',
            ],
        ];

        foreach ($facilities as $facility) {
            Facility::updateOrCreate(
                ['name' => $facility['name']],
                $facility
            );
        }
    }
}
